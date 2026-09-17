import { strict as assert } from "node:assert";
import { getWCAEventName } from "../src/lib/wca-events";
import {
  createEngagingCandidates,
  generateEngagingRecommendations,
  getMatchupRelevance,
  ENGAGING_MARKET_CONFIG
} from "../src/lib/engaging-markets";
import { getSelectedContestTiming } from "../src/lib/contest-workflow";
import type { WCIFPublicPayload } from "../src/lib/wca";
import { fetchWCAPublicWCIF, fetchWCACompetitionResults } from "../src/lib/wca";
import { getWCARateLimitDelay, WCARequestQueue } from "../src/lib/wca-request-queue";

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
  assert.equal(getWCAEventName("222", "222"), "2x2x2 Cube");
  assert.equal(getWCAEventName("333oh", "333oh"), "3x3x3 One-Handed");
  assert.equal(getWCAEventName("unknown", "Custom event"), "Custom event");
  assert.equal(getWCAEventName(null, null), "Event");
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
  const broader = createEngagingCandidates(
    [{ id: "Broader", name: "Broader", persons: [person("Rank100", 100), person("Rank250", 250), person("Rank500", 500), person("Rank501", 501)] }],
    500
  );
  assert.equal(broader.length, 3);
  const expandedField = createEngagingCandidates(
    Array.from({ length: 24 }, (_, index) => ({
      id: `Expanded${index}`,
      name: `Expanded${index}`,
      persons: [person(`Left${index}`, index < 4 ? 10 : 200, index % 2 ? "333" : "222"), person(`Right${index}`, index < 4 ? 20 : 220, index % 2 ? "333" : "222")]
    })), 500
  );
  const visited = new Set<string>();
  const expanded = await generateEngagingRecommendations(expandedField, async (candidate) => {
    assert.ok(!visited.has(candidate.competitionId), "Do not simulate a pair twice");
    visited.add(candidate.competitionId);
    return candidate.left.worldRank < 100 ? 80 : 50;
  });
  assert.equal(expanded.markets.length, 20);
  assert.equal(expanded.rankTier, 250);
  assert.equal(expanded.outsideProbabilityRange, 4);
  assert.equal(expanded.unavailable, 0);
  let checked = 0;
  const lateQualifiers = await generateEngagingRecommendations(
    Array.from({ length: 80 }, (_, index) => ({
      ...candidates[0],
      left: { ...candidates[0].left, id: `LateLeft${index}` },
      right: { ...candidates[0].right, id: `LateRight${index}` }
    })),
    async () => ++checked <= 40 ? 80 : 50
  );
  assert.equal(lateQualifiers.markets.length, 12, "Continue checking after initial one-sided odds; cap only qualified markets");
  assert.equal(lateQualifiers.simulated, 80);
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
  assert.equal(extreme.outsideProbabilityRange, 2);
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
  const exhausted = await generateEngagingRecommendations(field, async () => 80);
  assert.equal(exhausted.simulated, ENGAGING_MARKET_CONFIG.simulationBudget);
  assert.equal(exhausted.budgetExhausted, true);
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
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const originalTimeout = globalThis.setTimeout;
  let time = Date.now();
  try {
    Date.now = () => time;
    globalThis.setTimeout = ((callback: () => void, ms = 0) => {
      time += ms;
      return originalTimeout(callback, 0);
    }) as typeof setTimeout;
    for (const status of [429, 503]) {
      let calls = 0;
      globalThis.fetch = async (_input, options) => {
        calls++;
        if (calls === 1) return new Response("", { status, headers: { "retry-after": "0.001" } });
        assert.equal(options?.cache, "no-store", "Retries bypass cached errors");
        return Response.json({ persons: [] });
      };
      assert.deepEqual(await fetchWCAPublicWCIF(`RetryFixture${status}`), { persons: [] });
      assert.equal(calls, 2);
      await fetchWCAPublicWCIF(`RetryFixture${status}`);
      assert.equal(calls, 2, "Successful roster reads are reused");
    }
    let concurrentCalls = 0;
    globalThis.fetch = async () => {
      concurrentCalls++;
      return Response.json({ persons: [] });
    };
    await Promise.all([fetchWCAPublicWCIF("SharedFixture"), fetchWCAPublicWCIF("SharedFixture")]);
    assert.equal(concurrentCalls, 1, "Concurrent identical reads share one request");
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response("", { status: 404 });
    };
    await assert.rejects(fetchWCAPublicWCIF("MissingFixture"), /404/);
    assert.equal(calls, 1, "Permanent failures do not retry");
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response("", { status: 429 });
    };
    await assert.rejects(fetchWCACompetitionResults("FreshFixture"), /429/);
    assert.equal(calls, 1, "Settlement reads retain fail-fast behavior");
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    globalThis.setTimeout = originalTimeout;
  }
  let now = 0;
  const starts: number[] = [];
  const queue = new WCARequestQueue(2000, { now: () => now, sleep: async (ms) => { now += ms; } });
  await Promise.all(Array.from({ length: 3 }, () => queue.run(async () => { starts.push(now); })));
  assert.deepEqual(starts, [0, 2000, 4000]);
  await queue.run(async () => { queue.defer(30_000); });
  const cooldownStart = now;
  await queue.run(async () => { assert.equal(now, cooldownStart + 30_000); });
  await assert.rejects(queue.run(async () => { throw new Error("Failed fixture"); }));
  await queue.run(async () => { starts.push(now); });
  assert.equal(getWCARateLimitDelay(new Response("", { status: 429 }), 0), 30_000);
  assert.equal(getWCARateLimitDelay(new Response("", { status: 429 }), 2), 120_000);
  assert.equal(getWCARateLimitDelay(new Response("", { headers: { "retry-after": "45" } }), 0), 45_000);
  assert.equal(getWCARateLimitDelay(new Response("", { headers: { "retry-after": new Date(60_000).toUTCString() } }), 0, 0), 60_000);
  console.log("Engaging market tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
