const TOKENIZED_STOCKS_API = "https://api.coinbase.com/v1/tokenized-stocks";
// The token list changes rarely (new listings only), so cache it for a day.
const TOKEN_LIST_REVALIDATE = 86400;
const DEX_SCREENER = "https://api.dexscreener.com/token-pairs/v1/base";
const COINBASE_IMAGE =
  /^https:\/\/metadata\.coinbase\.com\/equity_icons\/([a-f0-9]{64})\.png$/;

type TokenizedStock = {
  contract_address: string;
  symbol: string;
  name: string;
  icon_url: string;
};

type TokenizedStocksResponse = {
  tokens: TokenizedStock[];
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

function stockImageUrl(iconUrl: string) {
  const image = iconUrl.match(COINBASE_IMAGE);
  return image ? `/api/stock-icon/${image[1]}` : undefined;
}

async function getTokenizedStocks() {
  const response = await fetch(TOKENIZED_STOCKS_API, {
    next: { revalidate: TOKEN_LIST_REVALIDATE },
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Tokenized stock list request failed (${response.status})`);

  const { tokens } = (await response.json()) as TokenizedStocksResponse;
  if (!Array.isArray(tokens) || !tokens.length) {
    throw new Error("The tokenized stock list is empty");
  }
  return tokens;
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

async function getStock(token: TokenizedStock): Promise<Stock> {
  const address = token.contract_address;
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

  return {
    address,
    symbol: token.symbol,
    name: token.name,
    imageUrl: stockImageUrl(token.icon_url),
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
  const tokens = await getTokenizedStocks();
  const stocks = await Promise.all(tokens.map(getStock));

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
