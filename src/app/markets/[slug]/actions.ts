"use server";

import { MarketOutcome } from "@prisma/client";
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

    if (market.status !== "OPEN" || market.closeTime <= new Date()) {
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
        type: "MARKET_PURCHASE",
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
  redirect(redirectPath);
}
