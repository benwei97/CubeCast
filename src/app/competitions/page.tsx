import Link from "next/link";
import { CompetitionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { visibleMarkets } from "@/lib/market-visibility";

export const dynamic = "force-dynamic";

export default async function CompetitionsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const session = await auth();
  const visibility = visibleMarkets(session?.user?.role === "ADMIN");
  const competitions = await prisma.competition.findMany({
    where: { markets: { some: visibility } },
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
    include: {
      markets: {
        where: visibility,
        orderBy: { closeTime: "asc" },
        select: {
          id: true,
          slug: true,
          question: true,
          status: true,
          options: {
            orderBy: { displayOrder: "asc" },
            select: {
              label: true,
              probability: true
            }
          }
        }
      }
    }
  });
  const activeStatus = isCompetitionStatus(status) ? status : "ALL";
  const filteredCompetitions = competitions.filter((competition) =>
    activeStatus === "ALL" ? true : competition.status === activeStatus
  );

  return (
    <div className="page-stack">
      <section>
        <p className="eyebrow">Competition markets</p>
        <h1>Competitions</h1>
        <p>
          Browse WCA competitions attached to CubeCast contests and review fixed
          probability markets.
        </p>
      </section>

      <section>
        <div className="section-heading">
          <h2>All Competitions</h2>
          <span>
            {filteredCompetitions.length.toLocaleString()} of{" "}
            {competitions.length.toLocaleString()}
          </span>
        </div>
        <div className="filter-bar">
          <div>
            <span>Status</span>
            {["ALL", ...Object.values(CompetitionStatus)].map((option) => (
              <Link
                className={activeStatus === option ? "is-active" : undefined}
                href={getCompetitionStatusHref(option)}
                key={option}
              >
                {formatFilterLabel(option)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="competition-list">
        {filteredCompetitions.map((competition) => (
          <article className="competition-card" key={competition.id}>
            <div className="competition-card-header">
              <div>
                <p className="eyebrow">{competition.status}</p>
                <h2>{competition.name}</h2>
                <p>
                  {competition.location}, {competition.country}
                </p>
                <Link className="text-link" href={`/competitions/${competition.slug}`}>
                  Open competition
                </Link>
              </div>
              <div className="stat-pill">
                <strong>{competition.markets.length}</strong>
                <span>markets</span>
              </div>
            </div>
            <p>{competition.description}</p>
            <div className="date-row">
              <span>Starts {competition.startDate.toLocaleDateString()}</span>
              <span>Ends {competition.endDate.toLocaleDateString()}</span>
            </div>
            <div className="market-list">
              {competition.markets.map((market) => (
                <div className="market-list-row" key={market.id}>
                  <Link prefetch={false} className="text-link" href={`/markets/${market.slug}`}>{market.question}</Link>
                  <strong>
                    {market.options
                      .map((option) => `${option.label} ${option.probability}%`)
                      .join(" / ")}
                  </strong>
                  <small>{market.status}</small>
                </div>
              ))}
            </div>
          </article>
        ))}
        {filteredCompetitions.length === 0 && (
          <p className="empty-state">No competitions match this filter.</p>
        )}
      </section>
    </div>
  );
}

function isCompetitionStatus(status?: string): status is CompetitionStatus {
  return Object.values(CompetitionStatus).includes(status as CompetitionStatus);
}

function getCompetitionStatusHref(status: string) {
  if (status === "ALL") {
    return "/competitions";
  }

  return `/competitions?status=${status}`;
}

function formatFilterLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
