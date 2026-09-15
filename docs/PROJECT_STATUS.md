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

Status: not started.

Next tasks:

- Add V1 Prisma models and enums alongside legacy trading tables.
- Add WCA identity model.
- Add contest slate, market outcome, entry, prediction, settlement snapshot, leaderboard/audit/prize shell models.
- Generate Prisma client.
- Add V1 seed data.

### Phase 2: Core Game Rules

Status: not started.

Next tasks:

- Add scoring helpers.
- Add entry validation helpers.
- Add lock/state-machine helpers.
- Add deterministic tests.

### Phase 3: Player Game UI

Status: not started.

Next tasks:

- Replace trading home flow with slate feed.
- Add `X / 10 Picks`.
- Add pick/unpick/change-side actions.
- Add My Picks view.

### Phase 4+: Settlement, WCA, Admin, Prize Shell

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

Build production app:

```bash
npm run build
```
