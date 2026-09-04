"use client";

import { useMemo, useState } from "react";
import type { Stock, StocksData } from "../lib/stocks";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function compact(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function Change({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={positive ? "change positive" : "change negative"}>
      <span aria-hidden>{positive ? "↗" : "↘"}</span> {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function StockMark({ stock }: { stock: Stock }) {
  if (stock.imageUrl) {
    // These small local SVG marks do not benefit from image optimization.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="stock-mark" src={stock.imageUrl} alt="" />;
  }
  return <span className="stock-mark stock-fallback">{stock.symbol.slice(0, 2)}</span>;
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 12.5 12 4m-6.5 0H12v6.5" />
    </svg>
  );
}

export function MarketDashboard({ data }: { data: StocksData }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("volume");
  const [selected, setSelected] = useState<Stock | null>(null);

  const totals = useMemo(() => {
    const pools = new Map(
      data.stocks.flatMap((stock) => stock.pools.map((pool) => [pool.address, pool] as const)),
    );
    return {
      marketCap: data.stocks.reduce((sum, stock) => sum + stock.marketCap, 0),
      volume: [...pools.values()].reduce((sum, pool) => sum + pool.volume24h, 0),
      liquidity: [...pools.values()].reduce((sum, pool) => sum + pool.liquidity, 0),
      pools: pools.size,
    };
  }, [data.stocks]);

  const stocks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.stocks
      .filter(
        (stock) =>
          !needle ||
          stock.symbol.toLowerCase().includes(needle) ||
          stock.name.toLowerCase().includes(needle),
      )
      .toSorted((a, b) => {
        if (sort === "marketCap") return b.marketCap - a.marketCap;
        if (sort === "change") return b.change24h - a.change24h;
        if (sort === "liquidity") return b.liquidity - a.liquidity;
        return b.volume24h - a.volume24h;
      });
  }, [data.stocks, query, sort]);

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Based Stonks home">
          <span className="base-mark" />
          <span>based stonks</span>
        </a>
        <a className="header-action" href="https://base.org/stocks" target="_blank" rel="noreferrer">
          Base stocks <ArrowIcon />
        </a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="eyebrow"><span className="live-dot" /> Live on Base</div>
          <h1>The onchain stock market.</h1>
          <p>Track every Coinbase Tokenized Stock across Base liquidity venues—always on, always transparent.</p>
          <a className="hero-link" href="#market">Explore the market <span>↓</span></a>
          <div className="hero-details">
            <p>Backed 1:1 by real shares. Issued natively on Base.</p>
            <a href="https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base" target="_blank" rel="noreferrer">Learn how they work <ArrowIcon /></a>
          </div>
          <div className="hero-block" aria-hidden>
            <span>24</span><span>/</span><span>7</span>
          </div>
        </section>

        <section className="market-section" id="market" aria-label="Market overview">
          <div className="market-heading">
            <div>
              <div className="section-label">Live markets</div>
              <h2>Markets</h2>
            </div>
            <p>Live prices and liquidity aggregated across onchain pools.</p>
          </div>

          <div className="stats-grid">
            <article><span>Total market cap</span><strong>{compact(totals.marketCap)}</strong><small>{data.stocks.length} active assets</small></article>
            <article><span>24h volume</span><strong>{compact(totals.volume)}</strong><small>All indexed pools</small></article>
            <article><span>DEX liquidity</span><strong>{compact(totals.liquidity)}</strong><small>{totals.pools} active markets</small></article>
            <article><span>Network</span><strong className="network"><i /> Base</strong><small>Chain ID 8453</small></article>
          </div>

          <div className="market-tools">
            <label className="search">
              <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stocks" />
            </label>
            <label className="sort-control">
              <span>Sort by</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="volume">Volume</option>
                <option value="marketCap">Market cap</option>
                <option value="change">24h change</option>
                <option value="liquidity">Liquidity</option>
              </select>
            </label>
          </div>

          <div className="market-table-wrap">
            <table className="market-table">
              <thead><tr><th>Asset</th><th>Price</th><th>24h</th><th>Market cap</th><th>24h volume</th><th>Liquidity</th><th><span className="sr-only">Open</span></th></tr></thead>
              <tbody>
                {stocks.map((stock) => (
                  <tr key={stock.address} onClick={() => setSelected(stock)}>
                    <td><div className="asset-cell"><StockMark stock={stock} /><span><strong>{stock.symbol}</strong><small>{stock.name}</small></span></div></td>
                    <td className="number">{usd.format(stock.price)}</td>
                    <td><Change value={stock.change24h} /></td>
                    <td className="number">{stock.marketCap ? compact(stock.marketCap) : "—"}</td>
                    <td className="number">{compact(stock.volume24h)}</td>
                    <td className="number">{compact(stock.liquidity)}</td>
                    <td><button className="row-action" aria-label={`View ${stock.symbol} pools`}><ArrowIcon /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!stocks.length && <div className="empty-state">No stocks match “{query}”.</div>}
          </div>
          <div className="data-note"><span><i /> Updated {new Date(data.updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</span><span>Market data by DEX Screener · Assets verified by Base</span></div>
        </section>
      </main>

      {selected && (
        <div className="drawer-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <aside className="pool-drawer" role="dialog" aria-modal="true" aria-label={`${selected.symbol} liquidity pools`} onClick={(event) => event.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            <div className="drawer-asset"><StockMark stock={selected} /><div><span>{selected.name}</span><h2>{selected.symbol}</h2></div></div>
            <div className="drawer-price"><strong>{usd.format(selected.price)}</strong><Change value={selected.change24h} /></div>
            <div className="drawer-stats"><div><span>24h volume</span><strong>{compact(selected.volume24h)}</strong></div><div><span>Liquidity</span><strong>{compact(selected.liquidity)}</strong></div></div>
            <div className="pool-heading"><h3>Liquidity pools</h3><span>{selected.pools.length} markets</span></div>
            <div className="pool-list">
              {selected.pools.map((pool) => (
                <a href={pool.url} target="_blank" rel="noreferrer" key={pool.address}>
                  <div><strong>{pool.pair}</strong><span>{pool.dex}</span></div>
                  <div><strong>{compact(pool.liquidity)}</strong><span>{compact(pool.volume24h)} vol.</span></div>
                  <ArrowIcon />
                </a>
              ))}
            </div>
            <a className="contract-link" href={`https://basescan.org/token/${selected.address}`} target="_blank" rel="noreferrer">View verified contract <ArrowIcon /></a>
          </aside>
        </div>
      )}
    </>
  );
}
