# Deployment Notes

Last updated: 2026-09-17

CubeCast currently uses a standard Next.js, Prisma, PostgreSQL, and Auth.js setup.

CubeCast V1 is a free WCA speedcubing prediction contest game. The legacy trading UI, services, and database tables have been removed.

## WCA Ingestion Limits

Competition discovery, rosters, and official results share a two-second request queue within each Node process. HTTP 429 responses pause that process's queue for Retry-After or 30/60/120-second backoff. Successful non-result data is cached for 30 minutes; results remain fresh. WCA Odds uses separate controls.

This is not a distributed limiter. Before deploying multiple instances, coordinate reads through a single ingestion worker or a shared limiter so traffic does not multiply. Cold contest generation plus service cooldowns can take minutes. Generation uses Next.js after to return the browser response promptly, but after still inherits the host's execution-duration limits and does not survive process termination. Use a durable background job runner before deploying long generation tasks on short-lived serverless functions. A stranded running job can be cancelled from the admin page and restarted. Do not promise zero 429s or assume the selected spacing is an official WCA quota.

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

## Automatic WCA Results

Local development and persistent Node servers start the result monitor automatically through Next.js instrumentation. It checks for due work every minute and fetches each eligible competition at most once every 15 minutes. Only started competitions with unsettled public markets in active contests are queried. Errors retry on the next scheduled check; rate-limit errors do not trigger immediate retries.

On Vercel, vercel.json schedules GET /api/cron/wca-results every 15 minutes. Set CRON_SECRET in the deployment environment; Vercel supplies it as the Bearer authorization header. The hosting plan must support this schedule. For another serverless host, configure a scheduler with the same interval, URL, and Authorization: Bearer <CRON_SECRET> header. A sleeping serverless process cannot run the persistent Node timer reliably.

Checks preserve first-observed person/event/round result rows and their observation timestamps, adding newly published rows without overwriting earlier evidence. Detection time is when CubeCast observes publication, not a claim about the exact WCA publication time. Existing imported results retain their historical observation timestamp. No database migration is required. Market settlement is still admin-reviewed.

## Database Setup

After Prisma schema changes, restart the dev server. Next.js hot reload can retain an older Prisma Client instance and report Unknown argument errors for new fields even when the database migration is applied. npm run dev now regenerates Prisma Client before starting Next.js. Generation does not apply migrations; run the migration commands separately.

Migration 20260916210000_contest_only_publication clears legacy single-market publications inside draft contests. It preserves market content and audit history and refuses to change markets with picks or settlement evidence. Markets now become public exclusively through whole-contest publication.

The admin contest workflow adds nullable ContestSlate.preparation metadata in migration 20260916200000_admin_contest_preparation. Deploy this migration and regenerate Prisma Client before running the updated app. This is additive and does not delete existing contests, markets, or picks.

For local development:

```bash
npm run prisma:migrate
```

For production, run Prisma migrations against the production database before serving traffic:

```bash
npx prisma migrate deploy
```

CubeCast no longer ships fake seeded contests or markets. Production and local contest data should come from WCA sign-in, WCA competition recommendations, generated markets, picks, result snapshots, and settlement records.

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
