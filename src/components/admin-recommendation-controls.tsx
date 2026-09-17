"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelContestGeneration, generateWeeklyRecommendedContest } from "@/app/admin/actions";

export function AdminRecommendationControls({
  contestId,
  label,
  className,
  running = false
}: {
  contestId?: string;
  label: string;
  className?: string;
  running?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [running, router]);

  const submit = (cancel = false) => {
    const data = new FormData();
    if (contestId) data.set("contestId", contestId);
    setError(null);
    startTransition(async () => {
      try {
        const result = await (cancel ? cancelContestGeneration(data) : generateWeeklyRecommendedContest(data));
        router.replace(`/admin?contest=${encodeURIComponent(result.contestId)}`);
        router.refresh();
      } catch {
        setError("Could not reach the server. Reload to check whether generation started before trying again.");
      }
    });
  };

  return (
    <div>
      {running ? (
        <>
          <p role="status">Finding competitions and calculating odds...</p>
          <button className="secondary-button" disabled={pending} onClick={() => submit(true)} type="button">
            {pending ? "Cancelling..." : "Cancel generation"}
          </button>
        </>
      ) : (
        <button className={className} disabled={pending} onClick={() => submit()} type="button">
          {pending ? "Starting generation..." : label}
        </button>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
