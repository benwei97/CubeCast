import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketCategory, MarketStatus } from "@prisma/client";

import { getMarketPrices } from "@/lib/market-pricing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CompetitionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const { slug } = await params;
  const { category, status } = await searchParams;
  const competition = await prisma.competition.findUnique({
    where: { slug },
    include: {
      markets: {
        orderBy: [{ status: "asc" }, { closeTime: "asc" }, { question: "asc" }],
        include: {
          _count: {
            select: {
              purchases: true,
              positions: true
            }
          }
        }
      }
    }
  });

  if (!competition) {
    notFound();
  }

  const openMarkets = competition.markets.filter(
    (market) => market.status === "OPEN"
  );
  const resolvedMarkets = competition.markets.filter(
    (market) => market.status === "RESOLVED" || market.status === "CANCELED"
  );
  const totalVolume = competition.markets.reduce(
    (total, market) =>
      total + market.yesSharesOutstanding + market.noSharesOutstanding,
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
          <p>{competition.description}</p>
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
            <span>Volume</span>
            <strong>{totalVolume.toLocaleString()}</strong>
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
                  status: activeStatus
                })}
                key={option}
              >
                {formatFilterLabel(option)}
              </Link>
            ))}
          </div>
        </div>
        <div className="market-board">
          <div className="market-board-header">
            <span>Market</span>
            <span>Yes</span>
            <span>No</span>
            <span>Volume</span>
            <span>Status</span>
          </div>
          {filteredMarkets.map((market) => {
            const prices = getMarketPrices(market);

            return (
              <Link
                className="market-board-row"
                href={`/markets/${market.slug}`}
                key={market.id}
              >
                <div>
                  <strong>{market.question}</strong>
                  <span>{market.category}</span>
                </div>
                <strong className="yes-text">{prices.yesPrice}</strong>
                <strong className="no-text">{prices.noPrice}</strong>
                <span>{prices.totalShares.toLocaleString()}</span>
                <span>{market.status}</span>
              </Link>
            );
          })}
          {filteredMarkets.length === 0 && (
            <div className="market-board-empty">
              No markets match these filters.
            </div>
          )}
        </div>
      </section>

      <section className="detail-grid">
        <article className="info-panel">
          <h2>Open Markets</h2>
          {openMarkets.length > 0 ? (
            <div className="compact-list">
              {openMarkets.slice(0, 5).map((market) => (
                <Link href={`/markets/${market.slug}`} key={market.id}>
                  {market.question}
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-state">No open markets for this competition.</p>
          )}
        </article>
        <article className="info-panel">
          <h2>Final Markets</h2>
          {resolvedMarkets.length > 0 ? (
            <div className="compact-list">
              {resolvedMarkets.slice(0, 5).map((market) => (
                <Link href={`/markets/${market.slug}`} key={market.id}>
                  {market.question}
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-state">No resolved or canceled markets yet.</p>
          )}
        </article>
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
  status
}: {
  category: string;
  slug: string;
  status: string;
}) {
  const params = new URLSearchParams();

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
