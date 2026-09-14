"use client";

import { useMemo, useState } from "react";

import { PendingSubmitButton } from "@/components/pending-submit-button";
import { buyShares } from "./actions";

type Outcome = "YES" | "NO";

export function OrderTicket({
  balance,
  noPrice,
  slug,
  yesPrice
}: {
  balance: number;
  noPrice: number;
  slug: string;
  yesPrice: number;
}) {
  const [outcome, setOutcome] = useState<Outcome>("YES");
  const [quantity, setQuantity] = useState(1);
  const [isReviewing, setIsReviewing] = useState(false);
  const price = outcome === "YES" ? yesPrice : noPrice;
  const totalCost = useMemo(() => price * quantity, [price, quantity]);
  const maxPayout = quantity * 100;
  const maxProfit = maxPayout - totalCost;
  const remainingBalance = balance - totalCost;
  const canAfford = remainingBalance >= 0;
  const isValidQuantity = quantity >= 1 && quantity <= 100;

  function chooseOutcome(nextOutcome: Outcome) {
    setOutcome(nextOutcome);
    setIsReviewing(false);
  }

  return (
    <form action={buyShares} className="order-ticket">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="outcome" value={outcome} />

      <div className="outcome-toggle" role="group" aria-label="Choose outcome">
        <button
          aria-pressed={outcome === "YES"}
          className={outcome === "YES" ? "is-selected yes-option" : "yes-option"}
          onClick={() => chooseOutcome("YES")}
          type="button"
        >
          Yes {yesPrice}
        </button>
        <button
          aria-pressed={outcome === "NO"}
          className={outcome === "NO" ? "is-selected no-option" : "no-option"}
          onClick={() => chooseOutcome("NO")}
          type="button"
        >
          No {noPrice}
        </button>
      </div>

      <label htmlFor="quantity">Contracts</label>
      <input
        id="quantity"
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
          <strong>{price}</strong>
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
        <p className="form-error">You do not have enough CubeCoins.</p>
      )}
      {!isValidQuantity && (
        <p className="form-error">Enter between 1 and 100 contracts.</p>
      )}

      {isReviewing ? (
        <div className="review-box">
          <div>
            <span>Reviewing</span>
            <strong>
              Buy {quantity.toLocaleString()} {outcome} at {price}
            </strong>
          </div>
          <p>
            This will spend {totalCost.toLocaleString()} CubeCoins. If {outcome}{" "}
            wins, max payout is {maxPayout.toLocaleString()} CubeCoins.
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
    </form>
  );
}
