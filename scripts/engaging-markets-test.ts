import { strict as assert } from "node:assert";
import {
  createEngagingCandidates,
  generateEngagingRecommendations,
  getMatchupRelevance,
  ENGAGING_MARKET_CONFIG
} from "../src/lib/engaging-markets";
import { getSelectedContestTiming } from "../src/lib/contest-workflow";
import type { WCIFPublicPayload } from "../src/lib/wca";

function person(
  id: string,
  rank: number,
  eventId = "333"
): NonNullable<WCIFPublicPayload["persons"]>[number] {
  return {
    wcaId: id,
    name: id,
    registration: {
      status: "accepted",
      isCompeting: true,
      eventIds: [eventId]
    },
    personalBests: [
      { eventId, type: "average", best: 600 + rank, worldRanking: rank }
    ]
  };
}

async function main() {
  const excluded = person("unregistered", 1);
  excluded.registration!.eventIds = ["222"];
  const waiting = person("waiting", 1);
  waiting.registration!.status = "pending";
  const candidates = createEngagingCandidates([
    {
      id: "Small",
      name: "Small competition",
      persons: [
        person("A", 10),
        person("B", 15),
        person("Obscure", 500),
        excluded,
        waiting,
        person("A", 10)
      ]
    },
    {
      id: "Large",
      name: "Large competition",
      persons: [person("C", 80), person("D", 90)]
    }
  ]);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].competitionId, "Small");
  assert.ok(getMatchupRelevance(10, 15) > getMatchupRelevance(1, 100));
  const ranked = await generateEngagingRecommendations(
    candidates,
    async () => 50
  );
  assert.equal(ranked.markets[0].competitionId, "Small");
  assert.equal(ranked.markets.length, 2);
  const extreme = await generateEngagingRecommendations(
    candidates,
    async () => 70
  );
  assert.equal(extreme.markets.length, 0);
  const missing = await generateEngagingRecommendations(
    candidates,
    async () => {
      throw new Error("Odds unavailable");
    }
  );
  assert.equal(missing.markets.length, 0);
  assert.equal(missing.unavailable, 2);
  const close = await generateEngagingRecommendations(
    [candidates[0]],
    async () => 50
  );
  const lessClose = await generateEngagingRecommendations(
    [candidates[0]],
    async () => 35
  );
  assert.ok(close.markets[0].score > lessClose.markets[0].score);
  for (const probability of [35, 65]) {
    assert.equal(
      (
        await generateEngagingRecommendations(
          [candidates[0]],
          async () => probability
        )
      ).markets.length,
      1
    );
  }

  const field = createEngagingCandidates(
    Array.from({ length: 20 }, (_, index) => ({
      id: `Competition${index}`,
      name: `Competition${index}`,
      persons: Array.from({ length: 12 }, (_, personIndex) =>
        person(
          `Person${index}-${personIndex}`,
          personIndex + 1,
          index % 2 ? "333" : "222"
        )
      )
    }))
  );
  let requests = 0;
  const diverse = await generateEngagingRecommendations(field, async () => {
    requests++;
    return 50;
  });
  assert.ok(requests <= ENGAGING_MARKET_CONFIG.simulationBudget);
  assert.ok(diverse.markets.length >= 10);
  assert.ok(
    diverse.markets.length <= ENGAGING_MARKET_CONFIG.recommendationLimit
  );
  const counts = new Map<string, number>();
  for (const market of diverse.markets) {
    for (const key of [
      `person:${market.left.id}`,
      `person:${market.right.id}`,
      `event:${market.eventId}`,
      `competition:${market.competitionId}`
    ]) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of counts) {
    assert.ok(
      count <=
        (key.startsWith("person:")
          ? ENGAGING_MARKET_CONFIG.maxPerCompetitor
          : key.startsWith("event:")
            ? ENGAGING_MARKET_CONFIG.maxPerEvent
            : ENGAGING_MARKET_CONFIG.maxPerCompetition)
    );
  }
  const timing = getSelectedContestTiming([
    {
      startDate: new Date("2026-10-03T00:00:00Z"),
      endDate: new Date("2026-10-04T00:00:00Z")
    }
  ]);
  assert.equal(timing.lockAt.toISOString(), "2026-10-02T23:00:00.000Z");
  assert.throws(() => getSelectedContestTiming([]));
  console.log("Engaging market tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
