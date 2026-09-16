import {
  AdminActionType,
  ContestEntryStatus,
  ContestSlateStatus,
  MarketStatus,
  PredictionResultStatus,
  SettlementStatus,
  type Prisma,
  type PrismaClient
} from "@prisma/client";

import {
  calculateEntryScore,
  getPredictionScoreChange,
  isValidLockedEntry,
  rankLeaderboardEntries,
  type PredictionScoreResult
} from "@/lib/v1-game";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function resolveV1Market({
  adminUserId,
  sourceEvidence,
  marketId,
  sourceNote,
  sourceUrl,
  winningMarketOptionId
}: {
  adminUserId: string;
  sourceEvidence?: SettlementSourceEvidence;
  marketId: string;
  sourceNote?: string;
  sourceUrl?: string;
  winningMarketOptionId: string;
}) {
  return settleV1Market({
    adminUserId,
    marketId,
    sourceEvidence,
    sourceNote,
    sourceUrl,
    winningMarketOptionId
  });
}

export async function tieV1Market({
  adminUserId,
  marketId,
  sourceNote,
  sourceUrl
}: {
  adminUserId: string;
  marketId: string;
  sourceNote?: string;
  sourceUrl?: string;
}) {
  return settleV1Market({
    adminUserId,
    isTie: true,
    marketId,
    sourceNote,
    sourceUrl
  });
}

export async function voidV1Market({
  adminUserId,
  marketId,
  reason,
  sourceUrl
}: {
  adminUserId: string;
  marketId: string;
  reason: string;
  sourceUrl?: string;
}) {
  return settleV1Market({
    adminUserId,
    isVoid: true,
    marketId,
    sourceNote: reason,
    sourceUrl
  });
}

async function settleV1Market({
  adminUserId,
  isTie = false,
  isVoid = false,
  marketId,
  sourceEvidence,
  sourceNote,
  sourceUrl,
  winningMarketOptionId
}: {
  adminUserId: string;
  isTie?: boolean;
  isVoid?: boolean;
  marketId: string;
  sourceEvidence?: SettlementSourceEvidence;
  sourceNote?: string;
  sourceUrl?: string;
  winningMarketOptionId?: string;
}) {
  const { prisma } = await import("@/lib/prisma");

  return prisma.$transaction(async (tx) => {
    const market = await tx.market.findUnique({
      where: { id: marketId },
      include: {
        options: true,
        predictions: true,
        slate: {
          select: {
            id: true
          }
        }
      }
    });

    if (!market?.slateId || !market.slate) {
      throw new Error("Only contest markets can be settled here.");
    }

    if (
      market.status === MarketStatus.RESOLVED ||
      market.status === MarketStatus.VOID
    ) {
      throw new Error("This market is already terminal.");
    }

    const winningOption = winningMarketOptionId
      ? market.options.find((option) => option.id === winningMarketOptionId)
      : null;

    if (!isVoid && !isTie && !winningOption) {
      throw new Error("Choose a winning outcome.");
    }

    if (winningOption && winningOption.marketId !== market.id) {
      throw new Error("Winning outcome does not belong to this market.");
    }

    const nextMarketStatus = isVoid ? MarketStatus.VOID : MarketStatus.RESOLVED;
    const settlementStatus = isVoid ? SettlementStatus.VOID : SettlementStatus.RESOLVED;
    const settledAt = new Date();
    const observedPublicationAt =
      getObservedPublicationAt(sourceEvidence) ?? settledAt;

    await tx.market.update({
      where: { id: market.id },
      data: {
        resolvedAt: settledAt,
        status: nextMarketStatus,
        voidReason: isVoid ? sourceNote ?? "Voided by admin." : null
      }
    });

    await tx.settlementSnapshot.create({
      data: {
        marketId: market.id,
        observedPublicationAt,
        ruleVersion: market.settlementRuleVersion,
        settledAt,
        settledByUserId: adminUserId,
        snapshot: {
          marketId: market.id,
          question: market.question,
          result: isVoid ? "VOID" : isTie ? "TIE" : "RESOLVED",
          sourceEvidence: sourceEvidence ?? null,
          sourceNote: sourceNote ?? null,
          winningMarketOptionId: winningOption?.id ?? null,
          winningMarketOptionLabel: winningOption?.label ?? null
        },
        sourceCompetitionId: sourceEvidence?.wcaCompetitionId ?? market.competitionId,
        sourceEventId: sourceEvidence?.eventId ?? market.eventId,
        sourcePersonId: sourceEvidence?.personId ?? null,
        sourceRoundId: sourceEvidence?.roundId ?? null,
        sourceUrl: sourceUrl || sourceEvidence?.sourceUrl || null,
        placement: sourceEvidence?.placement ?? null,
        resultValue: getSettlementResultValue(sourceEvidence),
        status: settlementStatus,
        winningMarketOptionId: winningOption?.id ?? null
      }
    });

    await tx.adminAction.create({
      data: {
        actionType: isVoid
          ? AdminActionType.MARKET_VOID
          : AdminActionType.MARKET_SETTLE,
        adminUserId,
        marketId: market.id,
        metadata: {
          result: isVoid ? "VOID" : isTie ? "TIE" : "RESOLVED",
          sourceEvidence: sourceEvidence ?? null,
          sourceNote: sourceNote ?? null,
          winningMarketOptionId: winningOption?.id ?? null
        },
        slateId: market.slateId
      }
    });

    for (const prediction of market.predictions) {
      const resultStatus = getPredictionResultStatus({
        isTie,
        isVoid,
        selectedMarketOptionId: prediction.selectedMarketOptionId,
        winningMarketOptionId: winningOption?.id
      });

      await tx.prediction.update({
        where: { id: prediction.id },
        data: {
          resultStatus,
          scoreChange: getPredictionScoreChange({
            probability: prediction.selectedProbability,
            result: resultStatus
          })
        }
      });
    }

    await refreshV1SlateScores(tx, market.slateId);

    return { marketId: market.id, slateId: market.slateId };
  });
}

export type SettlementSourceEvidence = {
  average?: number | null;
  best?: number | null;
  eventId?: string | null;
  eventName?: string | null;
  observedAt?: string | null;
  personId?: string | null;
  personName?: string | null;
  placement?: number | null;
  rawResult?: Prisma.InputJsonValue | null;
  roundId?: string | null;
  roundName?: string | null;
  sourceUrl?: string | null;
  wcaCompetitionId?: string | null;
  wcaId?: string | null;
};

function getSettlementResultValue(sourceEvidence?: SettlementSourceEvidence) {
  if (!sourceEvidence) {
    return null;
  }

  const parts = [
    sourceEvidence.average != null ? `avg ${sourceEvidence.average}` : null,
    sourceEvidence.best != null ? `best ${sourceEvidence.best}` : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function getObservedPublicationAt(sourceEvidence?: SettlementSourceEvidence) {
  if (!sourceEvidence?.observedAt) {
    return null;
  }

  const observedAt = new Date(sourceEvidence.observedAt);

  return Number.isNaN(observedAt.getTime()) ? null : observedAt;
}

export async function refreshV1SlateScores(
  tx: TransactionClient,
  slateId: string
) {
  const slate = await tx.contestSlate.findUnique({
    where: { id: slateId },
    include: {
      entries: {
        include: {
          predictions: true,
          user: {
            select: { id: true }
          }
        }
      },
      markets: {
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  if (!slate) {
    throw new Error("Contest not found.");
  }

  const terminalMarketStatuses = new Set<MarketStatus>([
    MarketStatus.RESOLVED,
    MarketStatus.VOID,
    MarketStatus.CANCELED
  ]);
  const isSlateTerminal = slate.markets.every((market) =>
    terminalMarketStatuses.has(market.status)
  );

  await tx.leaderboardEntry.deleteMany({
    where: { slateId }
  });

  const leaderboardInputs = [];

  for (const entry of slate.entries) {
    const isValidEntry = isValidLockedEntry({
      pickCount: entry.predictions.length,
      requiredPicks: slate.maxPicks
    });

    if (!isValidEntry) {
      await tx.contestEntry.update({
        where: { id: entry.id },
        data: {
          finalScore: null,
          status: ContestEntryStatus.INVALID
        }
      });
      continue;
    }

    const correctPredictions = entry.predictions.filter(
      (prediction) => prediction.resultStatus === PredictionResultStatus.CORRECT
    );
    const scoreChanges = entry.predictions.map(
      (prediction) => prediction.scoreChange ?? 0
    );
    const finalScore = calculateEntryScore({
      baseScore: entry.baseScore,
      scoreChanges
    });
    const hardestCorrectProbability =
      correctPredictions.length > 0
        ? Math.min(
            ...correctPredictions.map((prediction) => prediction.selectedProbability)
          )
        : null;
    const nextEntryStatus = isSlateTerminal
      ? ContestEntryStatus.FINALIZED
      : ContestEntryStatus.VALID;

    await tx.contestEntry.update({
      where: { id: entry.id },
      data: {
        correctCount: correctPredictions.length,
        finalScore,
        finalizedAt: isSlateTerminal ? new Date() : null,
        hardestCorrectProbability,
        status: nextEntryStatus
      }
    });

    leaderboardInputs.push({
      correctCount: correctPredictions.length,
      entryId: entry.id,
      finalScore,
      hardestCorrectProbability,
      userId: entry.user.id
    });
  }

  const rankedEntries = rankLeaderboardEntries(leaderboardInputs);

  for (const rankedEntry of rankedEntries) {
    await tx.leaderboardEntry.create({
      data: {
        correctCount: rankedEntry.correctCount,
        entryId: rankedEntry.entryId,
        finalScore: rankedEntry.finalScore,
        hardestCorrectProbability: rankedEntry.hardestCorrectProbability,
        isSharedRank: rankedEntry.isSharedRank,
        rank: rankedEntry.rank,
        slateId,
        userId: rankedEntry.userId
      }
    });
  }

  await tx.contestSlate.update({
    where: { id: slateId },
    data: {
      finalizedAt: isSlateTerminal ? new Date() : null,
      status: isSlateTerminal
        ? ContestSlateStatus.FINALIZED
        : ContestSlateStatus.SETTLING
    }
  });
}

function getPredictionResultStatus({
  isTie,
  isVoid,
  selectedMarketOptionId,
  winningMarketOptionId
}: {
  isTie: boolean;
  isVoid: boolean;
  selectedMarketOptionId: string;
  winningMarketOptionId?: string;
}): PredictionScoreResult {
  if (isVoid) {
    return PredictionResultStatus.VOID;
  }

  if (isTie) {
    return PredictionResultStatus.TIE;
  }

  return selectedMarketOptionId === winningMarketOptionId
    ? PredictionResultStatus.CORRECT
    : PredictionResultStatus.INCORRECT;
}
