"use client";

import { useState, useTransition } from "react";
import { updateDraftMarketInclusion } from "@/app/admin/actions";

export function DraftMarketInclusion({ contestId, marketId, included, disabled }: {
  contestId: string; marketId: string; included: boolean; disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return <div>
    <button aria-pressed={included} disabled={disabled || pending} className="secondary-button" onClick={() => {
      const data = new FormData();
      data.set("contestId", contestId);
      data.append("marketIds", marketId);
      data.set("included", String(!included));
      setError(null);
      startTransition(async () => {
        try { await updateDraftMarketInclusion(data); }
        catch { setError("Could not save this selection. Reload and try again."); }
      });
    }} type="button">{pending ? "Saving..." : included ? "Exclude from contest" : "Include in contest"}</button>
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
