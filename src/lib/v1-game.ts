export const V1_BASE_SCORE = 1000;
export const V1_REQUIRED_PICKS = 10;

export type PredictionScoreResult = "CORRECT" | "INCORRECT" | "VOID" | "TIE";
export type BinarySettlementOutcome = "YES" | "NO" | "VOID";
export type H2HSettlementOutcome = "A" | "B" | "TIE" | "VOID";

export type LeaderboardInput = {
  entryId: string;
  userId: string;
  finalScore: number;
  correctCount: number;
  hardestCorrectProbability: number | null;
};

export type RankedLeaderboardEntry = LeaderboardInput & {
  rank: number;
  isSharedRank: boolean;
};

export type LockedEntryStatus = "LOCKED" | "INVALID";

export function getPredictionScoreChange({
  probability,
  result
}: {
  probability: number;
  result: PredictionScoreResult;
}) {
  assertValidProbability(probability);

  switch (result) {
    case "CORRECT":
      return 100 - probability;
    case "INCORRECT":
      return -probability;
    case "TIE":
      return (100 - probability) / 2;
    case "VOID":
      return 0;
    default:
      assertNever(result);
  }
}

export function calculateEntryScore({
  baseScore = V1_BASE_SCORE,
  scoreChanges
}: {
  baseScore?: number;
  scoreChanges: number[];
}) {
  return scoreChanges.reduce((total, scoreChange) => total + scoreChange, baseScore);
}

export function isValidLockedEntry({
  pickCount,
  requiredPicks = V1_REQUIRED_PICKS
}: {
  pickCount: number;
  requiredPicks?: number;
}) {
  return pickCount === requiredPicks;
}

export function getLockedEntryStatus({
  pickCount,
  requiredPicks = V1_REQUIRED_PICKS
}: {
  pickCount: number;
  requiredPicks?: number;
}): LockedEntryStatus {
  return isValidLockedEntry({ pickCount, requiredPicks }) ? "LOCKED" : "INVALID";
}

export function canAddPrediction({
  currentPickCount,
  lockAt,
  maxPicks = V1_REQUIRED_PICKS,
  now = new Date()
}: {
  currentPickCount: number;
  lockAt: Date;
  maxPicks?: number;
  now?: Date;
}) {
  return now < lockAt && currentPickCount < maxPicks;
}

export function canModifyPrediction({
  lockAt,
  now = new Date()
}: {
  lockAt: Date;
  now?: Date;
}) {
  return now < lockAt;
}

export function getPickCounterLabel({
  locked = false,
  pickCount,
  requiredPicks = V1_REQUIRED_PICKS
}: {
  locked?: boolean;
  pickCount: number;
  requiredPicks?: number;
}) {
  if (pickCount === requiredPicks) {
    return `${pickCount} / ${requiredPicks} Picks - Entry Complete`;
  }

  if (locked && pickCount < requiredPicks) {
    return `${pickCount} / ${requiredPicks} Picks - Entry Invalid`;
  }

  return `${pickCount} / ${requiredPicks} Picks`;
}

export function rankLeaderboardEntries(
  entries: LeaderboardInput[]
): RankedLeaderboardEntry[] {
  const sortedEntries = [...entries].sort(compareLeaderboardEntries);

  return sortedEntries.map((entry, index) => {
    const previousEntry = sortedEntries[index - 1];
    const rank =
      previousEntry && areLeaderboardTiebreakersEqual(previousEntry, entry)
        ? previousEntryRank(sortedEntries, index)
        : index + 1;

    const isSharedRank =
      Boolean(previousEntry && areLeaderboardTiebreakersEqual(previousEntry, entry)) ||
      Boolean(
        sortedEntries[index + 1] &&
          areLeaderboardTiebreakersEqual(entry, sortedEntries[index + 1])
      );

    return {
      ...entry,
      rank,
      isSharedRank
    };
  });
}

function previousEntryRank(entries: LeaderboardInput[], currentIndex: number) {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (!areLeaderboardTiebreakersEqual(entries[index], entries[currentIndex])) {
      return index + 2;
    }
  }

  return 1;
}

function compareLeaderboardEntries(left: LeaderboardInput, right: LeaderboardInput) {
  if (right.finalScore !== left.finalScore) {
    return right.finalScore - left.finalScore;
  }

  if (right.correctCount !== left.correctCount) {
    return right.correctCount - left.correctCount;
  }

  const leftHardest = left.hardestCorrectProbability ?? Number.POSITIVE_INFINITY;
  const rightHardest = right.hardestCorrectProbability ?? Number.POSITIVE_INFINITY;

  if (leftHardest !== rightHardest) {
    return leftHardest - rightHardest;
  }

  return left.entryId.localeCompare(right.entryId);
}

function areLeaderboardTiebreakersEqual(
  left: LeaderboardInput,
  right: LeaderboardInput
) {
  return (
    left.finalScore === right.finalScore &&
    left.correctCount === right.correctCount &&
    left.hardestCorrectProbability === right.hardestCorrectProbability
  );
}

export function settleHeadToHead({
  competitorA,
  competitorB
}: {
  competitorA: H2HCompetitorResult;
  competitorB: H2HCompetitorResult;
}): H2HSettlementOutcome {
  if (!competitorA.participated || !competitorB.participated) {
    return "VOID";
  }

  if (competitorA.roundRank !== competitorB.roundRank) {
    return competitorA.roundRank > competitorB.roundRank ? "A" : "B";
  }

  if (competitorA.placement !== competitorB.placement) {
    return competitorA.placement < competitorB.placement ? "A" : "B";
  }

  return "TIE";
}

export type H2HCompetitorResult = {
  participated: boolean;
  roundRank: number;
  placement: number;
  resultKey?: string | null;
};

export function settleAdvancementMarket({
  cutoffPlacement,
  qualifyingPlacement,
  participated
}: {
  cutoffPlacement: number;
  qualifyingPlacement: number | null;
  participated: boolean;
}): BinarySettlementOutcome {
  if (!participated || qualifyingPlacement === null) {
    return "VOID";
  }

  return qualifyingPlacement <= cutoffPlacement ? "YES" : "NO";
}

export function settlePlacementMarket({
  competedInFinal,
  finalPlacement,
  participatedInEvent,
  thresholdPlacement
}: {
  competedInFinal: boolean;
  finalPlacement: number | null;
  participatedInEvent: boolean;
  thresholdPlacement: number;
}): BinarySettlementOutcome {
  if (!participatedInEvent) {
    return "VOID";
  }

  if (!competedInFinal || finalPlacement === null) {
    return "NO";
  }

  return finalPlacement <= thresholdPlacement ? "YES" : "NO";
}

export function settlePerformanceAverageMarket({
  averages,
  participatedInEvent,
  threshold
}: {
  averages: Array<number | null>;
  participatedInEvent: boolean;
  threshold: number;
}): BinarySettlementOutcome {
  if (!participatedInEvent) {
    return "VOID";
  }

  return averages.some((average) => average !== null && average < threshold)
    ? "YES"
    : "NO";
}

function assertValidProbability(probability: number) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
    throw new Error("Probability must be between 0 and 100.");
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${value}`);
}
