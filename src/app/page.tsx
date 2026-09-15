import Link from "next/link";

import { auth } from "@/auth";
import { QuickMarketBoard } from "@/components/quick-market-board";
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

  const quickMarkets = markets.map((market) => {
    const prices = getMarketPrices(market);

    return {
      closeLabel: market.closeTime.toLocaleDateString(),
      competitionName: market.competition.name,
      noPrice: prices.noPrice,
      question: market.question,
      slug: market.slug,
      totalShares: prices.totalShares,
      yesPrice: prices.yesPrice
    };
  });

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
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
          <h2>Markets</h2>
          <Link href="/competitions">Open market catalog</Link>
        </div>
        {quickMarkets.length > 0 ? (
          <QuickMarketBoard
            balance={session?.user?.balance ?? 0}
            isSignedIn={Boolean(session?.user)}
            markets={quickMarkets}
          />
        ) : (
          <p className="empty-state">Seed the database to view markets.</p>
        )}
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
