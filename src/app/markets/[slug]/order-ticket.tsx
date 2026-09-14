"use client";

import { useMemo, useState } from "react";

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
  const price = outcome === "YES" ? yesPrice : noPrice;
  const totalCost = useMemo(() => price * quantity, [price, quantity]);
  const maxPayout = quantity * 100;
  const maxProfit = maxPayout - totalCost;
  const remainingBalance = balance - totalCost;
  const canAfford = remainingBalance >= 0;

  return (
    <form action={buyShares} className="order-ticket">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="outcome" value={outcome} />

      <div className="outcome-toggle" role="group" aria-label="Choose outcome">
        <button
          aria-pressed={outcome === "YES"}
          className={outcome === "YES" ? "is-selected yes-option" : "yes-option"}
          onClick={() => setOutcome("YES")}
          type="button"
        >
          Yes {yesPrice}
        </button>
        <button
          aria-pressed={outcome === "NO"}
          className={outcome === "NO" ? "is-selected no-option" : "no-option"}
          onClick={() => setOutcome("NO")}
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
      <button disabled={!canAfford || quantity < 1 || quantity > 100} type="submit">
        Buy {outcome}
      </button>
    </form>
  );
}
