# Deployment Notes

Last updated: 2026-09-15

CubeCast currently uses a standard Next.js, Prisma, PostgreSQL, and Auth.js setup.

CubeCast V1 is a free WCA speedcubing prediction contest game. The legacy trading UI, services, and database tables have been removed.

## Required Services

- A hosted PostgreSQL database.
- A deployment target for the Next.js app.
- Optional Google OAuth credentials if Google sign-in should be enabled.
- WCA OAuth credentials before official V1 gameplay can launch.

## Required Environment Variables

```text
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="https://your-production-domain.example"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
AUTH_WCA_ID=""
AUTH_WCA_SECRET=""
WCA_BASE_URL="https://www.worldcubeassociation.org"
PRIZES_ENABLED="false"
PRIZE_PAYOUTS_JSON=""
```

`DATABASE_URL` points to the PostgreSQL database where all app data is stored:

- users
- auth accounts and sessions
- competitions
- markets
- contests
- entries and predictions
- WCA identities
- settlement snapshots
- leaderboard entries
- admin audit records
- prize/payout shell records while prizes remain disabled

Legacy purchase, position, ledger, and balance columns were removed by migration `20260915230000_phase8_legacy_db_cleanup`.

`AUTH_SECRET` signs auth cookies and tokens. Generate a long random value for each environment.

`AUTH_URL` should match the deployed app URL. For local development it is usually:

```text
http://localhost:3000
```

`AUTH_WCA_ID` and `AUTH_WCA_SECRET` enable WCA sign-in. Create a WCA OAuth application and use this callback URL:

```text
https://your-production-domain.example/api/auth/callback/wca
```

For local testing:

```text
http://localhost:3000/api/auth/callback/wca
```

`WCA_BASE_URL` defaults to the production WCA site. Set it to `https://staging.worldcubeassociation.org` when testing against WCA staging credentials.

## Database Commands

For local development:

```bash
npm run prisma:migrate
npm run prisma:seed
```

For production, run Prisma migrations against the production database before serving traffic:

```bash
npx prisma migrate deploy
```

Only seed production intentionally. The current seed creates local users and local markets, so it is mainly for local testing.

## Real-Money Boundary

V1 is intentionally free-to-play. It does not have:

- deposits
- withdrawals
- payment processing
- cash balances
- crypto balances
- real-money settlement
- purchasable prediction currency
- purchased extra picks
- user-funded prize pools
- compliance, KYC, AML, or state-by-state permissions

Prize functionality must remain disabled unless explicitly enabled and reviewed. Future real-money or prize-related support should be treated as a separate legal/compliance workstream, not a simple switch inside gameplay.

`PRIZE_PAYOUTS_JSON` is reserved for future prize configuration, for example:

```json
[{"rank":1,"amountCents":10000},{"rank":2,"amountCents":5000}]
```

It is ignored by gameplay while `PRIZES_ENABLED` is false.
