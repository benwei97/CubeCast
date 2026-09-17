# Market Recommendations

CubeCast recommends matchups before choosing featured competitions. Competition size does not determine recommendation quality.

## Eligibility

Search non-cancelled global competitions in the contest's discovery window whose prediction deadlines have not passed. Read accepted public WCIF registrations. Both people in a matchup must be registered for the same event, have WCA IDs, have a valid average personal best, and have event-specific average world rankings at or above world top 100.

The initial supported events remain 2x2, 3x3, one-handed 3x3, 4x4, and 5x5, matching the existing H2H generator.

## Shortlisting and Probabilities

Consider pairs among the top 16 eligible competitors per event/competition, rather than only adjacent personal bests. Shortlist using world-rank relevance and PB similarity. PB similarity never supplies a probability.

Request WCA Odds simulations for at most 60 shortlisted pairs, sequentially with existing request spacing/retries. Use the existing one-year history and 180-day half-life settings. Reject unavailable probabilities and probabilities outside 35%-65%. There is no fallback model.

## Recommendation Score

For average world ranks a and b:

relevance = 1 - (0.6 * log10(max(a,b)) + 0.4 * log10(sqrt(a*b))) / log10(100)

closeness = 1 - abs(probability - 50) / 15

score = 70 * relevance + 30 * closeness

The weaker competitor's rank receives extra weight so one famous competitor does not carry an obscure matchup. Rankings proxy recognition; the score is not a measured popularity or model-confidence estimate.

Select up to 30 candidates in descending score order, with configurable caps of four appearances per competitor, twelve markets per competition, and sixteen per event. Shortlisting has looser diversity caps so simulations are not consumed by one field. All constants live in src/lib/engaging-markets.ts.

If strong candidates are scarce, show fewer rather than padding. At least ten included markets are required to publish a playable contest.

## Admin Review and Publication

Default to recommendation order, with an optional competition-grouped view. All recommendations are preselected. Show world ranks, fixed probabilities, event, competition, and a short reason.

Refresh replaces unpublished candidates only after new results are ready. No-op/failed searches preserve the saved draft. Old competition-first drafts are labelled; they are not silently repriced.

Publish included markets and activate the contest in one transaction. Derive featured competitions and timing from included markets, dropping competitions with no included markets. Set the global lock one hour before the earliest included scheduled start. The current WCA ingestion uses competition dates as start timestamps; precise schedule/timezone ingestion remains a separate limitation.

Published probabilities never change when recommendations refresh. Existing user pick rules, scoring, settlement evidence, automatic result monitoring, and historical contests remain unchanged.

## Verification

npm run test:v1 includes deterministic recommendation tests: registration/event/ranking eligibility, small-competition relevance, weaker-rank weighting, tightness, unavailable odds, simulation budgets, diversity limits, and derived lock times.
