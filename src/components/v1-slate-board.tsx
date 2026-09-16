"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  removePrediction,
  selectPrediction
} from "@/app/picks/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";

type ContestMarketOption = {
  id: string;
  label: string;
  probability: number;
  sideKey: string;
};

type ContestMarket = {
  category: string;
  competitionName: string;
  eventName: string;
  id: string;
  lockLabel: string;
  options: ContestMarketOption[];
  question: string;
  status: string;
};

type SelectedPick = {
  marketId: string;
  marketOptionId: string;
  predictionId: string;
};

type PendingSelection = {
  market: ContestMarket;
  option: ContestMarketOption;
};

export function V1ContestBoard({
  isLocked,
  isSignedIn,
  markets,
  pickCount,
  pickLimit,
  selectedPicks,
  slateId
}: {
  isLocked: boolean;
  isSignedIn: boolean;
  markets: ContestMarket[];
  pickCount: number;
  pickLimit: number;
  selectedPicks: SelectedPick[];
  slateId: string;
}) {
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);

  const selectedPickByMarket = useMemo(
    () =>
      new Map(
        selectedPicks.map((pick) => [
          pick.marketId,
          {
            marketOptionId: pick.marketOptionId,
            predictionId: pick.predictionId
          }
        ])
      ),
    [selectedPicks]
  );

  return (
    <>
      <div className="slate-market-board">
        <div className="slate-market-header" aria-hidden="true">
          <span>Market</span>
          <span>Pick A</span>
          <span>Pick B</span>
        </div>

        {markets.map((market) => {
          const selectedPick = selectedPickByMarket.get(market.id);

          return (
            <article className="slate-market-row" key={market.id}>
              <div className="slate-market-main">
                <span>
                  {market.competitionName} · {market.eventName}
                </span>
                <strong>{market.question}</strong>
                <small>{market.category} · Locks {market.lockLabel}</small>
              </div>

              {market.options.map((option) => {
                const isSelected = selectedPick?.marketOptionId === option.id;
                const isDisabled =
                  isLocked ||
                  market.status !== "OPEN" ||
                  (!isSelected && pickCount >= pickLimit && !selectedPick);

                return (
                  <button
                    className={`pick-option-button ${
                      option.sideKey === "YES" ? "yes-pick" : "no-pick"
                    }${isSelected ? " is-selected" : ""}`}
                    disabled={isDisabled}
                    key={option.id}
                    onClick={() => setPendingSelection({ market, option })}
                    type="button"
                  >
                    <span>{option.label}</span>
                    <strong>{option.probability}%</strong>
                    <small>{formatScoreSwing(option.probability)}</small>
                    {market.status !== "OPEN" && <em>{market.status}</em>}
                  </button>
                );
              })}
            </article>
          );
        })}
      </div>

      {pendingSelection && (
        <PickReviewModal
          isSignedIn={isSignedIn}
          onClose={() => setPendingSelection(null)}
          pickCount={pickCount}
          pickLimit={pickLimit}
          selectedPick={selectedPickByMarket.get(pendingSelection.market.id)}
          selection={pendingSelection}
          slateId={slateId}
        />
      )}
    </>
  );
}

function PickReviewModal({
  isSignedIn,
  onClose,
  pickCount,
  pickLimit,
  selectedPick,
  selection,
  slateId
}: {
  isSignedIn: boolean;
  onClose: () => void;
  pickCount: number;
  pickLimit: number;
  selectedPick?: {
    marketOptionId: string;
    predictionId: string;
  };
  selection: PendingSelection;
  slateId: string;
}) {
  const isChangingExistingPick = Boolean(selectedPick);
  const nextPickCount = isChangingExistingPick ? pickCount : pickCount + 1;
  const isSameSelection = selectedPick?.marketOptionId === selection.option.id;

  return (
    <div
      aria-labelledby="pick-review-title"
      aria-modal="true"
      className="modal-backdrop"
      role="dialog"
    >
      <div className="pick-review-modal">
        <div className="modal-header">
          <div>
            <span>{selection.market.competitionName}</span>
            <h2 id="pick-review-title">Review pick</h2>
          </div>
          <button
            aria-label="Close pick review"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="pick-review-market">
          <strong>{selection.market.question}</strong>
          <span>
            {selection.market.eventName} · Locks {selection.market.lockLabel}
          </span>
        </div>

        <div className="pick-review-side">
          <span>{selection.option.label}</span>
          <strong>
            {selection.option.probability}% · {selection.option.probability}¢
          </strong>
          <small>{formatScoreSwing(selection.option.probability)}</small>
        </div>

        {isSignedIn ? (
          <>
            <p className="pick-review-copy">
              {isChangingExistingPick
                ? "This changes your pick for this market."
                : `This adds pick ${nextPickCount} of ${pickLimit}.`}{" "}
              You can edit picks until the contest locks.
            </p>

            <div className="review-actions">
              {selectedPick && (
                <form action={removePrediction}>
                  <input
                    name="predictionId"
                    type="hidden"
                    value={selectedPick.predictionId}
                  />
                  <PendingSubmitButton
                    className="secondary-button"
                    pendingLabel="Removing..."
                  >
                    Remove
                  </PendingSubmitButton>
                </form>
              )}

              <form action={selectPrediction}>
                <input name="slateId" type="hidden" value={slateId} />
                <input
                  name="marketId"
                  type="hidden"
                  value={selection.market.id}
                />
                <input
                  name="marketOptionId"
                  type="hidden"
                  value={selection.option.id}
                />
                <PendingSubmitButton
                  pendingLabel={isChangingExistingPick ? "Changing..." : "Adding..."}
                >
                  {isSameSelection
                    ? "Keep pick"
                    : isChangingExistingPick
                      ? "Change pick"
                      : "Add pick"}
                </PendingSubmitButton>
              </form>
            </div>
          </>
        ) : (
          <div className="signed-out-trade">
            <p>Sign in to choose 10 picks for this contest.</p>
            <Link className="button-link" href="/sign-in">
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function formatScoreSwing(probability: number) {
  return `+${100 - probability} / -${probability}`;
}
