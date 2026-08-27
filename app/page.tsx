import Link from "next/link";
import { MarketDashboard } from "./components/market-dashboard";
import { getStocksData } from "./lib/stocks";

export default async function Home() {
  let data;
  try {
    data = await getStocksData();
  } catch (error) {
    console.error(error);
    return (
      <main className="error-page">
        <span className="base-mark" />
        <p>Market data is taking a breather.</p>
        <h1>Unable to load stocks.</h1>
        <Link href="/">Try again ↗</Link>
      </main>
    );
  }

  return <MarketDashboard data={data} />;
}
