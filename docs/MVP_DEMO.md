# MVP Demo Walkthrough

Last updated: 2026-09-15

CubeCast is mid-migration from the legacy CubeCoin trading MVP to V1, a free WCA prediction slate game.

The current runnable app now opens on the V1 slate-picking flow. Legacy trading routes still exist temporarily while settlement, leaderboard, admin, and old-flow removal are completed.

## Current V1 Demo

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

## V1 Flow Available Now

- Open the active slate on `/`.
- Scan 20 fixed-probability markets across the seeded competitions.
- See `X / 10 Picks` in the slate entry panel.
- Click a market outcome to open the pick review modal.
- Sign in and add, change, or remove picks before lock.
- Open `/picks` to review selected markets, probabilities, and score swing.
- As admin, open `/admin` and use the V1 Settlement Queue to resolve, void, or mark an exact tie.
- Open `/leaderboard` to see valid 10-pick entries ranked by slate score.

The server enforces sign-in, slate status, lock time, market membership, option membership, and the max-10-picks rule.

Settlement now stores snapshot evidence and admin audit records. The current MVP settlement path is manual/admin-assisted; direct WCA result ingestion is still planned.

## Legacy Flow Still Available Temporarily

- Legacy competition, market detail, portfolio, and admin routes still exist.
- The old CubeCoin trading flow is retained only until the V1 settlement and leaderboard flows replace it.

## V1 Demo Target

The seeded V1 data includes:

- 1 demo contest slate
- 2 slate competitions
- 20 fixed-probability V1 markets
- 40 market options
- 4 development WCA identities

The V1 demo is successful when:

1. A user signs in with WCA identity or a local development WCA-like account.
2. The user opens the active slate.
3. The slate shows approximately 20-30 fixed-probability markets.
4. The UI displays `X / 10 Picks`.
5. The user selects exactly 10 predictions before lock.
6. The user reviews My Picks with probability and score swing.
7. The entry locks server-side. Partially implemented through lock/edit enforcement; automatic lock transition is still planned.
8. Admin settles or voids markets with evidence snapshots.
9. The leaderboard ranks only valid 10-pick entries.
10. The finalized slate score starts from 1,000 and applies deterministic scoring.

## Test Commands

```bash
npm run typecheck
npm run lint
npm run test:v1
npm run test:trading
npm run build
```

`npm run test:v1` covers the new V1 game rules. `npm run test:trading` is legacy and will be removed after the old trading flow is retired.
