import type { WCACompetitionPayload, WCAHistoryResult } from "./wca";

// WCA person pages order by competition start DESC, ID ASC, round rank DESC.
// Ranks: the WCA repository's lib/static_data/round_types.json.
const rounds: Record<string, { label: string; rank: number }> = {
  "0": { label: "Qualification Round", rank: 19 },
  "1": { label: "First Round", rank: 29 },
  "2": { label: "Second Round", rank: 50 },
  "3": { label: "Third Round", rank: 79 },
  b: { label: "B Final", rank: 39 },
  c: { label: "Final", rank: 90 },
  d: { label: "First Round", rank: 20 },
  e: { label: "Second Round", rank: 59 },
  f: { label: "Final", rank: 99 },
  g: { label: "Third Round", rank: 70 },
  h: { label: "Qualification Round", rank: 10 }
};

export function getHistoryRoundLabel(roundId: string) {
  return rounds[roundId]?.label ?? "Unknown Round";
}

export function getRecentWCAResults(
  results: WCAHistoryResult[],
  competitions: Map<string, WCACompetitionPayload>,
  eventId: string,
  limit = 8
) {
  return results
    .filter((row) => row.event_id === eventId &&
      typeof row.round_type_id === "string" && Number.isFinite(row.average) &&
      competitions.has(row.competition_id))
    .sort((a, b) => {
      const aDate = competitions.get(a.competition_id)?.start_date ?? "";
      const bDate = competitions.get(b.competition_id)?.start_date ?? "";
      return bDate.localeCompare(aDate) ||
        a.competition_id.localeCompare(b.competition_id) ||
        (rounds[b.round_type_id]?.rank ?? 0) - (rounds[a.round_type_id]?.rank ?? 0);
    })
    .slice(0, limit);
}
