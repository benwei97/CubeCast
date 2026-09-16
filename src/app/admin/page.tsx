import Link from "next/link";
import { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { AdminMarketPublisher } from "@/components/admin-market-publisher";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { maintainContestLockState } from "@/lib/contest-maintenance";
import { prisma } from "@/lib/prisma";
import {
  generateWeeklyRecommendedContest,
  refreshContestLifecycle,
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
    lifecycle?: string;
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

  await maintainContestLockState();

  const [
    competitions,
    activeSlate,
    manageableSlate,
    slates,
    finalizedSlate
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
      prisma.contestSlate.findFirst({
        where: {
          status: { in: ["OPEN", "LOCKED", "SETTLING"] }
        },
        orderBy: { lockAt: "asc" },
        include: {
          entries: {
            select: {
              status: true
            }
          },
          markets: {
            where: {
              status: { in: ["OPEN", "LOCKED", "PENDING_RESULT"] }
            },
            include: {
              competition: {
                select: {
                  name: true,
                  sourceMetadata: true,
                  wcaCompetitionId: true
                }
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
        orderBy: [{ status: "asc" }, { lockAt: "asc" }, { createdAt: "desc" }],
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
      }),
      prisma.contestSlate.findFirst({
        where: { status: "FINALIZED" },
        orderBy: [{ finalizedAt: "desc" }, { lockAt: "desc" }],
        include: {
          leaderboardEntries: {
            include: {
              user: {
                select: {
                  username: true,
                  wcaIdentity: {
                    select: {
                      name: true,
                      wcaId: true
                    }
                  }
                }
              }
            },
            orderBy: [{ rank: "asc" }, { finalScore: "desc" }],
            take: 5
          },
          markets: {
            select: {
              status: true
            }
          }
        }
      })
    ]);
  const diversityConfig = getDiversityConfig(manageableSlate?.diversityConfig);
  const wcaCompetitions = competitions.filter(
    (competition) => competition.wcaCompetitionId
  );
  const lifecycleStats = getLifecycleStats(activeSlate);
  const finalizedStats = getFinalizedStats(finalizedSlate);

  return (
    <div className="page-stack">
      <section className="admin-contest-heading">
        <div>
          <h1>Contest Manager</h1>
          <p>{manageableSlate?.title ?? "Upcoming contest"}</p>
          {manageableSlate && (
            <small>{manageableSlate.status === "DRAFT" ? "Draft" : "Open"} · Picks lock {manageableSlate.lockAt.toLocaleString()}</small>
          )}
        </div>
        <form action={generateWeeklyRecommendedContest}>
          <PendingSubmitButton className={manageableSlate ? "secondary-button" : undefined} pendingLabel="Generating...">
            {manageableSlate ? "Regenerate recommendations" : "Generate contest"}
          </PendingSubmitButton>
        </form>
      </section>
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
        {params.wca === "no-recommendations" && (
          <p className="form-error">
            CubeCast could not find upcoming WCA competitions with usable public
            registration data for the next week.
          </p>
        )}
        {params.wca === "recommendations-generated" && (
          <p className="form-success">
            Generated a draft contest with recommended competitions and draft
            markets. Review the markets before publishing.
          </p>
        )}

      {params.v1Market === "published" && (
        <p className="form-success" role="status">Selected markets are now public.</p>
      )}
      {!manageableSlate && (
        <p className="empty-state">No contest is ready for market selection.</p>
      )}
      {manageableSlate && (
        <section>
          <div className="section-heading">
            <h2>Select Markets</h2>
          </div>
          <AdminMarketPublisher
            competitions={manageableSlate.competitions.map(({ competition }) => ({
              name: competition.name,
              location: `${competition.location} · ${competition.country}`,
              startDate: competition.startDate.toLocaleDateString(),
              endDate: competition.endDate.toLocaleDateString(),
              wcaCompetitionId: competition.wcaCompetitionId,
              ...getCompetitionPreview(competition.sourceMetadata)
            }))}
            markets={manageableSlate.markets.map((market) => ({
              competitionName: market.competition.name,
              eventName: market.eventName ?? market.eventId ?? "Event",
              id: market.id,
              options: market.options.map((option) => ({
                id: option.id,
                label: option.label,
                probability: option.probability
              })),
              question: market.question,
              status: market.status
            }))}
          />
        </section>
      )}
      <div className="admin-operations">
      <details className="admin-secondary" open={Boolean(params.v1Settlement || params.wca === "results-refreshed")}>
        <summary>Results & settlement</summary>
        <section className="admin-results-refresh">          <form action={refreshWCACompetitionResults} className="admin-form">
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
          </form></section>
      <section>
        <div className="section-heading">
          <h2>Settlement Queue</h2>
          <span>
            {activeSlate
              ? `${activeSlate.markets.length.toLocaleString()} open markets`
              : "No active contest"}
          </span>
        </div>
        {params.v1Settlement === "invalid" && (
          <p className="form-error">Check the settlement fields.</p>
        )}
        {params.v1Settlement === "resolved" && (
          <p className="form-success">
            Market resolved. Scores, snapshots, and leaderboard cache were updated.
          </p>
        )}
        {params.v1Settlement === "tie" && (
          <p className="form-success">
            Exact tie recorded. Both sides received the half-win score change.
          </p>
        )}
        {params.v1Settlement === "void" && (
          <p className="form-success">
            Market voided. Selected predictions on that market now score 0.
          </p>
        )}
        {activeSlate && activeSlate.markets.length > 0 ? (
          <div className="v1-settlement-list">
            {activeSlate.markets.map((market) => {
              const evidenceRows = getMarketWCAEvidenceRows(market);
              const evidenceSummary =
                evidenceRows.length > 0
                  ? `${evidenceRows.length.toLocaleString()} matching WCA rows`
                  : "Manual evidence needed";

              return (
                <article className="v1-settlement-row" key={market.id}>
                  <div className="v1-settlement-main">
                    <span>
                      {market.competition.name} ·{" "}
                      {market.eventName ?? market.eventId}
                    </span>
                    <strong>{market.question}</strong>
                    <small>
                      {market.category} · {market._count.predictions} picks ·{" "}
                      {market.status}
                    </small>
                    <div className="settlement-status-row">
                      <span>{evidenceSummary}</span>
                      <span>
                        {market.status === "PENDING_RESULT"
                          ? "Awaiting result"
                          : "Ready to review"}
                      </span>
                    </div>
                  </div>

                  <div className="wca-evidence-panel">
                    <strong>WCA evidence</strong>
                    {evidenceRows.length > 0 ? (
                      <>
                        <small>
                          Choose the official result row that supports the selected
                          outcome.
                        </small>
                        <div className="wca-evidence-list">
                          {evidenceRows.slice(0, 6).map((row) => (
                            <span key={row.id}>{row.label}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <small>
                        No matching imported WCA result rows. Refresh this
                        competition snapshot, or enter a WCA result URL and note
                        before settling manually.
                      </small>
                    )}
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
                    <select aria-label="WCA evidence row" name="sourceEvidence">
                      <option value="">Manual evidence or no matched row</option>
                      {evidenceRows.map((row) => (
                        <option key={row.id} value={row.value}>
                          Store evidence: {row.label}
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
              );
            })}
          </div>
        ) : (
          <p className="empty-state">No markets currently need settlement.</p>
        )}
      </section>


      </details>

      <details className="admin-secondary" open={Boolean(params.lifecycle)}>
        <summary>Contest status</summary>
      <section className="admin-form-panel">
        <div className="section-heading">
          <h2>Contest Lifecycle</h2>
          <span>
            {activeSlate
              ? `${activeSlate.status} · Locks ${activeSlate.lockAt.toLocaleString()}`
              : "No active contest"}
          </span>
        </div>
        {params.lifecycle === "refreshed" && (
          <p className="form-success">Contest lifecycle status refreshed.</p>
        )}
        <div className="summary-grid">
          <article className="summary-card">
            <span>Contest</span>
            <strong>{activeSlate?.status ?? "None"}</strong>
            <small>{activeSlate?.title ?? "Create or open a contest"}</small>
          </article>
          <article className="summary-card">
            <span>Entries</span>
            <strong>{lifecycleStats.totalEntries.toLocaleString()}</strong>
            <small>
              {lifecycleStats.lockedEntries.toLocaleString()} locked ·{" "}
              {lifecycleStats.invalidEntries.toLocaleString()} invalid
            </small>
          </article>
          <article className="summary-card">
            <span>Markets</span>
            <strong>{lifecycleStats.totalMarkets.toLocaleString()}</strong>
            <small>
              {lifecycleStats.lockedMarkets.toLocaleString()} locked ·{" "}
              {lifecycleStats.pendingMarkets.toLocaleString()} pending
            </small>
          </article>
          <article className="summary-card">
            <span>Next action</span>
            <strong>{lifecycleStats.nextAction}</strong>
            <small>{lifecycleStats.nextActionDetail}</small>
          </article>
        </div>
        <form action={refreshContestLifecycle} className="inline-form">
          <PendingSubmitButton
            className="secondary-button"
            pendingLabel="Refreshing..."
          >
            Refresh lifecycle status
          </PendingSubmitButton>
        </form>
      </section>


      </details>

      {manageableSlate && (
      <details className="admin-secondary">
        <summary>Generation settings</summary>
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
      </details>

      )}
      <details className="admin-secondary">
        <summary>Past contests</summary>
      <section className="admin-form-panel">
        <div className="section-heading">
          <h2>Contest Review</h2>
          <span>{slates.length.toLocaleString()} recent contests</span>
        </div>
        <div className="admin-slate-list">
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
      </section>

      <section className="admin-form-panel">
        <div className="section-heading">
          <h2>Finalized Contest Review</h2>
          <span>
            {finalizedSlate?.finalizedAt
              ? `Finalized ${finalizedSlate.finalizedAt.toLocaleString()}`
              : "No finalized contests"}
          </span>
        </div>
        <div className="summary-grid">
          <article className="summary-card">
            <span>Contest</span>
            <strong>{finalizedSlate ? "FINALIZED" : "None"}</strong>
            <small>{finalizedSlate?.title ?? "Settle all markets to finalize"}</small>
          </article>
          <article className="summary-card">
            <span>Official entries</span>
            <strong>{finalizedSlate?.leaderboardEntries.length ?? 0}</strong>
            <small>Leaderboard entries cached</small>
          </article>
          <article className="summary-card">
            <span>Markets</span>
            <strong>{finalizedStats.terminalMarkets.toLocaleString()}</strong>
            <small>
              {finalizedStats.resolvedMarkets.toLocaleString()} resolved ·{" "}
              {finalizedStats.voidMarkets.toLocaleString()} void
            </small>
          </article>
          <article className="summary-card">
            <span>Winner</span>
            <strong>{finalizedStats.winnerScore}</strong>
            <small>{finalizedStats.winnerName}</small>
          </article>
        </div>
        {finalizedSlate && finalizedSlate.leaderboardEntries.length > 0 ? (
          <div className="leaderboard-table compact-admin-table">
            <div className="leaderboard-header v1-leaderboard-header">
              <span>Rank</span>
              <span>User</span>
              <span>Score</span>
              <span>Correct</span>
              <span>Hardest correct</span>
              <span>Tie</span>
            </div>
            {finalizedSlate.leaderboardEntries.map((entry) => (
              <article className="leaderboard-row v1-leaderboard-row" key={entry.id}>
                <strong>#{entry.rank}</strong>
                <span>{getAdminDisplayName(entry.user)}</span>
                <strong>{entry.finalScore.toLocaleString()}</strong>
                <span>{entry.correctCount.toLocaleString()}</span>
                <span>
                  {entry.hardestCorrectProbability === null
                    ? "-"
                    : `${entry.hardestCorrectProbability}%`}
                </span>
                <span>{entry.isSharedRank ? "Shared" : "-"}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            Finalized contests with official 10-pick entries will appear here.
          </p>
        )}
      </section>


      </details>

      </div>
    </div>
  );
}

function getCompetitionPreview(sourceMetadata: unknown) {
  const metadata = isRecord(sourceMetadata) ? sourceMetadata : null;
  const topRankedCompetitors = Array.isArray(metadata?.topRankedCompetitors)
    ? metadata.topRankedCompetitors
        .map((competitor) => {
          if (!isRecord(competitor)) {
            return null;
          }

          const eventId = getString(competitor.eventId);
          const eventName = getString(competitor.eventName);
          const name = getString(competitor.name);
          const wcaId = getString(competitor.wcaId);
          const worldRanking = getNumber(competitor.worldRanking);

          if (!eventId || !eventName || !name || !wcaId || !worldRanking) {
            return null;
          }

          return {
            eventId,
            eventName,
            name,
            wcaId,
            worldRanking
          };
        })
        .filter((competitor): competitor is NonNullable<typeof competitor> =>
          Boolean(competitor)
        )
    : [];

  return {
    acceptedCompetitors: getNumber(metadata?.acceptedCompetitorCount),
    competitorLimit: getNumber(metadata?.competitorLimit),
    topRankedCompetitors
  };
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

type WCAEvidenceMarket = {
  eventId: string | null;
  eventName: string | null;
  competition: {
    sourceMetadata: unknown;
    wcaCompetitionId: string | null;
  };
  options: {
    competitorWcaId: string | null;
    label: string;
  }[];
};

function getMarketWCAEvidenceRows(market: WCAEvidenceMarket) {
  const metadata = isRecord(market.competition.sourceMetadata)
    ? market.competition.sourceMetadata
    : null;
  const snapshot = Array.isArray(metadata?.resultsSnapshot)
    ? metadata.resultsSnapshot
    : [];
  const competitorIds = new Set(
    market.options
      .map((option) => option.competitorWcaId)
      .filter((value): value is string => Boolean(value))
  );
  const observedAt =
    typeof metadata?.resultsObservedAt === "string"
      ? metadata.resultsObservedAt
      : null;
  const sourceUrl =
    typeof metadata?.resultsSourceUrl === "string"
      ? metadata.resultsSourceUrl
      : null;

  return snapshot
    .map((result, index) =>
      buildWCAEvidenceRow({
        index,
        market,
        observedAt,
        result,
        sourceUrl
      })
    )
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .filter((row) => {
      const eventMatches = !market.eventId || row.evidence.eventId === market.eventId;
      const competitorMatches =
        competitorIds.size === 0 ||
        (row.evidence.wcaId ? competitorIds.has(row.evidence.wcaId) : false);

      return eventMatches && competitorMatches;
    })
    .slice(0, 20);
}

function buildWCAEvidenceRow({
  index,
  market,
  observedAt,
  result,
  sourceUrl
}: {
  index: number;
  market: WCAEvidenceMarket;
  observedAt: string | null;
  result: unknown;
  sourceUrl: string | null;
}) {
  if (!isRecord(result)) {
    return null;
  }

  const person = isRecord(result.person) ? result.person : null;
  const round = isRecord(result.round) ? result.round : null;
  const eventId = getString(result.event_id);
  const roundId = getString(result.round_type_id) ?? getString(round?.id);
  const roundName = getString(round?.name) ?? roundId;
  const personName = getString(person?.name) ?? getString(result.person_name);
  const personId = getString(person?.id) ?? getString(result.person_id);
  const wcaId = getString(person?.wca_id) ?? personId;
  const placement = getNumber(result.pos) ?? getNumber(result.ranking);
  const best = getNumber(result.best);
  const average = getNumber(result.average);
  const evidence = {
    average,
    best,
    eventId,
    eventName: market.eventName,
    observedAt,
    personId,
    personName,
    placement,
    rawResult: result,
    roundId,
    roundName,
    sourceUrl,
    wcaCompetitionId: market.competition.wcaCompetitionId,
    wcaId
  };
  const labelParts = [
    personName ?? wcaId ?? "Unknown competitor",
    eventId,
    roundName,
    placement != null ? `place ${placement}` : null,
    average != null ? `avg ${average}` : null,
    best != null ? `best ${best}` : null
  ].filter(Boolean);

  return {
    evidence,
    id: `${eventId ?? "event"}-${personId ?? index}-${roundId ?? "round"}-${index}`,
    label: labelParts.join(" · "),
    value: JSON.stringify(evidence)
  };
}

function getWCAResultSummary(value: unknown) {
  if (!isRecord(value)) {
    return "No result snapshot yet";
  }

  const resultCount = getNumber(value.resultCount);
  const observedAt =
    typeof value.resultsObservedAt === "string"
      ? new Date(value.resultsObservedAt)
      : null;

  if (!resultCount || !observedAt || Number.isNaN(observedAt.getTime())) {
    return "No result snapshot yet";
  }

  return `${resultCount.toLocaleString()} result rows observed ${observedAt.toLocaleString()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getLifecycleStats(
  contest: {
    entries: { status: string }[];
    lockAt: Date;
    markets: { status: string }[];
    status: string;
  } | null
) {
  if (!contest) {
    return {
      invalidEntries: 0,
      lockedEntries: 0,
      lockedMarkets: 0,
      nextAction: "Create contest",
      nextActionDetail: "Open a contest before collecting picks",
      pendingMarkets: 0,
      totalEntries: 0,
      totalMarkets: 0
    };
  }

  const now = new Date();
  const lockedEntries = contest.entries.filter(
    (entry) => entry.status === "LOCKED" || entry.status === "FINALIZED"
  ).length;
  const invalidEntries = contest.entries.filter(
    (entry) => entry.status === "INVALID"
  ).length;
  const lockedMarkets = contest.markets.filter(
    (market) => market.status === "LOCKED"
  ).length;
  const pendingMarkets = contest.markets.filter(
    (market) => market.status === "PENDING_RESULT"
  ).length;
  const baseStats = {
    invalidEntries,
    lockedEntries,
    lockedMarkets,
    pendingMarkets,
    totalEntries: contest.entries.length,
    totalMarkets: contest.markets.length
  };

  if (contest.status === "OPEN" && contest.lockAt > now) {
    return {
      ...baseStats,
      nextAction: "Collect picks",
      nextActionDetail: `Locks ${contest.lockAt.toLocaleString()}`
    };
  }

  if (contest.status === "LOCKED") {
    return {
      ...baseStats,
      nextAction: "Settle markets",
      nextActionDetail: "Refresh WCA evidence and resolve results"
    };
  }

  if (contest.status === "SETTLING") {
    return {
      ...baseStats,
      nextAction: "Finish settlement",
      nextActionDetail: "Resolve or void every remaining market"
    };
  }

  return {
    ...baseStats,
    nextAction: "Review",
    nextActionDetail: "Lifecycle status is up to date"
  };
}

function getFinalizedStats(
  contest: {
    leaderboardEntries: {
      finalScore: number;
      user: {
        username: string;
        wcaIdentity: {
          name: string;
          wcaId: string | null;
        } | null;
      };
    }[];
    markets: { status: string }[];
  } | null
) {
  if (!contest) {
    return {
      resolvedMarkets: 0,
      terminalMarkets: 0,
      voidMarkets: 0,
      winnerName: "No finalized leaderboard",
      winnerScore: "-"
    };
  }

  const winner = contest.leaderboardEntries[0] ?? null;

  return {
    resolvedMarkets: contest.markets.filter((market) => market.status === "RESOLVED")
      .length,
    terminalMarkets: contest.markets.filter((market) =>
      ["RESOLVED", "VOID", "CANCELED"].includes(market.status)
    ).length,
    voidMarkets: contest.markets.filter((market) => market.status === "VOID").length,
    winnerName: winner ? getAdminDisplayName(winner.user) : "No official entries",
    winnerScore: winner ? winner.finalScore.toLocaleString() : "-"
  };
}

function getAdminDisplayName(user: {
  username: string;
  wcaIdentity: {
    name: string;
    wcaId: string | null;
  } | null;
}) {
  if (user.wcaIdentity?.name) {
    return user.wcaIdentity.wcaId
      ? `${user.wcaIdentity.name} (${user.wcaIdentity.wcaId})`
      : user.wcaIdentity.name;
  }

  return user.username;
}
