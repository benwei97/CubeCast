import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const session = await auth();
  const slate = await prisma.contestSlate.findFirst({
    orderBy: [{ finalizedAt: "desc" }, { lockAt: "desc" }],
    include: {
      leaderboardEntries: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              wcaIdentity: {
                select: {
                  name: true,
                  wcaId: true
                }
              }
            }
          }
        },
        orderBy: [{ rank: "asc" }, { finalScore: "desc" }]
      },
      markets: {
        select: {
          status: true
        }
      }
    }
  });

  if (!slate) {
    return (
      <div className="page-stack">
        <section>
          <h1>Leaderboard</h1>
          <p>No slate is available yet.</p>
        </section>
      </div>
    );
  }

  const currentUserRank = session?.user?.id
    ? slate.leaderboardEntries.find(
        (entry) => entry.userId === session.user.id
      )?.rank
    : null;
  const terminalMarkets = slate.markets.filter((market) =>
    ["RESOLVED", "VOID", "CANCELED"].includes(market.status)
  ).length;
  const topEntry = slate.leaderboardEntries[0] ?? null;

  return (
    <div className="page-stack">
      <section>
        <p className="eyebrow">Slate rankings</p>
        <h1>Leaderboard</h1>
        <p>
          Only official 10-pick entries appear here. Scores start at 1,000 and
          update as markets settle.
        </p>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span>Slate</span>
          <strong>{slate.title}</strong>
          <small>{slate.status}</small>
        </article>
        <article className="summary-card">
          <span>Top score</span>
          <strong>{topEntry ? topEntry.finalScore.toLocaleString() : "0"}</strong>
          <small>{topEntry ? getDisplayName(topEntry.user) : "No entries yet"}</small>
        </article>
        <article className="summary-card">
          <span>Your rank</span>
          <strong>{currentUserRank ? `#${currentUserRank}` : "-"}</strong>
          <small>{session?.user ? "Valid entries only" : "Sign in to rank"}</small>
        </article>
        <article className="summary-card">
          <span>Markets settled</span>
          <strong>
            {terminalMarkets.toLocaleString()} / {slate.markets.length}
          </strong>
          <small>Resolved or void</small>
        </article>
      </section>

      <section>
        <div className="section-heading">
          <h2>Official Entries</h2>
          <Link href="/">Back to slate</Link>
        </div>
        {slate.leaderboardEntries.length > 0 ? (
          <div className="leaderboard-table">
            <div className="leaderboard-header v1-leaderboard-header">
              <span>Rank</span>
              <span>User</span>
              <span>Score</span>
              <span>Correct</span>
              <span>Hardest correct</span>
              <span>Tie</span>
            </div>
            {slate.leaderboardEntries.map((entry) => (
              <article
                className={
                  entry.userId === session?.user?.id
                    ? "leaderboard-row v1-leaderboard-row is-current-user"
                    : "leaderboard-row v1-leaderboard-row"
                }
                key={entry.id}
              >
                <strong>#{entry.rank}</strong>
                <span>{getDisplayName(entry.user)}</span>
                <strong>{entry.finalScore.toLocaleString()}</strong>
                <span>{entry.correctCount.toLocaleString()}</span>
                <span>
                  {entry.hardestCorrectProbability === null
                    ? "-"
                    : `${entry.hardestCorrectProbability}%`}
                </span>
                <span>{entry.isSharedRank ? "Shared" : "-"}</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state pick-empty-state">
            <p>
              No valid 10-pick entries have been scored yet. Select 10 picks,
              then settle at least one market from the admin queue.
            </p>
            <Link className="button-link" href="/">
              Open slate
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function getDisplayName(user: {
  username: string;
  wcaIdentity: { name: string; wcaId: string | null } | null;
}) {
  return user.wcaIdentity?.name ?? user.username;
}
