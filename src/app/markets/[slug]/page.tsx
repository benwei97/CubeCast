import Link from "next/link";
import { notFound } from "next/navigation";

import { getMarketPrices } from "@/lib/market-pricing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const market = await prisma.market.findUnique({
    where: { slug },
    include: {
      competition: true,
      purchases: {
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          user: {
            select: {
              username: true
            }
          }
        }
      }
    }
  });

  if (!market) {
    notFound();
  }

  const prices = getMarketPrices(market);

  return (
    <div className="page-stack">
      <section className="market-detail-hero">
        <div>
          <Link className="text-link" href="/competitions">
            Back to competitions
          </Link>
          <p className="eyebrow">{market.competition.name}</p>
          <h1>{market.question}</h1>
          <p>{market.description}</p>
        </div>
        <aside className="trade-panel">
          <span>Current mock prices</span>
          <div className="price-row">
            <strong>YES {prices.yesPrice}</strong>
            <strong>NO {prices.noPrice}</strong>
          </div>
          <p>
            Buying is coming in the next MVP step. For now, seeded purchases
            move these read-only prices.
          </p>
        </aside>
      </section>

      <section className="detail-grid">
        <article className="info-panel">
          <h2>Market Details</h2>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{market.status}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{market.category}</dd>
            </div>
            <div>
              <dt>Closes</dt>
              <dd>{market.closeTime.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Total shares</dt>
              <dd>{prices.totalShares.toLocaleString()}</dd>
            </div>
            <div>
              <dt>YES shares</dt>
              <dd>{market.yesSharesOutstanding.toLocaleString()}</dd>
            </div>
            <div>
              <dt>NO shares</dt>
              <dd>{market.noSharesOutstanding.toLocaleString()}</dd>
            </div>
          </dl>
        </article>

        <article className="info-panel">
          <h2>Resolution Rules</h2>
          <p>{market.resolutionRules}</p>
          <p>
            <strong>Source:</strong> {market.resolutionSource}
          </p>
          {market.winningOutcome && (
            <p>
              <strong>Winning outcome:</strong> {market.winningOutcome}
            </p>
          )}
        </article>
      </section>

      <section>
        <div className="section-heading">
          <h2>Recent Activity</h2>
        </div>
        {market.purchases.length > 0 ? (
          <div className="activity-list">
            {market.purchases.map((purchase) => (
              <article className="activity-row" key={purchase.id}>
                <div>
                  <strong>{purchase.user.username}</strong>
                  <span>
                    bought {purchase.quantity} {purchase.outcome} shares
                  </span>
                </div>
                <div>
                  <strong>{purchase.totalCost} CubeCoins</strong>
                  <small>{purchase.createdAt.toLocaleDateString()}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">No purchases yet.</p>
        )}
      </section>
    </div>
  );
}
