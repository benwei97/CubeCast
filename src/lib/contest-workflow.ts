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
    return "This contest's pick deadline has passed. Generate competitions for a future window.";
  if (previous && previous.lockAt > now)
    return "The current contest is still accepting picks. Publish this contest after those picks lock.";
  if (previous && startsAt <= previous.endsAt)
    return "The next contest must feature competitions after the current contest window.";
  if (competitionCount !== 3 || representedCompetitions !== 3)
    return "Select markets from all three featured competitions.";
  if (selectedCount < requiredPicks || selectedCount > marketCount)
    return `Include at least ${requiredPicks} generated markets so users can complete their entry.`;
  return null;
}
