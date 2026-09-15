import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { formatMarketCents, formatMarketPercent } from "@/lib/market-format";
import { getMarketPrices } from "@/lib/market-pricing";
import { prisma } from "@/lib/prisma";
import { OrderTicket } from "./order-ticket";
import { resolveMarket } from "./actions";

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ resolution?: string; trade?: string }>;
}) {
  const { slug } = await params;
  const { resolution, trade } = await searchParams;
  const session = await auth();
  const sessionBalance =
    typeof session?.user?.balance === "number" ? session.user.balance : null;
  const market = await prisma.market.findUnique({
    where: { slug },
    include: {
      competition: true,
      settlement: true,
      purchases: {
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          user: {
            select: {
              username: true,
              wcaIdentity: {
                select: {
                  name: true
                }
              }
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
  const canResolve =
    session?.user?.role === UserRole.ADMIN &&
    market.status !== "RESOLVED" &&
    market.status !== "CANCELED";
  const tradeMessage = getTradeMessage(trade);
  const resolutionMessage = getResolutionMessage(resolution);
  const yesSharePercent =
    prices.totalShares === 0
      ? 50
      : Math.round((market.yesSharesOutstanding / prices.totalShares) * 100);

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
          <div className="market-metrics">
            <div>
              <span>Yes chance</span>
              <strong>{formatMarketPercent(prices.yesPrice)}</strong>
            </div>
            <div>
              <span>No chance</span>
              <strong>{formatMarketPercent(prices.noPrice)}</strong>
            </div>
            <div>
              <span>Volume</span>
              <strong>{prices.totalShares.toLocaleString()}</strong>
            </div>
            <div>
              <span>Closes</span>
              <strong>{market.closeTime.toLocaleDateString()}</strong>
            </div>
          </div>
          <div className="probability-bar" aria-label="Share split">
            <span style={{ width: `${yesSharePercent}%` }} />
          </div>
        </div>
        <aside className="trade-panel">
          <span>Order ticket</span>
          <div className="market-status-row">
            <strong>{market.status}</strong>
            {market.winningOutcome && <span>{market.winningOutcome} won</span>}
          </div>
          <div className="price-row">
            <strong>YES {formatMarketCents(prices.yesPrice)}</strong>
            <strong>NO {formatMarketCents(prices.noPrice)}</strong>
          </div>
          {tradeMessage && (
            <p className={trade === "success" ? "success-text" : "form-error"}>
              {tradeMessage}
            </p>
          )}
          {session?.user?.id && sessionBalance !== null ? (
            <>
              <p>
                Balance:{" "}
                <strong>{sessionBalance.toLocaleString()} CubeCoins</strong>
              </p>
              {isOpen ? (
                <OrderTicket
                  balance={sessionBalance}
                  noPrice={prices.noPrice}
                  slug={market.slug}
                  yesPrice={prices.yesPrice}
                />
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

      {session?.user?.role === UserRole.ADMIN && (
        <section>
          <div className="section-heading">
            <h2>Admin Resolution</h2>
          </div>
          <article className="admin-panel">
            <div>
              <p className="eyebrow">Admin controls</p>
              <h3>Resolve this market</h3>
              <p>
                Resolution finalizes the market, stops new purchases, updates
                positions, and writes payout or refund ledger entries.
              </p>
              {resolutionMessage && (
                <p
                  className={
                    resolution === "success" ? "success-text" : "form-error"
                  }
                >
                  {resolutionMessage}
                </p>
              )}
            </div>
            {canResolve ? (
              <div className="resolution-actions">
                <ResolutionChoiceForm
                  label="Resolve YES"
                  marketSlug={market.slug}
                  outcome="YES"
                  pendingLabel="Resolving..."
                />
                <ResolutionChoiceForm
                  label="Resolve NO"
                  marketSlug={market.slug}
                  outcome="NO"
                  pendingLabel="Resolving..."
                />
                <ResolutionChoiceForm
                  buttonClassName="secondary-button"
                  label="Cancel and refund"
                  marketSlug={market.slug}
                  outcome="CANCELED"
                  pendingLabel="Canceling..."
                />
              </div>
            ) : (
              <p className="empty-state">This market is already final.</p>
            )}
          </article>
        </section>
      )}

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
            {market.winningOutcome && (
              <div>
                <dt>Winning outcome</dt>
                <dd>{market.winningOutcome}</dd>
              </div>
            )}
            {market.settlement && (
              <div>
                <dt>Total payout</dt>
                <dd>{market.settlement.totalPayout.toLocaleString()}</dd>
              </div>
            )}
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
                  <strong>
                    {purchase.user.wcaIdentity?.name ?? purchase.user.username}
                  </strong>
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

function getResolutionMessage(resolution?: string) {
  switch (resolution) {
    case "success":
      return "Market resolved. Positions, payouts, ledger entries, portfolio, and leaderboard have updated.";
    case "already-final":
      return "This market has already been resolved or canceled.";
    case "unauthorized":
      return "Only admins can resolve markets.";
    case "invalid":
      return "Choose YES, NO, or canceled and confirm the final resolution.";
    case "missing-market":
      return "That market could not be found.";
    default:
      return null;
  }
}

function ResolutionChoiceForm({
  buttonClassName,
  label,
  marketSlug,
  outcome,
  pendingLabel
}: {
  buttonClassName?: string;
  label: string;
  marketSlug: string;
  outcome: "YES" | "NO" | "CANCELED";
  pendingLabel: string;
}) {
  return (
    <form action={resolveMarket} className="resolution-choice-form">
      <input type="hidden" name="slug" value={marketSlug} />
      <input type="hidden" name="outcome" value={outcome} />
      <label className="checkbox-row">
        <input name="confirmResolution" type="checkbox" value="confirm" />
        <span>Confirm final</span>
      </label>
      <PendingSubmitButton className={buttonClassName} pendingLabel={pendingLabel}>
        {label}
      </PendingSubmitButton>
    </form>
  );
}
