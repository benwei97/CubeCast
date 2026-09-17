import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketCategory, MarketStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { visibleMarkets } from "@/lib/market-visibility";
import { asMetadata } from "@/lib/wca-result-snapshot";
import { WCAEventLabel } from "@/components/wca-event-label";
import { V1ContestBoard } from "@/components/v1-slate-board";

export const dynamic = "force-dynamic";

export default async function CompetitionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; status?: string; contest?: string }>;
}) {
  const { slug } = await params;
  const { category, status, contest: requestedContest } = await searchParams;
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

  const openMarkets = competition.markets.filter(
    (market) => market.status === "OPEN"
  );
  const resolvedMarkets = competition.markets.filter(
    (market) => market.status === "RESOLVED" || market.status === "CANCELED"
  );
  const totalPicks = competition.markets.reduce(
    (total, market) => total + market._count.predictions,
    0
  );
  const activeStatus = isMarketStatus(status) ? status : "ALL";
  const activeCategory = isMarketCategory(category) ? category : "ALL";
  const filteredMarkets = competition.markets.filter((market) => {
    const statusMatches =
      activeStatus === "ALL" ? true : market.status === activeStatus;
    const categoryMatches =
      activeCategory === "ALL" ? true : market.category === activeCategory;

    return statusMatches && categoryMatches;
  });

  return (
    <div className="page-stack">
      <section className="competition-hero">
        <div>
          <Link className="text-link" href="/competitions">
            Back to competitions
          </Link>
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
        <aside className="competition-summary">
          <div>
            <span>Markets</span>
            <strong>{competition.markets.length.toLocaleString()}</strong>
          </div>
          <div>
            <span>Open</span>
            <strong>{openMarkets.length.toLocaleString()}</strong>
          </div>
          <div>
            <span>Final</span>
            <strong>{resolvedMarkets.length.toLocaleString()}</strong>
          </div>
          <div>
            <span>Picks</span>
            <strong>{totalPicks.toLocaleString()}</strong>
          </div>
        </aside>
      </section>

      <section>
        <div className="section-heading">
          <h2>Markets</h2>
          <span>
            {filteredMarkets.length.toLocaleString()} of{" "}
            {competition.markets.length.toLocaleString()}
          </span>
        </div>
        <div className="filter-bar">
          <div>
            <span>Status</span>
            {["ALL", ...Object.values(MarketStatus)].map((option) => (
              <Link
                className={activeStatus === option ? "is-active" : undefined}
                href={getCompetitionFilterHref({
                  category: activeCategory,
                  slug: competition.slug,
                  contest: contest.id,
                  status: option
                })}
                key={option}
              >
                {formatFilterLabel(option)}
              </Link>
            ))}
          </div>
          <div>
            <span>Category</span>
            {["ALL", ...Object.values(MarketCategory)].map((option) => (
              <Link
                className={activeCategory === option ? "is-active" : undefined}
                href={getCompetitionFilterHref({
                  category: option,
                  slug: competition.slug,
                  contest: contest.id,
                  status: activeStatus
                })}
                key={option}
              >
                {formatFilterLabel(option)}
              </Link>
            ))}
          </div>
        </div>
        {!preview && <><p>{picks.length} / {contest.maxPicks} Picks</p><V1ContestBoard isLocked={contest.status !== "OPEN" || new Date() >= contest.lockAt} isSignedIn={Boolean(session?.user)} pickCount={picks.length} pickLimit={contest.maxPicks} slateId={contest.id}
          selectedPicks={picks.map((pick) => ({ marketId: pick.marketId, marketOptionId: pick.selectedMarketOptionId, predictionId: pick.id }))}
          markets={filteredMarkets.map((market) => ({ id: market.id, slug: market.slug, category: market.category.replaceAll("_", " "), competitionName: competition.name, eventName: market.eventName ?? "Event", eventId: market.eventId, question: market.question, status: market.status, lockLabel: contest.lockAt.toLocaleString(), options: market.options }))} /></>}
        {preview && <div className="market-board">
          <div className="market-board-header">
            <span>Market</span>
            <span>Outcomes</span>
            <span>Picks</span>
            <span>Status</span>
          </div>
          {filteredMarkets.map((market) => (
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
          {filteredMarkets.length === 0 && (
            <div className="market-board-empty">
              No markets match these filters.
            </div>
          )}
        </div>}
      </section>
    </div>
  );
}

function isMarketStatus(status?: string): status is MarketStatus {
  return Object.values(MarketStatus).includes(status as MarketStatus);
}

function isMarketCategory(category?: string): category is MarketCategory {
  return Object.values(MarketCategory).includes(category as MarketCategory);
}

function getCompetitionFilterHref({
  category,
  slug,
  status,
  contest
}: {
  category: string;
  slug: string;
  status: string;
  contest: string;
}) {
  const params = new URLSearchParams();
  params.set("contest", contest);

  if (status !== "ALL") {
    params.set("status", status);
  }

  if (category !== "ALL") {
    params.set("category", category);
  }

  const query = params.toString();

  return query ? `/competitions/${slug}?${query}` : `/competitions/${slug}`;
}

function formatFilterLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
