# CubeCast V1 Implementation Plan

Last updated: 2026-09-15

This document records the migration plan from the current CubeCoin trading MVP to CubeCast V1: a free WCA-based weekly/slate prediction game.

## Current Architecture Summary

The existing app is a Next.js App Router application with Prisma, PostgreSQL, and Auth.js/NextAuth. It currently implements a virtual trading product:

- credential demo auth plus optional Google OAuth
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
- curated contest slates
- one or more WCA competitions per slate
- approximately 20-30 published markets per slate
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
- `Market` becomes a fixed-probability slate market.
- Current YES/NO UI becomes pick selection UI.
- Home/market board becomes slate market feed.
- Leaderboard becomes slate score leaderboard.
- Admin page becomes slate, market review, publishing, settlement, and audit console.
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

Add V1 models alongside the current trading tables first. Remove obsolete tables only after the V1 flow works.

Likely models:

- `WCAIdentity`
- `ContestSlate`
- `ContestCompetition`
- `MarketOutcome`
- `ContestEntry`
- `Prediction`
- `SettlementSnapshot`
- `LeaderboardEntry` or derived leaderboard query support
- `AdminAction`
- `PrizeAward`
- `Payout`

Likely changed models:

- `User`
- `Competition`
- `Market`
- `Settlement`

Likely deprecated models:

- `Purchase`
- `Position`
- `LedgerTransaction`

## Data-Loss Risks

The current demo data does not map cleanly to V1. Existing purchases, positions, ledger transactions, and CubeCoin balances should be treated as obsolete demo data unless real users are introduced before migration.

Safe path:

1. Add V1 tables without dropping old trading tables.
2. Build V1 UI and server actions against the new tables.
3. Hide old trading UI.
4. Delete old trading tables in a later cleanup migration.

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
- Added seed data for one demo slate with 20 markets.
- Applied migration `20260915000000_v1_schema_foundation`.

### Phase 2: Core Game Rules

Status: complete.

- Implemented pure scoring helpers.
- Implemented entry validation helpers.
- Implemented lock/state-machine helpers.
- Added deterministic tests for scoring, entry rules, voids, H2H ties, settlement semantics, and leaderboard tiebreakers.

### Phase 3: Player Game UI

Status: complete.

- Replaced trading home flow with active slate feed.
- Added persistent `X / 10 Picks`.
- Added market rows with fixed probability and score swing.
- Added pick/change/remove server actions.
- Added My Picks view.
- Enforced sign-in, slate status, lock time, market membership, option membership, and max 10 picks server-side.

### Phase 4: Settlement And Leaderboard

Status: complete.

- Added manual/admin-assisted settlement actions and snapshots.
- Implemented void logic.
- Implemented H2H exact-tie scoring.
- Added entry score calculation from settled predictions.
- Built slate leaderboard with deterministic tiebreakers.
- Finalizes contest when all markets are resolved, void, or canceled.

### Phase 5: Admin Slate Tools

Status: next.

- Create/edit slates.
- Attach WCA competitions to slates.
- Create/publish markets and outcomes with immutable probabilities.
- Configure diversity limits.
- Audit publish/void/settlement/finalization actions.

### Phase 6: WCA Integration

- Add WCA OAuth provider.
- Store WCA identity.
- Add WCA competition/result ingestion boundary.
- Store first-observed official result snapshots.
- Keep manual/admin-assisted settlement available for MVP fallback.

### Phase 7: Remove Old Trading System

- Remove CubeCoin purchase/position/ledger UI.
- Remove old trading services and tests.
- Drop obsolete tables once safe.
- Update docs to remove migration warnings.

### Phase 8: Prize-Ready Disabled Layer

- Add prize config and payout records behind `PRIZES_ENABLED=false`.
- Add eligibility hooks.
- Do not expose prizes in gameplay until explicitly enabled.

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
- void prediction scores 0
- H2H exact tie half-win
- advancement cutoff semantics
- placement final-round semantics
- performance threshold semantics
- WCA later correction does not alter an already-settled snapshot
