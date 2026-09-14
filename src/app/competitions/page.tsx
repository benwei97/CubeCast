import Link from "next/link";

import { getMarketPrices } from "@/lib/market-pricing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CompetitionsPage() {
  const competitions = await prisma.competition.findMany({
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
    include: {
      markets: {
        orderBy: { closeTime: "asc" },
        select: {
          id: true,
          slug: true,
          question: true,
          status: true,
          closeTime: true,
          yesSharesOutstanding: true,
          noSharesOutstanding: true
        }
      }
    }
  });

  return (
    <div className="page-stack">
      <section>
        <p className="eyebrow">Competition markets</p>
        <h1>Competitions</h1>
        <p>
          Browse seeded speedcubing competitions and open each YES/NO market.
        </p>
      </section>

      <section className="competition-list">
        {competitions.map((competition) => (
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
              {competition.markets.map((market) => {
                const prices = getMarketPrices(market);

                return (
                  <Link
                    className="market-list-row"
                    href={`/markets/${market.slug}`}
                    key={market.id}
                  >
                    <span>{market.question}</span>
                    <strong>
                      YES {prices.yesPrice} / NO {prices.noPrice}
                    </strong>
                    <small>{market.status}</small>
                  </Link>
                );
              })}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
