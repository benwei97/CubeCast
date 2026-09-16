import Link from "next/link";
import { Prisma, UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { AdminCompetitionSelector } from "@/components/admin-competition-selector";
import { AdminMarketPublisher } from "@/components/admin-market-publisher";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { maintainContestLockState } from "@/lib/contest-maintenance";
import {
  CURRENT_CONTEST_ORDER,
  PUBLIC_CONTEST_WHERE,
  getContestDisplayStatus
} from "@/lib/contest-workflow";
import { asMetadata } from "@/lib/wca-result-snapshot";
import { prisma } from "@/lib/prisma";
import {
  generateWeeklyRecommendedContest,
  prepareNextContest,
  settleV1Market,
  settleV1MarketAsTie,
  voidV1MarketAction
} from "./actions";

export const dynamic = "force-dynamic";

const contestInclude = {
  competitions: {
    include: { competition: true },
    orderBy: { createdAt: "asc" as const }
  },
  entries: {
    select: { status: true, _count: { select: { predictions: true } } }
  },
  markets: {
    include: {
      competition: {
        select: { name: true, sourceMetadata: true, wcaCompetitionId: true }
      },
      options: { orderBy: { displayOrder: "asc" as const } },
      _count: { select: { predictions: true } },
      settlementSnapshots: true
    },
    orderBy: { createdAt: "asc" as const }
  },
  leaderboardEntries: {
    include: {
      user: {
        select: { username: true, wcaIdentity: { select: { name: true } } }
      }
    },
    orderBy: { rank: "asc" as const },
    take: 10
  }
} satisfies Prisma.ContestSlateInclude;

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{
    contest?: string;
    wca?: string;
    v1Market?: string;
    v1Settlement?: string;
    publishError?: string;
  }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return (
      <div className="auth-page">
        <section className="auth-panel">
          <h1>Admin sign in</h1>
          <Link className="button-link" href="/sign-in">
            Sign in
          </Link>
        </section>
      </div>
    );
  }
  await maintainContestLockState();
  const [current, draft, history] = await Promise.all([
    prisma.contestSlate.findFirst({
      where: PUBLIC_CONTEST_WHERE,
      orderBy: CURRENT_CONTEST_ORDER,
      select: { id: true, endsAt: true }
    }),
    prisma.contestSlate.findFirst({
      where: { status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      select: { id: true, startsAt: true }
    }),
    prisma.contestSlate.findMany({
      where: PUBLIC_CONTEST_WHERE,
      orderBy: CURRENT_CONTEST_ORDER,
      take: 16,
      include: {
        competitions: { include: { competition: true } },
        markets: {
          where: { publishedAt: { not: null } },
          select: { competitionId: true, status: true }
        }
      }
    })
  ]);
  const selectedId = params.contest ?? current?.id ?? draft?.id;
  const contest = selectedId
    ? await prisma.contestSlate.findUnique({
        where: { id: selectedId },
        include: contestInclude
      })
    : null;
  const isDraft = contest?.status === "DRAFT";
  const isComplete = contest?.status === "FINALIZED";
  const now = new Date();
  const preparation = asMetadata(contest?.preparation);
  const candidateIds = Array.isArray(preparation.candidateIds)
    ? preparation.candidateIds.filter(
        (id): id is string => typeof id === "string"
      )
    : [];
  const candidates = isDraft
    ? await prisma.competition.findMany({
        where: {
          id: {
            in: candidateIds.length
              ? candidateIds
              : contest.competitions.map((row) => row.competitionId)
          }
        }
      })
    : [];
  candidates.sort(
    (a, b) => candidateIds.indexOf(a.id) - candidateIds.indexOf(b.id)
  );
  const publicMarkets =
    contest?.markets.filter((market) => market.publishedAt !== null) ?? [];
  const pendingMarkets = publicMarkets.filter(
    (market) => !["RESOLVED", "VOID", "CANCELED"].includes(market.status)
  );
  const windowStart =
    contest &&
    isDraft &&
    !contest.competitions.length &&
    typeof preparation.windowStart === "string"
      ? new Date(preparation.windowStart)
      : contest?.startsAt;
  const windowEnd =
    contest &&
    isDraft &&
    !contest.competitions.length &&
    typeof preparation.windowEnd === "string"
      ? new Date(preparation.windowEnd)
      : contest?.endsAt;
  const windowLabel =
    windowStart && windowEnd
      ? `${formatWindowDate(windowStart)} – ${formatWindowDate(windowEnd)}`
      : "Upcoming contest";
  const preview = (competition: (typeof candidates)[number]) => ({
    id: competition.id,
    name: competition.name,
    location: `${competition.location} · ${competition.country}`,
    startDate: formatWindowDate(competition.startDate),
    endDate: formatWindowDate(competition.endDate),
    wcaCompetitionId: competition.wcaCompetitionId,
    ...getCompetitionPreview(competition.sourceMetadata)
  });
  const hasMarkets = Boolean(contest?.markets.length);
  const completeEntries =
    contest?.entries.filter(
      (entry) =>
        entry.status !== "INVALID" &&
        entry._count.predictions === contest.maxPicks
    ).length ?? 0;
  const pastContests = history.filter((item) => item.id !== current?.id);

  return (
    <div className="page-stack admin-workspace">
      <section className="admin-contest-heading">
        <div>
          <h1>{windowLabel}</h1>
          <p>{contest?.title ?? "Contest Manager"}</p>
          {contest && (
            <div className="admin-contest-state">
              <span
                className={`admin-status admin-status-${getContestDisplayStatus(contest.status).toLowerCase()}`}
              >
                {getContestDisplayStatus(contest.status)}
              </span>
              <small>
                {isDraft
                  ? "Not public"
                  : isComplete
                    ? "Final results"
                    : now < contest.lockAt
                      ? "Selections open"
                      : "Selections locked"}
              </small>
            </div>
          )}
          {contest && (contest.competitions.length > 0 || !isDraft) && (
            <small>Picks lock {contest.lockAt.toLocaleString()}</small>
          )}
        </div>
        <div className="admin-contest-navigation">
          {current && contest?.id !== current.id && (
            <Link className="secondary-button button-link" href="/admin">
              Current contest
            </Link>
          )}
          {current && !isDraft && (
            <form action={prepareNextContest}>
              <PendingSubmitButton
                className="secondary-button"
                pendingLabel="Opening draft..."
              >
                {draft && draft.startsAt > current.endsAt
                  ? "Continue next draft"
                  : "Prepare next contest"}
              </PendingSubmitButton>
            </form>
          )}
        </div>
      </section>

      {params.publishError && (
        <p className="form-error" role="alert">
          {params.publishError}
        </p>
      )}
      {params.v1Market === "published" && (
        <p className="form-success" role="status">
          Contest published. Players can now choose their picks.
        </p>
      )}
      {params.wca === "unavailable" && (
        <p className="form-error" role="alert">
          Competition or probability data is temporarily unavailable. Your saved
          draft is unchanged. Try again.
        </p>
      )}
      {params.wca === "no-recommendations" && (
        <p className="form-error" role="alert">
          Fewer than three eligible upcoming competitions were found in this
          window.
        </p>
      )}
      {params.wca === "deadline-passed" && (
        <p className="form-error" role="alert">
          The selected competitions&apos; pick deadline has passed. Choose
          upcoming competitions.
        </p>
      )}

      {!contest && (
        <form action={generateWeeklyRecommendedContest}>
          <PendingSubmitButton pendingLabel="Finding competitions...">
            Generate competitions
          </PendingSubmitButton>
        </form>
      )}

      {contest && isDraft && (
        <>
          <section className="admin-draft-step">
            <div className="section-heading">
              <h2>Choose competitions</h2>
              {
                <form action={generateWeeklyRecommendedContest}>
                  <input name="contestId" type="hidden" value={contest.id} />
                  <PendingSubmitButton
                    className={
                      candidates.length ? "secondary-button" : undefined
                    }
                    pendingLabel="Finding competitions..."
                  >
                    {candidates.length
                      ? "Regenerate competitions"
                      : "Generate competitions"}
                  </PendingSubmitButton>
                </form>
              }
            </div>
            {candidates.length > 0 && (
              <details className="admin-step-details" open={!hasMarkets}>
                <summary>
                  {hasMarkets
                    ? `${contest.competitions.length} competitions selected · Edit selection`
                    : "Select three featured competitions"}
                </summary>
                <AdminCompetitionSelector
                  key={contest.updatedAt.toISOString()}
                  contestId={contest.id}
                  competitions={candidates.map(preview)}
                  selectedIds={contest.competitions.map(
                    (row) => row.competitionId
                  )}
                  hasMarkets={hasMarkets}
                />
              </details>
            )}
          </section>
          {hasMarkets && (
            <section>
              <h2>Choose markets</h2>
              {contest.markets.length < 25 && (
                <p className="form-error">
                  Only {contest.markets.length} markets are available.
                  Regenerate markets or choose different competitions to reach
                  25.
                </p>
              )}
              <AdminMarketPublisher
                key={contest.updatedAt.toISOString()}
                contestId={contest.id}
                lockLabel={contest.lockAt.toLocaleString()}
                windowLabel={windowLabel}
                competitions={contest.competitions.map(({ competition }) =>
                  preview(competition)
                )}
                markets={contest.markets.map((market) => ({
                  competitionName: market.competition.name,
                  eventName: market.eventName ?? market.eventId ?? "Event",
                  id: market.id,
                  question: market.question,
                  status: market.status,
                  options: market.options.map((option) => ({
                    id: option.id,
                    label: option.label,
                    probability: option.probability
                  }))
                }))}
              />
            </section>
          )}
        </>
      )}

      {contest && !isDraft && (
        <>
          <section
            className="admin-contest-stats"
            aria-label="Contest statistics"
          >
            <div>
              <span>Complete entries</span>
              <strong>{completeEntries.toLocaleString()}</strong>
            </div>
            <div>
              <span>Markets settled</span>
              <strong>
                {publicMarkets.length - pendingMarkets.length} /{" "}
                {publicMarkets.length}
              </strong>
            </div>
            <div>
              <span>{isComplete ? "Winner" : "Pick status"}</span>
              <strong>
                {isComplete
                  ? (contest.leaderboardEntries[0]?.user.wcaIdentity?.name ??
                    contest.leaderboardEntries[0]?.user.username ??
                    "No official entries")
                  : now < contest.lockAt
                    ? "Open"
                    : "Locked"}
              </strong>
            </div>
          </section>
          <section>
            <h2>Featured competitions</h2>
            <div className="admin-competition-progress">
              {contest.competitions.map(({ competition }) => {
                const markets = publicMarkets.filter(
                  (market) => market.competitionId === competition.id
                );
                const done =
                  markets.length > 0 &&
                  markets.every((market) =>
                    ["RESOLVED", "VOID", "CANCELED"].includes(market.status)
                  );
                const metadata = asMetadata(competition.sourceMetadata);
                const status = done
                  ? "Done"
                  : competition.startDate > now
                    ? "Upcoming"
                    : Number(metadata.resultCount) > 0
                      ? "Results available"
                      : "Awaiting WCA results";
                return (
                  <article key={competition.id}>
                    <div>
                      <strong>{competition.name}</strong>
                      <small>
                        {formatWindowDate(competition.startDate)} –{" "}
                        {formatWindowDate(competition.endDate)}
                      </small>
                    </div>
                    <span
                      className={
                        done
                          ? "admin-status admin-status-complete"
                          : "admin-progress-label"
                      }
                    >
                      {status}
                    </span>
                  </article>
                );
              })}
            </div>
          </section>
          <section>
            <div className="section-heading">
              <h2>Results & settlements</h2>
              <Link href={`/leaderboard?contest=${contest.id}`}>
                View leaderboard
              </Link>
            </div>
            {isComplete ? (
              <div className="admin-final-results">
                {contest.leaderboardEntries.length ? (
                  contest.leaderboardEntries.map((entry) => (
                    <article key={entry.id}>
                      <strong>
                        #{entry.rank}{" "}
                        {entry.user.wcaIdentity?.name ?? entry.user.username}
                      </strong>
                      <span>{entry.finalScore.toLocaleString()} points</span>
                    </article>
                  ))
                ) : (
                  <p className="empty-state">
                    No official entries in this contest.
                  </p>
                )}
                <details className="admin-secondary">
                  <summary>Settled markets</summary>
                  {publicMarkets.map((market) => (
                    <details className="admin-settled-market" key={market.id}>
                      <summary>
                        {market.question} ·{" "}
                        {market.status === "VOID" ? "Void" : "Resolved"}
                      </summary>
                      {market.settlementSnapshots.map((snapshot) => (
                        <div key={snapshot.id}>
                          <p>
                            Rule {snapshot.ruleVersion} · Settled{" "}
                            {snapshot.settledAt.toLocaleString()}
                          </p>
                          <p>
                            Observed{" "}
                            {snapshot.observedPublicationAt?.toLocaleString() ??
                              "Not recorded"}
                          </p>
                          {snapshot.sourceUrl && (
                            <a
                              href={snapshot.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              WCA source
                            </a>
                          )}
                          <pre>
                            {JSON.stringify(snapshot.snapshot, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </details>
                  ))}
                </details>
              </div>
            ) : now < contest.lockAt ? (
              <p className="empty-state">
                Results will appear after competitions begin.
              </p>
            ) : (
              <details
                className="admin-secondary"
                open={
                  Boolean(params.v1Settlement) ||
                  pendingMarkets.some(
                    (market) => getMarketWCAEvidenceRows(market).length > 0
                  )
                }
              >
                <summary>
                  Review unsettled markets ({pendingMarkets.length})
                </summary>
                <section>
                  <div className="section-heading">
                    <h2>Settlement Queue</h2>
                    <span>
                      {contest
                        ? `${pendingMarkets.length} unsettled markets`
                        : "No active contest"}
                    </span>
                  </div>
                  {params.v1Settlement === "invalid" && (
                    <p className="form-error">Check the settlement fields.</p>
                  )}
                  {params.v1Settlement === "resolved" && (
                    <p className="form-success">
                      Market resolved. Scores, snapshots, and leaderboard cache
                      were updated.
                    </p>
                  )}
                  {params.v1Settlement === "tie" && (
                    <p className="form-success">
                      Exact tie recorded. Both sides received the half-win score
                      change.
                    </p>
                  )}
                  {params.v1Settlement === "void" && (
                    <p className="form-success">
                      Market voided. Selected predictions on that market now
                      score 0.
                    </p>
                  )}
                  {pendingMarkets.length > 0 ? (
                    <div className="v1-settlement-list">
                      {pendingMarkets.map((market) => {
                        const evidenceRows = getMarketWCAEvidenceRows(market);
                        const evidenceSummary =
                          evidenceRows.length > 0
                            ? `${evidenceRows.length.toLocaleString()} matching WCA rows`
                            : "Manual evidence needed";

                        return (
                          <article
                            className="v1-settlement-row"
                            key={market.id}
                          >
                            <div className="v1-settlement-main">
                              <span>
                                {market.competition.name} ·{" "}
                                {market.eventName ?? market.eventId}
                              </span>
                              <strong>{market.question}</strong>
                              <small>
                                {market.category} · {market._count.predictions}{" "}
                                picks · {market.status}
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
                                    Choose the official result row that supports
                                    the selected outcome.
                                  </small>
                                  <div className="wca-evidence-list">
                                    {evidenceRows.slice(0, 6).map((row) => (
                                      <span key={row.id}>{row.label}</span>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <small>
                                  No matching imported WCA result rows. Results
                                  are checked automatically. Enter a WCA result
                                  URL and note before settling manually.
                                </small>
                              )}
                            </div>

                            <form
                              action={settleV1Market}
                              className="resolution-choice-form"
                            >
                              <input
                                name="marketId"
                                type="hidden"
                                value={market.id}
                              />
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
                              <select
                                aria-label="WCA evidence row"
                                name="sourceEvidence"
                              >
                                <option value="">
                                  Manual evidence or no matched row
                                </option>
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
                                <input
                                  name="marketId"
                                  type="hidden"
                                  value={market.id}
                                />
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
                                <input
                                  name="marketId"
                                  type="hidden"
                                  value={market.id}
                                />
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
                    <p className="empty-state">
                      No markets currently need settlement.
                    </p>
                  )}
                </section>
              </details>
            )}
          </section>
        </>
      )}

      <section className="admin-history">
        <h2>Past contests</h2>
        {pastContests.length ? (
          pastContests.map((item) => (
            <details className="admin-secondary" key={item.id}>
              <summary>
                <span>
                  {formatWindowDate(item.startsAt)} –{" "}
                  {formatWindowDate(item.endsAt)}
                </span>
                <span
                  className={`admin-status admin-status-${getContestDisplayStatus(item.status).toLowerCase()}`}
                >
                  {getContestDisplayStatus(item.status)}
                </span>
              </summary>
              <div className="admin-competition-progress">
                {item.competitions.map(({ competition }) => {
                  const markets = item.markets.filter(
                    (market) => market.competitionId === competition.id
                  );
                  const done =
                    markets.length > 0 &&
                    markets.every((market) =>
                      ["RESOLVED", "VOID", "CANCELED"].includes(market.status)
                    );
                  return (
                    <article key={competition.id}>
                      <strong>{competition.name}</strong>
                      <span>
                        {done ? "Done" : "Awaiting results / settlement"}
                      </span>
                    </article>
                  );
                })}
              </div>
              <div className="admin-history-actions">
                <Link href={`/admin?contest=${item.id}`}>
                  View results & settlements
                </Link>
                <Link href={`/leaderboard?contest=${item.id}`}>
                  Leaderboard
                </Link>
              </div>
            </details>
          ))
        ) : (
          <p className="empty-state">No past contests yet.</p>
        )}
      </section>
    </div>
  );
}

function formatWindowDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
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
      const eventMatches =
        !market.eventId || row.evidence.eventId === market.eventId;
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
    observedAt: getString(result.cubecastObservedAt) ?? observedAt,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
