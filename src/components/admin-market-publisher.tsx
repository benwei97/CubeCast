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

export function AdminMarketPublisher({
  markets
}: {
  markets: AdminPublishMarket[];
}) {
  const draftMarkets = useMemo(
    () => markets.filter((market) => market.status === "DRAFT"),
    [markets]
  );
  const publishedMarkets = markets.length - draftMarkets.length;
  const publishTarget = Math.min(DEFAULT_MARKET_PUBLISH_TARGET, draftMarkets.length);
  const [selectedMarketIds, setSelectedMarketIds] = useState<string[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);

  const selectedMarkets = useMemo(
    () =>
      selectedMarketIds
        .map((marketId) => draftMarkets.find((market) => market.id === marketId))
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
  const isComplete = publishTarget > 0 && selectedMarketIds.length === publishTarget;

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
      <div className="admin-publish-empty">
        <strong>All generated markets have been published.</strong>
        <span>
          {publishedMarkets.toLocaleString()} markets are available to players.
        </span>
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
            {publishedMarkets.toLocaleString()} already public ·{" "}
            {draftMarkets.length.toLocaleString()} draft markets available
          </span>
        </div>
        <div className="admin-publish-toolbar-actions">
          <button
            className="secondary-button"
            disabled={selectedMarketIds.length === 0}
            onClick={clearSelections}
            type="button"
          >
            Clear
          </button>
          <button
            disabled={!isComplete}
            onClick={() => setIsReviewing(true)}
            type="button"
          >
            Review selected
          </button>
        </div>
      </div>

      {isReviewing && (
        <section className="admin-publish-review">
          <div className="section-heading">
            <h3>Review public markets</h3>
            <span>{selectedMarketIds.length.toLocaleString()} selected</span>
          </div>
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
            {selectedMarketIds.map((marketId) => (
              <input key={marketId} name="marketIds" type="hidden" value={marketId} />
            ))}
            <button
              className="secondary-button"
              onClick={() => setIsReviewing(false)}
              type="button"
            >
              Keep editing
            </button>
            <PendingSubmitButton pendingLabel="Publishing...">
              Publish selected markets
            </PendingSubmitButton>
          </form>
        </section>
      )}

      <div className="admin-market-groups">
        {groupedMarkets.map((group) => (
          <section className="admin-market-group" key={group.competitionName}>
            <div className="admin-market-group-heading">
              <strong>{group.competitionName}</strong>
              <span>{group.markets.length.toLocaleString()} draft markets</span>
            </div>
            <div className="admin-market-selection-list">
              {group.markets.map((market) => {
                const isSelected = selectedMarketIds.includes(market.id);
                const isDisabled = !isSelected && selectedMarketIds.length >= publishTarget;

                return (
                  <button
                    className={`admin-market-select-row${
                      isSelected ? " is-selected" : ""
                    }`}
                    disabled={isDisabled}
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
        ))}
      </div>
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
