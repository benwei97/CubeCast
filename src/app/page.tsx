import Link from "next/link";

import { auth } from "@/auth";
import { V1ContestBoard } from "@/components/v1-slate-board";
import { prisma } from "@/lib/prisma";
import { getPickCounterLabel } from "@/lib/v1-game";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const now = new Date();

  const activeSlate = await prisma.contestSlate.findFirst({
    where: { status: { in: ["OPEN", "LOCKED", "SETTLING", "FINALIZED"] } },
    orderBy: { lockAt: "asc" },
    include: {
      competitions: {
        include: { competition: true },
        orderBy: { createdAt: "asc" }
      },
      entries: {
        where: { userId: session?.user?.id ?? "__signed_out__" },
        include: {
          predictions: {
            include: {
              selectedMarketOption: true
            }
          }
        }
      },
      markets: {
        where: {
          status: {
            in: ["OPEN", "LOCKED", "PENDING_RESULT", "RESOLVED", "VOID"]
          }
        },
        include: {
          competition: true,
          options: {
            orderBy: { displayOrder: "asc" }
          }
        },
        orderBy: [{ competition: { startDate: "asc" } }, { createdAt: "asc" }]
      }
    }
  });

  if (!activeSlate) {
    return (
      <div className="page-stack">
        <section className="slate-hero">
          <div>
            <h1>CubeCast</h1>
            <p>
              No open contest is published yet. Publish a contest from admin
              tools to start collecting picks.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const entry = activeSlate.entries[0] ?? null;
  const predictions = entry?.predictions ?? [];
  const pickCount = predictions.length;
  const isLocked = now >= activeSlate.lockAt || activeSlate.status !== "OPEN";
  const pickCounterLabel = getPickCounterLabel({
    locked: isLocked,
    pickCount,
    requiredPicks: activeSlate.maxPicks
  });

  const markets = activeSlate.markets.map((market) => ({
    category: market.category.replaceAll("_", " "),
    competitionName: market.competition.name,
    eventName: market.eventName ?? market.eventId ?? "Event",
    id: market.id,
    lockLabel: formatDateTime(activeSlate.lockAt),
    options: market.options.map((option) => ({
      id: option.id,
      label: option.label,
      probability: option.probability,
      sideKey: option.sideKey
    })),
    question: market.question,
    status: market.status
  }));

  const selectedPicks = predictions.map((prediction) => ({
    marketId: prediction.marketId,
    marketOptionId: prediction.selectedMarketOptionId,
    predictionId: prediction.id
  }));

  return (
    <div className="page-stack">
      <section className="slate-hero">
        <div className="slate-hero-main">
          <h1>{activeSlate.title}</h1>
          <p>{activeSlate.description}</p>
          <div className="slate-meta-row">
            <span>{activeSlate.markets.length} markets</span>
            <span>{activeSlate.competitions.length} competitions</span>
            <span>Locks {formatDateTime(activeSlate.lockAt)}</span>
          </div>
        </div>

        <aside className="pick-status-panel">
          <span>Contest entry</span>
          <strong>{pickCounterLabel}</strong>
          <p>
            {isLocked
              ? "The contest is locked. Picks are now read-only."
              : "Choose exactly 10 picks before lock for an official entry."}
          </p>
          <Link className="button-link secondary-button" href="/picks">
            Review picks
          </Link>
        </aside>
      </section>

      <section className="competition-strip" aria-label="Contest competitions">
        {activeSlate.competitions.map(({ competition }) => (
          <article key={competition.id}>
            <span>{competition.location}</span>
            <strong>{competition.name}</strong>
            <small>
              {formatDate(competition.startDate)} - {formatDate(competition.endDate)}
            </small>
          </article>
        ))}
      </section>

      <section>
        <div className="section-heading">
          <h2>Markets</h2>
          <Link href="/picks">My Picks</Link>
        </div>

        <V1ContestBoard
          isLocked={isLocked}
          isSignedIn={Boolean(session?.user?.id)}
          markets={markets}
          pickCount={pickCount}
          pickLimit={activeSlate.maxPicks}
          selectedPicks={selectedPicks}
          slateId={activeSlate.id}
        />
      </section>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short"
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(date);
}
