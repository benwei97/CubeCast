import Link from "next/link";

import { auth } from "@/auth";
import { getMarketPrices } from "@/lib/market-pricing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="auth-page">
        <section className="auth-panel">
          <p className="eyebrow">Portfolio</p>
          <h1>Sign in</h1>
          <p>
            Sign in with a demo account to view CubeCoin balances, positions,
            and ledger history.
          </p>
          <Link className="button-link" href="/sign-in">
            Sign in
          </Link>
        </section>
      </div>
    );
  }

  const [positions, transactions] = await Promise.all([
    prisma.position.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        market: {
          include: {
            competition: true
          }
        }
      }
    }),
    prisma.ledgerTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        market: {
          select: {
            question: true,
            slug: true
          }
        }
      }
    })
  ]);

  const openPositions = positions.filter((position) => position.status === "OPEN");
  const openPositionValue = openPositions.reduce((total, position) => {
    const prices = getMarketPrices(position.market);

    return (
      total +
      position.yesShares * prices.yesPrice +
      position.noShares * prices.noPrice
    );
  }, 0);
  const totalSpent = positions.reduce(
    (total, position) => total + position.totalYesCost + position.totalNoCost,
    0
  );
  const totalPayout = positions.reduce(
    (total, position) => total + position.payout,
    0
  );
  const accountValue = session.user.balance + openPositionValue;

  return (
    <div className="page-stack">
      <section>
        <p className="eyebrow">Your account</p>
        <h1>Portfolio</h1>
        <p>
          Track CubeCoin balance, market positions, estimated open value, and
          recent account activity.
        </p>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span>Balance</span>
          <strong>{session.user.balance.toLocaleString()}</strong>
          <small>Available CubeCoins</small>
        </article>
        <article className="summary-card">
          <span>Open value</span>
          <strong>{openPositionValue.toLocaleString()}</strong>
          <small>Estimated from current mock prices</small>
        </article>
        <article className="summary-card">
          <span>Account value</span>
          <strong>{accountValue.toLocaleString()}</strong>
          <small>Balance plus open value</small>
        </article>
        <article className="summary-card">
          <span>Total spent</span>
          <strong>{totalSpent.toLocaleString()}</strong>
          <small>Across all positions</small>
        </article>
      </section>

      <section>
        <div className="section-heading">
          <h2>Positions</h2>
          <Link href="/competitions">Browse markets</Link>
        </div>
        {positions.length > 0 ? (
          <div className="portfolio-list">
            {positions.map((position) => {
              const market = position.market;
              const prices = getMarketPrices(market);
              const currentValue =
                position.status === "OPEN"
                  ? position.yesShares * prices.yesPrice +
                    position.noShares * prices.noPrice
                  : position.payout;
              const totalCost = position.totalYesCost + position.totalNoCost;

              return (
                <article className="portfolio-row" key={position.id}>
                  <div>
                    <Link className="text-link" href={`/markets/${market.slug}`}>
                      {market.question}
                    </Link>
                    <span>{market.competition.name}</span>
                  </div>
                  <div>
                    <strong>{position.yesShares.toLocaleString()}</strong>
                    <span>YES</span>
                  </div>
                  <div>
                    <strong>{position.noShares.toLocaleString()}</strong>
                    <span>NO</span>
                  </div>
                  <div>
                    <strong>{totalCost.toLocaleString()}</strong>
                    <span>Cost</span>
                  </div>
                  <div>
                    <strong>{currentValue.toLocaleString()}</strong>
                    <span>{position.status === "OPEN" ? "Value" : "Payout"}</span>
                  </div>
                  <div>
                    <strong>{position.status}</strong>
                    <span>
                      YES {prices.yesPrice} / NO {prices.noPrice}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">
            You do not have any positions yet. Open a market to buy YES or NO
            shares.
          </p>
        )}
      </section>

      <section>
        <div className="section-heading">
          <h2>Ledger</h2>
        </div>
        <div className="detail-grid">
          <article className="info-panel">
            <h2>Totals</h2>
            <dl>
              <div>
                <dt>Open positions</dt>
                <dd>{openPositions.length.toLocaleString()}</dd>
              </div>
              <div>
                <dt>All positions</dt>
                <dd>{positions.length.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Total payouts</dt>
                <dd>{totalPayout.toLocaleString()}</dd>
              </div>
            </dl>
          </article>
          <article className="info-panel">
            <h2>Recent Activity</h2>
            {transactions.length > 0 ? (
              <div className="ledger-list">
                {transactions.map((transaction) => (
                  <div className="ledger-row" key={transaction.id}>
                    <div>
                      <strong>{formatTransactionType(transaction.type)}</strong>
                      <span>
                        {transaction.market ? (
                          <Link href={`/markets/${transaction.market.slug}`}>
                            {transaction.market.question}
                          </Link>
                        ) : (
                          transaction.description
                        )}
                      </span>
                    </div>
                    <div>
                      <strong>
                        {transaction.amount > 0 ? "+" : ""}
                        {transaction.amount.toLocaleString()}
                      </strong>
                      <span>
                        Balance {transaction.balanceAfter.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No ledger activity yet.</p>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

function formatTransactionType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
