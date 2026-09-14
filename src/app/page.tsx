import Link from "next/link";

import { auth } from "@/auth";
import { getMarketPrices } from "@/lib/market-pricing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const [featuredCompetition, markets, leaders] = await Promise.all([
    prisma.competition.findFirst({
      where: { status: { in: ["ACTIVE", "UPCOMING"] } },
      orderBy: { startDate: "asc" },
      include: { _count: { select: { markets: true } } }
    }),
    prisma.market.findMany({
      where: { status: "OPEN" },
      orderBy: { closeTime: "asc" },
      take: 4,
      include: { competition: true }
    }),
    prisma.user.findMany({
      orderBy: { balance: "desc" },
      take: 5,
      select: { username: true, balance: true }
    })
  ]);

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <p className="eyebrow">Virtual speedcubing predictions</p>
          <h1>CubeCast</h1>
          <p>
            Browse WCA-style competition markets, spend free CubeCoins on YES or
            NO predictions, and climb the leaderboard after results resolve.
          </p>
        </div>
        <div className="balance-panel">
          <span>Current balance</span>
          <strong>
            {session?.user
              ? `${session.user.balance.toLocaleString()} CubeCoins`
              : "Sign in to start"}
          </strong>
          {!session?.user && (
            <Link className="button-link" href="/sign-in">
              Sign in
            </Link>
          )}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <h2>Featured competition</h2>
          <Link href="/competitions">View all</Link>
        </div>
        {featuredCompetition ? (
          <article className="feature-row">
            <div>
              <h3>{featuredCompetition.name}</h3>
              <p>{featuredCompetition.location}</p>
            </div>
            <div>
              <span>{featuredCompetition.status}</span>
              <strong>{featuredCompetition._count.markets} markets</strong>
            </div>
          </article>
        ) : (
          <p className="empty-state">Seed the database to view competitions.</p>
        )}
      </section>

      <section>
        <div className="section-heading">
          <h2>Featured markets</h2>
        </div>
        <div className="market-grid">
          {markets.map((market) => (
            <article className="market-card" key={market.id}>
              <span>{market.competition.name}</span>
              <h3>
                <Link href={`/markets/${market.slug}`}>{market.question}</Link>
              </h3>
              <div className="price-row">
                <strong>
                  YES{" "}
                  {
                    getMarketPrices({
                      yesSharesOutstanding: market.yesSharesOutstanding,
                      noSharesOutstanding: market.noSharesOutstanding
                    }).yesPrice
                  }
                </strong>
                <strong>
                  NO{" "}
                  {
                    getMarketPrices({
                      yesSharesOutstanding: market.yesSharesOutstanding,
                      noSharesOutstanding: market.noSharesOutstanding
                    }).noPrice
                  }
                </strong>
              </div>
              <small>Closes {market.closeTime.toLocaleDateString()}</small>
              <Link className="text-link" href={`/markets/${market.slug}`}>
                View market
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <h2>Leaderboard preview</h2>
          <Link href="/leaderboard">Open leaderboard</Link>
        </div>
        <ol className="leader-list">
          {leaders.map((leader) => (
            <li key={leader.username}>
              <span>{leader.username}</span>
              <strong>{leader.balance.toLocaleString()}</strong>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
