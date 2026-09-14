import Link from "next/link";
import { MarketCategory, CompetitionStatus, UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { getMarketPrices } from "@/lib/market-pricing";
import { prisma } from "@/lib/prisma";
import { createCompetition, createMarket } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ competition?: string; market?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return (
      <div className="auth-page">
        <section className="auth-panel">
          <p className="eyebrow">Admin</p>
          <h1>Sign in</h1>
          <p>Admin access is required to create competitions and markets.</p>
          <Link className="button-link" href="/sign-in">
            Sign in
          </Link>
        </section>
      </div>
    );
  }

  const [competitions, markets] = await Promise.all([
    prisma.competition.findMany({
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        startDate: true
      }
    }),
    prisma.market.findMany({
      orderBy: [{ status: "asc" }, { closeTime: "asc" }],
      take: 12,
      include: {
        competition: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    })
  ]);

  return (
    <div className="page-stack">
      <section>
        <p className="eyebrow">Admin console</p>
        <h1>Market Operations</h1>
        <p>
          Create competitions and markets for the virtual CubeCoin prediction
          marketplace.
        </p>
      </section>

      <section className="detail-grid">
        <article className="admin-form-panel">
          <h2>Create Competition</h2>
          {params.competition === "invalid" && (
            <p className="form-error">Check the competition fields and dates.</p>
          )}
          <form action={createCompetition} className="admin-form">
            <label htmlFor="competition-name">Name</label>
            <input id="competition-name" name="name" required />

            <label htmlFor="competition-description">Description</label>
            <textarea id="competition-description" name="description" required />

            <div className="form-grid">
              <div>
                <label htmlFor="location">Location</label>
                <input id="location" name="location" required />
              </div>
              <div>
                <label htmlFor="country">Country</label>
                <input
                  id="country"
                  maxLength={2}
                  name="country"
                  placeholder="US"
                  required
                />
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label htmlFor="startDate">Start date</label>
                <input id="startDate" name="startDate" required type="date" />
              </div>
              <div>
                <label htmlFor="endDate">End date</label>
                <input id="endDate" name="endDate" required type="date" />
              </div>
            </div>

            <label htmlFor="competition-status">Status</label>
            <select id="competition-status" name="status" defaultValue="UPCOMING">
              {Object.values(CompetitionStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <label htmlFor="officialUrl">Official URL</label>
            <input id="officialUrl" name="officialUrl" type="url" />

            <button type="submit">Create competition</button>
          </form>
        </article>

        <article className="admin-form-panel">
          <h2>Create Market</h2>
          {params.market === "invalid" && (
            <p className="form-error">Check the market fields.</p>
          )}
          {params.market === "missing-competition" && (
            <p className="form-error">Choose a valid competition.</p>
          )}
          <form action={createMarket} className="admin-form">
            <label htmlFor="competitionId">Competition</label>
            <select id="competitionId" name="competitionId" required>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>

            <label htmlFor="question">Question</label>
            <input
              id="question"
              name="question"
              placeholder="Will Competitor A win 3x3?"
              required
            />

            <label htmlFor="market-description">Description</label>
            <textarea id="market-description" name="description" required />

            <div className="form-grid">
              <div>
                <label htmlFor="category">Category</label>
                <select id="category" name="category" defaultValue="WINNER">
                  {Object.values(MarketCategory).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="closeTime">Close time</label>
                <input
                  id="closeTime"
                  name="closeTime"
                  required
                  type="datetime-local"
                />
              </div>
            </div>

            <label htmlFor="resolutionRules">Resolution rules</label>
            <textarea
              id="resolutionRules"
              name="resolutionRules"
              defaultValue="Resolves from official WCA-style final results. The market cancels if no official result is published."
              required
            />

            <label htmlFor="resolutionSource">Resolution source</label>
            <input
              id="resolutionSource"
              name="resolutionSource"
              defaultValue="Official WCA competition results"
              required
            />

            <label htmlFor="liquidityParameter">Liquidity parameter</label>
            <input
              id="liquidityParameter"
              name="liquidityParameter"
              defaultValue="1000"
              min="100"
              type="number"
            />

            <button type="submit">Create market</button>
          </form>
        </article>
      </section>

      <section>
        <div className="section-heading">
          <h2>Market Review</h2>
          <Link href="/competitions">Open competitions</Link>
        </div>
        <div className="market-board">
          <div className="market-board-header">
            <span>Market</span>
            <span>Yes</span>
            <span>No</span>
            <span>Volume</span>
            <span>Status</span>
          </div>
          {markets.map((market) => {
            const prices = getMarketPrices(market);

            return (
              <Link
                className="market-board-row"
                href={`/markets/${market.slug}`}
                key={market.id}
              >
                <div>
                  <strong>{market.question}</strong>
                  <span>{market.competition.name}</span>
                </div>
                <strong className="yes-text">{prices.yesPrice}</strong>
                <strong className="no-text">{prices.noPrice}</strong>
                <span>{prices.totalShares.toLocaleString()}</span>
                <span>{market.status}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
