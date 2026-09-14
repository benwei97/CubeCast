"use server";

import {
  MarketOutcome,
  MarketStatus,
  PositionStatus,
  TransactionType,
  UserRole
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { getMarketPrices } from "@/lib/market-pricing";
import { prisma } from "@/lib/prisma";

const buySharesSchema = z.object({
  slug: z.string().min(1),
  outcome: z.nativeEnum(MarketOutcome),
  quantity: z.coerce.number().int().min(1).max(100)
});

const resolveMarketSchema = z.object({
  slug: z.string().min(1),
  outcome: z.enum(["YES", "NO", "CANCELED"])
});

export async function buyShares(formData: FormData) {
  const parsed = buySharesSchema.safeParse({
    slug: formData.get("slug"),
    outcome: formData.get("outcome"),
    quantity: formData.get("quantity")
  });

  if (!parsed.success) {
    redirect("/competitions?trade=invalid");
  }

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/sign-in`);
  }

  const { slug, outcome, quantity } = parsed.data;
  let redirectPath = `/markets/${slug}?trade=success`;

  await prisma.$transaction(async (tx) => {
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
      redirectPath = `/competitions?trade=missing-market`;
      return;
    }

    if (market.status !== MarketStatus.OPEN || market.closeTime <= new Date()) {
      redirectPath = `/markets/${market.slug}?trade=closed`;
      return;
    }

    const user = await tx.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, balance: true }
    });

    if (!user) {
      redirectPath = `/markets/${market.slug}?trade=missing-user`;
      return;
    }

    const prices = getMarketPrices(market);
    const averagePrice =
      outcome === MarketOutcome.YES ? prices.yesPrice : prices.noPrice;
    const totalCost = averagePrice * quantity;

    if (user.balance < totalCost) {
      redirectPath = `/markets/${market.slug}?trade=insufficient-balance`;
      return;
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
        outcome === MarketOutcome.YES
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
        yesShares: outcome === MarketOutcome.YES ? quantity : 0,
        noShares: outcome === MarketOutcome.NO ? quantity : 0,
        totalYesCost: outcome === MarketOutcome.YES ? totalCost : 0,
        totalNoCost: outcome === MarketOutcome.NO ? totalCost : 0,
        status: "OPEN"
      },
      update:
        outcome === MarketOutcome.YES
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
  });

  revalidatePath("/");
  revalidatePath("/competitions");
  revalidatePath(`/markets/${slug}`);
  revalidatePath("/portfolio");
  revalidatePath("/leaderboard");
  redirect(redirectPath);
}

export async function resolveMarket(formData: FormData) {
  const parsed = resolveMarketSchema.safeParse({
    slug: formData.get("slug"),
    outcome: formData.get("outcome")
  });

  if (!parsed.success) {
    redirect("/competitions?resolution=invalid");
  }

  const session = await auth();

  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    redirect(`/markets/${parsed.data.slug}?resolution=unauthorized`);
  }

  const { slug, outcome } = parsed.data;
  let redirectPath = `/markets/${slug}?resolution=success`;

  await prisma.$transaction(async (tx) => {
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
      redirectPath = "/competitions?resolution=missing-market";
      return;
    }

    if (
      market.status === MarketStatus.RESOLVED ||
      market.status === MarketStatus.CANCELED
    ) {
      redirectPath = `/markets/${market.slug}?resolution=already-final`;
      return;
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

      return;
    }

    const winningOutcome =
      outcome === "YES" ? MarketOutcome.YES : MarketOutcome.NO;
    let totalPayout = 0;

    await tx.market.update({
      where: { id: market.id },
      data: {
        status: MarketStatus.RESOLVED,
        resolvedAt: new Date(),
        winningOutcome
      }
    });

    for (const position of positions) {
      const winningShares =
        winningOutcome === MarketOutcome.YES
          ? position.yesShares
          : position.noShares;
      const payoutAmount = winningShares * 100;
      totalPayout += payoutAmount;

      await tx.position.update({
        where: { id: position.id },
        data: {
          status:
            payoutAmount > 0 ? PositionStatus.WON : PositionStatus.LOST,
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
            description: `Payout for ${winningOutcome} resolution: ${market.question}`
          }
        });
      }
    }

    await tx.settlement.create({
      data: {
        marketId: market.id,
        outcome: winningOutcome,
        settledByUserId: session.user.id,
        totalPayout
      }
    });
  });

  revalidatePath("/");
  revalidatePath("/competitions");
  revalidatePath(`/markets/${slug}`);
  revalidatePath("/portfolio");
  revalidatePath("/leaderboard");
  redirect(redirectPath);
}
