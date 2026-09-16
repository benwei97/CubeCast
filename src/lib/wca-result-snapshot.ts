type ResultRow = Record<string, unknown>;

export function asMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function resultKey(row: ResultRow) {
  const person = asMetadata(row.person);
  const round = asMetadata(row.round);
  const personId = row.person_id ?? person.wca_id ?? person.id;
  const roundId = row.round_type_id ?? round.id;
  if (!personId || !roundId || !row.event_id) {
    throw new Error("WCA result is missing its person, round, or event identifier.");
  }
  return JSON.stringify([row.event_id, roundId, personId]);
}

// Preserve the first observation of each person/event/round, adding only new rows.
export function mergeFirstObservedResults<T extends Record<string, unknown>>(
  metadata: T,
  incoming: ResultRow[],
  observedAt: string
) {
  const existing = Array.isArray(metadata.resultsSnapshot)
    ? metadata.resultsSnapshot.map(asMetadata)
    : [];
  const seen = new Set(existing.map(resultKey));
  const results = [...existing];
  for (const row of incoming) {
    const key = resultKey(row);
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ ...row, cubecastObservedAt: observedAt });
    }
  }
  return {
    ...metadata,
    resultsSnapshot: results,
    resultCount: results.length,
    resultsObservedAt: metadata.resultsObservedAt ?? (results.length ? observedAt : null)
  };
}
