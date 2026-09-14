# CubeCast Project Status

Last updated: 2026-09-14

CubeCast is a virtual prediction market for competitive speedcubing. Users will eventually sign in, receive free CubeCoins, browse competition markets, make YES/NO predictions, hold positions, and receive virtual payouts when markets resolve.

CubeCoins are virtual only. The app does not support real money, deposits, withdrawals, crypto, or cash-equivalent functionality.

## Current Architecture

The app currently uses:

- Next.js for the web app, pages, and server-rendered data loading
- React and TypeScript for UI code
- PostgreSQL for persistent app data
- Prisma for schema management, migrations, and type-safe database access
- NextAuth/Auth.js for authentication

High-level flow:

```text
Browser
  -> Next.js app
  -> Prisma client
  -> PostgreSQL database
```

## Local Data Storage

Local development data is stored in PostgreSQL:

```text
database: cubecast
host: localhost
port: 5432
user: benwei
```

The app reads this through `DATABASE_URL` in `.env`.

## Built So Far

### App Foundation

- Next.js app scaffold
- Shared global layout with header, nav, account area, and footer
- Global styling in `src/app/globals.css`
- TypeScript configuration
- ESLint setup
- Shared market pricing helper for YES/NO display and purchase prices
- Shared account value helper for portfolio and leaderboard calculations

### Database Foundation

The Prisma schema defines the main data model:

- `User`
- `Account`
- `Session`
- `VerificationToken`
- `Competition`
- `Market`
- `Purchase`
- `Position`
- `LedgerTransaction`
- `Settlement`

The initial database migration has been created and applied:

```text
prisma/migrations/20260914213004_init/migration.sql
```

### Authentication

- NextAuth/Auth.js is configured
- Prisma adapter stores auth-related data in PostgreSQL
- Credential sign-in works for local seeded demo users
- Google OAuth provider is wired but disabled until Google credentials are configured
- Signed-in sessions include CubeCast user data such as username, role, and CubeCoin balance

### Onboarding

- First-login onboarding service exists
- New users can receive a starting balance of 1,000 CubeCoins
- The starting balance is recorded as a ledger transaction

### Seed Data

The seed script creates demo data:

- one admin user
- five sample users
- upcoming competitions
- open markets
- sample purchases
- sample positions
- one resolved market
- ledger transactions
- one settlement

Demo accounts use:

```text
admin@cubecast.test / password123
maya@cubecast.test / password123
```

### Current Pages

`/`

- Home page
- Shows CubeCast intro
- Shows current balance or sign-in prompt
- Shows featured competition
- Shows featured open markets
- Links featured markets to market detail pages
- Shows leaderboard preview
- Data is loaded from PostgreSQL through Prisma

`/sign-in`

- Local credential sign-in page
- Google sign-in button appears only when Google OAuth env vars are set

`/competitions`

- Lists seeded competitions from PostgreSQL
- Shows competition location, status, description, dates, and market count
- Shows each competition's markets
- Links each listed market to its market detail page
- Links each competition to its detail page

`/competitions/[slug]`

- Competition detail page
- Shows competition description, location, dates, status, market count, open markets, final markets, and total volume
- Shows a compact market board with YES price, NO price, volume, and status
- Links each market row to its market detail page

`/markets/[slug]`

- Market detail page
- Shows market question, description, competition, status, category, close time, and resolution rules
- Shows calculated YES/NO prices based on current outstanding seeded shares
- Shows market metrics, share split, and a Kalshi-style order ticket
- Signed-in users can buy YES or NO shares with CubeCoins
- Order ticket previews selected outcome, quantity, average price, total cost, max payout, max profit, and remaining balance
- Order ticket blocks unaffordable client-side submissions while server-side validation remains authoritative
- Purchase flow validates market status, close time, user balance, and quantity
- Purchases update user balance, market outstanding shares, user position, recent activity, and ledger records
- Shows the signed-in user's current position in the market
- Shows recent purchase activity when available
- Admin users can resolve a market as YES, NO, or canceled
- Resolved markets pay 100 CubeCoins per winning share
- Canceled markets refund original position costs
- Resolution updates market status, positions, balances, ledger entries, portfolio, and leaderboard

`/portfolio`

- Signed-in portfolio page
- Shows available CubeCoin balance
- Shows estimated open position value
- Shows total account value
- Shows total CubeCoins spent across positions
- Lists YES/NO holdings, cost, estimated value or payout, and market status
- Lists recent ledger transactions with balance-after values
- Signed-out users see a sign-in prompt

`/leaderboard`

- Global leaderboard page
- Ranks users by estimated account value
- Account value equals available CubeCoins plus open position value at current mock prices
- Shows balance, open position value, total positions, and rank
- Highlights the signed-in user's row and summary rank

`/admin`

- Admin-only operations page
- Admin nav link appears only for admin users
- Admin users can create competitions
- Admin users can create open markets under existing competitions
- Admin users can review recent markets and open each market for buying or resolution
- Signed-out and non-admin users see a sign-in prompt

## Not Built Yet

### Competition Browsing

- Competition status filtering
- Market status/category filters on competition detail pages
- Richer event metadata and external WCA links

### Market Detail Pages

- Explicit trade confirmation step
- Better post-purchase loading state
- Live multi-user updates without manual refresh

### Trading / Prediction Flow

- More realistic automated market maker pricing
- Sell/exit behavior, if included in MVP scope
- Prevent trades after close
- More automated tests around purchase transactions

### Portfolio

- More detailed purchase history
- Profit/loss display per market
- Better resolved/canceled position grouping
- Account value charts over time

### Market Resolution

- Dedicated admin dashboard for reviewing markets that need resolution
- Stronger confirmation step before final resolution
- Audit trail beyond payout/refund ledger entries

### Leaderboard

- Add all-time and time-based views
- Handle resolved markets consistently
- Add richer filters such as balance-only, open-value, and resolved winnings

### Admin Tools

- Edit market details
- Close markets
- Review users and balances
- Better admin validation feedback without query-string redirects

### Testing And Hardening

- Automated tests for balance changes
- Automated tests for purchases
- Automated tests for settlement payouts
- Better form validation
- Better error states
- Loading states
- Access-control checks for admin-only actions

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

Build production app:

```bash
npm run build
```

## Progress Notes

When new functionality is added, update these sections:

- `Built So Far` for completed features
- `Current Pages` for visible user-facing pages
- `Not Built Yet` for remaining work
- `Useful Commands` if setup or testing commands change
