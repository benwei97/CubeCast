"use client";

import { useMemo, useState } from "react";

import { publishSelectedV1Markets } from "@/app/admin/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";

const DEFAULT_MARKET_PUBLISH_TARGET = 25;

type AdminMarketOption = {
  id: string;
  label: string;
  probability: number;
};

export type AdminPublishMarket = {
  competitionName: string;
  eventName: string;
  id: string;
  options: AdminMarketOption[];
  question: string;
  status: string;
};

export type CompetitionPreview = {
  name: string;
  location: string;
  startDate: string;
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
  windowLabel
}: {
  markets: AdminPublishMarket[];
  competitions: CompetitionPreview[];
  contestId: string;
  lockLabel: string;
  windowLabel: string;
}) {
  const draftMarkets = useMemo(
    () => markets.filter((market) => market.status === "DRAFT"),
    [markets]
  );
  const publishTarget = DEFAULT_MARKET_PUBLISH_TARGET;
  const [selectedMarketIds, setSelectedMarketIds] = useState<string[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);

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
  const isComplete =
    selectedMarketIds.length === publishTarget &&
    selectedGroupedMarkets.length === 3;

  function toggleMarket(marketId: string) {
    setIsReviewing(false);
    setSelectedMarketIds((current) => {
      if (current.includes(marketId)) {
        return current.filter((selectedId) => selectedId !== marketId);
      }

      if (current.length >= publishTarget) {
        return current;
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
          <strong>
            {selectedMarketIds.length} / {publishTarget} markets selected
          </strong>
          <span>
            {isReviewing
              ? "Ready to publish"
              : selectedMarketIds.length === publishTarget &&
                  selectedGroupedMarkets.length < 3
                ? "Include markets from all three competitions"
                : "Contest selection"}
          </span>
        </div>
        <div className="admin-publish-toolbar-actions">
          {!isReviewing && (
            <button
              className="secondary-button"
              disabled={selectedMarketIds.length === 0}
              onClick={clearSelections}
              type="button"
            >
              Clear
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
            {windowLabel} · Picks lock {lockLabel}
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
        <div className="admin-market-groups">
          {competitions
            .filter(
              (competition) =>
                !groupedMarkets.some(
                  (group) => group.competitionName === competition.name
                )
            )
            .map((competition) => (
              <section className="admin-market-group" key={competition.name}>
                <CompetitionHeading competition={competition} />
                <p className="empty-state">
                  No draft markets available for this competition.
                </p>
              </section>
            ))}
          {groupedMarkets.map((group) => {
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
                  <strong>
                    {competition ? "Markets" : group.competitionName}
                  </strong>
                  <span>
                    {
                      group.markets.filter((market) =>
                        selectedMarketIds.includes(market.id)
                      ).length
                    }{" "}
                    / {group.markets.length} selected
                  </span>
                </div>
                <div className="admin-market-selection-list">
                  {group.markets.map((market) => {
                    const isSelected = selectedMarketIds.includes(market.id);
                    const isDisabled =
                      !isSelected && selectedMarketIds.length >= publishTarget;

                    return (
                      <button
                        className={`admin-market-select-row${
                          isSelected ? " is-selected" : ""
                        }`}
                        disabled={isDisabled}
                        aria-pressed={isSelected}
                        key={market.id}
                        onClick={() => toggleMarket(market.id)}
                        type="button"
                      >
                        <span className="admin-market-select-control">
                          {isSelected ? "Selected" : "Select"}
                        </span>
                        <MarketSummary market={market} />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
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

function MarketSummary({ market }: { market: AdminPublishMarket }) {
  return (
    <span className="admin-market-summary">
      <span>
        {market.eventName} · {market.question}
      </span>
      <strong>
        {market.options
          .map((option) => `${option.label} ${option.probability}%`)
          .join(" / ")}
      </strong>
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
