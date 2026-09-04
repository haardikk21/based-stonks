# based stonks

Live market intelligence for Coinbase Tokenized Stocks on Base. The dashboard tracks price, market cap, 24-hour volume, liquidity, and individual onchain pools.

## Data

- The official asset list is discovered from the [Base tokenized stocks documentation](https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base).
- Market and pool data comes from the [DEX Screener API](https://docs.dexscreener.com/api/reference).
- Company marks are stored locally so pool metadata cannot substitute an unrelated token's image.
- Assets without active price, market cap, volume, and liquidity data are hidden.

Upstream responses are cached for one minute, while the official asset list is refreshed every five minutes.

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
