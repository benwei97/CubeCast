import Link from "next/link";
import { notFound } from "next/navigation";

import { getMarketPrices } from "@/lib/market-pricing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CompetitionDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await prisma.competition.findUnique({
    where: { slug },
    include: {
      markets: {
        orderBy: [{ status: "asc" }, { closeTime: "asc" }, { question: "asc" }],
        include: {
          _count: {
            select: {
              purchases: true,
              positions: true
            }
          }
        }
      }
    }
  });

  if (!competition) {
    notFound();
  }

  const openMarkets = competition.markets.filter(
    (market) => market.status === "OPEN"
  );
  const resolvedMarkets = competition.markets.filter(
    (market) => market.status === "RESOLVED" || market.status === "CANCELED"
  );
  const totalVolume = competition.markets.reduce(
    (total, market) =>
      total + market.yesSharesOutstanding + market.noSharesOutstanding,
    0
  );

  return (
    <div className="page-stack">
      <section className="competition-hero">
        <div>
          <Link className="text-link" href="/competitions">
            Back to competitions
          </Link>
          <p className="eyebrow">{competition.status}</p>
          <h1>{competition.name}</h1>
          <p>{competition.description}</p>
          <div className="date-row">
            <span>
              {competition.location}, {competition.country}
            </span>
            <span>Starts {competition.startDate.toLocaleDateString()}</span>
            <span>Ends {competition.endDate.toLocaleDateString()}</span>
          </div>
        </div>
        <aside className="competition-summary">
          <div>
            <span>Markets</span>
            <strong>{competition.markets.length.toLocaleString()}</strong>
          </div>
          <div>
            <span>Open</span>
            <strong>{openMarkets.length.toLocaleString()}</strong>
          </div>
          <div>
            <span>Final</span>
            <strong>{resolvedMarkets.length.toLocaleString()}</strong>
          </div>
          <div>
            <span>Volume</span>
            <strong>{totalVolume.toLocaleString()}</strong>
          </div>
        </aside>
      </section>

      <section>
        <div className="section-heading">
          <h2>Markets</h2>
          <span>{competition.markets.length.toLocaleString()} total</span>
        </div>
        <div className="market-board">
          <div className="market-board-header">
            <span>Market</span>
            <span>Yes</span>
            <span>No</span>
            <span>Volume</span>
            <span>Status</span>
          </div>
          {competition.markets.map((market) => {
            const prices = getMarketPrices(market);

            return (
              <Link
                className="market-board-row"
                href={`/markets/${market.slug}`}
                key={market.id}
              >
                <div>
                  <strong>{market.question}</strong>
                  <span>{market.category}</span>
                </div>
                <strong className="yes-text">{prices.yesPrice}</strong>
                <strong className="no-text">{prices.noPrice}</strong>
                <span>{prices.totalShares.toLocaleString()}</span>
                <span>{market.status}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="detail-grid">
        <article className="info-panel">
          <h2>Open Markets</h2>
          {openMarkets.length > 0 ? (
            <div className="compact-list">
              {openMarkets.slice(0, 5).map((market) => (
                <Link href={`/markets/${market.slug}`} key={market.id}>
                  {market.question}
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-state">No open markets for this competition.</p>
          )}
        </article>
        <article className="info-panel">
          <h2>Final Markets</h2>
          {resolvedMarkets.length > 0 ? (
            <div className="compact-list">
              {resolvedMarkets.slice(0, 5).map((market) => (
                <Link href={`/markets/${market.slug}`} key={market.id}>
                  {market.question}
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-state">No resolved or canceled markets yet.</p>
          )}
        </article>
      </section>
    </div>
  );
}
