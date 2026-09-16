export type PrizeEligibilityReason =
  | "PRIZES_DISABLED"
  | "CONTEST_PRIZES_DISABLED"
  | "ENTRY_NOT_FINALIZED"
  | "ENTRY_NOT_VALID"
  | "WCA_IDENTITY_REQUIRED"
  | "PARTICIPANT_RESTRICTED";

export type PrizeEligibilityInput = {
  contestPrizeEnabled: boolean;
  entryStatus: "DRAFT" | "VALID" | "LOCKED" | "FINALIZED" | "INVALID";
  globalPrizesEnabled: boolean;
  hasWcaIdentity: boolean;
  isParticipantRestricted?: boolean;
  pickCount: number;
  requiredPicks: number;
};

export type PrizeEligibilityResult = {
  eligible: boolean;
  reasons: PrizeEligibilityReason[];
};

export type PrizePayoutPosition = {
  amountCents: number;
  currency?: string;
  rank: number;
};

export type PrizeConfig = {
  enabled: boolean;
  payouts: PrizePayoutPosition[];
};

type PrizeConfigEnv = Record<string, string | undefined>;

export type PrizeLeaderboardEntry = {
  entryId: string;
  isSharedRank: boolean;
  rank: number;
  userId: string;
};

export type PlannedPrizeAward = {
  amountCents: number;
  currency: string;
  entryId: string;
  rank: number;
  userId: string;
};

const DEFAULT_PRIZE_CURRENCY = "USD";

export function getPrizeConfig(env: PrizeConfigEnv = process.env): PrizeConfig {
  return {
    enabled: env.PRIZES_ENABLED === "true",
    payouts: parsePrizePayouts(env.PRIZE_PAYOUTS_JSON)
  };
}

export function getPrizeEligibility({
  contestPrizeEnabled,
  entryStatus,
  globalPrizesEnabled,
  hasWcaIdentity,
  isParticipantRestricted = false,
  pickCount,
  requiredPicks
}: PrizeEligibilityInput): PrizeEligibilityResult {
  const reasons: PrizeEligibilityReason[] = [];

  if (!globalPrizesEnabled) {
    reasons.push("PRIZES_DISABLED");
  }

  if (!contestPrizeEnabled) {
    reasons.push("CONTEST_PRIZES_DISABLED");
  }

  if (entryStatus !== "FINALIZED") {
    reasons.push("ENTRY_NOT_FINALIZED");
  }

  if (pickCount !== requiredPicks || entryStatus === "INVALID") {
    reasons.push("ENTRY_NOT_VALID");
  }

  if (!hasWcaIdentity) {
    reasons.push("WCA_IDENTITY_REQUIRED");
  }

  if (isParticipantRestricted) {
    reasons.push("PARTICIPANT_RESTRICTED");
  }

  return {
    eligible: reasons.length === 0,
    reasons
  };
}

export function planPrizeAwards({
  leaderboardEntries,
  payouts
}: {
  leaderboardEntries: PrizeLeaderboardEntry[];
  payouts: PrizePayoutPosition[];
}): PlannedPrizeAward[] {
  if (payouts.length === 0 || leaderboardEntries.length === 0) {
    return [];
  }

  const payoutsByRank = new Map(
    payouts.map((payout) => [
      payout.rank,
      {
        ...payout,
        currency: payout.currency ?? DEFAULT_PRIZE_CURRENCY
      }
    ])
  );

  const sortedEntries = [...leaderboardEntries].sort(
    (left, right) => left.rank - right.rank || left.entryId.localeCompare(right.entryId)
  );
  const awards: PlannedPrizeAward[] = [];

  for (let index = 0; index < sortedEntries.length; ) {
    const rank = sortedEntries[index].rank;
    const tiedEntries = sortedEntries.filter((entry) => entry.rank === rank);
    const tiedPositionCount = tiedEntries.length;
    const coveredRanks = Array.from(
      { length: tiedPositionCount },
      (_, offset) => rank + offset
    );
    const coveredPayouts = coveredRanks
      .map((coveredRank) => payoutsByRank.get(coveredRank))
      .filter((payout): payout is PrizePayoutPosition & { currency: string } =>
        Boolean(payout)
      );

    if (coveredPayouts.length > 0) {
      const currency = coveredPayouts[0].currency;
      assertSingleCurrency(coveredPayouts, currency);

      const prizePoolCents = coveredPayouts.reduce(
        (total, payout) => total + payout.amountCents,
        0
      );
      const baseAwardCents = Math.floor(prizePoolCents / tiedPositionCount);
      const remainderCents = prizePoolCents % tiedPositionCount;
      const deterministicEntries = [...tiedEntries].sort((left, right) =>
        left.entryId.localeCompare(right.entryId)
      );

      deterministicEntries.forEach((entry, tiedIndex) => {
        awards.push({
          amountCents: baseAwardCents + (tiedIndex < remainderCents ? 1 : 0),
          currency,
          entryId: entry.entryId,
          rank: entry.rank,
          userId: entry.userId
        });
      });
    }

    index += tiedPositionCount;
  }

  return awards.sort(
    (left, right) => left.rank - right.rank || left.entryId.localeCompare(right.entryId)
  );
}

function parsePrizePayouts(rawPayouts: string | undefined): PrizePayoutPosition[] {
  if (!rawPayouts?.trim()) {
    return [];
  }

  const parsed = JSON.parse(rawPayouts) as PrizePayoutPosition[];

  if (!Array.isArray(parsed)) {
    throw new Error("PRIZE_PAYOUTS_JSON must be an array.");
  }

  return parsed.map((payout) => {
    if (!Number.isInteger(payout.rank) || payout.rank < 1) {
      throw new Error("Prize payout ranks must be positive integers.");
    }

    if (!Number.isInteger(payout.amountCents) || payout.amountCents < 0) {
      throw new Error("Prize payout amounts must be non-negative cents.");
    }

    return {
      amountCents: payout.amountCents,
      currency: payout.currency ?? DEFAULT_PRIZE_CURRENCY,
      rank: payout.rank
    };
  });
}

function assertSingleCurrency(
  payouts: Array<PrizePayoutPosition & { currency: string }>,
  currency: string
) {
  const hasMixedCurrency = payouts.some((payout) => payout.currency !== currency);

  if (hasMixedCurrency) {
    throw new Error("Tied prize positions must use the same currency.");
  }
}
