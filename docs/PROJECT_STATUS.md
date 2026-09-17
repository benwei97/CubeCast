# CubeCast Project Status

Last updated: 2026-09-17

## Compact Home and Detail Navigation

- Removed the `/competitions` directory route and competition-detail category/status filters. Old filter query parameters no longer hide markets; contest scoping and private preview permissions remain enforced.
- Removed the competition-page Markets/Open/Final/Picks summary grid; the header is single-column, followed by the market list and entry counter.
- Home's competition cards now link directly to contest-scoped detail pages and show name, dates, and market count in a compact scrollable strip. Reduced contest-heading height while preserving entry counter/review access.
- Shared Back navigation tracks in-app navigation, returning to the preceding screen or Home for direct visits. Both market and competition detail pages use it; explicit admin review links remain available.

## WCA Recent Result Ordering

- Recent results use First Round, Second Round, Third Round, and Final for regular/cutoff IDs; legacy qualification and B-final IDs also have readable labels. Third Round is the requested product wording for WCA's legacy Semi Final label.
- Match WCA person-page ordering: competition start date descending, competition ID ascending for equal dates, then official numeric round rank descending. Do not sort round IDs alphabetically or by average performance.
- Preserve DNF/DNS and rounds with no average (display a dash) so recent rows are not silently omitted. Still show the eight most recent rows for the market's event.
- Added deterministic label, cutoff ordering, same-date grouping, absent competition, event filtering, row limit, and input immutability tests. Source: https://github.com/thewca/worldcubeassociation.org/blob/main/app/controllers/persons_controller.rb and https://github.com/thewca/worldcubeassociation.org/blob/main/lib/static_data/round_types.json.

## Production Market Presentation

- Removed duplicate historical comparison and technical model/cache commentary from market pages. The two outcomes and large probabilities lead, followed by competitor PB averages/world ranks from WCA person records.
- Missing historical PB metadata no longer creates misleading empty comparison rows. Current stats remain real WCA values; failed requests show an honest retry notice, not fabricated PBs.
- Recent results and rules are always visible without dropdowns; raw settlement evidence is admin-only and remains expandable. Pick behavior, private previews, immutable odds, and saved internal metadata are unchanged.

## Pick Rejection Handling

- Expected selection failures (locked/unavailable contest, unavailable outcome, or pick limit) return inline review messages rather than uncaught server runtime errors. Unexpected request failures also remain inside review.
- Open pages crossing the deadline are revalidated on rejection. Deadline locking commits even when the pick is rejected; no picks are added after lock.
- Review submit/remove controls disable when refreshed contest state is locked. Successful actions close review. Added deterministic availability tests for draft/cancelled, open-before-deadline, exact deadline, locked, settling, and finalized states.

## Market Research and Private Previews

- Added `/markets/[slug]` detail pages with fixed probabilities, score swings, generation settings/PB/ranking context, current WCA records, recent official round averages, and settlement rules/evidence.
- Competition pages scope markets to a selected contest and provide the same player selection flow as Home. Feed and admin event/competition labels now link to details without nesting links in pick buttons.
- Anonymous/non-admin browsing requires both a published market and a published public contest. Unpublished competition/market previews return 404; admins can inspect them before release.
- Admin include/exclude changes persist in existing preparation metadata and sync across previews and the main publisher. Whole-contest review/publication remains unchanged.
- Future generation saves WCA Odds request settings and original PB context. Older markets honestly show unavailable historical context. Current WCA statistics use the existing paced/cache-backed client and never change scoring probabilities.
- No database migration required. Verified admin preview, real WCA history loading, inclusion save/restore, anonymous 404s, and desktop/mobile overflow/runtime checks. Transactional database checks verify parent/child publication visibility and cancellation/void behavior without retaining changes.

## Market Readability

- Event-first admin recommendation and review rows use self-hosted @cubing/icons and canonical full WCA event names. Competitors and percentages are aligned in separate rows; world ranks are muted secondary metadata. Removed repeated matchup/probability prose.
- Player feed/review shares the event-label component and displays stored recommendation ranks when available. Review probabilities no longer include redundant currency-style cents.
- Future WCA generation uses the shared canonical event names; existing market IDs display correctly without database rewrites. Selection, odds, and scoring are unchanged.
- Added event-name/fallback tests. Verified real admin data on desktop/mobile: icon font loaded, percentages rendered, no overflow or runtime errors.

## Fixed Target Weekends

- Added immutable Saturday-date anchors in existing preparation metadata; no schema migration required. New drafts target the next unstarted weekend after any current featured competition window.
- Discover competitions in start-date order and stop after target Sunday, then apply date-range overlap and deadline checks before loading registrations. This retains Friday-Sunday/Saturday-Monday and Thursday/Tuesday extensions without mixing adjacent weekends.
- Removed all discovery-window expansion paths. Publication requires regenerated weekend-policy candidates and independently validates selected competitions' overlap.
- Header separates target Saturday-Sunday from full featured competition dates and lock time. Expired drafts can explicitly prepare a new contest. Published contests remain unchanged; old draft content survives until successful regeneration.
- Added deterministic tests for multi-day overlap, adjacent-weekend exclusion, pinned anchors, invalid dates, full settlement duration, and year boundaries.

## Nonblocking Recommendation Generation

- Recommendation actions now claim a job in existing preparation metadata and return immediately. Next.js after runs ingestion/simulation after the response, rather than holding the browser's submission connection open for minutes.
- Admin controls poll every five seconds while running, expose cancellation, and catch submission connection failures inline. Duplicate starts reuse the current job; publication is blocked during generation.
- Existing markets remain intact until a successful atomic replacement. Cancellation invalidates the optimistic draft claim and stops work at request checkpoints. Failure details persist for review/retry.
- Verified a real start/cancel in the browser: start returned in 364ms, 18 existing markets remained unchanged, and desktop/mobile had no overflow or runtime errors. An intentionally aborted submission displayed an inline error rather than an uncaught exception.
- This is response-scoped background work, not a durable external worker. After a server restart, cancel a stranded running job and regenerate. Hosting execution limits still apply; serverless production needs a durable job runner for long generation tasks.

## Shared WCA Request Controls

- Replaced the 250ms registration-only delay with a process-wide queue for discovery, registration, and automatic result reads, with at least two seconds between request starts.
- A 429 pauses all queued reads using Retry-After or 30/60/120-second fallback cooldowns, including when the triggering read cannot retry.
- Successful non-result reads are reused for 30 minutes; concurrent identical requests share one fetch. Failed reads are not cached. Official results remain fresh.
- Deterministic tests cover queue spacing, cooldowns, failure recovery, Retry-After formats, successful caching, request deduplication, and retry rules. No schema migration is needed.
- This is single-process protection, not a guaranteed WCA quota. Multi-instance deployment needs coordinated ingestion or a distributed limiter.

## Market-First Engagement Recommendations

- Removed competition selection and fixed three-competition publication requirements.
- Search upcoming global competitions in the window; prioritize top-100 accepted, event-registered competitors, expanding to top-250 and top-500 pairs when needed.
- Simulate up to 120 distinct matchups using WCA Odds only, qualify probabilities in 35%-65%, target 20 and recommend up to 30 with diversity caps applied after simulation. Ranking tiers precede relevance/closeness scores.
- Retry temporary WCA roster failures and retain failed competition names/reasons. Search additional matchups only within the fixed target weekend when fewer than 10 markets qualify. Real-data availability cannot be guaranteed.
- Recommendations are preselected and quality-ranked; optional competition grouping remains available.
- World ranks and recommendation reasons appear on admin market rows. Unavailable registrations or probabilities are disclosed; no fallback odds or weak padding are added.
- Publishing derives featured competitions, start/end dates, and the one-hour-before-earliest-start lock from included markets. Excluding an entire competition is supported.
- Existing drafts remain intact until successful refresh; existing active contests remain immutable. No schema migration is required.

## Prisma Development Startup

- npm run dev regenerates Prisma Client before starting Next.js.
- Restart the dev server after schema changes so cached client instances match the database.
- Verified the preparation-field update in a rolled-back transaction; existing contest markets are preserved.

## Contest Preparation and Transition Workflow

- Admin header leads with the contest date range and Draft/Active/Complete status.
- Draft recommendations prioritize highly ranked, closely matched competitors across the global contest window; admins no longer choose competitions first.
- All recommended markets are preselected for release. Admins exclude unwanted markets and publish a variable-sized group atomically with the contest. Publication requires at least 10 markets. Featured competitions are derived from the included markets. Excluded candidates are cancelled and omitted from scoring/finalization counts.
- Active contests show entry and settlement progress. Complete contests show final results and immutable evidence.
- Prepare-next creates/reuses an upcoming draft without replacing the public contest. Publication switches the public current contest, but is blocked until the previous picks lock and for overlapping competition windows.
- Historical contests remain available for settlement, leaderboard review, and previous user entries. Automatic result monitoring continues for unsettled older contests.
- Added nullable preparation metadata via additive migration 20260916200000_admin_contest_preparation. Existing contests, markets, and picks are retained.
- Removed legacy single-market publication support. Migration 20260916210000_contest_only_publication returns individually opened draft markets to DRAFT, preserving market content and audit history. It stops if picks or settlement evidence would be affected. Publication now requires every market in the draft to be unpublished.

## Automatic WCA Result Monitoring

- Removed manual result refresh action and UI.
- Next.js instrumentation starts automatic monitoring on local and persistent Node servers; Vercel uses a protected scheduled endpoint.
- Check eligible competitions every 15 minutes, preserve first-observed result rows and timestamps, and retry failures on later checks.
- Results are automatically imported as settlement evidence; settlement remains admin-reviewed.
- Added deterministic tests for first observations, subsequent rounds, duplicate/corrected rows, empty responses, and malformed rows.

## Admin Workspace Simplification

- Current contest and grouped market selection lead the admin page.
- Competition dates, location, accepted count, and capacity appear with markets; ranked entrants expand on demand.
- Review replaces selection until publishing or returning to editing.
- Settlement, lifecycle, generation settings, and history remain in collapsed sections.
- Test: open /admin, inspect competitions, fill the market counter, review, return to editing or publish; expand operational sections for existing tools.

CubeCast is being migrated from an older virtual CubeCoin trading MVP into V1: a free WCA speedcubing prediction game based on contests, exactly 10 picks, fixed model probabilities, WCA settlement, and score leaderboards.

## Current Architecture

The app currently uses:

- Next.js App Router
- React and TypeScript
- PostgreSQL
- Prisma
- Auth.js/NextAuth

High-level flow:

```text
Browser
  -> Next.js app
  -> Prisma client
  -> PostgreSQL database
```

## Current Codebase State

The repository still contains the legacy CubeCoin trading implementation:

- local credential auth
- optional Google OAuth
- admin/user roles
- competitions
- binary markets
- CubeCoin balances
- YES/NO purchases
- positions
- ledger transactions
- settlement payouts/refunds
- portfolio page
- account-value leaderboard
- admin competition and market creation

These pieces are useful as infrastructure and UI reference, but the trading domain is obsolete for V1.

## V1 Target Product

V1 should support:

- WCA-authenticated users
- contests that include one or more WCA competitions
- one global contest lock time
- approximately 20-30 fixed-probability markets per contest
- exactly 10 user predictions for a valid entry
- immutable published probabilities
- 1,000-point starting score
- score changes based on selected outcome probability
- voided markets scoring 0
- H2H exact-tie half-win scoring
- official WCA result settlement
- immutable settlement snapshots
- leaderboard ranking by final score, correct picks, hardest correct pick, then shared rank
- admin audit logs
- prize-ready architecture disabled by default

## Preserved Infrastructure

- Next.js app structure
- Prisma/PostgreSQL
- Auth.js integration pattern
- admin role checks
- shared layout and global CSS
- dense board/table UI patterns
- admin form/server-action patterns
- slug helper
- Prisma client helper
- pending submit button

## Obsolete Concepts

The following are not part of V1 and should be removed or deprecated during migration:

- CubeCoin balances
- starting-balance onboarding
- buying YES/NO shares
- contracts/shares terminology
- purchases
- positions
- portfolio/account value
- ledger transactions
- liquidity parameter
- market repricing from outstanding shares
- payouts/refunds as balance mutations
- trading smoke tests

## Current Documentation

- Product record: `PRODUCT.md`
- Design system: `DESIGN.md`
- V1 implementation plan: `docs/V1_IMPLEMENTATION_PLAN.md`
- Deployment notes: `docs/DEPLOYMENT_NOTES.md`

## Phase Status

### Phase 0: Product And Design Reset

Status: complete.

- V1 product direction documented.
- V1 design direction documented.
- Migration plan documented.
- README and project status updated.

### Phase 1: Schema Foundation

Status: complete.

Completed:

- Added V1 Prisma enums and models alongside legacy trading tables.
- Added WCA identity model.
- Added contest and contest competition models.
- Added market options for immutable published probabilities.
- Added contest entry and prediction models.
- Added settlement snapshot model.
- Added leaderboard cache model.
- Added admin action audit model.
- Added prize award and payout shell models with prize behavior still disabled.
- Added optional WCA/contest/event/published/lock fields to existing competition and market models.
- Generated and applied migration `20260915000000_v1_schema_foundation`.
- Added early V1 seed data for local testing. This has since been removed in favor of real WCA-generated contests and markets.

### Phase 2: Core Game Rules

Status: complete.

Completed:

- Added pure V1 scoring helpers.
- Added exactly-10 entry validation helpers.
- Added server-side lock/edit eligibility helpers.
- Added pick-counter label helper.
- Added H2H, advancement, placement, and performance settlement helpers.
- Added deterministic leaderboard ranking with shared-rank support.
- Added `npm run test:v1` for V1 game-rule tests.

### Phase 3: Player Game UI

Status: complete.

Completed:

- Replaced the home page with the active V1 contest feed.
- Added persistent `X / 10 Picks` entry status.
- Added market rows with fixed probabilities and score swing.
- Added quick pick review modal from the contest board.
- Added server actions for selecting, changing, and removing picks.
- Enforced sign-in, contest status, lock time, market membership, option membership, and max-10 picks server-side.
- Added `/picks` as the My Picks review screen.
- Updated app shell copy away from CubeCoin balance language.

### Phase 4: Settlement And Leaderboard

Status: complete.

Completed:

- Added manual/admin-assisted V1 market settlement.
- Added immutable settlement snapshots for resolved, voided, and exact-tie outcomes.
- Added admin audit records for settlement and void actions.
- Added prediction result updates for correct, incorrect, void, and tie outcomes.
- Added score calculation from each entry's 1,000-point baseline.
- Added V1 leaderboard generation for valid 10-pick entries.
- Added deterministic leaderboard ranks with shared-rank support.
- Added contest finalization when every market is resolved, void, or canceled.
- Updated player pages so settling/finalized contests remain visible and non-editable markets show their terminal state.
- Replaced the legacy leaderboard route with the V1 contest leaderboard.

### Phase 5: Admin Contest Tools

Status: complete.

Completed:

- Create/edit contests from the admin UI.
- Generate contests from WCA competitions in the admin UI.
- Create/publish V1 markets and outcomes with immutable probabilities.
- Configure diversity limits.
- Added basic V1 market review with draft publish action.
- Added migration `20260915220059_add_slate_diversity_config`.
- Recomputed contest start/end/lock windows when competitions are attached.
- Kept settlement inspection and exception handling available through the V1 settlement queue.

### Phase 6: WCA Integration

Status: complete.

Completed:

- Add WCA OAuth provider.
- Store WCA identity from real WCA login.
- Add WCA competition/result ingestion boundary.
- Store WCA competition imports in local `Competition` rows.
- Store admin-refreshed WCA result snapshots in competition `sourceMetadata`.
- Keep manual/admin-assisted settlement as the MVP fallback.

### Phase 6.5: WCA-Assisted Settlement

Status: complete.

Completed:

- Show imported WCA result rows inside the admin V1 Settlement Queue.
- Match settlement evidence by market event and option competitor WCA IDs when available.
- Let admins attach a selected WCA evidence row while resolving a market.
- Store the selected evidence in immutable `SettlementSnapshot.snapshot`.
- Fill structured settlement snapshot fields such as source competition, event, round, person, placement, and result value when evidence is attached.
- Keep manual source notes and manual settlement available when imported WCA evidence is missing or incomplete.

### Phase 7: Remove Old Trading System

Status: complete.

Completed:

- Removed the legacy market-detail trading route.
- Removed the legacy portfolio route.
- Removed quick-trade/order-ticket components.
- Removed old trading services and account-value helpers.
- Removed the legacy trading smoke test and package script.
- Removed old trading admin panels for legacy market creation, review, and resolution.
- Converted competition pages to V1 read-only probability summaries instead of legacy price/share links.

### Phase 8: Legacy Database Cleanup

Status: complete.

Completed:

- Added migration `20260915230000_phase8_legacy_db_cleanup`.
- Dropped legacy purchase, position, ledger transaction, and old settlement tables.
- Removed legacy balance, share outstanding, liquidity, and winning-outcome columns.
- Removed legacy trading enums from the Prisma schema.
- Updated auth/session typing to stop exposing balance.
- Simplified onboarding so it only assigns a unique internal username.
- Removed legacy trading seed data.

### Phase 9: Prize-Ready Disabled Layer

Status: complete.

Completed:

- Added disabled-by-default prize config parsing.
- Added `PRIZES_ENABLED` and `PRIZE_PAYOUTS_JSON` environment documentation.
- Added prize eligibility hooks for finalized valid entries, WCA identity, contest/global prize flags, and participant restrictions.
- Added deterministic tied-rank award planning that pools tied positions and splits cents predictably.
- Added V1 tests for disabled prize behavior, eligibility, and prize award planning.

### Phase 10: Contest Lock Maintenance

Status: complete.

Completed:

- Added server-side contest lock maintenance.
- Run lock maintenance before home, picks, leaderboard, and admin page reads.
- Run lock maintenance inside pick selection transactions before accepting changes.
- Lock due open contests and their open markets.
- Mark exactly-10 entries as locked and incomplete entries as invalid.
- Added V1 tests for the lock-status decision.

Next MVP gap:

### Phase 11: Admin Lifecycle Visibility

Status: complete.

Completed:

- Added an admin contest lifecycle panel.
- Show active contest status, lock time, entry counts, market counts, and next operational action.
- Added an admin-only manual lifecycle refresh action.
- Revalidate player/admin pages after manual lifecycle refresh.

Next MVP gap:

### Phase 12: Finalized Contest Review

Status: complete.

Completed:

- Added latest finalized contest review to the admin console.
- Show finalized timestamp, terminal market totals, official entry count, winner, and top leaderboard rows.
- Keep finalized review read-only so settlement snapshots and leaderboard cache remain the source of truth.

Next MVP gap:

### Phase 13: Settlement Ergonomics

Status: complete.

Completed:

- Added clear success feedback after resolve, exact tie, and void actions.
- Added evidence-match counts and result-state cues inside settlement rows.
- Clarified manual settlement requirements when imported WCA evidence is missing.
- Made evidence dropdown labels explicit about the row that will be stored.

Next MVP gap:

### Phase 14: WCA Recommendation Pipeline

Status: complete.

Completed:

- Added WCA upcoming competition lookup for the next 7 days.
- Added public WCIF ingestion for accepted competitor counts, registered events, and personal-best data.
- Added admin generation of a draft weekly contest from the top 3 recommended competitions.
- Added generated draft H2H markets. Probabilities now require WCA Odds simulation results; failed or rate-limited model requests are skipped instead of estimated with a different model.
- Kept generated markets unpublished so admins manually choose what to release.

### Phase 14.1: Recommendation Ranking Fix

Status: complete.

Completed:

- Fetch all WCA competition pages for the weekly recommendation window.
- Sort recommended competitions by all accepted competing registrants.
- Count first-time competitors without WCA IDs in the accepted-registration total.
- Keep generated markets limited to accepted competitors with WCA IDs.

### Phase 15: Real-Data Admin Path Cleanup

Status: complete.

Completed:

- Removed fake local contest and market seed data.
- Removed the seed script and npm seed entry point.
- Removed manual admin creation paths for competitions, contests, contest attachments, one-off competition imports, and hand-created markets.
- Kept the real-data WCA recommendation flow as the source of new contests and markets.
- Kept admin review/publishing, diversity caps, WCA result snapshots, settlement, lifecycle maintenance, and finalized contest review.

### Phase 16: Country-Scoped Competition Experiment

Status: superseded.

Completed:

- Scoped recommendation generation to WCA competitions with `country_iso2 = US`.
- Ensured generated markets only come from selected U.S. competitions.
- Updated admin copy and docs so the MVP scope is clearly U.S.-only.

### Phase 16.1: Global Competition Scope

Status: complete.

Completed:

- Expanded recommendation generation to all non-canceled WCA competitions globally.
- Ensured generated markets come from the largest competitions worldwide by accepted competing registrants.
- Updated admin copy and docs so the MVP scope is global.

### Phase 16.2: WCA Rate-Limit Handling

Status: complete.

Completed:

- Added retry/backoff handling for WCA `429` responses.
- Replaced parallel WCIF lookups with spaced sequential recommendation enrichment.
- Reduced the chance that global recommendation generation overwhelms WCA API limits.

### Phase 17: Competition Preview Metadata

Status: complete.

Completed:

- Stored accepted competitor count, competitor limit, and top ranked registered cubers in generated competition metadata.
- Added an admin preview for each included competition before publishing markets.
- Derived top ranked cubers from public WCIF personal-best average world rankings for registered events.

### Phase 18: WCA Odds Probability Provider

Status: complete.

Completed:

- Added a WCA Odds simulation client for generated H2H markets.
- Matched WCA Odds defaults of one year of history and a 180-day half-life.
- Filtered generated markets to the V1 tight probability band of 35%-65%.
- Skipped candidate matchups when WCA Odds cannot return a probability, avoiding mixed probability systems.
- Added conservative request spacing and longer retry/backoff for WCA Odds rate limits.
- Added optional `WCA_ODDS_BASE_URL` configuration.

### Phase 19: Admin Market Selection Publishing

Status: complete.

Completed:

- Replaced one-click per-market publishing with a grouped market selection flow.
- Added a `selected / target` market counter for admin publishing.
- Grouped generated draft markets by competition during review.
- Added a review step before selected markets are published to the public contest.
- Added a batch publish action with server-side validation that selected markets are complete drafts from one contest.

Next MVP gap:

- Add a final MVP readiness checklist covering remaining acceptance criteria and manual end-to-end test steps.

## Useful Commands

Install dependencies:

```bash
npm install
```

Apply database migrations:

```bash
npm run prisma:migrate
```

Start local dev server:

```bash
npm run dev
```

Run typecheck:

```bash
npm run typecheck
```

Run lint:

```bash
npm run lint
```

Run V1 game-rule tests:

```bash
npm run test:v1
```

Build production app:

```bash
npm run build
```
