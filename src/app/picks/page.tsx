import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { maintainContestLockState } from "@/lib/contest-maintenance";
import { prisma } from "@/lib/prisma";
import { getPickCounterLabel } from "@/lib/v1-game";
import { removePrediction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PicksPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  await maintainContestLockState();

  const activeSlate = await prisma.contestSlate.findFirst({
    where: { status: { in: ["OPEN", "LOCKED", "SETTLING", "FINALIZED"] } },
    orderBy: { lockAt: "asc" },
    include: {
      entries: {
        where: { userId: session.user.id },
        include: {
          leaderboardEntry: true,
          predictions: {
            include: {
              market: {
                include: {
                  competition: true
                }
              },
              selectedMarketOption: true
            },
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });

  if (!activeSlate) {
    return (
      <div className="page-stack">
        <section className="slate-hero">
          <div>
            <h1>My Picks</h1>
            <p>No open contest is available right now.</p>
          </div>
        </section>
      </div>
    );
  }

  const entry = activeSlate.entries[0] ?? null;
  const predictions = entry?.predictions ?? [];
  const isLocked = new Date() >= activeSlate.lockAt || activeSlate.status !== "OPEN";
  const runningScore =
    entry?.finalScore ??
    activeSlate.baseScore +
      predictions.reduce(
        (total, prediction) => total + (prediction.scoreChange ?? 0),
        0
      );
  const pickCounterLabel = getPickCounterLabel({
    locked: isLocked,
    pickCount: predictions.length,
    requiredPicks: activeSlate.maxPicks
  });

  return (
    <div className="page-stack">
      <section className="slate-hero compact-slate-hero">
        <div>
          <h1>My Picks</h1>
          <p>
            Review your selected markets before lock. Your entry becomes
            official only if exactly 10 picks are selected when the contest locks.
          </p>
        </div>
        <aside className="pick-status-panel">
          <span>{activeSlate.title}</span>
          <strong>{pickCounterLabel}</strong>
          <p>Locks {formatDateTime(activeSlate.lockAt)}</p>
          <p>
            Score {runningScore.toLocaleString()}
            {entry?.leaderboardEntry
              ? ` · Rank #${entry.leaderboardEntry.rank}`
              : ""}
          </p>
          <Link className="button-link secondary-button" href="/">
            Back to markets
          </Link>
        </aside>
      </section>

      {predictions.length > 0 ? (
        <section className="my-picks-list">
          {predictions.map((prediction, index) => (
            <article className="my-pick-row" key={prediction.id}>
              <div className="pick-rank">{index + 1}</div>
              <div className="my-pick-main">
                <span>
                  {prediction.market.competition.name} ·{" "}
                  {prediction.market.eventName ?? prediction.market.eventId ?? "Event"}
                </span>
                <strong>{prediction.market.question}</strong>
                <small>
                  Selected {prediction.selectedMarketOption.label} ·{" "}
                  {prediction.selectedProbability}% ·{" "}
                  {formatScoreSwing(prediction.selectedProbability)}
                </small>
              </div>
              <div className="my-pick-status">
                <span>{prediction.resultStatus}</span>
                <strong>
                  {prediction.scoreChange === null
                    ? "Pending"
                    : formatSignedNumber(prediction.scoreChange)}
                </strong>
              </div>
              {!isLocked && (
                <form action={removePrediction}>
                  <input
                    name="predictionId"
                    type="hidden"
                    value={prediction.id}
                  />
                  <PendingSubmitButton
                    className="secondary-button"
                    pendingLabel="Removing..."
                  >
                    Remove
                  </PendingSubmitButton>
                </form>
              )}
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state pick-empty-state">
          <p>You have not selected any picks for this contest yet.</p>
          <Link className="button-link" href="/">
            Browse markets
          </Link>
        </section>
      )}
    </div>
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(date);
}

function formatScoreSwing(probability: number) {
  return `+${100 - probability} / -${probability}`;
}

function formatSignedNumber(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
