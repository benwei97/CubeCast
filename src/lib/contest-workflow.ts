import { ContestSlateStatus, type Prisma } from "@prisma/client";

export const PUBLIC_CONTEST_WHERE = {
  status: {
    in: [
      ContestSlateStatus.OPEN,
      ContestSlateStatus.LOCKED,
      ContestSlateStatus.SETTLING,
      ContestSlateStatus.FINALIZED
    ]
  }
} satisfies Prisma.ContestSlateWhereInput;

export const CURRENT_CONTEST_ORDER = [
  { startsAt: "desc" },
  { publishedAt: "desc" },
  { createdAt: "desc" }
] satisfies Prisma.ContestSlateOrderByWithRelationInput[];

export function getContestDisplayStatus(status: string) {
  return status === "DRAFT"
    ? "Draft"
    : status === "FINALIZED"
      ? "Complete"
      : status === "CANCELLED"
        ? "Cancelled"
        : "Active";
}

export function getSelectedContestTiming(
  competitions: { startDate: Date; endDate: Date }[]
) {
  if (!competitions.length)
    throw new Error("Select markets from at least one competition.");
  const startsAt = new Date(
    Math.min(
      ...competitions.map((competition) => competition.startDate.getTime())
    )
  );
  const endsAt = new Date(
    Math.max(
      ...competitions.map((competition) => competition.endDate.getTime())
    )
  );
  return { startsAt, endsAt, lockAt: new Date(startsAt.getTime() - 3600000) };
}

export function getContestPublishError({
  status,
  lockAt,
  startsAt,
  marketCount,
  selectedCount,
  requiredPicks = 10,
  competitionCount,
  representedCompetitions,
  previous,
  now
}: {
  status: string;
  lockAt: Date;
  startsAt: Date;
  marketCount: number;
  selectedCount: number;
  requiredPicks?: number;
  competitionCount: number;
  representedCompetitions: number;
  previous?: { lockAt: Date; endsAt: Date } | null;
  now: Date;
}) {
  if (status !== "DRAFT") return "Only a draft contest can be published.";
  if (lockAt <= now)
    return "This contest's pick deadline has passed. Generate recommended markets for a future window.";
  if (previous && previous.lockAt > now)
    return "The current contest is still accepting picks. Publish this contest after those picks lock.";
  if (previous && startsAt <= previous.endsAt)
    return "The next contest must feature competitions after the current contest window.";
  if (
    competitionCount < 1 ||
    representedCompetitions < 1 ||
    representedCompetitions > competitionCount
  )
    return "Include markets from eligible contest competitions.";
  if (selectedCount < requiredPicks || selectedCount > marketCount)
    return `Include at least ${requiredPicks} generated markets so users can complete their entry.`;
  return null;
}
