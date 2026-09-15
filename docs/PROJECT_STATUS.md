# CubeCast Project Status

Last updated: 2026-09-15

CubeCast is being migrated from an older virtual CubeCoin trading MVP into V1: a free WCA speedcubing prediction game based on contest slates, exactly 10 picks, fixed model probabilities, WCA settlement, and score leaderboards.

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

- credential demo auth
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
- contest slates that include one or more WCA competitions
- one global slate lock time
- approximately 20-30 fixed-probability markets per slate
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
- Added contest slate and contest competition models.
- Added market options for immutable published probabilities.
- Added contest entry and prediction models.
- Added settlement snapshot model.
- Added leaderboard cache model.
- Added admin action audit model.
- Added prize award and payout shell models with prize behavior still disabled.
- Added optional WCA/slate/event/published/lock fields to existing competition and market models.
- Generated and applied migration `20260915000000_v1_schema_foundation`.
- Updated seed data with one demo V1 slate, two slate competitions, 20 V1 markets, 40 market options, four WCA identities, and one admin audit action.

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

- Replaced the home page with the active V1 slate feed.
- Added persistent `X / 10 Picks` entry status.
- Added market rows with fixed probabilities and score swing.
- Added quick pick review modal from the slate board.
- Added server actions for selecting, changing, and removing picks.
- Enforced sign-in, slate status, lock time, market membership, option membership, and max-10 picks server-side.
- Added `/picks` as the My Picks review screen.
- Updated app shell copy away from CubeCoin balance language.

### Phase 4: Settlement And Leaderboard

Status: next.

Next tasks:

- Add settlement actions and immutable settlement snapshots.
- Add void support in the player-facing result state.
- Calculate entry scores from settled predictions.
- Build V1 slate leaderboard from valid 10-pick entries.
- Finalize contests only after all markets are resolved or void.

### Phase 5+: Admin, WCA, Prize Shell

Status: planned in `docs/V1_IMPLEMENTATION_PLAN.md`.

## Useful Commands

Install dependencies:

```bash
npm install
```

Apply database migrations:

```bash
npm run prisma:migrate
```

Seed demo data:

```bash
npm run prisma:seed
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

Run legacy trading smoke tests:

```bash
npm run test:trading
```

Run V1 game-rule tests:

```bash
npm run test:v1
```

Build production app:

```bash
npm run build
```
