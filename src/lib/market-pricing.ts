export function getMarketPrices(input: {
  yesSharesOutstanding: number;
  noSharesOutstanding: number;
}) {
  const totalShares = input.yesSharesOutstanding + input.noSharesOutstanding;

  if (totalShares === 0) {
    return {
      yesPrice: 50,
      noPrice: 50,
      totalShares
    };
  }

  const yesPrice = Math.max(
    1,
    Math.min(99, Math.round((input.yesSharesOutstanding / totalShares) * 100))
  );

  return {
    yesPrice,
    noPrice: 100 - yesPrice,
    totalShares
  };
}
