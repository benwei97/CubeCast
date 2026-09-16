# CubeCast Project Status

Last updated: 2026-09-16

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
- Added generated draft H2H markets. Probabilities now use WCA Odds simulation results when available, with a personal-best fallback only if the model request fails.
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
- Kept the old personal-best estimate only as a fallback when the external simulation request fails.
- Added optional `WCA_ODDS_BASE_URL` configuration.

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
