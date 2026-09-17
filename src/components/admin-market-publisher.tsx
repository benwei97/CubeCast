"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { publishSelectedV1Markets, updateDraftMarketInclusion } from "@/app/admin/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { WCAEventLabel } from "@/components/wca-event-label";
import { getSelectedContestTiming } from "@/lib/contest-workflow";

type AdminMarketOption = {
  id: string;
  label: string;
  probability: number;
  worldRanking?: number | null;
};

export type AdminPublishMarket = {
  category?: string;
  slug: string;
  competitionSlug: string;
  contestId: string;
  competitionName: string;
  eventName: string;
  eventId?: string | null;
  id: string;
  options: AdminMarketOption[];
  question: string;
  status: string;
  recommendationScore?: number | null;
};

export type CompetitionPreview = {
  name: string;
  location: string;
  startDate: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  endDate: string;
  wcaCompetitionId: string | null;
  acceptedCompetitors: number | null;
  competitorLimit: number | null;
  topRankedCompetitors: {
    wcaId: string;
    eventId: string;
    name: string;
    eventName: string;
    worldRanking: number;
  }[];
};

export function AdminMarketPublisher({
  markets,
  competitions,
  contestId,
  lockLabel,
  windowLabel,
  requiredPicks,
  excludedMarketIds = []
}: {
  markets: AdminPublishMarket[];
  competitions: CompetitionPreview[];
  contestId: string;
  lockLabel: string;
  windowLabel: string;
  requiredPicks: number;
  excludedMarketIds?: string[];
}) {
  const draftMarkets = useMemo(
    () =>
      markets
        .filter((market) => market.status === "DRAFT")
        .sort(
          (a, b) =>
            getRankTier(a) - getRankTier(b) ||
            (b.recommendationScore ?? -1) - (a.recommendationScore ?? -1)
        ),
    [markets]
  );
  const [selectedMarketIds, setSelectedMarketIds] = useState<string[]>(() =>
    draftMarkets.filter((market) => !excludedMarketIds.includes(market.id)).map((market) => market.id)
  );
  const exclusionKey = [...excludedMarketIds].sort().join(":");
  const [savedExclusionKey, setSavedExclusionKey] = useState(exclusionKey);
  if (savedExclusionKey !== exclusionKey) {
    setSavedExclusionKey(exclusionKey);
    setSelectedMarketIds(draftMarkets.filter((market) => !excludedMarketIds.includes(market.id)).map((market) => market.id));
  }
  const [saving, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [view, setView] = useState<"recommended" | "competition">(
    "recommended"
  );

  const selectedMarkets = useMemo(
    () =>
      selectedMarketIds
        .map((marketId) =>
          draftMarkets.find((market) => market.id === marketId)
        )
        .filter((market): market is AdminPublishMarket => Boolean(market)),
    [draftMarkets, selectedMarketIds]
  );

  const groupedMarkets = useMemo(
    () => groupMarketsByCompetition(draftMarkets),
    [draftMarkets]
  );
  const selectedGroupedMarkets = useMemo(
    () => groupMarketsByCompetition(selectedMarkets),
    [selectedMarkets]
  );
  const isComplete = selectedMarketIds.length >= requiredPicks;
  const selectedCompetitions = competitions.filter((competition) =>
    selectedMarkets.some(
      (market) => market.competitionName === competition.name
    )
  );
  const timing =
    selectedCompetitions.length &&
    selectedCompetitions.every(
      (competition) =>
        competition.scheduledStartAt && competition.scheduledEndAt
    )
      ? getSelectedContestTiming(
          selectedCompetitions.map((competition) => ({
            startDate: new Date(competition.scheduledStartAt!),
            endDate: new Date(competition.scheduledEndAt!)
          }))
        )
      : null;
  const reviewWindowLabel = timing
    ? `${timing.startsAt.toLocaleDateString()} – ${timing.endsAt.toLocaleDateString()}`
    : windowLabel;
  const reviewLockLabel = timing ? timing.lockAt.toLocaleString() : lockLabel;

  function toggleMarket(marketId: string) {
    changeInclusion([marketId], !selectedMarketIds.includes(marketId));
  }

  function changeInclusion(ids: string[], included: boolean) {
    const previous = selectedMarketIds;
    setIsReviewing(false);
    setSaveError(null);
    setSelectedMarketIds(included ? [...new Set([...previous, ...ids])] : previous.filter((id) => !ids.includes(id)));
    const data = new FormData();
    data.set("contestId", contestId);
    data.set("included", String(included));
    ids.forEach((id) => data.append("marketIds", id));
    startTransition(async () => {
      try { await updateDraftMarketInclusion(data); }
      catch { setSelectedMarketIds(previous); setSaveError("Could not save selection. Reload and try again."); }
    });
  }

  function clearSelections() {
    changeInclusion(draftMarkets.map((market) => market.id), false);
  }

  if (draftMarkets.length === 0) {
    return (
      <div className="admin-publish-flow">
        <div className="admin-publish-empty">
          <strong>No markets available for selection.</strong>
          <span>Generate markets before publishing this contest.</span>
        </div>
        {competitions.map((competition) => (
          <section className="admin-market-group" key={competition.name}>
            <CompetitionHeading competition={competition} />
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="admin-publish-flow">
      {saveError && <p role="alert" className="form-error">{saveError}</p>}
      <div className="admin-publish-toolbar">
        <div>
          <strong>{selectedMarketIds.length} markets included</strong>
          <span>
            {isReviewing
              ? "Ready to publish"
              : selectedMarketIds.length < requiredPicks
                ? `Include at least ${requiredPicks} markets`
                : `${draftMarkets.length - selectedMarketIds.length} excluded`}
          </span>
        </div>
        <div className="admin-publish-toolbar-actions">
          {!isReviewing && (
            <button
              className="secondary-button"
              disabled={saving || selectedMarketIds.length === draftMarkets.length}
              onClick={() =>
                changeInclusion(draftMarkets.map((market) => market.id), true)
              }
              type="button"
            >
              Select all
            </button>
          )}
          {!isReviewing && (
            <button
              className="secondary-button"
              disabled={saving || selectedMarketIds.length === 0}
              onClick={clearSelections}
              type="button"
            >
              Deselect all
            </button>
          )}
          {!isReviewing && (
            <button
              disabled={saving || !isComplete}
              onClick={() => setIsReviewing(true)}
              type="button"
            >
              Review selected
            </button>
          )}
        </div>
      </div>

      {isReviewing && (
        <section className="admin-publish-review">
          <div className="section-heading">
            <h3>Review public markets</h3>
            <span>{selectedMarketIds.length.toLocaleString()} selected</span>
          </div>
          <p>
            {reviewWindowLabel} · Picks lock {reviewLockLabel}
          </p>
          <div className="admin-publish-review-list">
            {selectedGroupedMarkets.map((group) => (
              <div className="admin-market-group" key={group.competitionName}>
                <div className="admin-market-group-heading">
                  <strong>{group.competitionName}</strong>
                  <span>{group.markets.length.toLocaleString()} selected</span>
                </div>
                {group.markets.map((market) => (
                  <MarketSummary key={market.id} market={market} />
                ))}
              </div>
            ))}
          </div>
          <form action={publishSelectedV1Markets} className="review-actions">
            <input name="contestId" type="hidden" value={contestId} />
            {selectedMarketIds.map((marketId) => (
              <input
                key={marketId}
                name="marketIds"
                type="hidden"
                value={marketId}
              />
            ))}
            <button
              className="secondary-button"
              onClick={() => setIsReviewing(false)}
              type="button"
            >
              Keep editing
            </button>
            <PendingSubmitButton pendingLabel="Publishing...">
              Publish contest
            </PendingSubmitButton>
          </form>
        </section>
      )}

      {!isReviewing && (
        <>
          <div
            className="admin-market-view-tabs"
            role="tablist"
            aria-label="Market organization"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "recommended"}
              aria-controls="admin-market-list"
              onClick={() => setView("recommended")}
            >
              Recommended
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "competition"}
              aria-controls="admin-market-list"
              onClick={() => setView("competition")}
            >
              By competition
            </button>
          </div>
          <div
            id="admin-market-list"
            className="admin-market-groups"
            role="tabpanel"
            aria-label={
              view === "recommended" ? "Recommended" : "By competition"
            }
          >
            {view === "recommended" ? (
              <div className="admin-market-selection-list">
                {draftMarkets.map((market) => (
                  <MarketSelectionRow
                    key={market.id}
                    market={market}
                    selected={selectedMarketIds.includes(market.id)}
                    onToggle={toggleMarket}
                    disabled={saving}
                  />
                ))}
              </div>
            ) : (
              groupedMarkets.map((group) => {
                const competition = competitions.find(
                  (item) => item.name === group.competitionName
                );
                return (
                  <section
                    className="admin-market-group"
                    key={group.competitionName}
                  >
                    {competition && (
                      <CompetitionHeading competition={competition} />
                    )}
                    <div className="admin-market-group-heading">
                      <strong>Markets</strong>
                      <span>
                        {
                          group.markets.filter((market) =>
                            selectedMarketIds.includes(market.id)
                          ).length
                        }{" "}
                        / {group.markets.length} included
                      </span>
                    </div>
                    <div className="admin-market-selection-list">
                      {group.markets.map((market) => (
                        <MarketSelectionRow
                          key={market.id}
                          market={market}
                          selected={selectedMarketIds.includes(market.id)}
                          onToggle={toggleMarket}
                          disabled={saving}
                        />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function CompetitionHeading({
  competition,
  showName = true
}: {
  competition: CompetitionPreview;
  showName?: boolean;
}) {
  return (
    <div className="admin-competition-preview">
      {showName && <h3>{competition.name}</h3>}
      <div className="admin-competition-meta">
        <span>
          {competition.location} · {competition.startDate}
          {competition.endDate !== competition.startDate
            ? ` – ${competition.endDate}`
            : ""}
        </span>
        {competition.wcaCompetitionId && (
          <a
            href={`https://www.worldcubeassociation.org/competitions/${competition.wcaCompetitionId}`}
            target="_blank"
            rel="noreferrer"
          >
            WCA details
          </a>
        )}
      </div>
      <p>
        {competition.acceptedCompetitors === null
          ? "Accepted count unavailable"
          : `${competition.acceptedCompetitors.toLocaleString()} accepted`}
        {competition.competitorLimit !== null &&
          ` · ${competition.competitorLimit.toLocaleString()} competitor limit`}
      </p>
      {competition.topRankedCompetitors.length > 0 && (
        <details className="admin-entrants">
          <summary>Top ranked cubers</summary>
          <ul>
            {competition.topRankedCompetitors.map((competitor) => (
              <li key={`${competitor.wcaId}-${competitor.eventId}`}>
                {competitor.name} · {competitor.eventName} #
                {competitor.worldRanking.toLocaleString()}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function MarketSelectionRow({
  market,
  selected,
  onToggle,
  disabled
}: {
  market: AdminPublishMarket;
  selected: boolean;
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`admin-market-select-row${selected ? " is-selected" : ""}`}
    >
      <button className="admin-market-select-control" aria-label={`${selected ? "Exclude" : "Include"} market: ${market.question}`} aria-pressed={selected} disabled={disabled} onClick={() => onToggle(market.id)} type="button">
        {selected ? "Included" : "Excluded"}
      </button>
      <MarketSummary market={market} />
    </div>
  );
}

function MarketSummary({ market }: { market: AdminPublishMarket }) {
  return (
    <span className="admin-market-summary">
      <Link prefetch={false} className="market-detail-link" href={`/markets/${market.slug}`}><WCAEventLabel eventId={market.eventId} fallback={market.eventName} /></Link>
      <Link className="market-competition-label" href={`/competitions/${market.competitionSlug}?contest=${market.contestId}`}>{market.competitionName}</Link>
      <span className="market-matchup-label">{market.category === "HEAD_TO_HEAD" ? "Who places higher?" : market.question}</span>
      <span className="market-matchup-options">
        {market.options.map((option) => (
          <span className="market-matchup-option" key={option.id}>
            <span className="market-competitor-identity">
              <span>{option.label}</span>
              {option.worldRanking && <small title="WCA average world ranking">World #{option.worldRanking}</small>}
            </span>
            <strong className="market-matchup-probability">{option.probability}%</strong>
          </span>
        ))}
      </span>
    </span>
  );
}

function getRankTier(market: AdminPublishMarket) {
  const weakestRank = Math.max(...market.options.map((option) => option.worldRanking ?? Infinity));
  return [100, 250, 500].find((rank) => weakestRank <= rank) ?? Infinity;
}

function groupMarketsByCompetition(markets: AdminPublishMarket[]) {
  const groups = new Map<string, AdminPublishMarket[]>();

  for (const market of markets) {
    const currentMarkets = groups.get(market.competitionName) ?? [];
    currentMarkets.push(market);
    groups.set(market.competitionName, currentMarkets);
  }

  return [...groups.entries()].map(([competitionName, groupedMarkets]) => ({
    competitionName,
    markets: groupedMarkets
  }));
}
