# CubeCast V1 Implementation Plan

Last updated: 2026-09-15

This document records the migration plan from the current CubeCoin trading MVP to CubeCast V1: a free WCA-based weekly contest prediction game.

## Current Architecture Summary

The existing app is a Next.js App Router application with Prisma, PostgreSQL, and Auth.js/NextAuth. It currently implements a virtual trading product:

- local credential auth plus optional Google OAuth
- admin/user roles
- competitions
- binary markets
- CubeCoin balances
- YES/NO purchases
- positions
- ledger transactions
- settlement payouts/refunds
- account-value leaderboard
- portfolio/trade history pages

This infrastructure works, but the core product model conflicts with V1.

## V1 Target Summary

CubeCast V1 is a free forecasting game:

- WCA-authenticated users
- curated contests
- one or more WCA competitions per contest
- approximately 20-30 published markets per contest
- immutable published probabilities
- exactly 10 user predictions for a valid entry
- lock one hour before the earliest included competition starts
- scoring from a 1,000-point baseline
- official WCA result settlement
- immutable settlement snapshots
- valid-entry leaderboard with deterministic tiebreakers
- prize architecture disabled by default

## Preserve

- Next.js app structure
- Prisma/PostgreSQL
- Auth.js integration pattern
- admin/user role authorization
- shared layout and dense market-board styling
- competition browsing as a concept
- admin form/action patterns
- slug helpers
- Prisma client helper
- pending submit button

## Adapt

- `Competition` becomes WCA-backed competition metadata.
- `Market` becomes a fixed-probability contest market.
- Current YES/NO UI becomes pick selection UI.
- Home/market board becomes contest market feed.
- Leaderboard becomes contest score leaderboard.
- Admin page becomes contest, market review, publishing, settlement, and audit console.
- Settlement evolves into outcome plus immutable WCA snapshot.

## Remove Or Deprecate

- CubeCoin balances
- starting-balance onboarding
- purchases
- positions
- ledger transactions
- portfolio/account value
- market repricing from outstanding shares
- liquidity parameter
- payout/refund balance mutation
- buy/sell/contracts/shares terminology
- trading smoke tests

## Required Database Direction

V1 models were added alongside the old trading tables first. After the V1 flow was working, the obsolete trading tables were removed in migration `20260915230000_phase8_legacy_db_cleanup`.

Likely models:

- `WCAIdentity`
- `ContestSlate`
- `ContestCompetition`
- `ContestEntry`
- `Prediction`
- `SettlementSnapshot`
- `LeaderboardEntry` or derived leaderboard query support
- `AdminAction`
- `PrizeAward`
- `Payout`

Changed models:

- `User`
- `Competition`
- `Market`

Removed legacy models:

- `Purchase`
- `Position`
- `LedgerTransaction`
- old `Settlement`

## Data-Loss Risks

The old trading data did not map cleanly to V1. Purchases, positions, ledger transactions, CubeCoin balances, and old settlements were treated as obsolete data and removed during Phase 8.

Completed safe path:

1. Add V1 tables without dropping old trading tables.
2. Build V1 UI and server actions against the new tables.
3. Hide old trading UI.
4. Delete old trading tables in migration `20260915230000_phase8_legacy_db_cleanup`.

## Phase Plan

### Phase 0: Product And Design Reset

Status: in progress.

- Update `PRODUCT.md`
- Update `DESIGN.md`
- Update project docs and README
- Record migration plan

### Phase 1: Schema Foundation

Status: complete.

- Added V1 enums and models.
- Added feature flag documentation for `PRIZES_ENABLED=false`.
- Kept old trading tables temporarily.
- Generated Prisma client.
- Added seed data for one seeded contest with 20 markets.
- Applied migration `20260915000000_v1_schema_foundation`.

### Phase 2: Core Game Rules

Status: complete.

- Implemented pure scoring helpers.
- Implemented entry validation helpers.
- Implemented lock/state-machine helpers.
- Added deterministic tests for scoring, entry rules, voids, H2H ties, settlement semantics, and leaderboard tiebreakers.

### Phase 3: Player Game UI

Status: complete.

- Replaced trading home flow with active contest feed.
- Added persistent `X / 10 Picks`.
- Added market rows with fixed probability and score swing.
- Added pick/change/remove server actions.
- Added My Picks view.
- Enforced sign-in, contest status, lock time, market membership, option membership, and max 10 picks server-side.

### Phase 4: Settlement And Leaderboard

Status: complete.

- Added manual/admin-assisted settlement actions and snapshots.
- Implemented void logic.
- Implemented H2H exact-tie scoring.
- Added entry score calculation from settled predictions.
- Built contest leaderboard with deterministic tiebreakers.
- Finalizes contest when all markets are resolved, void, or canceled.

### Phase 5: Admin Contest Tools

Status: complete.

- Added contest creation UI.
- Added competition attachment UI with automatic contest window and lock recalculation.
- Added V1 market creation with two immutable outcome probabilities.
- Added draft/publish workflow for V1 markets.
- Added diversity cap configuration.
- Added audit records for contest creation, contest updates, market creation, market publishing, settlement, and voids.

### Phase 6: WCA Integration

Status: complete.

- Added WCA OAuth provider.
- Stores WCA identity in `WCAIdentity` on WCA login.
- Added WCA competition import/update boundary.
- Added WCA result refresh boundary that stores observed result snapshots in competition metadata.
- Kept manual/admin-assisted settlement available for MVP fallback.

### Phase 6.5: WCA-Assisted Settlement

Status: complete.

- Imported WCA result snapshots are visible from the admin V1 Settlement Queue.
- Settlement rows show relevant evidence matched by event and competitor WCA ID when available.
- Admins can attach a selected WCA result row while resolving a market.
- Settlement snapshots preserve the selected evidence row and structured source identifiers.
- Manual source URL/note settlement remains available for cases where imported WCA data is incomplete.

### Phase 7: Remove Old Trading System

Status: complete.

- Removed legacy market-detail trading route and portfolio route.
- Removed old trading services, account-value helpers, quick-trade/order-ticket components, and trading smoke test.
- Removed legacy admin market creation/review/resolution panels.
- Converted competition pages to V1 probability summaries.

### Phase 8: Legacy Database Cleanup

Status: complete.

- Added migration `20260915230000_phase8_legacy_db_cleanup`.
- Dropped legacy purchase, position, ledger transaction, and old settlement tables.
- Removed legacy balance, share outstanding, liquidity, and winning-outcome columns.
- Removed old trading enums from Prisma.
- Simplified onboarding and auth session data around V1 identity only.
- Removed legacy seed data; seed data is now V1-only.

### Phase 9: Prize-Ready Disabled Layer

Status: complete.

- Added `PRIZES_ENABLED=false` and optional `PRIZE_PAYOUTS_JSON` documentation.
- Added prize configuration parsing.
- Added eligibility hooks for global flag, contest flag, finalized entry state, valid 10-pick entry, WCA identity, and participant restriction.
- Added deterministic tied-rank award planning with pooled prize positions.
- Kept prize behavior out of gameplay while disabled.

### Phase 10: Contest Lock Maintenance

Status: complete.

- Added server-side contest lock maintenance.
- Persisted due open contests as locked when server pages or pick actions run.
- Locked open markets when the parent contest locks.
- Marked exactly-10 entries as locked and incomplete entries as invalid.
- Kept settlement and finalization in the existing settlement path.

### Phase 11: Admin Lifecycle Visibility

Status: complete.

- Added an admin lifecycle panel.
- Show active contest status, lock time, entry counts, market counts, and next operational action.
- Added a manual lifecycle refresh action that runs server-side lock maintenance and revalidates contest pages.
- Kept the maintenance action admin-only.

### Phase 12: Finalized Contest Review

Status: complete.

- Added a finalized contest review panel to the admin console.
- Show the most recent finalized contest, finalized timestamp, terminal market totals, official entry count, winner, and top leaderboard rows.
- Kept review read-only so final scoring remains driven by settlement snapshots and cached leaderboard entries.

### Phase 13: Settlement Ergonomics

Status: complete.

- Added clearer settlement action feedback for resolved, tie, and void outcomes.
- Added evidence-match counts and market result-state cues to each settlement row.
- Clarified manual-evidence fallback when no imported WCA result row matches.
- Made evidence select options explicit about what evidence will be stored.

### Phase 14: WCA Recommendation Pipeline

Status: complete.

- Added an admin action that fetches upcoming WCA competitions for the next 7 days.
- Ranked competitions by accepted competitor count from public WCIF data, with competitor limit as fallback.
- Generated a draft weekly contest from the top 3 competitions.
- Generated up to 10 draft head-to-head markets per recommended competition.
- Kept all generated markets unpublished so admins manually choose what to release.

## Implementation Notes

- Do not implement XP.
- Do not implement purchasable currency.
- Do not implement deposits, withdrawals, staking, or user-funded prize pools.
- Do not implement adaptive/live probabilities for V1.
- Do not let frontend state be the only lock or pick-count enforcement.
- Do not settle markets from arbitrary client-submitted data.

## Testing Requirements

Add deterministic tests before relying on each rule:

- scoring examples at 35%, 50%, 65%
- 9 picks invalid at lock
- 10 picks valid at lock
- 11th pick rejected
- edits allowed before lock
- edits rejected after lock
- automatic lock transition marks 10-pick entries locked and incomplete entries invalid
- void prediction scores 0
- H2H exact tie half-win
- advancement cutoff semantics
- placement final-round semantics
- performance threshold semantics
- WCA later correction does not alter an already-settled snapshot
- prize disabled state, eligibility reasons, and tied-rank award planning
