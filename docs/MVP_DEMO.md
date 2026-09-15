# MVP Demo Walkthrough

Last updated: 2026-09-14

This is the fastest path to see the current CubeCast MVP behavior locally.

CubeCoins are virtual only. The MVP does not include deposits, withdrawals, cash prizes, crypto, or real-money settlement.

## Start The App

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

## What To Test

1. Sign in as `maya@cubecast.test`.
2. Open `/competitions`.
3. Open a market.
4. Use the order ticket to buy YES or NO shares.
5. Confirm that the order ticket shows cost, payout, profit, and remaining balance before submitting.
6. After purchase, confirm that balance, position, recent activity, portfolio, and leaderboard update.
7. Sign out and sign in as `admin@cubecast.test`.
8. Open `/admin`.
9. Create a competition or market if needed.
10. Open a market detail page and resolve it as YES, NO, or canceled.
11. Check the confirmation checkbox before resolving.
12. Confirm that resolved markets stop accepting purchases and that portfolio, ledger, and leaderboard values update.

## What You Should See

- Home page with featured markets and leaderboard preview.
- Competition list and competition detail pages.
- Market pages with YES/NO pricing, volume, close time, share split, order ticket, recent activity, and user position.
- Portfolio page with balance, open position value, final positions, trade history, and ledger.
- Leaderboard ranked by estimated account value.
- Admin page for creating competitions, creating markets, and finding markets that need resolution.

## MVP Completion Checklist

The minimum MVP is close. Remaining work should stay focused:

- Add a final local QA pass across signed-out, user, and admin flows.
- Improve validation messages where query-string feedback is too generic.
- Confirm production environment setup with PostgreSQL, `AUTH_SECRET`, and `AUTH_URL`.
- Decide whether sell/exit is truly required for MVP. If not, leave it out.
- Leave advanced filters, charts, complex AMM logic, and real-time sockets for later.

## Test Commands

```bash
npm run typecheck
npm run lint
npm run test:trading
npm run build
```
