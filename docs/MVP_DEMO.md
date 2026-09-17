# Local MVP Walkthrough

Last updated: 2026-09-17

## Recommendation Recovery

On a Draft contest in /admin, click Refresh recommendations. Top-100 pairs are searched first; top-250 and top-500 pairs are added if needed, using WCA Odds only. The search targets 20 diverse markets, with a 120-simulation ceiling. Temporary registration failures retry and unavailable competitions can be inspected through View unavailable competitions.

If fewer than 10 markets qualify, publication remains blocked. Expand window by 7 days explicitly searches a larger date range; the header updates after successful generation. No contest is published automatically, and no fallback probabilities are used.

WCA discovery and registration requests now share pacing with automatic result checks. Cold generation starts requests at least two seconds apart; a rate limit pauses all reads for Retry-After or a 30/60/120-second cooldown. Let generation finish rather than repeatedly refreshing. Successful rosters are reused for 30 minutes, so immediate refreshes are usually faster but may not reflect registrations changed during that period. WCA Odds remains separately rate-controlled.

Refresh recommendations now returns immediately and displays Finding competitions and calculating odds. The page checks status every five seconds; the work does not require keeping the original browser submission open. Existing markets are replaced only after successful completion. Cancel generation keeps existing markets and lets you start again, including after a server restart leaves a running status behind. Failed generation shows a saved error; connection failures show a recoverable inline message. Publication is unavailable while generation runs.

CubeCast is a free WCA prediction contest game.

The current runnable app opens on the V1 contest-picking flow. The old trading routes and services have been removed from the app surface.

## Current Local Flow

```bash
npm install
npm run prisma:migrate
npm run dev
```

Open:

```text
http://localhost:3000
```

Use WCA sign-in for local testing. After the first sign-in, promote your user to `ADMIN` in the database so `/admin` is available.

## Contest Flow Available Now

- As admin, open `/admin` and generate a recommended weekly contest from the largest upcoming WCA competitions.
- Review each included competition's accepted registrations, competitor limit, and top ranked cubers.
- Review generated draft markets by competition, select the markets for the public contest, review the selected set, and publish them together.
- Open the active contest on `/`.
- Scan fixed-probability markets across real WCA competitions.
- See `X / 10 Picks` in the contest entry panel.
- Click a market outcome to open the pick review modal.
- Sign in and add, change, or remove picks before lock.
- Open `/picks` to review selected markets, probabilities, and score swing.
- Configure WCA OAuth and sign in with WCA for production-like identity.
- As admin, open `/admin` to choose competitions, generate markets, exclude unwanted candidates, review the included markets, and publish the contest.
- Active contests show entry counts and settlement progress; pick deadlines are enforced server-side.
- WCA result evidence is fetched automatically every 15 minutes for started competitions with unsettled public contest markets.
- As admin, open `/admin` and use the Settlement Queue to review evidence counts, attach a WCA result row or manual source note, and resolve, void, or mark an exact tie.
- Complete contests show final scores and settlement evidence; historical contests remain accessible below.
- Open `/leaderboard` to see valid 10-pick entries ranked by contest score.

The server enforces sign-in, contest status, lock time, market membership, option membership, and the max-10-picks rule.

Settlement stores snapshot evidence and admin audit records. A background monitor imports WCA results, preserving the first observation of each person/event/round. These rows can be selected during admin-assisted settlement.

## WCA-Assisted Settlement Check

1. Sign in as an admin.
2. Open `/admin`.
3. Generate a recommended contest.
4. Keep the local dev server running; after WCA publishes results, allow up to 15 minutes for the monitor to import them. Production uses the scheduled endpoint described in DEPLOYMENT_NOTES.md.
5. Use a generated market for the same competition/event.
6. In the Settlement Queue, confirm WCA evidence rows appear for matching event/competitor data.
7. Pick a winning outcome, choose an evidence row, and resolve the market.
8. Confirm `/leaderboard` updates after valid 10-pick entries have settled predictions.

## Local MVP Target

## Admin Contest Workflow Check

All generated draft markets start included. The toolbar shows the actual included count, with Select all and Deselect all controls. Every candidate can be toggled. Only Publish contest releases the selected group; there is no fixed 25-market target.

1. Open /admin. The header shows contest dates and Draft, Active, or Complete status.
2. In a Draft, generate recommended markets across the global window. Existing drafts retain their old markets until a successful refresh; a notice identifies the older competition-first method.
3. Review the quality-ranked list with world ranks and WCA Odds probabilities; optionally switch to By competition. Deselect unwanted markets, retain at least 10, review the resulting dates and lock time, and publish the contest. There is no fixed competition count.
4. Confirm the contest becomes Active and Home, My Picks, and Leaderboard follow it.
5. Active contests show complete entries, settled market progress, selection open/locked status, and competition progress.
6. Prepare next contest creates a separate private draft for the following window. It cannot be published before the previous picks lock or with overlapping competition windows.
7. Once published, the next contest becomes current. The previous contest remains in history for delayed result settlement; user entries remain accessible through Other contest entries on My Picks.
8. Resolve or void every public market after lock to reach Complete. Unselected candidates do not block finalization.
9. Expand historical contests to inspect featured competition progress, results, and leaderboards. Completed contests expose immutable settlement evidence.

## Player Test Target

Local data should come from WCA login, WCA competition recommendations, generated markets, user picks, settlement snapshots, and leaderboard results. The app no longer ships fake seeded contests or fake seeded markets.

The local MVP flow is successful when:

1. A user signs in with WCA identity or a local development WCA-like account.
2. The user opens the active contest.
3. The contest shows fixed-probability markets generated from WCA Odds-style model probabilities.
4. The UI displays `X / 10 Picks`.
5. The user selects exactly 10 predictions before lock.
6. The user reviews My Picks with probability and score swing.
7. The entry locks server-side; exactly-10 entries become locked and incomplete entries become invalid.
8. Admin settles or voids markets with evidence snapshots.
9. The leaderboard ranks only valid 10-pick entries.
10. The finalized contest score starts from 1,000 and applies deterministic scoring.

## Test Commands

```bash
npm run typecheck
npm run lint
npm run test:v1
npm run build
```

`npm run test:v1` covers the V1 game rules.
