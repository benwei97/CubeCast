import Link from "next/link";
import {
  MarketCategory,
  CompetitionStatus,
  MarketStatus,
  UserRole
} from "@prisma/client";

import { auth } from "@/auth";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { formatMarketCents } from "@/lib/market-format";
import { getMarketPrices } from "@/lib/market-pricing";
import { prisma } from "@/lib/prisma";
import {
  attachCompetitionToSlate,
  createCompetition,
  createMarket,
  createV1Slate,
  createV1SlateMarket,
  importWCACompetition,
  publishV1Market,
  refreshWCACompetitionResults,
  settleV1Market,
  settleV1MarketAsTie,
  updateSlateDiversityConfig,
  voidV1MarketAction
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{
    competition?: string;
    market?: string;
    v1Market?: string;
    v1Settlement?: string;
    v1Slate?: string;
    wca?: string;
  }>;
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

  const [
    competitions,
    marketsNeedingResolution,
    markets,
    activeSlate,
    manageableSlate,
    slates
  ] =
    await Promise.all([
    prisma.competition.findMany({
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        startDate: true,
        sourceMetadata: true,
        wcaCompetitionId: true
      }
    }),
    prisma.market.findMany({
      where: {
        OR: [
          {
            status: MarketStatus.CLOSED
          },
          {
            status: MarketStatus.OPEN,
            closeTime: {
              lte: new Date()
            }
          }
        ]
      },
      orderBy: [{ closeTime: "asc" }, { question: "asc" }],
      include: {
        competition: {
          select: {
            name: true,
            slug: true
          }
        },
        _count: {
          select: {
            positions: true,
            purchases: true
          }
        }
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
      }),
      prisma.contestSlate.findFirst({
        where: {
          status: { in: ["OPEN", "LOCKED", "SETTLING"] }
        },
        orderBy: { lockAt: "asc" },
        include: {
          markets: {
            where: {
              status: { in: ["OPEN", "LOCKED", "PENDING_RESULT"] }
            },
            include: {
              competition: {
                select: { name: true }
              },
              options: {
                orderBy: { displayOrder: "asc" }
              },
              _count: {
                select: { predictions: true }
              }
            },
            orderBy: [{ competition: { startDate: "asc" } }, { createdAt: "asc" }]
          }
        }
      }),
      prisma.contestSlate.findFirst({
        where: {
          status: { in: ["DRAFT", "OPEN"] }
        },
        orderBy: [{ status: "asc" }, { lockAt: "asc" }],
        include: {
          competitions: {
            include: {
              competition: true
            },
            orderBy: { createdAt: "asc" }
          },
          markets: {
            include: {
              competition: {
                select: { name: true }
              },
              options: {
                orderBy: { displayOrder: "asc" }
              }
            },
            orderBy: [{ status: "asc" }, { createdAt: "desc" }]
          }
        }
      }),
      prisma.contestSlate.findMany({
        orderBy: [{ lockAt: "desc" }],
        take: 8,
        include: {
          _count: {
            select: {
              competitions: true,
              markets: true
            }
          }
        }
      })
    ]);
  const attachedCompetitionIds = new Set(
    manageableSlate?.competitions.map((item) => item.competitionId) ?? []
  );
  const availableCompetitions = competitions.filter(
    (competition) => !attachedCompetitionIds.has(competition.id)
  );
  const diversityConfig = getDiversityConfig(manageableSlate?.diversityConfig);
  const wcaCompetitions = competitions.filter(
    (competition) => competition.wcaCompetitionId
  );

  return (
    <div className="page-stack">
      <section>
        <p className="eyebrow">Admin console</p>
        <h1>Market Operations</h1>
        <p>
          Manage V1 slate settlement while legacy market tools remain available
          during the migration.
        </p>
      </section>

      <section className="admin-form-panel">
        <div className="section-heading">
          <h2>WCA Data</h2>
          <span>{wcaCompetitions.length.toLocaleString()} linked competitions</span>
        </div>
        {params.wca?.startsWith("invalid") && (
          <p className="form-error">Check the WCA fields.</p>
        )}
        {params.wca === "missing-dates" && (
          <p className="form-error">
            WCA did not return usable start and end dates for that competition.
          </p>
        )}
        {params.wca === "missing-wca-id" && (
          <p className="form-error">
            Choose a competition that has a WCA competition ID.
          </p>
        )}
        <div className="admin-slate-grid">
          <form action={importWCACompetition} className="admin-form">
            <h3>Import Competition</h3>
            <label htmlFor="wcaCompetitionId">WCA competition ID</label>
            <input
              id="wcaCompetitionId"
              name="wcaCompetitionId"
              placeholder="WC2025"
              required
            />
            <PendingSubmitButton pendingLabel="Importing...">
              Import from WCA
            </PendingSubmitButton>
          </form>

          <form action={refreshWCACompetitionResults} className="admin-form">
            <h3>Refresh Results</h3>
            <label htmlFor="wca-results-competition">Competition</label>
            <select id="wca-results-competition" name="competitionId" required>
              {wcaCompetitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
            <PendingSubmitButton
              className="secondary-button"
              pendingLabel="Refreshing..."
            >
              Refresh result snapshot
            </PendingSubmitButton>
            <div className="admin-slate-list">
              {wcaCompetitions.slice(0, 4).map((competition) => (
                <article key={competition.id}>
                  <div>
                    <strong>{competition.name}</strong>
                    <span>{competition.wcaCompetitionId}</span>
                  </div>
                  <small>
                    {getWCAResultSummary(competition.sourceMetadata)}
                  </small>
                </article>
              ))}
            </div>
          </form>
        </div>
      </section>

      <section className="admin-form-panel">
        <div className="section-heading">
          <h2>V1 Slate Management</h2>
          <span>{slates.length.toLocaleString()} recent slates</span>
        </div>
        {params.v1Slate?.startsWith("invalid") && (
          <p className="form-error">Check the slate management fields.</p>
        )}
        <div className="admin-slate-grid">
          <form action={createV1Slate} className="admin-form">
            <h3>Create Slate</h3>
            <label htmlFor="v1-slate-title">Title</label>
            <input
              id="v1-slate-title"
              name="title"
              placeholder="Spring Championship Slate"
              required
            />
            <label htmlFor="v1-slate-description">Description</label>
            <textarea
              id="v1-slate-description"
              name="description"
              placeholder="Curated WCA prediction markets for the featured weekend."
              required
            />
            <div className="form-grid">
              <div>
                <label htmlFor="v1-slate-starts">Starts</label>
                <input
                  id="v1-slate-starts"
                  name="startsAt"
                  required
                  type="datetime-local"
                />
              </div>
              <div>
                <label htmlFor="v1-slate-ends">Ends</label>
                <input
                  id="v1-slate-ends"
                  name="endsAt"
                  required
                  type="datetime-local"
                />
              </div>
            </div>
            <label htmlFor="v1-slate-status">Status</label>
            <select id="v1-slate-status" name="status" defaultValue="DRAFT">
              <option value="DRAFT">DRAFT</option>
              <option value="OPEN">OPEN</option>
            </select>
            <PendingSubmitButton pendingLabel="Creating slate...">
              Create slate
            </PendingSubmitButton>
          </form>

          <div className="admin-slate-list">
            <h3>Recent Slates</h3>
            {slates.map((slate) => (
              <article key={slate.id}>
                <div>
                  <strong>{slate.title}</strong>
                  <span>
                    {slate.status} · {slate._count.competitions} competitions ·{" "}
                    {slate._count.markets} markets
                  </span>
                </div>
                <small>Locks {slate.lockAt.toLocaleString()}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      {manageableSlate && (
        <section className="admin-form-panel">
          <div className="section-heading">
            <h2>Build {manageableSlate.title}</h2>
            <span>
              {manageableSlate.status} · Locks{" "}
              {manageableSlate.lockAt.toLocaleString()}
            </span>
          </div>

          <div className="admin-slate-grid">
            <form action={attachCompetitionToSlate} className="admin-form">
              <h3>Attach Competition</h3>
              <input name="slateId" type="hidden" value={manageableSlate.id} />
              <label htmlFor="slate-competition-id">Competition</label>
              <select
                id="slate-competition-id"
                name="competitionId"
                required
              >
                {availableCompetitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name}
                  </option>
                ))}
              </select>
              <PendingSubmitButton
                pendingLabel="Attaching..."
                className="secondary-button"
              >
                Attach competition
              </PendingSubmitButton>
              <div className="attached-competition-list">
                {manageableSlate.competitions.map(({ competition }) => (
                  <span key={competition.id}>{competition.name}</span>
                ))}
              </div>
            </form>

            <form action={updateSlateDiversityConfig} className="admin-form">
              <h3>Diversity Caps</h3>
              <input name="slateId" type="hidden" value={manageableSlate.id} />
              <div className="form-grid">
                <div>
                  <label htmlFor="maxPerCompetition">Per competition</label>
                  <input
                    id="maxPerCompetition"
                    min="1"
                    name="maxPerCompetition"
                    type="number"
                    defaultValue={diversityConfig.maxPerCompetition}
                  />
                </div>
                <div>
                  <label htmlFor="maxPerCompetitor">Per competitor</label>
                  <input
                    id="maxPerCompetitor"
                    min="1"
                    name="maxPerCompetitor"
                    type="number"
                    defaultValue={diversityConfig.maxPerCompetitor}
                  />
                </div>
                <div>
                  <label htmlFor="maxPerEvent">Per event</label>
                  <input
                    id="maxPerEvent"
                    min="1"
                    name="maxPerEvent"
                    type="number"
                    defaultValue={diversityConfig.maxPerEvent}
                  />
                </div>
                <div>
                  <label htmlFor="maxPerMarketType">Per market type</label>
                  <input
                    id="maxPerMarketType"
                    min="1"
                    name="maxPerMarketType"
                    type="number"
                    defaultValue={diversityConfig.maxPerMarketType}
                  />
                </div>
              </div>
              <PendingSubmitButton
                className="secondary-button"
                pendingLabel="Saving caps..."
              >
                Save caps
              </PendingSubmitButton>
            </form>
          </div>
        </section>
      )}

      {manageableSlate && manageableSlate.competitions.length > 0 && (
        <section className="admin-form-panel">
          <h2>Create V1 Market</h2>
          {params.v1Market === "invalid" && (
            <p className="form-error">Check the V1 market fields.</p>
          )}
          {params.v1Market === "probability-total" && (
            <p className="form-error">The two probabilities must total 100.</p>
          )}
          <form action={createV1SlateMarket} className="admin-form">
            <input name="slateId" type="hidden" value={manageableSlate.id} />
            <div className="form-grid">
              <div>
                <label htmlFor="v1-market-competition">Competition</label>
                <select
                  id="v1-market-competition"
                  name="competitionId"
                  required
                >
                  {manageableSlate.competitions.map(({ competition }) => (
                    <option key={competition.id} value={competition.id}>
                      {competition.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="v1-market-category">Market type</label>
                <select
                  id="v1-market-category"
                  name="category"
                  defaultValue="HEAD_TO_HEAD"
                >
                  {Object.values(MarketCategory)
                    .filter((category) => category !== "TIME_THRESHOLD")
                    .map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <label htmlFor="v1-market-question">Question</label>
            <input
              id="v1-market-question"
              name="question"
              placeholder="Who places higher in 3x3?"
              required
            />
            <label htmlFor="v1-market-description">Description</label>
            <textarea
              id="v1-market-description"
              name="description"
              placeholder="Head-to-head result using official WCA placement."
              required
            />
            <div className="form-grid">
              <div>
                <label htmlFor="v1-event-id">Event ID</label>
                <input id="v1-event-id" name="eventId" placeholder="333" required />
              </div>
              <div>
                <label htmlFor="v1-event-name">Event name</label>
                <input
                  id="v1-event-name"
                  name="eventName"
                  placeholder="3x3"
                  required
                />
              </div>
            </div>
            <div className="outcome-admin-grid">
              <div>
                <h3>Option A</h3>
                <label htmlFor="option-a-label">Label</label>
                <input id="option-a-label" name="optionALabel" required />
                <label htmlFor="option-a-probability">Probability</label>
                <input
                  id="option-a-probability"
                  max="65"
                  min="35"
                  name="optionAProbability"
                  required
                  type="number"
                />
                <label htmlFor="option-a-wca">Competitor WCA ID</label>
                <input id="option-a-wca" name="optionACompetitorWcaId" />
              </div>
              <div>
                <h3>Option B</h3>
                <label htmlFor="option-b-label">Label</label>
                <input id="option-b-label" name="optionBLabel" required />
                <label htmlFor="option-b-probability">Probability</label>
                <input
                  id="option-b-probability"
                  max="65"
                  min="35"
                  name="optionBProbability"
                  required
                  type="number"
                />
                <label htmlFor="option-b-wca">Competitor WCA ID</label>
                <input id="option-b-wca" name="optionBCompetitorWcaId" />
              </div>
            </div>
            <label className="checkbox-row">
              <input name="publishNow" type="checkbox" />
              Publish immediately
            </label>
            <PendingSubmitButton pendingLabel="Creating V1 market...">
              Create V1 market
            </PendingSubmitButton>
          </form>
        </section>
      )}

      <section>
        <div className="section-heading">
          <h2>V1 Settlement Queue</h2>
          <span>
            {activeSlate
              ? `${activeSlate.markets.length.toLocaleString()} open markets`
              : "No active slate"}
          </span>
        </div>
        {params.v1Settlement === "invalid" && (
          <p className="form-error">Check the V1 settlement fields.</p>
        )}
        {activeSlate && activeSlate.markets.length > 0 ? (
          <div className="v1-settlement-list">
            {activeSlate.markets.map((market) => (
              <article className="v1-settlement-row" key={market.id}>
                <div className="v1-settlement-main">
                  <span>
                    {market.competition.name} · {market.eventName ?? market.eventId}
                  </span>
                  <strong>{market.question}</strong>
                  <small>
                    {market.category} · {market._count.predictions} picks ·{" "}
                    {market.status}
                  </small>
                </div>

                <form action={settleV1Market} className="resolution-choice-form">
                  <input name="marketId" type="hidden" value={market.id} />
                  <select
                    aria-label={`Winning outcome for ${market.question}`}
                    name="winningMarketOptionId"
                    required
                  >
                    {market.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} ({option.probability}%)
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Source URL"
                    name="sourceUrl"
                    placeholder="WCA result URL"
                    type="url"
                  />
                  <input
                    aria-label="Settlement note"
                    name="sourceNote"
                    placeholder="Result note"
                  />
                  <PendingSubmitButton pendingLabel="Resolving...">
                    Resolve
                  </PendingSubmitButton>
                </form>

                <div className="resolution-actions">
                  <form action={settleV1MarketAsTie}>
                    <input name="marketId" type="hidden" value={market.id} />
                    <input
                      name="reason"
                      type="hidden"
                      value="Exact official tie."
                    />
                    <PendingSubmitButton
                      className="secondary-button"
                      pendingLabel="Settling..."
                    >
                      Exact tie
                    </PendingSubmitButton>
                  </form>
                  <form action={voidV1MarketAction}>
                    <input name="marketId" type="hidden" value={market.id} />
                    <input
                      name="reason"
                      type="hidden"
                      value="Competitor did not participate or market cannot be settled from official result."
                    />
                    <PendingSubmitButton
                      className="secondary-button"
                      pendingLabel="Voiding..."
                    >
                      Void
                    </PendingSubmitButton>
                  </form>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">No V1 markets currently need settlement.</p>
        )}
      </section>

      <section>
        <div className="section-heading">
          <h2>Legacy Resolution Queue</h2>
          <span>
            {marketsNeedingResolution.length.toLocaleString()} needing review
          </span>
        </div>
        {marketsNeedingResolution.length > 0 ? (
          <div className="market-board">
            <div className="market-board-header">
              <span>Market</span>
              <span>Close</span>
              <span>Positions</span>
              <span>Trades</span>
              <span>Status</span>
            </div>
            {marketsNeedingResolution.map((market) => (
              <Link
                className="market-board-row"
                href={`/markets/${market.slug}`}
                key={market.id}
              >
                <div>
                  <strong>{market.question}</strong>
                  <span>{market.competition.name}</span>
                </div>
                <span>{market.closeTime.toLocaleDateString()}</span>
                <span>{market._count.positions.toLocaleString()}</span>
                <span>{market._count.purchases.toLocaleString()}</span>
                <span>{market.status}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-state">No markets currently need resolution.</p>
        )}
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

            <PendingSubmitButton pendingLabel="Creating competition...">
              Create competition
            </PendingSubmitButton>
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

            <PendingSubmitButton pendingLabel="Creating market...">
              Create market
            </PendingSubmitButton>
          </form>
        </article>
      </section>

      <section>
        <div className="section-heading">
          <h2>Legacy Market Review</h2>
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
                <strong className="yes-text">
                  {formatMarketCents(prices.yesPrice)}
                </strong>
                <strong className="no-text">
                  {formatMarketCents(prices.noPrice)}
                </strong>
                <span>{prices.totalShares.toLocaleString()}</span>
                <span>{market.status}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {manageableSlate && manageableSlate.markets.length > 0 && (
        <section>
          <div className="section-heading">
            <h2>V1 Market Review</h2>
            <span>{manageableSlate.markets.length.toLocaleString()} markets</span>
          </div>
          <div className="market-board">
            <div className="market-board-header v1-market-review-header">
              <span>Market</span>
              <span>Options</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {manageableSlate.markets.map((market) => (
              <article
                className="market-board-row v1-market-review-row"
                key={market.id}
              >
                <div>
                  <strong>{market.question}</strong>
                  <span>
                    {market.competition.name} · {market.eventName ?? market.eventId}
                  </span>
                </div>
                <span>
                  {market.options
                    .map((option) => `${option.label} ${option.probability}%`)
                    .join(" / ")}
                </span>
                <span>{market.status}</span>
                {market.status === "DRAFT" ? (
                  <form action={publishV1Market}>
                    <input name="marketId" type="hidden" value={market.id} />
                    <PendingSubmitButton
                      className="secondary-button"
                      pendingLabel="Publishing..."
                    >
                      Publish
                    </PendingSubmitButton>
                  </form>
                ) : (
                  <span>Published</span>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function getDiversityConfig(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const config = value as Record<string, unknown>;

    return {
      maxPerCompetition: getConfigNumber(config.maxPerCompetition, 16),
      maxPerCompetitor: getConfigNumber(config.maxPerCompetitor, 6),
      maxPerEvent: getConfigNumber(config.maxPerEvent, 12),
      maxPerMarketType: getConfigNumber(config.maxPerMarketType, 8)
    };
  }

  return {
    maxPerCompetition: 16,
    maxPerCompetitor: 6,
    maxPerEvent: 12,
    maxPerMarketType: 8
  };
}

function getConfigNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getWCAResultSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "No result snapshot yet";
  }

  const metadata = value as Record<string, unknown>;
  const resultCount =
    typeof metadata.resultCount === "number" ? metadata.resultCount : null;
  const observedAt =
    typeof metadata.resultsObservedAt === "string"
      ? new Date(metadata.resultsObservedAt)
      : null;

  if (!resultCount || !observedAt || Number.isNaN(observedAt.getTime())) {
    return "No result snapshot yet";
  }

  return `${resultCount.toLocaleString()} result rows observed ${observedAt.toLocaleString()}`;
}
