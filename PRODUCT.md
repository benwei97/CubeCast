# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

CubeCast serves speedcubing fans, competitors, and spectators who want a lightweight way to predict competition outcomes without using real money. The primary user is a signed-in participant browsing WCA-style competitions, buying YES/NO CubeCoin positions, watching markets move, and checking portfolio or leaderboard progress.

Secondary users are admins who create competitions, create markets, and resolve results after the underlying event outcome is known.

## Product Purpose

CubeCast is a virtual prediction market for competitive speedcubing. It lets users spend free CubeCoins on event predictions, track open and final positions, and receive virtual payouts when markets resolve.

Success for the MVP means a user can understand a market, buy a YES or NO position, see their balance and portfolio update, and watch admin resolution settle payouts or refunds.

## Positioning

CubeCast applies the familiar prediction-market model to speedcubing while staying virtual-only. The product should feel close to modern event-contract trading interfaces, especially Kalshi-style market boards and order review flows, but the domain, currency, and settlement are CubeCast-specific.

## Operating Context

Users browse from the home market board, competition pages, market detail pages, portfolio, and leaderboard. The fastest path should be market discovery -> YES/NO click -> review order -> confirm purchase.

Admins use the admin area and market detail pages to create competitions, create markets, and resolve markets as YES, NO, or canceled.

## Capabilities and Constraints

- CubeCoins are virtual and have no monetary value.
- The app does not support deposits, withdrawals, crypto, cash balances, or real-money settlement.
- Auth uses Auth.js/NextAuth.
- Persistent data is stored in PostgreSQL through Prisma.
- Local demo users can sign in with credential auth.
- Markets support YES/NO purchases, position tracking, ledger entries, portfolio valuation, leaderboard ranking, and admin resolution.
- Resolved winning shares pay 100 CubeCoins per share.
- Canceled markets refund original position costs.
- Real-money monetization is a future regulated product layer, not a simple flag in the current MVP.

## Brand Commitments

The product name is CubeCast. The voice should be direct, practical, and trading-oriented. The interface should be Kalshi-inspired in interaction shape: dense market boards, visible bid-style YES/NO actions, compact order review, and fast movement from browsing to purchasing.

## Evidence on Hand

- Existing app implementation in `src/app`, `src/components`, and `src/lib`.
- Living project status in `docs/PROJECT_STATUS.md`.
- MVP demo path in `docs/MVP_DEMO.md`.
- Deployment and data notes in `docs/DEPLOYMENT_NOTES.md`.
- Seed data in `prisma/seed.ts`.
- No official brand assets, logo system, user research, legal compliance documents, or real-money regulatory approvals are present.

## Product Principles

- Keep the MVP virtual-only and legally clear.
- Make the fastest path to a trade visible from market browsing surfaces.
- Favor dense, scannable trading interfaces over marketing-heavy pages.
- Keep admin controls explicit and hard to trigger accidentally.
- Leave advanced filters, real-time sockets, complex AMM behavior, and real-money systems out of the bare MVP unless they become necessary.

## Accessibility & Inclusion

The web app should support keyboard navigation, visible focus states, semantic controls, sufficient text contrast, and responsive layouts across mobile and desktop viewports.
