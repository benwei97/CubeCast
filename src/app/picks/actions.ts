"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ContestEntryStatus } from "@prisma/client";

import { auth } from "@/auth";
import { lockContestIfDue } from "@/lib/contest-maintenance";
import { prisma } from "@/lib/prisma";
import {
  canAddPrediction,
  canModifyPrediction,
  getPredictionAvailabilityError,
  V1_REQUIRED_PICKS
} from "@/lib/v1-game";

export async function selectPrediction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const slateId = String(formData.get("slateId") ?? "");
  const marketId = String(formData.get("marketId") ?? "");
  const marketOptionId = String(formData.get("marketOptionId") ?? "");

  if (!slateId || !marketId || !marketOptionId) {
    return { error: "Missing prediction selection." };
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockContestIfDue(tx, slateId);

    const slate = await tx.contestSlate.findUnique({
      where: { id: slateId },
      select: { baseScore: true, id: true, lockAt: true, maxPicks: true, status: true }
    });

    if (!slate) return { error: "Contest not found." };
    const availabilityError = getPredictionAvailabilityError(slate);
    if (availabilityError) return { error: availabilityError };

    const marketOption = await tx.marketOption.findFirst({
      where: {
        id: marketOptionId,
        market: {
          id: marketId,
          slateId,
          status: "OPEN"
        }
      },
      select: {
        id: true,
        marketId: true,
        probability: true
      }
    });

    if (!marketOption) {
      return { error: "That outcome is not available for this contest." };
    }

    const entry = await tx.contestEntry.upsert({
      where: {
        userId_slateId: {
          slateId,
          userId: session.user.id
        }
      },
      create: {
        baseScore: slate.baseScore,
        slateId,
        status: ContestEntryStatus.DRAFT,
        userId: session.user.id
      },
      update: {},
      select: {
        id: true,
        predictions: {
          select: { id: true, marketId: true }
        }
      }
    });

    const existingPrediction = entry.predictions.find(
      (prediction) => prediction.marketId === marketId
    );

    if (!existingPrediction) {
      const currentPickCount = entry.predictions.length;

      if (
        !canAddPrediction({
          currentPickCount,
          lockAt: slate.lockAt,
          maxPicks: slate.maxPicks
        })
      ) {
        return { error: `You can only select ${V1_REQUIRED_PICKS} picks.` };
      }

      await tx.prediction.create({
        data: {
          entryId: entry.id,
          marketId,
          selectedMarketOptionId: marketOption.id,
          selectedProbability: marketOption.probability
        }
      });

      return { error: null };
    }

    await tx.prediction.update({
      where: { id: existingPrediction.id },
      data: {
        selectedMarketOptionId: marketOption.id,
        selectedProbability: marketOption.probability
      }
    });
    return { error: null };
  });

  revalidatePath("/");
  revalidatePath("/picks");
  revalidatePath("/markets/[slug]", "page");
  revalidatePath("/competitions/[slug]", "page");
  return result;
}

export async function removePrediction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const predictionId = String(formData.get("predictionId") ?? "");

  if (!predictionId) {
    throw new Error("Missing prediction.");
  }

  await prisma.$transaction(async (tx) => {
    const prediction = await tx.prediction.findFirst({
      where: {
        id: predictionId,
        entry: {
          userId: session.user.id
        }
      },
      select: {
        id: true,
        entry: {
          select: {
            slate: {
              select: { id: true, lockAt: true }
            }
          }
        }
      }
    });

    if (!prediction) {
      throw new Error("Prediction not found.");
    }

    await lockContestIfDue(tx, prediction.entry.slate.id);

    if (!canModifyPrediction({ lockAt: prediction.entry.slate.lockAt })) {
      throw new Error("This contest is locked.");
    }

    await tx.prediction.delete({
      where: { id: prediction.id }
    });
  });

  revalidatePath("/");
  revalidatePath("/picks");
  revalidatePath("/markets/[slug]", "page");
  revalidatePath("/competitions/[slug]", "page");
}
