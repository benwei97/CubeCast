import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { getMarketPrices } from "@/lib/market-pricing";
import { prisma } from "@/lib/prisma";
import { buyShares } from "./actions";

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ trade?: string }>;
}) {
  const { slug } = await params;
  const { trade } = await searchParams;
  const session = await auth();
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
      },
      positions: {
        where: session?.user?.id
          ? {
              userId: session.user.id
            }
          : {
              userId: "__signed_out__"
            },
        take: 1
      }
    }
  });

  if (!market) {
    notFound();
  }

  const prices = getMarketPrices(market);
  const userPosition = market.positions[0];
  const isOpen = market.status === "OPEN" && market.closeTime > new Date();
  const tradeMessage = getTradeMessage(trade);

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
          {tradeMessage && (
            <p className={trade === "success" ? "success-text" : "form-error"}>
              {tradeMessage}
            </p>
          )}
          {session?.user ? (
            <>
              <p>
                Balance:{" "}
                <strong>{session.user.balance.toLocaleString()} CubeCoins</strong>
              </p>
              {isOpen ? (
                <div className="trade-actions">
                  <form action={buyShares} className="trade-form">
                    <input type="hidden" name="slug" value={market.slug} />
                    <input type="hidden" name="outcome" value="YES" />
                    <label htmlFor="yes-quantity">YES shares</label>
                    <input
                      id="yes-quantity"
                      min="1"
                      max="100"
                      name="quantity"
                      type="number"
                      defaultValue="1"
                    />
                    <button type="submit">Buy YES</button>
                  </form>
                  <form action={buyShares} className="trade-form">
                    <input type="hidden" name="slug" value={market.slug} />
                    <input type="hidden" name="outcome" value="NO" />
                    <label htmlFor="no-quantity">NO shares</label>
                    <input
                      id="no-quantity"
                      min="1"
                      max="100"
                      name="quantity"
                      type="number"
                      defaultValue="1"
                    />
                    <button type="submit">Buy NO</button>
                  </form>
                </div>
              ) : (
                <p>This market is closed for purchases.</p>
              )}
            </>
          ) : (
            <Link className="button-link" href="/sign-in">
              Sign in to buy shares
            </Link>
          )}
        </aside>
      </section>

      {session?.user && (
        <section>
          <div className="section-heading">
            <h2>Your Position</h2>
          </div>
          {userPosition ? (
            <article className="position-row">
              <div>
                <strong>{userPosition.yesShares.toLocaleString()}</strong>
                <span>YES shares</span>
              </div>
              <div>
                <strong>{userPosition.noShares.toLocaleString()}</strong>
                <span>NO shares</span>
              </div>
              <div>
                <strong>
                  {(
                    userPosition.totalYesCost + userPosition.totalNoCost
                  ).toLocaleString()}
                </strong>
                <span>CubeCoins spent</span>
              </div>
            </article>
          ) : (
            <p className="empty-state">You do not own shares in this market yet.</p>
          )}
        </section>
      )}

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

function getTradeMessage(trade?: string) {
  switch (trade) {
    case "success":
      return "Purchase confirmed. Your balance, position, prices, and activity have updated.";
    case "closed":
      return "This market is closed and no longer accepts purchases.";
    case "insufficient-balance":
      return "You do not have enough CubeCoins for that purchase.";
    case "invalid":
      return "Enter a quantity between 1 and 100.";
    case "missing-market":
      return "That market could not be found.";
    case "missing-user":
      return "Your user account could not be loaded.";
    default:
      return null;
  }
}
