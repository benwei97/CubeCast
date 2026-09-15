"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ContestEntryStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  canAddPrediction,
  canModifyPrediction,
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
    throw new Error("Missing prediction selection.");
  }

  await prisma.$transaction(async (tx) => {
    const slate = await tx.contestSlate.findUnique({
      where: { id: slateId },
      select: { baseScore: true, id: true, lockAt: true, maxPicks: true, status: true }
    });

    if (!slate || slate.status !== "OPEN") {
      throw new Error("This slate is not open for picks.");
    }

    if (!canModifyPrediction({ lockAt: slate.lockAt })) {
      throw new Error("This slate is locked.");
    }

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
      throw new Error("That outcome is not available for this slate.");
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
        throw new Error(`You can only select ${V1_REQUIRED_PICKS} picks.`);
      }

      await tx.prediction.create({
        data: {
          entryId: entry.id,
          marketId,
          selectedMarketOptionId: marketOption.id,
          selectedProbability: marketOption.probability
        }
      });

      return;
    }

    await tx.prediction.update({
      where: { id: existingPrediction.id },
      data: {
        selectedMarketOptionId: marketOption.id,
        selectedProbability: marketOption.probability
      }
    });
  });

  revalidatePath("/");
  revalidatePath("/picks");
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
              select: { lockAt: true }
            }
          }
        }
      }
    });

    if (!prediction) {
      throw new Error("Prediction not found.");
    }

    if (!canModifyPrediction({ lockAt: prediction.entry.slate.lockAt })) {
      throw new Error("This slate is locked.");
    }

    await tx.prediction.delete({
      where: { id: prediction.id }
    });
  });

  revalidatePath("/");
  revalidatePath("/picks");
}
