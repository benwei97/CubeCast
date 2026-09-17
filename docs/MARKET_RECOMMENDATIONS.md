# Market Recommendations

CubeCast recommends matchups before choosing featured competitions. Competition size does not determine recommendation quality.

## Review and Research

Recommendation metadata now records WCA Odds source, history start/end, 180-day half-life, DNF setting, generation timestamp, and competitor average PBs/ranks. These are saved with the market; supplementary current WCA records and recent official round averages on detail pages are separately labelled and never reprice it. Existing markets are not backfilled with fabricated generation context.

Each candidate has an admin-only market preview and a contest-scoped competition preview. Include/exclude decisions are persisted as preparation.excludedMarketIds, shared with the main publisher, and reset when a successful regeneration replaces candidates. All candidates start included. Preview actions do not publish; admins still review and release the whole contest atomically.

## Eligibility

Search non-cancelled global competitions in the contest's discovery window whose prediction deadlines have not passed. Read accepted public WCIF registrations. Both people in a matchup must be registered for the same event, have WCA IDs, and have a valid average personal best and event-specific average world ranking. Prioritize top-100 pairs, expanding to top-250 and then top-500 when fewer than 20 diverse recommendations qualify.

The discovery identity is a fixed target Saturday-Sunday, stored as preparation.targetWeekend (a Saturday YYYY-MM-DD). Default to the next Saturday that has not started, using UTC calendar dates consistently with WCA ingestion. Publication of the next contest still respects non-overlapping featured competition windows. Legacy drafts acquire an anchor on regeneration; refresh never moves a pinned anchor. Published contests remain unchanged.

Include a competition when start_date <= target Sunday and end_date >= target Saturday. Friday-Sunday, Saturday-Monday, Thursday-Sunday, and Sunday-Tuesday all qualify; keep the entire competition duration for market settlement. Exclude cancelled competitions, past prediction deadlines, and competitions wholly before/after the weekend. Never add next weekend to fill the market list.

WCA's API start/end filters use containment, not overlap. Query from today's date without an end bound, sorted by start_date,name; paginate until a start date exceeds the target Sunday, then apply the overlap/deadline filters before roster loading. This avoids dropping Monday/Tuesday finishes or querying all future rosters. Source: https://github.com/thewca/worldcubeassociation.org/blob/main/app/models/competition.rb (Competition.search).

The initial supported events remain 2x2, 3x3, one-handed 3x3, 4x4, and 5x5, matching the existing H2H generator.

## Shortlisting and Probabilities

Consider pairs among the top 16 eligible competitors per event/competition, rather than only adjacent personal bests. Shortlist using world-rank relevance and PB similarity. PB similarity never supplies a probability.

Request WCA Odds simulations for at most 120 distinct pairs, sequentially with existing request spacing/retries. Allocate up to 40 per ranking tier, interleaving competition/event fields. Apply diversity caps only after odds are known; use spare budget for untested pairs if fewer than 20 recommendations qualify. Use the existing one-year history and 180-day half-life settings. Reject unavailable probabilities and probabilities outside 35%-65%. There is no fallback model.

## Recommendation Score

For average world ranks a and b:

relevance = 1 - (0.6 * log10(max(a,b)) + 0.4 * log10(sqrt(a*b))) / log10(500)

closeness = 1 - abs(probability - 50) / 15

score = 70 * relevance + 30 * closeness

The weaker competitor's rank receives extra weight so one famous competitor does not carry an obscure matchup. Rankings proxy recognition; the score is not a measured popularity or model-confidence estimate.

Select up to 30 candidates in ranking-tier order, then descending score, with configurable caps of four appearances per competitor, twelve markets per competition, and sixteen per event. All constants live in src/lib/engaging-markets.ts.

If strong candidates are scarce, show fewer rather than padding. At least ten included markets are required to publish a playable contest.

Enough qualifying real-data markets cannot be guaranteed in every weekend. A short list remains blocked below ten; search ranking tiers and additional matchups within the same weekend rather than extending dates or fabricating probabilities. Removed the seven-day expansion action. Temporary WCA registration network errors, timeouts, HTTP 429 and 5xx errors retry up to three times; permanent errors such as 404 do not retry. Persist failed competition names/reasons and search diagnostics in preparation metadata.

## WCA Request Pacing

All competition discovery, WCIF, and official result reads share one process-wide queue, including across development reloads. Start requests at least two seconds apart and allow only one fetch at a time. A 429 pauses the entire queue, not just the failed competition. Honor numeric/date Retry-After headers with a two-second floor; without a usable header, use 30/60/120-second cooldowns. Even a final failed attempt or a fresh-result 429 applies the cooldown to subsequent callers. Fresh settlement reads remain uncached and fail fast rather than retrying within a check.

Reuse successful non-result payloads for 30 minutes, bound the in-memory cache to 128 entries, and deduplicate concurrent identical reads. Upstream fetches use no-store; only successfully parsed payloads enter this application cache. Never cache failed requests or substitute old results/probabilities for unavailable data. Generation can take longer on a cold cache or during cooldowns; repeatedly refreshing does not bypass the limiter.

Two-second spacing is a conservative application policy, not a verified WCA quota or a guarantee against 429s. Other traffic sharing the public IP may still count. Multiple production processes/instances have separate queues; before scaling out, use a single ingestion worker or shared distributed limiter. WCA Odds is a separate service and retains its separate request controls.

## Admin Review and Publication

Default to recommendation order, with an optional competition-grouped view. All recommendations are preselected. Lead with the Cubing event icon and full readable event name, then competition metadata. Show competitors on separate aligned rows with large percentages on the right and subtle world ranks beside each name. Remove redundant matchup/percentage summaries. This hierarchy also appears in publication review; player feed/review uses the same event-label component. No regeneration is needed for existing known event IDs to display canonical labels.

Refresh replaces unpublished candidates only after new results are ready. No-op/failed searches preserve the saved draft. Old competition-first drafts are labelled; they are not silently repriced.

Generation claims a RUNNING job in preparation metadata and returns the contest ID immediately. Next.js after performs the work; the admin page polls every five seconds. Failed jobs preserve saved markets and expose errors. Cancelled or superseded jobs cannot replace markets; cancellation checkpoints precede discovery pages, registration reads, and simulations. Duplicate starts do not launch concurrent jobs for the same running draft. Publication is blocked while generation runs. Process restarts do not resume work automatically: cancel a stranded job and regenerate. This does not remove serverless execution limits or replace a durable production job runner.

Publish included markets and activate the contest in one transaction. Derive featured competitions and timing from included markets, dropping competitions with no included markets. Set the global lock one hour before the earliest included scheduled start. The current WCA ingestion uses competition dates as start timestamps; precise schedule/timezone ingestion remains a separate limitation.

Publication requires regenerated weekend-policy candidates (preparation.weekendPolicyVersion = 1) and independently checks every selected competition's overlap. Legacy multi-week draft markets remain saved on failure/cancellation but cannot be published until regenerated. No database schema migration or deletion of public contests is required.

Published probabilities never change when recommendations refresh. Existing user pick rules, scoring, settlement evidence, automatic result monitoring, and historical contests remain unchanged.

## Verification

npm run test:v1 includes deterministic recommendation tests: registration/event/ranking eligibility, small-competition relevance, weaker-rank weighting, tightness, unavailable odds, simulation budgets, diversity limits, and derived lock times.
