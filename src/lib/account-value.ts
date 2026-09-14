import { PositionStatus } from "@prisma/client";

import { getMarketPrices } from "@/lib/market-pricing";

type PositionForValue = {
  status: PositionStatus;
  yesShares: number;
  noShares: number;
  payout: number;
  market: {
    yesSharesOutstanding: number;
    noSharesOutstanding: number;
  };
};

export function getOpenPositionValue(positions: PositionForValue[]) {
  return positions.reduce((total, position) => {
    if (position.status !== PositionStatus.OPEN) {
      return total;
    }

    const prices = getMarketPrices(position.market);

    return (
      total +
      position.yesShares * prices.yesPrice +
      position.noShares * prices.noPrice
    );
  }, 0);
}

export function getPositionDisplayValue(position: PositionForValue) {
  if (position.status !== PositionStatus.OPEN) {
    return position.payout;
  }

  const prices = getMarketPrices(position.market);

  return position.yesShares * prices.yesPrice + position.noShares * prices.noPrice;
}

export function getAccountValue(input: {
  balance: number;
  positions: PositionForValue[];
}) {
  return input.balance + getOpenPositionValue(input.positions);
}
