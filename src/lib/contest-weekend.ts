const DAY_MS = 86400000;

// WCA competition dates are calendar dates; UTC avoids server-local/DST shifts.
export function getNextTargetWeekend(now: Date) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysUntilSaturday = (6 - day.getUTCDay() + 7) % 7 || 7;
  return new Date(day.getTime() + daysUntilSaturday * DAY_MS);
}

export function getTargetWeekend(preparation: Record<string, unknown>, now: Date) {
  if (typeof preparation.targetWeekend !== "string") return getNextTargetWeekend(now);
  const saturday = new Date(`${preparation.targetWeekend}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(preparation.targetWeekend) ||
    !Number.isFinite(saturday.getTime()) ||
    saturday.toISOString().slice(0, 10) !== preparation.targetWeekend ||
    saturday.getUTCDay() !== 6
  ) throw new Error("The contest target weekend must be a valid Saturday date.");
  return saturday;
}

export function getWeekendSunday(saturday: Date) {
  return new Date(saturday.getTime() + DAY_MS);
}

export function overlapsTargetWeekend(start: Date | null, end: Date | null, saturday: Date) {
  if (!start || !end || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return false;
  return start <= getWeekendSunday(saturday) && end >= saturday;
}

export function getWeekendPublicationError(
  preparation: Record<string, unknown>,
  competitions: { startDate: Date; endDate: Date }[],
  now: Date
) {
  if (preparation.weekendPolicyVersion !== 1 || typeof preparation.targetWeekend !== "string") {
    return "Refresh recommendations to scope this draft to a single target weekend before publishing.";
  }
  const saturday = getTargetWeekend(preparation, now);
  if (competitions.some((competition) =>
    !overlapsTargetWeekend(competition.startDate, competition.endDate, saturday)
  )) return "Every included competition must overlap the contest's target Saturday or Sunday.";
  return null;
}
