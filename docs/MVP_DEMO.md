# MVP Demo Walkthrough

Last updated: 2026-09-15

CubeCast is mid-migration from the legacy CubeCoin trading MVP to V1, a free WCA prediction slate game.

The current runnable app still demonstrates the legacy trading flow. The V1 demo flow will replace it in later phases.

## Current Legacy Demo

```bash
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open:

```text
http://localhost:3000
```

Seeded demo accounts:

```text
admin@cubecast.test / password123
maya@cubecast.test / password123
```

## Legacy Flow Still Available

- Browse competitions and markets.
- Click YES/NO prices.
- Review a CubeCoin order.
- Confirm a purchase.
- View portfolio and leaderboard.
- Resolve markets as admin.

This flow is retained temporarily while the V1 schema and game rules are built.

## V1 Demo Target

The V1 demo is successful when:

1. A user signs in with WCA identity or a local development WCA-like account.
2. The user opens the active slate.
3. The slate shows approximately 20-30 fixed-probability markets.
4. The UI displays `X / 10 Picks`.
5. The user selects exactly 10 predictions before lock.
6. The user reviews My Picks with probability and score swing.
7. The entry locks server-side.
8. Admin settles or voids markets with evidence snapshots.
9. The leaderboard ranks only valid 10-pick entries.
10. The finalized slate score starts from 1,000 and applies deterministic scoring.

## Test Commands

```bash
npm run typecheck
npm run lint
npm run test:trading
npm run build
```

`npm run test:trading` is legacy and will be replaced by V1 game-rule tests.
