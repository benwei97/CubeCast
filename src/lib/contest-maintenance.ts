import {
  ContestEntryStatus,
  ContestSlateStatus,
  MarketStatus,
  type PrismaClient
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getLockedEntryStatus } from "@/lib/v1-game";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function maintainContestLockState(now = new Date()) {
  await prisma.$transaction(async (tx) => {
    const contestsToLock = await tx.contestSlate.findMany({
      where: {
        lockAt: { lte: now },
        status: ContestSlateStatus.OPEN
      },
      select: { id: true }
    });

    for (const contest of contestsToLock) {
      await lockContestIfDue(tx, contest.id, now);
    }
  });
}

export async function lockContestIfDue(
  tx: TransactionClient,
  contestId: string,
  now = new Date()
) {
  const contest = await tx.contestSlate.findUnique({
    where: { id: contestId },
    include: {
      entries: {
        include: {
          predictions: {
            select: { id: true }
          }
        }
      }
    }
  });

  if (!contest || contest.status !== ContestSlateStatus.OPEN || contest.lockAt > now) {
    return { locked: false };
  }

  await tx.contestSlate.update({
    where: { id: contest.id },
    data: { status: ContestSlateStatus.LOCKED }
  });

  await tx.market.updateMany({
    where: {
      slateId: contest.id,
      status: MarketStatus.OPEN
    },
    data: { status: MarketStatus.LOCKED }
  });

  for (const entry of contest.entries) {
    const lockedStatus = getLockedEntryStatus({
      pickCount: entry.predictions.length,
      requiredPicks: contest.maxPicks
    });

    await tx.contestEntry.update({
      where: { id: entry.id },
      data: {
        finalScore: lockedStatus === "INVALID" ? null : entry.finalScore,
        lockedAt: entry.lockedAt ?? now,
        status:
          lockedStatus === "LOCKED"
            ? ContestEntryStatus.LOCKED
            : ContestEntryStatus.INVALID
      }
    });
  }

  return { locked: true };
}
