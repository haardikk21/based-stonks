import { unstable_cache } from "next/cache";

const BASE_STOCKS_DOCS =
  "https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base.md";
const DEX_SCREENER = "https://api.dexscreener.com/token-pairs/v1/base";
const BASE_RPC = "https://mainnet.base.org";
const CONTRACT_URI_SELECTOR = "0xe8a3d485";
const JSON_DATA_URI = "data:application/json;base64,";
const COINBASE_IMAGE =
  /^https:\/\/metadata\.coinbase\.com\/equity_icons\/([a-f0-9]{64})\.png$/;

type ContractMetadata = {
  name: string;
  symbol: string;
  image: string;
};

type RpcResponse = {
  id: number;
  result?: string;
  error?: { message?: string };
};

type DexPair = {
  pairAddress: string;
  dexId: string;
  url: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative?: string;
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
};

export type StockPool = {
  address: string;
  dex: string;
  pair: string;
  liquidity: number;
  volume24h: number;
  url: string;
};

export type Stock = {
  address: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  price: number;
  change24h: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  pools: StockPool[];
};

export type StocksData = {
  stocks: Stock[];
  updatedAt: string;
};

function parseOfficialContracts(markdown: string) {
  const section = markdown.split("## Contract addresses")[1]?.split("## Additional resources")[0];
  if (!section) return [];

  return [...section.matchAll(/^\|\s*([A-Z]+c)\s*\|\s*`(0x[a-fA-F0-9]{40})`\s*\|/gm)].map(
    ([, symbol, address]) => ({ symbol, address }),
  );
}

function decodeAbiString(value: string) {
  const encoded = Buffer.from(value.slice(2), "hex");
  if (encoded.length < 64) throw new Error("Invalid contractURI response");

  const offset = Number(encoded.readBigUInt64BE(24));
  if (offset + 32 > encoded.length) throw new Error("Invalid contractURI offset");

  const length = Number(encoded.readBigUInt64BE(offset + 24));
  const start = offset + 32;
  if (start + length > encoded.length) throw new Error("Invalid contractURI length");

  return encoded.subarray(start, start + length).toString("utf8");
}

function parseContractMetadata(value: string): ContractMetadata {
  const uri = decodeAbiString(value);
  if (!uri.startsWith(JSON_DATA_URI)) throw new Error("Unsupported contractURI format");

  const metadata = JSON.parse(
    Buffer.from(uri.slice(JSON_DATA_URI.length), "base64").toString("utf8"),
  ) as Partial<ContractMetadata>;

  if (
    typeof metadata.name !== "string" ||
    typeof metadata.symbol !== "string" ||
    typeof metadata.image !== "string"
  ) {
    throw new Error("Invalid contractURI metadata");
  }

  return metadata as ContractMetadata;
}

function stockImageUrl(imageUrl: string) {
  const image = imageUrl.match(COINBASE_IMAGE);
  if (!image) throw new Error("Unsupported contractURI image");
  return `/api/stock-icon/${image[1]}`;
}

async function readContractMetadata(contracts: { address: string }[]) {
  const calls = contracts.map(({ address }, id) => ({
    jsonrpc: "2.0",
    id,
    method: "eth_call",
    params: [{ to: address, data: CONTRACT_URI_SELECTOR }, "latest"],
  }));
  const metadata: ContractMetadata[] = [];

  for (const [index, call] of calls.entries()) {
    let error = "Contract metadata request failed";

    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(BASE_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(call),
        cache: "no-store",
      });
      if (!response.ok) {
        error = `Contract metadata request failed (${response.status})`;
      } else {
        const result = (await response.json()) as RpcResponse;
        if (result.result) {
          metadata.push(parseContractMetadata(result.result));
          break;
        }
        error = result.error?.message || error;
      }

      if (attempt === 2) throw new Error(error);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (index < calls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return metadata;
}

const getContractMetadata = unstable_cache(
  readContractMetadata,
  ["stock-contract-metadata"],
  { revalidate: 2592000 },
);

function tokenPrice(pair: DexPair, address: string) {
  const usd = Number(pair.priceUsd ?? 0);
  if (pair.baseToken.address.toLowerCase() === address.toLowerCase()) return usd;
  const native = Number(pair.priceNative ?? 0);
  return native > 0 ? usd / native : 0;
}

function titleCaseDex(dex: string) {
  if (dex === "aerodrome") return "Aerodrome";
  if (dex === "uniswap") return "Uniswap";
  return dex.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function getStock(
  symbol: string,
  address: string,
  metadata: ContractMetadata,
): Promise<Stock> {
  const response = await fetch(`${DEX_SCREENER}/${address}`, {
    next: { revalidate: 60 },
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Market data request failed (${response.status})`);

  const pairs = (await response.json()) as DexPair[];
  // DEX Screener also returns unrelated meme tokens that use a stock as their
  // quote asset. Those pools do not represent markets for the stock and can
  // otherwise become the primary pair when they have more liquidity.
  const relevant = pairs.filter(
    (pair) => pair.baseToken.address.toLowerCase() === address.toLowerCase(),
  );
  const primary = [...relevant].sort(
    (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
  )[0];
  const token = primary?.baseToken;

  return {
    address,
    symbol: metadata.symbol || token?.symbol || symbol,
    name: metadata.name || token?.name || symbol.replace(/c$/, ""),
    imageUrl: stockImageUrl(metadata.image),
    price: primary ? tokenPrice(primary, address) : 0,
    change24h: primary?.priceChange?.h24 ?? 0,
    marketCap: primary?.marketCap ?? primary?.fdv ?? 0,
    liquidity: relevant.reduce((sum, pair) => sum + (pair.liquidity?.usd ?? 0), 0),
    volume24h: relevant.reduce((sum, pair) => sum + (pair.volume?.h24 ?? 0), 0),
    pools: relevant
      .map((pair) => ({
        address: pair.pairAddress,
        dex: titleCaseDex(pair.dexId),
        pair: `${pair.baseToken.symbol} / ${pair.quoteToken.symbol}`,
        liquidity: pair.liquidity?.usd ?? 0,
        volume24h: pair.volume?.h24 ?? 0,
        url: pair.url,
      }))
      .sort((a, b) => b.liquidity - a.liquidity),
  };
}

export async function getStocksData(): Promise<StocksData> {
  const response = await fetch(BASE_STOCKS_DOCS, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`Official stock list request failed (${response.status})`);

  const contracts = parseOfficialContracts(await response.text());
  if (!contracts.length) throw new Error("The official stock list could not be read");

  const metadata = await getContractMetadata(contracts);

  const stocks = await Promise.all(
    contracts.map(({ symbol, address }, index) => getStock(symbol, address, metadata[index])),
  );

  return {
    stocks: stocks
      .filter(
        (stock) =>
          stock.price > 0 &&
          stock.marketCap > 0 &&
          stock.volume24h > 0 &&
          stock.liquidity > 0,
      )
      .sort((a, b) => b.volume24h - a.volume24h),
    updatedAt: new Date().toISOString(),
  };
}
