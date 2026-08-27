const BASE_STOCKS_DOCS =
  "https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base.md";
const DEX_SCREENER = "https://api.dexscreener.com/token-pairs/v1/base";

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
  info?: { imageUrl?: string };
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

async function getStock(symbol: string, address: string): Promise<Stock> {
  const response = await fetch(`${DEX_SCREENER}/${address}`, {
    next: { revalidate: 60 },
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Market data request failed (${response.status})`);

  const pairs = (await response.json()) as DexPair[];
  const relevant = pairs.filter(
    (pair) =>
      pair.baseToken.address.toLowerCase() === address.toLowerCase() ||
      pair.quoteToken.address.toLowerCase() === address.toLowerCase(),
  );
  const primary = [...relevant].sort(
    (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
  )[0];
  const token =
    primary?.baseToken.address.toLowerCase() === address.toLowerCase()
      ? primary.baseToken
      : primary?.quoteToken;

  return {
    address,
    symbol: token?.symbol || symbol,
    name: token?.name || symbol.replace(/c$/, ""),
    imageUrl: relevant.find((pair) => pair.info?.imageUrl)?.info?.imageUrl,
    price: primary ? tokenPrice(primary, address) : 0,
    change24h: primary?.priceChange?.h24 ?? 0,
    marketCap:
      primary?.baseToken.address.toLowerCase() === address.toLowerCase()
        ? (primary.marketCap ?? primary.fdv ?? 0)
        : 0,
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

  const stocks = await Promise.all(
    contracts.map(({ symbol, address }) => getStock(symbol, address)),
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
