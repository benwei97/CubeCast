"use client";

import { useState } from "react";
import { generateSelectedCompetitionMarkets } from "@/app/admin/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  CompetitionHeading,
  type CompetitionPreview
} from "@/components/admin-market-publisher";

export function AdminCompetitionSelector({
  contestId,
  competitions,
  selectedIds,
  hasMarkets
}: {
  contestId: string;
  competitions: (CompetitionPreview & { id: string })[];
  selectedIds: string[];
  hasMarkets: boolean;
}) {
  const [selected, setSelected] = useState(selectedIds);
  return (
    <form
      action={generateSelectedCompetitionMarkets}
      className="admin-competition-selector"
    >
      <input name="contestId" type="hidden" value={contestId} />
      <div className="admin-selection-heading">
        <strong>{selected.length} / 3 competitions selected</strong>
        <PendingSubmitButton
          disabled={selected.length !== 3}
          pendingLabel="Generating markets..."
        >
          {hasMarkets ? "Regenerate markets" : "Generate markets"}
        </PendingSubmitButton>
      </div>
      <div className="admin-competition-options">
        {competitions.map((competition) => (
          <section
            className={`admin-competition-option${selected.includes(competition.id) ? " is-selected" : ""}`}
            key={competition.id}
          >
            <label className="admin-competition-check">
              <input
                type="checkbox"
                name="competitionIds"
                value={competition.id}
                checked={selected.includes(competition.id)}
                disabled={
                  !selected.includes(competition.id) && selected.length === 3
                }
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, competition.id]
                      : current.filter((id) => id !== competition.id)
                  )
                }
              />
              <span>{competition.name}</span>
            </label>
            <CompetitionHeading competition={competition} showName={false} />
          </section>
        ))}
      </div>
    </form>
  );
}
