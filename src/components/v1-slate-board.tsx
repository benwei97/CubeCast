"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  removePrediction,
  selectPrediction
} from "@/app/picks/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { WCAEventLabel } from "@/components/wca-event-label";

type ContestMarketOption = {
  id: string;
  label: string;
  probability: number;
  sideKey: string;
  worldRanking?: number | null;
};

type ContestMarket = {
  slug?: string;
  competitionSlug?: string;
  category: string;
  competitionName: string;
  eventName: string;
  eventId?: string | null;
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
                {market.slug ? <Link prefetch={false} className="market-detail-link" href={`/markets/${market.slug}`}><WCAEventLabel eventId={market.eventId} fallback={market.eventName} /></Link> : <WCAEventLabel eventId={market.eventId} fallback={market.eventName} />}
                {market.competitionSlug ? <Link className="market-competition-label" href={`/competitions/${market.competitionSlug}?contest=${slateId}`}>{market.competitionName}</Link> : <span>{market.competitionName}</span>}
                <strong>{market.category === "HEAD TO HEAD" ? "Who places higher?" : market.question}</strong>
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
                    {option.worldRanking && <small className="competitor-world-rank" title="WCA average world ranking">World #{option.worldRanking}</small>}
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
          isLocked={isLocked || pendingSelection.market.status !== "OPEN"}
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
  isLocked,
  isSignedIn,
  onClose,
  pickCount,
  pickLimit,
  selectedPick,
  selection,
  slateId
}: {
  isLocked: boolean;
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
  const [error, setError] = useState<string | null>(null);
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
          <WCAEventLabel eventId={selection.market.eventId} fallback={selection.market.eventName} />
          <strong>{selection.market.question}</strong>
          <span>
            Locks {selection.market.lockLabel}
          </span>
        </div>

        <div className="pick-review-side">
          <span>{selection.option.label}</span>
          <strong>
            {selection.option.probability}%
          </strong>
          <small>{formatScoreSwing(selection.option.probability)}</small>
        </div>

        {isSignedIn ? (
          <>
            {(error || isLocked) && <p className="form-error" role="alert">{error ?? "This contest is locked. Picks can no longer be changed."}</p>}
            <p className="pick-review-copy">
              {isChangingExistingPick
                ? "This changes your pick for this market."
                : `This adds pick ${nextPickCount} of ${pickLimit}.`}{" "}
              You can edit picks until the contest locks.
            </p>

            <div className="review-actions">
              {selectedPick && (
                <form action={async (data) => {
                  setError(null);
                  try { await removePrediction(data); onClose(); }
                  catch { setError("Could not remove this pick. The contest may have locked; refresh to check its status."); }
                }}>
                  <input
                    name="predictionId"
                    type="hidden"
                    value={selectedPick.predictionId}
                  />
                  <PendingSubmitButton
                    className="secondary-button"
                    pendingLabel="Removing..."
                    disabled={isLocked}
                  >
                    Remove
                  </PendingSubmitButton>
                </form>
              )}

              <form action={async (data) => {
                setError(null);
                try {
                  const result = await selectPrediction(data);
                  if (result.error) setError(result.error);
                  else onClose();
                } catch {
                  setError("Could not save this pick. Please refresh and try again.");
                }
              }}>
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
                  disabled={isLocked}
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
