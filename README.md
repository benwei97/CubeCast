# CubeCast

CubeCast is being migrated into a free WCA speedcubing prediction game.

V1 target:

- WCA-authenticated gameplay
- curated contests
- approximately 20-30 fixed-probability markets per contest
- exactly 10 picks for a valid entry
- 1,000-point starting score
- transparent score changes based on published probabilities
- official WCA result settlement
- immutable settlement snapshots
- contest leaderboard with deterministic tiebreakers
- prize-ready architecture disabled by default

CubeCast V1 is not a real-money prediction market. It does not support deposits, withdrawals, wagering, purchasable currency, staking, user-funded prize pools, or buying extra predictions.

## Migration Status

The existing repository still contains an older CubeCoin trading MVP. That implementation is being migrated incrementally rather than rewritten from scratch.

Phase 1 schema foundation is complete: the database now includes V1 contest, WCA identity, market option, entry, prediction, settlement snapshot, leaderboard, admin audit, prize award, and payout shell models alongside the legacy trading tables.

Phase 2 core game rules are complete: scoring, exactly-10 entry validation, lock/edit checks, settlement helper semantics, and leaderboard tiebreakers are covered by `npm run test:v1`.

Phase 3 player UI is complete: the home page now opens on the active V1 contest feed, displays `X / 10 Picks`, lets signed-in users select/change/remove picks through server actions, and exposes `/picks` for reviewing the current entry.

Phase 4 settlement and leaderboard is complete for the manual MVP path: admins can resolve, void, or tie V1 markets, settlement snapshots and audit records are stored, valid 10-pick entries are scored from 1,000 points, and `/leaderboard` ranks contest entries.

Phase 5 admin contest tools are complete: admins can create contests, attach competitions, configure diversity caps, create fixed-probability V1 markets, and publish draft V1 markets.

Phase 6 WCA integration is complete: WCA OAuth can be enabled with credentials, WCA identities are stored on login, and admins can import WCA competitions plus refresh result snapshots.

Phase 6.5 WCA-assisted settlement is complete: imported WCA result snapshots now appear in the admin V1 Settlement Queue, and admins can attach a selected WCA evidence row to immutable settlement snapshots when resolving markets.

Phase 7 legacy trading UI removal is complete: the old market-detail trading route, portfolio route, trading services, quick-trade components, and legacy trading smoke test have been removed.

Phase 8 legacy database cleanup is complete: purchase, position, ledger, balance, liquidity, and old settlement schema have been removed in migration `20260915230000_phase8_legacy_db_cleanup`, and the seed is V1-only.

Phase 9 prize-ready disabled layer is complete: prize configuration is feature-flagged off by default, eligibility hooks are tested, and tied-rank award planning is deterministic without exposing prizes in gameplay.

Phase 10 contest lock maintenance is complete: server reads and pick actions now persist due contests as locked, lock open markets, and mark entries as locked or invalid based on the exactly-10 rule.

Phase 11 admin lifecycle visibility is complete: admins can review contest lifecycle counts and manually refresh status maintenance from `/admin`.

Phase 12 finalized contest review is complete: admins can review the latest finalized contest, terminal market totals, cached official entries, and top leaderboard results from `/admin`.

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

3. Set `DATABASE_URL` to a PostgreSQL database and set `AUTH_SECRET`. For WCA login, also set `AUTH_WCA_ID` and `AUTH_WCA_SECRET`.

4. Create tables and seed local data:

   ```bash
   npm run prisma:migrate
   npm run prisma:seed
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

The current seed still creates local development accounts while V1 migration is underway.

## Useful Checks

```bash
npm run typecheck
npm run lint
npm run test:v1
npm run build
```

`npm run test:v1` covers the V1 game rules.
