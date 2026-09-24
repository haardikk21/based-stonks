# based stonks

Live market intelligence for Coinbase Tokenized Stocks on Base. The dashboard tracks price, market cap, 24-hour volume, liquidity, and individual onchain pools.

## Data

- The official asset list, including names, symbols, and icons, comes from the Coinbase tokenized stocks API (`https://api.coinbase.com/v1/tokenized-stocks`).
- Market and pool data comes from the [DEX Screener API](https://docs.dexscreener.com/api/reference).
- Assets without active price, market cap, volume, and liquidity data are hidden.

Market responses are cached for one minute and the official asset list for 24 hours.

## Development

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
bun run lint
bun run build
```
