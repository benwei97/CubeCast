# CubeCast

CubeCast is being migrated into a free WCA speedcubing prediction game.

V1 target:

- WCA-authenticated gameplay
- curated contest slates
- approximately 20-30 fixed-probability markets per slate
- exactly 10 picks for a valid entry
- 1,000-point starting score
- transparent score changes based on published probabilities
- official WCA result settlement
- immutable settlement snapshots
- slate leaderboard with deterministic tiebreakers
- prize-ready architecture disabled by default

CubeCast V1 is not a real-money prediction market. It does not support deposits, withdrawals, wagering, purchasable currency, staking, user-funded prize pools, or buying extra predictions.

## Migration Status

The existing repository still contains an older CubeCoin trading MVP. That implementation is being migrated incrementally rather than rewritten from scratch.

Phase 1 schema foundation is complete: the database now includes V1 slate, WCA identity, market option, entry, prediction, settlement snapshot, leaderboard, admin audit, prize award, and payout shell models alongside the legacy trading tables.

Current planning docs:

- [PRODUCT.md](PRODUCT.md)
- [DESIGN.md](DESIGN.md)
- [docs/V1_IMPLEMENTATION_PLAN.md](docs/V1_IMPLEMENTATION_PLAN.md)
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment values:

   ```bash
   cp .env.example .env
   ```

3. Set `DATABASE_URL` to a PostgreSQL database and set `AUTH_SECRET`.

4. Create tables and seed demo data:

   ```bash
   npm run prisma:migrate
   npm run prisma:seed
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

The current seed still creates legacy demo accounts while V1 migration is underway.

## Useful Checks

```bash
npm run typecheck
npm run lint
npm run test:trading
npm run build
```

`npm run test:trading` covers the legacy trading flow and will be replaced by V1 game-rule tests during the migration.
