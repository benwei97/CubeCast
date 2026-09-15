# Deployment Notes

Last updated: 2026-09-14

CubeCast currently uses a standard Next.js, Prisma, PostgreSQL, and Auth.js setup.

## Required Services

- A hosted PostgreSQL database.
- A deployment target for the Next.js app.
- Optional Google OAuth credentials if Google sign-in should be enabled.

## Required Environment Variables

```text
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="https://your-production-domain.example"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
```

`DATABASE_URL` points to the PostgreSQL database where all app data is stored:

- users
- auth accounts and sessions
- competitions
- markets
- purchases
- positions
- ledger transactions
- settlements

`AUTH_SECRET` signs auth cookies and tokens. Generate a long random value for each environment.

`AUTH_URL` should match the deployed app URL. For local development it is usually:

```text
http://localhost:3000
```

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

Only seed production intentionally. The current seed creates demo users and demo markets, so it is mainly for local testing.

## Real-Money Boundary

The MVP is intentionally virtual-only. It does not have:

- deposits
- withdrawals
- payment processing
- cash balances
- crypto balances
- real-money settlement
- compliance, KYC, AML, or state-by-state permissions

Future real-money support should be treated as a separate regulated product layer, not a simple switch inside the current CubeCoin flow.
