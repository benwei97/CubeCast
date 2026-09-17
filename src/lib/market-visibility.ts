import type { Prisma } from "@prisma/client";
import { PUBLIC_CONTEST_WHERE } from "./contest-workflow";

export function visibleMarkets(isAdmin: boolean): Prisma.MarketWhereInput {
  return isAdmin ? {} : {
    publishedAt: { not: null },
    status: { in: ["OPEN", "LOCKED", "PENDING_RESULT", "RESOLVED", "VOID"] },
    slate: { is: { ...PUBLIC_CONTEST_WHERE, publishedAt: { not: null } } }
  };
}

export function formatWCAResult(value: unknown) {
  if (value === -1) return "DNF";
  if (value === -2) return "DNS";
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "Not available";
  return `${(value / 100).toFixed(2)} s`;
}
