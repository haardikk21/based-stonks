# based stonks

Live market intelligence for Coinbase Tokenized Stocks on Base. The dashboard tracks price, market cap, 24-hour volume, liquidity, and individual onchain pools.

## Data

- The official asset list is discovered from the [Base tokenized stocks documentation](https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base).
- Market and pool data comes from the [DEX Screener API](https://docs.dexscreener.com/api/reference).
- Asset names, symbols, and images come from each token's onchain `contractURI()` metadata.
- Assets without active price, market cap, volume, and liquidity data are hidden.

Market responses are cached for one minute, the official asset list for five minutes, and onchain metadata for 30 days.

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
