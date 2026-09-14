# CubeCast

Virtual prediction markets for competitive speedcubing. This repository currently contains Phase 1 foundation work only.

For a living summary of what has been built, how the app works, and what remains, see [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Phase 1 Scope

- Next.js, React, TypeScript app scaffold
- Prisma schema for users, competitions, markets, purchases, positions, transactions, and settlements
- Auth.js/NextAuth foundation with Google OAuth support when configured
- Local demo credential sign-in for seeded users
- First-login onboarding service that grants 1,000 CubeCoins and records a ledger transaction
- Shared layout, sign-in page, and seed-backed home page
- Seed script with one admin, five sample users, competitions, markets, purchases, and a resolved market

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

## Phase 1 Deviations

- Google OAuth is wired but not usable until `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are configured.
- Credential login exists only to make local seeded verification possible.
- No real-money, deposit, withdrawal, crypto, or cash-equivalent functionality is present.
- Pricing, purchase, settlement, portfolio, leaderboard, and admin behavior remain for later phases.
