import { strict as assert } from "node:assert";

import {
  calculateEntryScore,
  canAddPrediction,
  canModifyPrediction,
  getPickCounterLabel,
  getPredictionScoreChange,
  isValidLockedEntry,
  rankLeaderboardEntries,
  settleAdvancementMarket,
  settleHeadToHead,
  settlePerformanceAverageMarket,
  settlePlacementMarket,
  V1_BASE_SCORE
} from "../src/lib/v1-game";
import {
  getPrizeConfig,
  getPrizeEligibility,
  planPrizeAwards
} from "../src/lib/prizes";

function testScoring() {
  assert.equal(
    getPredictionScoreChange({ probability: 35, result: "CORRECT" }),
    65
  );
  assert.equal(
    getPredictionScoreChange({ probability: 35, result: "INCORRECT" }),
    -35
  );
  assert.equal(
    getPredictionScoreChange({ probability: 50, result: "CORRECT" }),
    50
  );
  assert.equal(
    getPredictionScoreChange({ probability: 50, result: "INCORRECT" }),
    -50
  );
  assert.equal(
    getPredictionScoreChange({ probability: 65, result: "CORRECT" }),
    35
  );
  assert.equal(
    getPredictionScoreChange({ probability: 65, result: "INCORRECT" }),
    -65
  );
  assert.equal(getPredictionScoreChange({ probability: 52, result: "VOID" }), 0);
  assert.equal(getPredictionScoreChange({ probability: 60, result: "TIE" }), 20);
  assert.equal(getPredictionScoreChange({ probability: 40, result: "TIE" }), 30);
  assert.equal(calculateEntryScore({ scoreChanges: [65, -40, 0] }), 1025);
  assert.equal(V1_BASE_SCORE, 1000);
}

function testEntryRules() {
  const lockAt = new Date("2027-01-01T12:00:00Z");
  const beforeLock = new Date("2027-01-01T11:59:59Z");
  const atLock = new Date("2027-01-01T12:00:00Z");

  assert.equal(isValidLockedEntry({ pickCount: 9 }), false);
  assert.equal(isValidLockedEntry({ pickCount: 10 }), true);
  assert.equal(canAddPrediction({ currentPickCount: 10, lockAt, now: beforeLock }), false);
  assert.equal(canAddPrediction({ currentPickCount: 9, lockAt, now: beforeLock }), true);
  assert.equal(canModifyPrediction({ lockAt, now: beforeLock }), true);
  assert.equal(canModifyPrediction({ lockAt, now: atLock }), false);
  assert.equal(getPickCounterLabel({ pickCount: 7 }), "7 / 10 Picks");
  assert.equal(
    getPickCounterLabel({ pickCount: 10 }),
    "10 / 10 Picks - Entry Complete"
  );
  assert.equal(
    getPickCounterLabel({ locked: true, pickCount: 9 }),
    "9 / 10 Picks - Entry Invalid"
  );
}

function testHeadToHeadSettlement() {
  assert.equal(
    settleHeadToHead({
      competitorA: { participated: true, placement: 8, roundRank: 3 },
      competitorB: { participated: true, placement: 1, roundRank: 2 }
    }),
    "A"
  );
  assert.equal(
    settleHeadToHead({
      competitorA: { participated: true, placement: 2, roundRank: 3 },
      competitorB: { participated: true, placement: 5, roundRank: 3 }
    }),
    "A"
  );
  assert.equal(
    settleHeadToHead({
      competitorA: { participated: true, placement: 2, resultKey: "5.80", roundRank: 3 },
      competitorB: { participated: true, placement: 2, resultKey: "5.80", roundRank: 3 }
    }),
    "TIE"
  );
  assert.equal(
    settleHeadToHead({
      competitorA: { participated: false, placement: 0, roundRank: 0 },
      competitorB: { participated: true, placement: 1, roundRank: 3 }
    }),
    "VOID"
  );
}

function testAdvancementSettlement() {
  assert.equal(
    settleAdvancementMarket({
      cutoffPlacement: 8,
      participated: true,
      qualifyingPlacement: 8
    }),
    "YES"
  );
  assert.equal(
    settleAdvancementMarket({
      cutoffPlacement: 8,
      participated: true,
      qualifyingPlacement: 9
    }),
    "NO"
  );
}

function testPlacementSettlement() {
  assert.equal(
    settlePlacementMarket({
      competedInFinal: false,
      finalPlacement: null,
      participatedInEvent: true,
      thresholdPlacement: 8
    }),
    "NO"
  );
  assert.equal(
    settlePlacementMarket({
      competedInFinal: true,
      finalPlacement: 3,
      participatedInEvent: true,
      thresholdPlacement: 3
    }),
    "YES"
  );
  assert.equal(
    settlePlacementMarket({
      competedInFinal: false,
      finalPlacement: null,
      participatedInEvent: false,
      thresholdPlacement: 8
    }),
    "VOID"
  );
}

function testPerformanceSettlement() {
  assert.equal(
    settlePerformanceAverageMarket({
      averages: [6.12, 5.79, null],
      participatedInEvent: true,
      threshold: 5.8
    }),
    "YES"
  );
  assert.equal(
    settlePerformanceAverageMarket({
      averages: [6.12, null, 5.91],
      participatedInEvent: true,
      threshold: 5.8
    }),
    "NO"
  );
  assert.equal(
    settlePerformanceAverageMarket({
      averages: [],
      participatedInEvent: false,
      threshold: 5.8
    }),
    "VOID"
  );
}

function testLeaderboardRanking() {
  const rankedEntries = rankLeaderboardEntries([
    {
      correctCount: 8,
      entryId: "entry-c",
      finalScore: 1200,
      hardestCorrectProbability: 35,
      userId: "user-c"
    },
    {
      correctCount: 7,
      entryId: "entry-b",
      finalScore: 1200,
      hardestCorrectProbability: 35,
      userId: "user-b"
    },
    {
      correctCount: 8,
      entryId: "entry-a",
      finalScore: 1200,
      hardestCorrectProbability: 40,
      userId: "user-a"
    },
    {
      correctCount: 8,
      entryId: "entry-d",
      finalScore: 1199,
      hardestCorrectProbability: 35,
      userId: "user-d"
    },
    {
      correctCount: 8,
      entryId: "entry-e",
      finalScore: 1200,
      hardestCorrectProbability: 35,
      userId: "user-e"
    }
  ]);

  assert.deepEqual(
    rankedEntries.map((entry) => ({
      entryId: entry.entryId,
      isSharedRank: entry.isSharedRank,
      rank: entry.rank
    })),
    [
      { entryId: "entry-c", isSharedRank: true, rank: 1 },
      { entryId: "entry-e", isSharedRank: true, rank: 1 },
      { entryId: "entry-a", isSharedRank: false, rank: 3 },
      { entryId: "entry-b", isSharedRank: false, rank: 4 },
      { entryId: "entry-d", isSharedRank: false, rank: 5 }
    ]
  );
}

function testPrizeDisabledLayer() {
  assert.deepEqual(getPrizeConfig({ PRIZES_ENABLED: "false" }).payouts, []);
  assert.equal(getPrizeConfig({ PRIZES_ENABLED: "false" }).enabled, false);
  assert.deepEqual(
    getPrizeConfig({
      PRIZES_ENABLED: "true",
      PRIZE_PAYOUTS_JSON:
        '[{"rank":1,"amountCents":10000},{"rank":2,"amountCents":5000}]'
    }),
    {
      enabled: true,
      payouts: [
        { amountCents: 10000, currency: "USD", rank: 1 },
        { amountCents: 5000, currency: "USD", rank: 2 }
      ]
    }
  );

  assert.deepEqual(
    getPrizeEligibility({
      contestPrizeEnabled: false,
      entryStatus: "FINALIZED",
      globalPrizesEnabled: false,
      hasWcaIdentity: true,
      pickCount: 10,
      requiredPicks: 10
    }),
    {
      eligible: false,
      reasons: ["PRIZES_DISABLED", "CONTEST_PRIZES_DISABLED"]
    }
  );

  assert.deepEqual(
    getPrizeEligibility({
      contestPrizeEnabled: true,
      entryStatus: "FINALIZED",
      globalPrizesEnabled: true,
      hasWcaIdentity: true,
      pickCount: 10,
      requiredPicks: 10
    }),
    {
      eligible: true,
      reasons: []
    }
  );

  assert.deepEqual(
    getPrizeEligibility({
      contestPrizeEnabled: true,
      entryStatus: "FINALIZED",
      globalPrizesEnabled: true,
      hasWcaIdentity: true,
      isParticipantRestricted: true,
      pickCount: 10,
      requiredPicks: 10
    }),
    {
      eligible: false,
      reasons: ["PARTICIPANT_RESTRICTED"]
    }
  );

  assert.deepEqual(
    planPrizeAwards({
      leaderboardEntries: [
        { entryId: "entry-b", isSharedRank: true, rank: 1, userId: "user-b" },
        { entryId: "entry-a", isSharedRank: true, rank: 1, userId: "user-a" },
        { entryId: "entry-c", isSharedRank: false, rank: 3, userId: "user-c" }
      ],
      payouts: [
        { amountCents: 10000, rank: 1 },
        { amountCents: 5000, rank: 2 },
        { amountCents: 2500, rank: 3 }
      ]
    }),
    [
      {
        amountCents: 7500,
        currency: "USD",
        entryId: "entry-a",
        rank: 1,
        userId: "user-a"
      },
      {
        amountCents: 7500,
        currency: "USD",
        entryId: "entry-b",
        rank: 1,
        userId: "user-b"
      },
      {
        amountCents: 2500,
        currency: "USD",
        entryId: "entry-c",
        rank: 3,
        userId: "user-c"
      }
    ]
  );
}

function main() {
  testScoring();
  testEntryRules();
  testHeadToHeadSettlement();
  testAdvancementSettlement();
  testPlacementSettlement();
  testPerformanceSettlement();
  testLeaderboardRanking();
  testPrizeDisabledLayer();
  console.log("V1 game rule tests passed.");
}

main();
