# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

CubeCast serves speedcubing fans, competitors, and spectators who want a free weekly forecasting game around official World Cube Association competition results.

The primary user signs in with WCA, reviews a curated contest, chooses exactly 10 predictions from roughly 20-30 available markets, and competes on a contest leaderboard.

Secondary users are administrators who generate recommended contests from real WCA competitions, review generated markets, publish probabilities, settle outcomes from official WCA results, inspect evidence, void markets, and finalize contests.

## Product Purpose

CubeCast is a free speedcubing prediction game. Each contest contains more markets than a user can select, so the core skill is identifying the 10 predictions where CubeCast's fixed model probabilities are most wrong.

Success for V1 means a WCA-authenticated user can choose 10 predictions before lock, see transparent scoring upside/downside, track results as WCA outcomes settle, and rank on a leaderboard scored from a 1,000-point baseline.

## Positioning

CubeCast uses the scanability and interaction speed of modern prediction-market products while remaining a free forecasting game. It is not a real-money market, not a wagering product, and not a virtual-currency trading game.

The product is differentiated by combining official WCA results, recognizable speedcubers, fixed model probabilities, exactly-10 pick selection, transparent point scoring, and objective settlement evidence.

## Operating Context

The admin workspace focuses on the current generated contest: review competitions and markets, select the release, review it, and publish. Operational tools and history remain available in collapsed sections below.

Users browse active contests, inspect markets, add/remove/change picks before the contest lock time, and review a persistent `X / 10 Picks` state. Once the contest locks, entries are immutable. Users with exactly 10 locked predictions receive a valid contest entry and appear on the official leaderboard.

Administrators generate featured contests from upcoming WCA competitions, preview competitor limits and top ranked entrants, publish approximately 20-30 generated markets, configure diversity constraints, settle or void markets, preserve immutable settlement snapshots, and finalize contests after every market is resolved or void.

## Capabilities and Constraints

- WCA login is required for official gameplay.
- A contest can include one or more WCA competitions and is not tied to Monday-Sunday calendar weeks.
- Contest predictions lock one hour before the earliest included competition starts.
- Users can select, remove, replace, or change predictions before lock.
- A valid entry requires exactly 10 predictions at lock.
- Users with fewer than 10 locked predictions are not official leaderboard participants.
- Published market probabilities are immutable for V1.
- Normal V1 market probabilities should generally sit between 35% and 65%.
- Every valid entry starts at 1,000 points.
- Correct prediction score change is `100 - publishedProbability`.
- Incorrect prediction score change is `-publishedProbability`.
- Voided predictions score 0 and do not invalidate an originally valid 10-pick entry.
- H2H exact ties award 50% of the normal positive score change to either side.
- WCA first-published official results are the settlement source of truth.
- Settlement must store immutable evidence snapshots and rule versions.
- Real prizes are future-only and must remain feature-flagged off until explicitly enabled.
- No XP, purchasable currency, deposits, withdrawals, staking, user-funded wagering, or purchasable extra predictions are part of V1.

## Brand Commitments

The product name is CubeCast. The voice should be direct, practical, and forecasting-oriented.

Use interaction inspiration from Kalshi and Polymarket for fast scanning, probability display, binary choices, pick status, and results. Do not clone their branding, copy, or exact visual design.

Use product language such as picks, score, probability, leaderboard, results, contest, market, lock, and void. Avoid unnecessary financial terms such as shares, contracts, portfolio value, order book, buy, sell, payout, stake, and balance.

## Evidence on Hand

- Existing Next.js, Prisma, PostgreSQL, and Auth.js implementation.
- Existing admin/user role infrastructure.
- Existing dense market-board UI patterns.
- Current trading/CubeCoin code that must be migrated away from the V1 product model.
- Generated H2H market probabilities now use the public WCA Odds simulation API by default, with one year of historical results and a 180-day half-life. Full in-repo model implementation and backtesting are still future work.
- No production WCA OAuth credentials, WCA ingestion pipeline, official rules, prize terms, legal compliance docs, or real prize provider integration are present.

## Product Principles

- Keep V1 free and legally conservative.
- Make the exactly-10-pick constraint obvious at all times.
- Show probability and score upside/downside before the user picks.
- Prefer recognizable competitors and tight 35%-65% markets.
- Lock and settlement rules must be enforced server-side.
- Preserve settlement evidence so future WCA corrections do not rewrite CubeCast history.
- Keep prize architecture separable and disabled by default.
- Avoid advanced model/live-probability features until the core game loop works.

## Accessibility & Inclusion

The web app should support keyboard navigation, visible focus states, semantic controls, sufficient text contrast, and responsive layouts across mobile and desktop viewports. Critical game state such as lock time, selected side, valid/invalid entry state, and result status must not rely on color alone.
