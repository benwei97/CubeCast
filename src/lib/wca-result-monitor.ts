import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { fetchWCACompetitionResults, getWCACompetitionUrl } from "@/lib/wca";
import { asMetadata, mergeFirstObservedResults } from "@/lib/wca-result-snapshot";

export const RESULT_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const BATCH_SIZE = 10;

export async function monitorWCAResults(now = new Date()) {
  const competitions = await prisma.competition.findMany({
    where: {
      wcaCompetitionId: { not: null },
      startDate: { lte: now },
      markets: {
        some: {
          status: { in: ["OPEN", "LOCKED", "PENDING_RESULT"] },
          slate: { status: { in: ["OPEN", "LOCKED", "SETTLING"] } }
        }
      }
    },
    orderBy: { startDate: "asc" },
    select: { id: true, wcaCompetitionId: true, sourceMetadata: true }
  });
  let checked = 0;
  const failures: string[] = [];
  const lastChecked = (value: unknown) => {
    const metadata = asMetadata(value);
    return typeof metadata.resultsLastCheckedAt === "string"
      ? Date.parse(metadata.resultsLastCheckedAt) || 0 : 0;
  };
  competitions.sort((a, b) => lastChecked(a.sourceMetadata) - lastChecked(b.sourceMetadata));
  for (const competition of competitions) {
    if (checked >= BATCH_SIZE) break;
    const metadata = asMetadata(competition.sourceMetadata);
    const checkedAt = lastChecked(metadata);
    if (now.getTime() - checkedAt < RESULT_CHECK_INTERVAL_MS) continue;

    // Claim the check before making a network request, including across app instances.
    const claim = await prisma.competition.updateMany({
      where: {
        id: competition.id,
        sourceMetadata: { equals: competition.sourceMetadata ?? Prisma.DbNull }
      },
      data: {
        sourceMetadata: {
          ...metadata,
          resultsLastCheckedAt: now.toISOString()
        } as Prisma.InputJsonObject
      }
    });
    if (!claim.count) continue;
    checked++;
    try {
      const results = await fetchWCACompetitionResults(competition.wcaCompetitionId!);
      if (!Array.isArray(results)) throw new Error("WCA returned an invalid result list.");
      await prisma.$transaction(async (tx) => {
        const current = await tx.competition.findUniqueOrThrow({ where: { id: competition.id } });
        const observedAt = new Date().toISOString();
        const next = mergeFirstObservedResults(asMetadata(current.sourceMetadata), results, observedAt);
        await tx.competition.update({
          where: { id: competition.id },
          data: {
            sourceMetadata: {
              ...next,
              resultsSource: "wca-api-v0",
              resultsSourceUrl: getWCACompetitionUrl(competition.wcaCompetitionId!),
              resultsLastSuccessfulCheckAt: observedAt,
              resultsLastError: null
            } as Prisma.InputJsonObject
          }
        });
      });
    } catch (error) {
      failures.push(competition.wcaCompetitionId!);
      console.error("[WCA results]", competition.wcaCompetitionId, error);
      const current = await prisma.competition.findUniqueOrThrow({ where: { id: competition.id } });
      await prisma.competition.update({
        where: { id: competition.id },
        data: {
          sourceMetadata: {
            ...asMetadata(current.sourceMetadata),
            resultsLastError: error instanceof Error ? error.message : "Result check failed."
          } as Prisma.InputJsonObject
        }
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  return { checked, failures };
}

const worker = globalThis as typeof globalThis & { wcaResultMonitorStarted?: boolean };

export function startWCAResultMonitor() {
  if (worker.wcaResultMonitorStarted) return;
  worker.wcaResultMonitorStarted = true;
  async function tick() {
    try {
      await monitorWCAResults();
    } catch (error) {
      console.error("[WCA result monitor]", error);
    } finally {
      setTimeout(tick, 60_000).unref();
    }
  }
  setTimeout(tick, 1000).unref();
}
