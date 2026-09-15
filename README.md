# CubeCast

Virtual prediction markets for competitive speedcubing.

CubeCast is currently a virtual-only MVP using CubeCoins. It does not support deposits, withdrawals, crypto, cash balances, or real-money settlement.

For the living project summary, see [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).
For a local demo path, see [docs/MVP_DEMO.md](docs/MVP_DEMO.md).
For environment and database notes, see [docs/DEPLOYMENT_NOTES.md](docs/DEPLOYMENT_NOTES.md).

## Current Scope

- Next.js, React, TypeScript app
- Prisma schema for users, competitions, markets, purchases, positions, ledger transactions, and settlements
- PostgreSQL persistence
- Auth.js/NextAuth with local demo credential sign-in
- Seed data with demo users, competitions, markets, purchases, positions, and a resolved market
- Kalshi-inspired market browsing and order ticket
- Home page quick-trade market board with YES/NO review modal
- CubeCoin YES/NO purchases
- Portfolio, trade history, ledger, and leaderboard
- Admin competition creation, market creation, and market resolution
- Trading smoke tests for purchases, insufficient balance, payout settlement, and canceled-market refunds

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

Demo accounts created by the seed script use `password123`.

## Useful Checks

```bash
npm run typecheck
npm run lint
npm run test:trading
npm run build
```
