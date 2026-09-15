# MVP Demo Walkthrough

Last updated: 2026-09-15

CubeCast is a free WCA prediction slate game.

The current runnable app opens on the V1 slate-picking flow. The old trading routes and services have been removed from the app surface.

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
- Configure WCA OAuth and sign in with WCA for production-like identity.
- As admin, open `/admin` to create slates, attach competitions, configure diversity caps, and create/publish V1 markets.
- As admin, import a competition by WCA competition ID and refresh its result snapshot.
- As admin, open `/admin` and use the V1 Settlement Queue to review imported WCA evidence, attach a result row, and resolve, void, or mark an exact tie.
- Open `/leaderboard` to see valid 10-pick entries ranked by slate score.

The server enforces sign-in, slate status, lock time, market membership, option membership, and the max-10-picks rule.

Settlement now stores snapshot evidence and admin audit records. WCA competition/result data can be imported into local metadata and selected as evidence during admin-assisted settlement.

## WCA-Assisted Settlement Check

1. Sign in as an admin.
2. Open `/admin`.
3. Import a WCA competition ID from a WCA competition URL.
4. Refresh that competition's result snapshot.
5. Create or use a V1 market for the same competition/event.
6. In the V1 Settlement Queue, confirm WCA evidence rows appear for matching event/competitor data.
7. Pick a winning outcome, choose an evidence row, and resolve the market.
8. Confirm `/leaderboard` updates after valid 10-pick entries have settled predictions.

## V1 Demo Target

The seeded V1 data includes:

- 1 demo contest slate
- 2 slate competitions
- 20 fixed-probability V1 markets
- 40 market options
- 4 development WCA identities
- default diversity caps on the demo slate

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
npm run build
```

`npm run test:v1` covers the V1 game rules.
