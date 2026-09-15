import {
  type MarketOutcome,
  MarketStatus,
  PositionStatus,
  TransactionType
} from "@prisma/client";
import { type PrismaClient } from "@prisma/client";

import { getMarketPrices } from "@/lib/market-pricing";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type BuySharesResult =
  | { status: "success"; marketSlug: string }
  | {
      status:
        | "closed"
        | "insufficient-balance"
        | "missing-market"
        | "missing-user";
      marketSlug?: string;
    };

export type ResolveMarketResult =
  | { status: "success"; marketSlug: string }
  | {
      status: "already-final" | "missing-market";
      marketSlug?: string;
    };

export async function buySharesForUser({
  outcome,
  quantity,
  slug,
  tx,
  userId
}: {
  outcome: MarketOutcome;
  quantity: number;
  slug: string;
  tx: PrismaTransaction;
  userId: string;
}): Promise<BuySharesResult> {
  const market = await tx.market.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      status: true,
      closeTime: true,
      question: true,
      yesSharesOutstanding: true,
      noSharesOutstanding: true
    }
  });

  if (!market) {
    return { status: "missing-market" };
  }

  if (market.status !== MarketStatus.OPEN || market.closeTime <= new Date()) {
    return { status: "closed", marketSlug: market.slug };
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, balance: true }
  });

  if (!user) {
    return { status: "missing-user", marketSlug: market.slug };
  }

  const prices = getMarketPrices(market);
  const averagePrice = outcome === "YES" ? prices.yesPrice : prices.noPrice;
  const totalCost = averagePrice * quantity;

  if (user.balance < totalCost) {
    return { status: "insufficient-balance", marketSlug: market.slug };
  }

  const purchase = await tx.purchase.create({
    data: {
      userId: user.id,
      marketId: market.id,
      outcome,
      quantity,
      totalCost,
      averagePrice
    }
  });

  await tx.user.update({
    where: { id: user.id },
    data: {
      balance: {
        decrement: totalCost
      }
    }
  });

  await tx.market.update({
    where: { id: market.id },
    data:
      outcome === "YES"
        ? {
            yesSharesOutstanding: {
              increment: quantity
            }
          }
        : {
            noSharesOutstanding: {
              increment: quantity
            }
          }
  });

  await tx.position.upsert({
    where: {
      userId_marketId: {
        userId: user.id,
        marketId: market.id
      }
    },
    create: {
      userId: user.id,
      marketId: market.id,
      yesShares: outcome === "YES" ? quantity : 0,
      noShares: outcome === "NO" ? quantity : 0,
      totalYesCost: outcome === "YES" ? totalCost : 0,
      totalNoCost: outcome === "NO" ? totalCost : 0,
      status: PositionStatus.OPEN
    },
    update:
      outcome === "YES"
        ? {
            yesShares: {
              increment: quantity
            },
            totalYesCost: {
              increment: totalCost
            }
          }
        : {
            noShares: {
              increment: quantity
            },
            totalNoCost: {
              increment: totalCost
            }
          }
  });

  const balanceAfter = user.balance - totalCost;

  await tx.ledgerTransaction.create({
    data: {
      userId: user.id,
      marketId: market.id,
      purchaseId: purchase.id,
      type: TransactionType.MARKET_PURCHASE,
      amount: -totalCost,
      balanceAfter,
      description: `Bought ${quantity} ${outcome} shares for ${market.question}`
    }
  });

  return { status: "success", marketSlug: market.slug };
}

export async function resolveMarketForAdmin({
  adminUserId,
  outcome,
  slug,
  tx
}: {
  adminUserId: string;
  outcome: MarketOutcome | "CANCELED";
  slug: string;
  tx: PrismaTransaction;
}): Promise<ResolveMarketResult> {
  const market = await tx.market.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      question: true,
      status: true
    }
  });

  if (!market) {
    return { status: "missing-market" };
  }

  if (
    market.status === MarketStatus.RESOLVED ||
    market.status === MarketStatus.CANCELED
  ) {
    return { status: "already-final", marketSlug: market.slug };
  }

  const positions = await tx.position.findMany({
    where: { marketId: market.id },
    select: {
      id: true,
      userId: true,
      yesShares: true,
      noShares: true,
      totalYesCost: true,
      totalNoCost: true
    }
  });

  if (outcome === "CANCELED") {
    await tx.market.update({
      where: { id: market.id },
      data: {
        status: MarketStatus.CANCELED,
        resolvedAt: new Date(),
        winningOutcome: null
      }
    });

    for (const position of positions) {
      const refundAmount = position.totalYesCost + position.totalNoCost;

      await tx.position.update({
        where: { id: position.id },
        data: {
          status: PositionStatus.REFUNDED,
          payout: refundAmount
        }
      });

      if (refundAmount > 0) {
        const user = await tx.user.update({
          where: { id: position.userId },
          data: {
            balance: {
              increment: refundAmount
            }
          },
          select: {
            balance: true
          }
        });

        await tx.ledgerTransaction.create({
          data: {
            userId: position.userId,
            marketId: market.id,
            type: TransactionType.MARKET_REFUND,
            amount: refundAmount,
            balanceAfter: user.balance,
            description: `Refunded canceled market: ${market.question}`
          }
        });
      }
    }

    return { status: "success", marketSlug: market.slug };
  }

  let totalPayout = 0;

  await tx.market.update({
    where: { id: market.id },
    data: {
      status: MarketStatus.RESOLVED,
      resolvedAt: new Date(),
      winningOutcome: outcome
    }
  });

  for (const position of positions) {
    const winningShares =
      outcome === "YES" ? position.yesShares : position.noShares;
    const payoutAmount = winningShares * 100;
    totalPayout += payoutAmount;

    await tx.position.update({
      where: { id: position.id },
      data: {
        status: payoutAmount > 0 ? PositionStatus.WON : PositionStatus.LOST,
        payout: payoutAmount
      }
    });

    if (payoutAmount > 0) {
      const user = await tx.user.update({
        where: { id: position.userId },
        data: {
          balance: {
            increment: payoutAmount
          }
        },
        select: {
          balance: true
        }
      });

      await tx.ledgerTransaction.create({
        data: {
          userId: position.userId,
          marketId: market.id,
          type: TransactionType.MARKET_PAYOUT,
          amount: payoutAmount,
          balanceAfter: user.balance,
          description: `Payout for ${outcome} resolution: ${market.question}`
        }
      });
    }
  }

  await tx.settlement.create({
    data: {
      marketId: market.id,
      outcome,
      settledByUserId: adminUserId,
      totalPayout
    }
  });

  return { status: "success", marketSlug: market.slug };
}
