"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { buyShares } from "@/app/markets/[slug]/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { formatMarketCents, formatMarketPercent } from "@/lib/market-format";

type Outcome = "YES" | "NO";

type QuickMarket = {
  closeLabel: string;
  competitionName: string;
  noPrice: number;
  question: string;
  slug: string;
  totalShares: number;
  yesPrice: number;
};

type SelectedMarket = QuickMarket & {
  outcome: Outcome;
};

export function QuickMarketBoard({
  balance,
  isSignedIn,
  markets
}: {
  balance: number;
  isSignedIn: boolean;
  markets: QuickMarket[];
}) {
  const [selectedMarket, setSelectedMarket] = useState<SelectedMarket | null>(
    null
  );

  return (
    <>
      <div className="quick-market-board">
        <div className="quick-market-header" aria-hidden="true">
          <span>Market</span>
          <span>Yes</span>
          <span>No</span>
          <span>Volume</span>
        </div>
        {markets.map((market) => (
          <article className="quick-market-row" key={market.slug}>
            <Link className="quick-market-main" href={`/markets/${market.slug}`}>
              <span>{market.competitionName}</span>
              <strong>{market.question}</strong>
              <small>Closes {market.closeLabel}</small>
            </Link>
            <button
              className="quick-price-button yes-quick-button"
              onClick={() => setSelectedMarket({ ...market, outcome: "YES" })}
              type="button"
            >
              <span>Yes</span>
              <strong>{formatMarketCents(market.yesPrice)}</strong>
              <small>{formatMarketPercent(market.yesPrice)}</small>
            </button>
            <button
              className="quick-price-button no-quick-button"
              onClick={() => setSelectedMarket({ ...market, outcome: "NO" })}
              type="button"
            >
              <span>No</span>
              <strong>{formatMarketCents(market.noPrice)}</strong>
              <small>{formatMarketPercent(market.noPrice)}</small>
            </button>
            <span className="quick-market-volume">
              {market.totalShares.toLocaleString()}
            </span>
          </article>
        ))}
      </div>

      {selectedMarket && (
        <QuickTradeModal
          balance={balance}
          isSignedIn={isSignedIn}
          market={selectedMarket}
          onClose={() => setSelectedMarket(null)}
        />
      )}
    </>
  );
}

function QuickTradeModal({
  balance,
  isSignedIn,
  market,
  onClose
}: {
  balance: number;
  isSignedIn: boolean;
  market: SelectedMarket;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [isReviewing, setIsReviewing] = useState(false);
  const price = market.outcome === "YES" ? market.yesPrice : market.noPrice;
  const totalCost = useMemo(() => price * quantity, [price, quantity]);
  const maxPayout = quantity * 100;
  const maxProfit = maxPayout - totalCost;
  const remainingBalance = balance - totalCost;
  const canAfford = remainingBalance >= 0;
  const isValidQuantity = quantity >= 1 && quantity <= 100;

  return (
    <div
      aria-labelledby="quick-trade-title"
      aria-modal="true"
      className="modal-backdrop"
      role="dialog"
    >
      <form action={buyShares} className="quick-trade-modal">
        <input type="hidden" name="slug" value={market.slug} />
        <input type="hidden" name="outcome" value={market.outcome} />

        <div className="modal-header">
          <div>
            <span>{market.competitionName}</span>
            <h2 id="quick-trade-title">Buy {market.outcome}</h2>
          </div>
          <button
            aria-label="Close quick order"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="quick-trade-market">
          <strong>{market.question}</strong>
          <Link href={`/markets/${market.slug}`}>View full market</Link>
        </div>

        <div className="quick-trade-side">
          <div className={market.outcome === "YES" ? "is-active" : undefined}>
            <span>Yes</span>
            <strong>{formatMarketCents(market.yesPrice)}</strong>
            <small>{formatMarketPercent(market.yesPrice)} chance</small>
          </div>
          <div className={market.outcome === "NO" ? "is-active" : undefined}>
            <span>No</span>
            <strong>{formatMarketCents(market.noPrice)}</strong>
            <small>{formatMarketPercent(market.noPrice)} chance</small>
          </div>
        </div>

        {isSignedIn ? (
          <>
            <label htmlFor="quick-quantity">Contracts</label>
            <input
              id="quick-quantity"
              max="100"
              min="1"
              name="quantity"
              onChange={(event) => {
                const nextQuantity = Number(event.target.value);
                setQuantity(Number.isFinite(nextQuantity) ? nextQuantity : 1);
                setIsReviewing(false);
              }}
              type="number"
              value={quantity}
            />

            <div className="order-summary">
              <div>
                <span>Avg price</span>
                <strong>{formatMarketCents(price)}</strong>
              </div>
              <div>
                <span>Total cost</span>
                <strong>{totalCost.toLocaleString()}</strong>
              </div>
              <div>
                <span>Max payout</span>
                <strong>{maxPayout.toLocaleString()}</strong>
              </div>
              <div>
                <span>Max profit</span>
                <strong>{maxProfit.toLocaleString()}</strong>
              </div>
              <div>
                <span>Remaining balance</span>
                <strong className={canAfford ? undefined : "danger-text"}>
                  {remainingBalance.toLocaleString()}
                </strong>
              </div>
            </div>

            {!canAfford && (
              <p className="form-error">
                Add fewer contracts or pick the other side.
              </p>
            )}
            {!isValidQuantity && (
              <p className="form-error">Enter between 1 and 100 contracts.</p>
            )}

            {isReviewing ? (
              <div className="review-box">
                <div>
                  <span>Review order</span>
                  <strong>
                    Buy {quantity.toLocaleString()} {market.outcome} at{" "}
                    {formatMarketCents(price)}
                  </strong>
                </div>
                <p>
                  This spends {totalCost.toLocaleString()} CubeCoins. If{" "}
                  {market.outcome} wins, the max payout is{" "}
                  {maxPayout.toLocaleString()} CubeCoins.
                </p>
                <div className="review-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setIsReviewing(false)}
                    type="button"
                  >
                    Edit
                  </button>
                  <PendingSubmitButton pendingLabel="Buying...">
                    Confirm buy
                  </PendingSubmitButton>
                </div>
              </div>
            ) : (
              <button
                disabled={!canAfford || !isValidQuantity}
                onClick={() => setIsReviewing(true)}
                type="button"
              >
                Review order
              </button>
            )}
          </>
        ) : (
          <div className="signed-out-trade">
            <p>Sign in to place CubeCoin orders from the market board.</p>
            <Link className="button-link" href="/sign-in">
              Sign in
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}
