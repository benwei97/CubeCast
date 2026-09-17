"use client";

import { useMemo, useState } from "react";

import { publishSelectedV1Markets } from "@/app/admin/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getSelectedContestTiming } from "@/lib/contest-workflow";

type AdminMarketOption = {
  id: string;
  label: string;
  probability: number;
  worldRanking?: number | null;
};

export type AdminPublishMarket = {
  competitionName: string;
  eventName: string;
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
  requiredPicks
}: {
  markets: AdminPublishMarket[];
  competitions: CompetitionPreview[];
  contestId: string;
  lockLabel: string;
  windowLabel: string;
  requiredPicks: number;
}) {
  const draftMarkets = useMemo(
    () =>
      markets
        .filter((market) => market.status === "DRAFT")
        .sort(
          (a, b) =>
            (b.recommendationScore ?? -1) - (a.recommendationScore ?? -1)
        ),
    [markets]
  );
  const [selectedMarketIds, setSelectedMarketIds] = useState<string[]>(() =>
    draftMarkets.map((market) => market.id)
  );
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
    setIsReviewing(false);
    setSelectedMarketIds((current) => {
      if (current.includes(marketId)) {
        return current.filter((selectedId) => selectedId !== marketId);
      }

      return [...current, marketId];
    });
  }

  function clearSelections() {
    setIsReviewing(false);
    setSelectedMarketIds([]);
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
              disabled={selectedMarketIds.length === draftMarkets.length}
              onClick={() =>
                setSelectedMarketIds(draftMarkets.map((market) => market.id))
              }
              type="button"
            >
              Select all
            </button>
          )}
          {!isReviewing && (
            <button
              className="secondary-button"
              disabled={selectedMarketIds.length === 0}
              onClick={clearSelections}
              type="button"
            >
              Deselect all
            </button>
          )}
          {!isReviewing && (
            <button
              disabled={!isComplete}
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
  onToggle
}: {
  market: AdminPublishMarket;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      className={`admin-market-select-row${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={() => onToggle(market.id)}
      type="button"
    >
      <span className="admin-market-select-control">
        {selected ? "Included" : "Excluded"}
      </span>
      <MarketSummary market={market} />
    </button>
  );
}

function MarketSummary({ market }: { market: AdminPublishMarket }) {
  return (
    <span className="admin-market-summary">
      <span>{market.options.map((option) => option.label).join(" vs ")}</span>
      <strong>
        {market.options
          .map(
            (option) =>
              `${option.label}${option.worldRanking ? ` (World #${option.worldRanking})` : ""} ${option.probability}%`
          )
          .join(" / ")}
      </strong>
      <small>
        {market.eventName} · {market.competitionName}
      </small>
      {market.options.every((option) => option.worldRanking) && (
        <small>
          {market.options.every((option) => option.worldRanking! <= 25)
            ? "Two top-25 competitors"
            : "Two top-100 competitors"}{" "}
          ·{" "}
          {market.options.map((option) => `${option.probability}%`).join(" / ")}
        </small>
      )}
    </span>
  );
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
