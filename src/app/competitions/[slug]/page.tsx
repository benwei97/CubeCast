import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { visibleMarkets } from "@/lib/market-visibility";
import { asMetadata } from "@/lib/wca-result-snapshot";
import { WCAEventLabel } from "@/components/wca-event-label";
import { V1ContestBoard } from "@/components/v1-slate-board";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

export default async function CompetitionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ contest?: string }>;
}) {
  const { slug } = await params;
  const { contest: requestedContest } = await searchParams;
  const session = await auth();
  const visibility = visibleMarkets(session?.user?.role === "ADMIN");
  const competition = await prisma.competition.findFirst({
    where: { slug, markets: { some: visibility } },
    include: {
      markets: {
        where: visibility,
        orderBy: [{ status: "asc" }, { closeTime: "asc" }, { question: "asc" }],
        include: {
          slate: true,
          options: {
            orderBy: { displayOrder: "asc" },
            select: {
              id: true,
              sideKey: true,
              competitorWcaId: true,
              label: true,
              probability: true
            }
          },
          _count: {
            select: {
              predictions: true
            }
          }
        }
      }
    }
  });

  if (!competition) {
    notFound();
  }
  const availableContests = [...new Map(competition.markets.filter((market) => market.slate).map((market) => [market.slateId, market.slate!])).values()].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const contest = availableContests.find((item) => item.id === (requestedContest ?? availableContests[0]?.id));
  if (!contest) notFound();
  competition.markets = competition.markets.filter((market) => market.slateId === contest.id);
  const metadata = asMetadata(competition.sourceMetadata);
  const preview = contest.status === "DRAFT";
  const entry = session?.user?.id ? await prisma.contestEntry.findUnique({ where: { userId_slateId: { userId: session.user.id, slateId: contest.id } }, include: { predictions: true } }) : null;
  const picks = entry?.predictions ?? [];

  return (
    <div className="page-stack">
      <section className="competition-hero competition-detail-header">
        <div>
          <BackLink />
          <p className="eyebrow">{competition.status}</p>
          <h1>{competition.name}</h1>
          <p>{contest.title}</p>
          {preview && <p className="admin-status admin-status-draft">Draft · Admin preview · Not public</p>}
          <p>Accepted competitors: {typeof metadata.acceptedCompetitorCount === "number" ? metadata.acceptedCompetitorCount : "Not available"} · Competitor limit: {typeof metadata.competitorLimit === "number" ? metadata.competitorLimit : "Not available"}</p>
          <p>Picks lock {contest.lockAt.toLocaleString()}</p>
          {competition.officialUrl && <a className="text-link" href={competition.officialUrl} target="_blank" rel="noreferrer">Official WCA competition</a>}
          {availableContests.length > 1 && <nav className="contest-detail-navigation" aria-label="Competition contests">{availableContests.map((item) => <Link key={item.id} className="text-link" href={`/competitions/${competition.slug}?contest=${item.id}`}>{item.title}{item.status === "DRAFT" ? " (Draft)" : ""}</Link>)}</nav>}
          <div className="date-row">
            <span>
              {competition.location}, {competition.country}
            </span>
            <span>Starts {competition.startDate.toLocaleDateString()}</span>
            <span>Ends {competition.endDate.toLocaleDateString()}</span>
          </div>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <h2>Markets</h2>
          <span>
            {competition.markets.length.toLocaleString()} markets
          </span>
        </div>
        {!preview && <><p>{picks.length} / {contest.maxPicks} Picks</p><V1ContestBoard isLocked={contest.status !== "OPEN" || new Date() >= contest.lockAt} isSignedIn={Boolean(session?.user)} pickCount={picks.length} pickLimit={contest.maxPicks} slateId={contest.id}
          selectedPicks={picks.map((pick) => ({ marketId: pick.marketId, marketOptionId: pick.selectedMarketOptionId, predictionId: pick.id }))}
          markets={competition.markets.map((market) => ({ id: market.id, slug: market.slug, category: market.category.replaceAll("_", " "), competitionName: competition.name, eventName: market.eventName ?? "Event", eventId: market.eventId, question: market.question, status: market.status, lockLabel: contest.lockAt.toLocaleString(), options: market.options }))} /></>}
        {preview && <div className="market-board">
          <div className="market-board-header">
            <span>Market</span>
            <span>Outcomes</span>
            <span>Picks</span>
            <span>Status</span>
          </div>
          {competition.markets.map((market) => (
            <div className="market-board-row" key={market.id}>
              <div>
                <Link prefetch={false} className="market-detail-link" href={`/markets/${market.slug}`}><WCAEventLabel eventId={market.eventId} fallback={market.eventName} /><strong>{market.question}</strong></Link>
                <span>{market.category}</span>
              </div>
              <strong>
                {market.options
                  .map((option) => `${option.label} ${option.probability}%`)
                  .join(" / ")}
              </strong>
              <span>{market._count.predictions.toLocaleString()}</span>
              <span>{market.status}</span>
            </div>
          ))}
          {competition.markets.length === 0 && (
            <div className="market-board-empty">
              No markets are available.
            </div>
          )}
        </div>}
      </section>
    </div>
  );
}
