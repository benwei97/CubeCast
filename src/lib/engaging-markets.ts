import type { WCIFPublicPayload } from "@/lib/wca";

export const ENGAGING_MARKET_CONFIG = {
  maxWorldRank: 100,
  competitorsPerEvent: 16,
  simulationBudget: 60,
  recommendationLimit: 30,
  minProbability: 35,
  maxProbability: 65,
  relevanceWeight: 70,
  closenessWeight: 30,
  maxPerCompetitor: 4,
  maxPerCompetition: 12,
  maxPerEvent: 16,
  eventIds: ["222", "333", "333oh", "444", "555"]
};

type Person = NonNullable<WCIFPublicPayload["persons"]>[number];
type RankedCompetitor = {
  id: string;
  name: string;
  worldRank: number;
  average: number;
};
export type EngagingMatchup = {
  competitionId: string;
  competitionName: string;
  eventId: string;
  left: RankedCompetitor;
  right: RankedCompetitor;
  relevance: number;
  preflightScore: number;
};
export type EngagingRecommendation = EngagingMatchup & {
  probability: number;
  score: number;
};

function rankedCompetitor(
  person: Person,
  eventId: string
): RankedCompetitor | null {
  if (
    !person.wcaId ||
    person.registration?.status !== "accepted" ||
    person.registration.isCompeting === false ||
    !person.registration.eventIds?.includes(eventId)
  )
    return null;
  const best = person.personalBests?.find(
    (row) => row.eventId === eventId && row.type === "average"
  );
  const rank = best?.worldRanking;
  if (
    !best ||
    !Number.isFinite(best.best) ||
    best.best <= 0 ||
    !rank ||
    !Number.isInteger(rank) ||
    rank < 1 ||
    rank > ENGAGING_MARKET_CONFIG.maxWorldRank
  )
    return null;
  return {
    id: person.wcaId,
    name: person.name,
    worldRank: rank,
    average: best.best
  };
}

export function getMatchupRelevance(leftRank: number, rightRank: number) {
  // Weight the weaker rank most heavily; one star cannot carry an obscure opponent.
  const weaker = Math.log10(Math.max(leftRank, rightRank));
  const mean = (Math.log10(leftRank) + Math.log10(rightRank)) / 2;
  return Math.max(
    0,
    1 -
      (0.6 * weaker + 0.4 * mean) /
        Math.log10(ENGAGING_MARKET_CONFIG.maxWorldRank)
  );
}

export function createEngagingCandidates(
  competitions: {
    id: string;
    name: string;
    persons: Person[];
  }[]
) {
  const candidates: EngagingMatchup[] = [];
  for (const competition of competitions) {
    for (const eventId of ENGAGING_MARKET_CONFIG.eventIds) {
      const people = [
        ...new Map(
          competition.persons
            .map((person) => {
              const ranked = rankedCompetitor(person, eventId);
              return [ranked?.id, ranked] as const;
            })
            .filter(
              (pair): pair is readonly [string, RankedCompetitor] =>
                pair[1] !== null
            )
        ).values()
      ]
        .sort((a, b) => a.worldRank - b.worldRank || a.id.localeCompare(b.id))
        .slice(0, ENGAGING_MARKET_CONFIG.competitorsPerEvent);
      for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
          const left = people[i],
            right = people[j];
          const relevance = getMatchupRelevance(
            left.worldRank,
            right.worldRank
          );
          const similarity =
            Math.min(left.average, right.average) /
            Math.max(left.average, right.average);
          candidates.push({
            competitionId: competition.id,
            competitionName: competition.name,
            eventId,
            left,
            right,
            relevance,
            // PB similarity only shortlists simulations; it never becomes a probability.
            preflightScore: relevance * 85 + similarity * 15
          });
        }
      }
    }
  }
  return candidates.sort(
    (a, b) =>
      b.preflightScore - a.preflightScore ||
      matchupKey(a).localeCompare(matchupKey(b))
  );
}

function matchupKey(candidate: EngagingMatchup) {
  return [
    candidate.competitionId,
    candidate.eventId,
    candidate.left.id,
    candidate.right.id
  ].join(":");
}

function diverseSelection<T extends EngagingMatchup>(
  candidates: T[],
  limit: number,
  caps: { competitor: number; competition: number; event: number }
) {
  const counts = new Map<string, number>();
  const selected: T[] = [];
  for (const candidate of candidates) {
    const keys: [string, number][] = [
      [`person:${candidate.left.id}`, caps.competitor],
      [`person:${candidate.right.id}`, caps.competitor],
      [`competition:${candidate.competitionId}`, caps.competition],
      [`event:${candidate.eventId}`, caps.event]
    ];
    if (keys.some(([key, cap]) => (counts.get(key) ?? 0) >= cap)) continue;
    selected.push(candidate);
    keys.forEach(([key]) => counts.set(key, (counts.get(key) ?? 0) + 1));
    if (selected.length >= limit) break;
  }
  return selected;
}

export async function generateEngagingRecommendations(
  candidates: EngagingMatchup[],
  simulate: (candidate: EngagingMatchup) => Promise<number | null>
) {
  const config = ENGAGING_MARKET_CONFIG;
  const shortlist = diverseSelection(candidates, config.simulationBudget, {
    competitor: 8,
    competition: 12,
    event: 30
  });
  const qualified: EngagingRecommendation[] = [];
  let unavailable = 0;
  for (const candidate of shortlist) {
    let probability: number | null;
    try {
      probability = await simulate(candidate);
    } catch {
      probability = null;
    }
    if (probability === null || !Number.isFinite(probability)) {
      unavailable++;
      continue;
    }
    if (
      probability < config.minProbability ||
      probability > config.maxProbability
    )
      continue;
    const closeness = 1 - Math.abs(probability - 50) / 15;
    qualified.push({
      ...candidate,
      probability,
      score:
        candidate.relevance * config.relevanceWeight +
        closeness * config.closenessWeight
    });
  }
  qualified.sort(
    (a, b) => b.score - a.score || matchupKey(a).localeCompare(matchupKey(b))
  );
  return {
    markets: diverseSelection(qualified, config.recommendationLimit, {
      competitor: config.maxPerCompetitor,
      competition: config.maxPerCompetition,
      event: config.maxPerEvent
    }),
    simulated: shortlist.length,
    unavailable
  };
}
