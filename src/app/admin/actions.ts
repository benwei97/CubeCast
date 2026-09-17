"use server";

import {
  CompetitionStatus,
  MarketCategory,
  MarketStatus,
  Prisma,
  UserRole
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { auth } from "@/auth";
import { maintainContestLockState } from "@/lib/contest-maintenance";
import { prisma } from "@/lib/prisma";
import { getWCAEventName as getEventName } from "@/lib/wca-events";
import { getNextTargetWeekend, getTargetWeekend, getWeekendPublicationError, getWeekendSunday, overlapsTargetWeekend } from "@/lib/contest-weekend";
import {
  createEngagingCandidates,
  ENGAGING_MARKET_CONFIG,
  generateEngagingRecommendations
} from "@/lib/engaging-markets";
import {
  CURRENT_CONTEST_ORDER,
  PUBLIC_CONTEST_WHERE,
  getContestPublishError,
  getSelectedContestTiming
} from "@/lib/contest-workflow";
import { asMetadata } from "@/lib/wca-result-snapshot";
import { slugify, withTimestampSuffix } from "@/lib/slug";
import {
  fetchWCACompetitions,
  fetchWCAPublicWCIF,
  getWCACompetitionUrl,
  type WCACompetitionPayload,
  type WCIFPublicPayload
} from "@/lib/wca";
import {
  fetchWCAOddsHeadToHeadProbability,
  WCA_ODDS_DEFAULT_HALF_LIFE_DAYS,
  WCA_ODDS_DEFAULT_LOOKBACK_DAYS,
  WCA_ODDS_REQUEST_SPACING_MS
} from "@/lib/wca-odds";
import {
  resolveV1Market,
  type SettlementSourceEvidence,
  tieV1Market,
  voidV1Market
} from "@/lib/v1-settlement";

const WCA_COMPETITION_PAGE_SIZE = 25;
const WCA_COMPETITION_PAGE_LIMIT = 100;

const updateDiversityConfigSchema = z.object({
  maxPerCompetition: z.coerce.number().int().min(1).max(30),
  maxPerCompetitor: z.coerce.number().int().min(1).max(30),
  maxPerEvent: z.coerce.number().int().min(1).max(30),
  maxPerMarketType: z.coerce.number().int().min(1).max(30),
  slateId: z.string().min(1)
});

const publishSelectedV1MarketsSchema = z.object({
  marketIds: z.array(z.string().min(1)).min(1)
});

const settleV1MarketSchema = z.object({
  marketId: z.string().min(1),
  sourceEvidence: z.string().max(5000).optional(),
  sourceNote: z.string().max(1200).optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  winningMarketOptionId: z.string().min(1)
});

const exceptionalV1SettlementSchema = z.object({
  marketId: z.string().min(1),
  reason: z.string().min(3).max(1200),
  sourceUrl: z.string().url().optional().or(z.literal(""))
});

async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    redirect("/sign-in");
  }

  return session.user;
}

export async function refreshContestLifecycle() {
  await requireAdmin();
  await maintainContestLockState();
  revalidateV1Paths();
  redirect("/admin?lifecycle=refreshed");
}

async function getOrCreateDraft(contestId: string | null, adminUserId: string) {
  if (contestId) {
    const draft = await prisma.contestSlate.findUniqueOrThrow({
      where: { id: contestId }
    });
    if (draft.status !== "DRAFT")
      throw new Error("Published contests cannot be regenerated.");
    return draft;
  }
  const previous = await prisma.contestSlate.findFirst({
    where: PUBLIC_CONTEST_WHERE,
    orderBy: CURRENT_CONTEST_ORDER
  });
  const now = new Date();
  const upcomingWeekend = getNextTargetWeekend(now);
  const startsAt = previous
    ? new Date(Math.max(upcomingWeekend.getTime(), getNextTargetWeekend(previous.endsAt).getTime()))
    : upcomingWeekend;
  const endsAt = getWeekendSunday(startsAt);
  const title = `WCA Contest - ${formatContestDate(startsAt)}`;
  return prisma.contestSlate.create({
    data: {
      title,
      slug: withTimestampSuffix(slugify(title)),
      description:
        "Forecast the outcomes at this contest's featured WCA competitions.",
      startsAt,
      endsAt,
      lockAt: new Date(startsAt.getTime() - 60 * 60 * 1000),
      preparation: {
        windowStart: startsAt.toISOString(),
        windowEnd: endsAt.toISOString(),
        targetWeekend: formatWCADate(startsAt),
        candidateIds: []
      },
      diversityConfig: getDefaultDiversityConfig(),
      adminActions: { create: { actionType: "SLATE_CREATE", adminUserId } }
    }
  });
}

export async function prepareNextContest() {
  const admin = await requireAdmin();
  const current = await prisma.contestSlate.findFirst({
    where: PUBLIC_CONTEST_WHERE,
    orderBy: CURRENT_CONTEST_ORDER
  });
  const drafts = await prisma.contestSlate.findMany({
    where: {
      status: "DRAFT",
      ...(current ? { startsAt: { gt: current.endsAt } } : {})
    },
    orderBy: { createdAt: "desc" }
  });
  const existing = drafts.find((draft) =>
    getTargetWeekend(asMetadata(draft.preparation), new Date()) >= getNextTargetWeekend(new Date())
  );
  const draft = existing ?? (await getOrCreateDraft(null, admin.id));
  redirect(`/admin?contest=${draft.id}`);
}

async function claimDraft(
  tx: Prisma.TransactionClient,
  draft: { id: string; updatedAt: Date }
) {
  const claim = await tx.contestSlate.updateMany({
    where: { id: draft.id, status: "DRAFT", updatedAt: draft.updatedAt },
    data: { updatedAt: new Date() }
  });
  if (!claim.count)
    throw new Error(
      "This draft changed while generating. Reload and try again."
    );
  if (
    await tx.market.count({
      where: { slateId: draft.id, status: { not: "DRAFT" } }
    })
  ) {
    throw new Error("A contest with public markets cannot be regenerated.");
  }
}

export async function generateWeeklyRecommendedContest(formData: FormData) {
  const admin = await requireAdmin();
  const original = await getOrCreateDraft(
    formData.get("contestId")?.toString() ?? null,
    admin.id
  );
  const originalPreparation = asMetadata(original.preparation);
  if (asMetadata(originalPreparation.generationJob).status === "RUNNING") {
    return { contestId: original.id };
  }
  const jobId = randomUUID();
  const targetWeekend = getTargetWeekend(originalPreparation, new Date());
  const claimed = await prisma.contestSlate.updateMany({
    where: { id: original.id, status: "DRAFT", updatedAt: original.updatedAt },
    data: {
      preparation: {
        ...originalPreparation,
        targetWeekend: formatWCADate(targetWeekend),
        windowStart: targetWeekend.toISOString(),
        windowEnd: getWeekendSunday(targetWeekend).toISOString(),
        generationJob: { id: jobId, status: "RUNNING", startedAt: new Date().toISOString() }
      } as Prisma.InputJsonObject
    }
  });
  if (!claimed.count) throw new Error("This contest changed. Reload and try again.");
  const draft = await prisma.contestSlate.findUniqueOrThrow({ where: { id: original.id } });
  after(async () => {
    try {
      await generateContestRecommendations(draft, admin.id, jobId);
    } catch (error) {
      const current = await prisma.contestSlate.findUnique({ where: { id: draft.id } });
      const preparation = asMetadata(current?.preparation);
      const job = asMetadata(preparation.generationJob);
      if (current?.status === "DRAFT" && job.id === jobId && job.status === "RUNNING") {
        console.error("[Contest generation]", draft.id, error);
        await prisma.contestSlate.updateMany({
          where: { id: current.id, updatedAt: current.updatedAt, status: "DRAFT" },
          data: { preparation: {
            ...preparation,
            generationJob: {
              ...job, status: "FAILED", finishedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : "Generation failed. Try again."
            }
          } as Prisma.InputJsonObject }
        });
      }
    }
  });
  revalidateV1Paths();
  return { contestId: draft.id };
}

export async function cancelContestGeneration(formData: FormData) {
  await requireAdmin();
  const contestId = formData.get("contestId")?.toString();
  if (!contestId) throw new Error("Choose a contest first.");
  const draft = await prisma.contestSlate.findUniqueOrThrow({ where: { id: contestId } });
  const preparation = asMetadata(draft.preparation);
  const job = asMetadata(preparation.generationJob);
  if (draft.status === "DRAFT" && job.status === "RUNNING") {
    await prisma.contestSlate.updateMany({
      where: { id: draft.id, status: "DRAFT", updatedAt: draft.updatedAt },
      data: { preparation: {
        ...preparation,
        generationJob: { ...job, status: "CANCELLED", finishedAt: new Date().toISOString() }
      } as Prisma.InputJsonObject }
    });
  }
  revalidateV1Paths();
  return { contestId: draft.id };
}

async function generateContestRecommendations(
  draft: NonNullable<Awaited<ReturnType<typeof getOrCreateDraft>>>,
  adminUserId: string,
  jobId: string
) {
  const assertActive = async () => {
    const current = await prisma.contestSlate.findUnique({ where: { id: draft.id }, select: { status: true, preparation: true } });
    const job = asMetadata(asMetadata(current?.preparation).generationJob);
    if (current?.status !== "DRAFT" || job.id !== jobId || job.status !== "RUNNING") {
      throw new Error("Generation was cancelled or superseded.");
    }
  };
  const preparation = asMetadata(draft.preparation);
  const start = getTargetWeekend(preparation, new Date());
  const end = getWeekendSunday(start);
  const now = new Date();
  let competitions: WCARecommendation[];
  let generated: Awaited<ReturnType<typeof generateEngagingRecommendations>>;
  try {
    await assertActive();
    const upcoming = (
      await fetchAllWCACompetitions({
        start: formatWCADate(now),
        lastStartDate: end
      }, assertActive)
    ).filter(
      (competition) =>
        !competition.cancelled_at &&
        overlapsTargetWeekend(parseWCADate(competition.start_date), parseWCADate(competition.end_date), start) &&
        (parseWCADate(competition.start_date)?.getTime() ?? 0) >
          now.getTime() + 3600000
    );
    await assertActive();
    competitions = await buildWCARecommendations(upcoming, assertActive);
    const candidates = createEngagingCandidates(
      competitions.map(({ competition, wcif }) => ({
        id: competition.id,
        name: competition.name,
        persons: wcif?.persons ?? []
      })),
      ENGAGING_MARKET_CONFIG.rankTiers.at(-1)!
    );
    const modelEndDate = new Date();
    const modelStartDate = new Date(
      modelEndDate.getTime() - WCA_ODDS_DEFAULT_LOOKBACK_DAYS * 86400000
    );
    generated = await generateEngagingRecommendations(
      candidates,
      async (candidate) => {
        await assertActive();
        await sleep(WCA_ODDS_REQUEST_SPACING_MS);
        return getHeadToHeadProbability({
          eventId: candidate.eventId,
          leftCompetitorWcaId: candidate.left.id,
          rightCompetitorWcaId: candidate.right.id,
          modelEndDate,
          modelStartDate
        });
      }
    );
  } catch (error) {
    throw new Error("Could not load WCA data. Existing markets have been preserved. Try again later.", { cause: error });
  }
  await assertActive();
  if (!generated.markets.length)
    throw new Error("No qualifying markets were found for this weekend. Existing markets have been preserved. Try refreshing recommendations later.");
  const featuredIds = new Set(
    generated.markets.map((market) => market.competitionId)
  );
  const featured = competitions.filter(({ competition }) =>
    featuredIds.has(competition.id)
  );
  const startsAt = new Date(
    Math.min(
      ...featured.map(({ competition }) =>
        parseWCADate(competition.start_date)!.getTime()
      )
    )
  );
  const endsAt = new Date(
    Math.max(
      ...featured.map(({ competition }) =>
        (parseWCADate(competition.end_date) ?? startsAt).getTime()
      )
    )
  );
  const lockAt = new Date(startsAt.getTime() - 3600000);
  await prisma.$transaction(
    async (tx) => {
      await claimDraft(tx, draft);
      await tx.market.deleteMany({ where: { slateId: draft.id } });
      await tx.contestCompetition.deleteMany({ where: { slateId: draft.id } });
      const competitionIds = new Map<string, string>();
      for (const recommendation of featured) {
        const competition = await upsertWCACompetitionFromRecommendation(
          tx,
          recommendation
        );
        competitionIds.set(recommendation.competition.id, competition.id);
        await tx.contestCompetition.create({
          data: { slateId: draft.id, competitionId: competition.id }
        });
      }
      const recommendationMetadata: Record<string, Prisma.InputJsonValue> = {};
      const eventNames = new Map(
        featured.flatMap(({ wcif }) => [...getWCIFEventNames(wcif).entries()])
      );
      for (const market of generated.markets) {
        const eventName =
          eventNames.get(market.eventId) ?? getEventName(market.eventId);
        const question = `Who places higher in ${eventName} at ${market.competitionName}?`;
        const created = await tx.market.create({
          data: {
            category: MarketCategory.HEAD_TO_HEAD,
            closeTime: lockAt,
            competitionId: competitionIds.get(market.competitionId)!,
            createdByUserId: adminUserId,
            description:
              "Head-to-head forecast recommended for highly ranked competitors and close WCA Odds probabilities.",
            eventId: market.eventId,
            eventName,
            lockAt,
            question,
            options: {
              create: [
                {
                  competitorWcaId: market.left.id,
                  label: market.left.name,
                  displayOrder: 0,
                  probability: market.probability,
                  sideKey: "YES"
                },
                {
                  competitorWcaId: market.right.id,
                  label: market.right.name,
                  displayOrder: 1,
                  probability: 100 - market.probability,
                  sideKey: "NO"
                }
              ]
            },
            resolutionRules: `Whoever places higher in the specified official WCA event wins. Probability source: WCA Odds simulation, ${WCA_ODDS_DEFAULT_LOOKBACK_DAYS}-day history, ${WCA_ODDS_DEFAULT_HALF_LIFE_DAYS}-day half-life.`,
            resolutionSource: "Official WCA competition results",
            settlementRuleVersion: "v1",
            slateId: draft.id,
            slug: withTimestampSuffix(slugify(question)),
            status: MarketStatus.DRAFT
          },
          select: { id: true }
        });
        recommendationMetadata[created.id] = {
          score: market.score,
          ranks: {
            [market.left.id]: market.left.worldRank,
            [market.right.id]: market.right.worldRank
          }
        };
      }
      await tx.contestSlate.update({
        where: { id: draft.id },
        data: {
          startsAt,
          endsAt,
          lockAt,
          title: `WCA Contest - ${formatContestDate(start)}`,
          preparation: {
            windowStart: start.toISOString(),
            windowEnd: end.toISOString(),
            targetWeekend: formatWCADate(start),
            weekendPolicyVersion: 1,
            generationMethod: "engagement-v1",
            generationJob: {
              id: jobId, status: "COMPLETED",
              startedAt: String(asMetadata(preparation.generationJob).startedAt),
              finishedAt: new Date().toISOString()
            },
            recommendations: recommendationMetadata,
            simulated: generated.simulated,
            unavailable: generated.unavailable,
            outsideProbabilityRange: generated.outsideProbabilityRange,
            candidateCount: generated.candidateCount,
            rankTier: generated.rankTier,
            budgetExhausted: generated.budgetExhausted,
            unavailableRegistrations: competitions.filter(
              (competition) => !competition.wcif
            ).length,
            registrationFailures: competitions.filter((competition) => !competition.wcif).map(({ competition, registrationError }) => ({
              id: competition.id,
              name: competition.name,
              error: registrationError ?? "Registration data unavailable"
            }))
          },
          adminActions: {
            create: {
              actionType: "SLATE_UPDATE",
              adminUserId,
              metadata: {
                operation: "GENERATE_ENGAGING_MARKETS",
                simulated: generated.simulated,
                unavailable: generated.unavailable,
                marketCount: generated.markets.length
              }
            }
          }
        }
      });
    },
    { timeout: 30_000 }
  );
  revalidateV1Paths();
}

export async function updateSlateDiversityConfig(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = updateDiversityConfigSchema.safeParse({
    maxPerCompetition: formData.get("maxPerCompetition"),
    maxPerCompetitor: formData.get("maxPerCompetitor"),
    maxPerEvent: formData.get("maxPerEvent"),
    maxPerMarketType: formData.get("maxPerMarketType"),
    slateId: formData.get("slateId")
  });

  if (!parsed.success) {
    redirect("/admin?v1Slate=invalid-diversity");
  }

  await prisma.contestSlate.update({
    where: { id: parsed.data.slateId },
    data: {
      adminActions: {
        create: {
          actionType: "SLATE_UPDATE",
          adminUserId: admin.id,
          metadata: {
            diversityConfig: {
              maxPerCompetition: parsed.data.maxPerCompetition,
              maxPerCompetitor: parsed.data.maxPerCompetitor,
              maxPerEvent: parsed.data.maxPerEvent,
              maxPerMarketType: parsed.data.maxPerMarketType
            }
          }
        }
      },
      diversityConfig: {
        maxPerCompetition: parsed.data.maxPerCompetition,
        maxPerCompetitor: parsed.data.maxPerCompetitor,
        maxPerEvent: parsed.data.maxPerEvent,
        maxPerMarketType: parsed.data.maxPerMarketType
      }
    }
  });

  revalidatePath("/admin");
  redirect("/admin?v1Slate=diversity-updated");
}

export async function publishSelectedV1Markets(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = publishSelectedV1MarketsSchema.safeParse({
    marketIds: formData.getAll("marketIds")
  });
  if (!parsed.success) redirect("/admin?v1Market=invalid");
  const marketIds = [...new Set(parsed.data.marketIds)];
  const contestId = formData.get("contestId")?.toString();
  if (!contestId) redirect("/admin?v1Market=invalid");
  let error: string | null = null;
  await prisma.$transaction(
    async (tx) => {
      const contest = await tx.contestSlate.findUniqueOrThrow({
        where: { id: contestId },
        include: {
          markets: { include: { options: true } },
          competitions: { include: { competition: true } }
        }
      });
      if (asMetadata(asMetadata(contest.preparation).generationJob).status === "RUNNING") {
        error = "Wait for recommendation generation to finish or cancel it before publishing.";
        return;
      }
      const preparation = asMetadata(contest.preparation);
      const selected = contest.markets.filter((market) =>
        marketIds.includes(market.id)
      );
      const previous = await tx.contestSlate.findFirst({
        where: PUBLIC_CONTEST_WHERE,
        orderBy: CURRENT_CONTEST_ORDER
      });
      const selectedCompetitionIds = [
        ...new Set(selected.map((market) => market.competitionId))
      ];
      if (!selectedCompetitionIds.length) {
        error = "Include at least 10 generated markets before publishing.";
        return;
      }
      const timing = getSelectedContestTiming(
        contest.competitions
          .filter((row) => selectedCompetitionIds.includes(row.competitionId))
          .map(({ competition }) => ({
            startDate: competition.scheduledStartAt ?? competition.startDate,
            endDate: competition.endDate
          }))
      );
      error = getWeekendPublicationError(preparation,
        contest.competitions.filter(({ competition }) => selectedCompetitionIds.includes(competition.id)).map(({ competition }) => competition),
        new Date()
      );
      if (error) return;
      const now = new Date();
      error = getContestPublishError({
        status: contest.status,
        lockAt: timing.lockAt,
        startsAt: timing.startsAt,
        marketCount: contest.markets.length,
        selectedCount: selected.length,
        requiredPicks: contest.maxPicks,
        competitionCount: contest.competitions.length,
        representedCompetitions: new Set(
          selected.map((market) => market.competitionId)
        ).size,
        previous,
        now
      });
      if (error) return;
      const featured = new Set(
        contest.competitions.map((row) => row.competitionId)
      );
      if (
        selected.length !== marketIds.length ||
        contest.markets.some(
          (market) => market.status !== "DRAFT" || market.publishedAt !== null
        ) ||
        selected.some(
          (market) =>
            market.status !== "DRAFT" ||
            market.options.length !== 2 ||
            !featured.has(market.competitionId) ||
            market.options.reduce(
              (sum, option) => sum + option.probability,
              0
            ) !== 100 ||
            market.options.some(
              (option) => option.probability < 35 || option.probability > 65
            )
        )
      )
        throw new Error(
          "Selected markets must be complete draft markets belonging to the featured competitions."
        );
      await tx.market.updateMany({
        where: { id: { in: marketIds }, status: "DRAFT" },
        data: {
          publishedAt: now,
          status: "OPEN",
          lockAt: timing.lockAt,
          closeTime: timing.lockAt
        }
      });
      await tx.market.updateMany({
        where: {
          slateId: contestId,
          id: { notIn: marketIds },
          status: "DRAFT"
        },
        data: { status: "CANCELED" }
      });
      await tx.contestSlate.update({
        where: { id: contestId },
        data: {
          status: "OPEN",
          ...timing,
          publishedAt: now,
          adminActions: {
            create: {
              actionType: "SLATE_UPDATE",
              adminUserId: admin.id,
              metadata: {
                operation: "PUBLISH_CONTEST",
                marketCount: selected.length
              }
            }
          }
        }
      });
      await tx.contestCompetition.deleteMany({
        where: {
          slateId: contestId,
          competitionId: { notIn: selectedCompetitionIds }
        }
      });
      await tx.adminAction.createMany({
        data: selected.map((market) => ({
          actionType: "MARKET_PUBLISH",
          adminUserId: admin.id,
          marketId: market.id,
          slateId: contestId,
          metadata: { publishBatchSize: selected.length }
        }))
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  if (error)
    redirect(
      `/admin?contest=${contestId}&publishError=${encodeURIComponent(error)}`
    );
  revalidateV1Paths();
  redirect(`/admin?contest=${contestId}&v1Market=published`);
}

export async function settleV1Market(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = settleV1MarketSchema.safeParse({
    marketId: formData.get("marketId"),
    sourceEvidence: formData.get("sourceEvidence") || undefined,
    sourceNote: formData.get("sourceNote") || undefined,
    sourceUrl: formData.get("sourceUrl") || undefined,
    winningMarketOptionId: formData.get("winningMarketOptionId")
  });

  if (!parsed.success) {
    redirect("/admin?v1Settlement=invalid");
  }

  const result = await resolveV1Market({
    adminUserId: admin.id,
    marketId: parsed.data.marketId,
    sourceEvidence: parseSettlementSourceEvidence(parsed.data.sourceEvidence),
    sourceNote: parsed.data.sourceNote,
    sourceUrl: parsed.data.sourceUrl || undefined,
    winningMarketOptionId: parsed.data.winningMarketOptionId
  });

  revalidateV1Paths();
  redirect(`/admin?contest=${result.slateId}&v1Settlement=resolved`);
}

export async function settleV1MarketAsTie(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = exceptionalV1SettlementSchema.safeParse({
    marketId: formData.get("marketId"),
    reason: formData.get("reason"),
    sourceUrl: formData.get("sourceUrl") || undefined
  });

  if (!parsed.success) {
    redirect("/admin?v1Settlement=invalid");
  }

  const result = await tieV1Market({
    adminUserId: admin.id,
    marketId: parsed.data.marketId,
    sourceNote: parsed.data.reason,
    sourceUrl: parsed.data.sourceUrl || undefined
  });

  revalidateV1Paths();
  redirect(`/admin?contest=${result.slateId}&v1Settlement=tie`);
}

export async function voidV1MarketAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = exceptionalV1SettlementSchema.safeParse({
    marketId: formData.get("marketId"),
    reason: formData.get("reason"),
    sourceUrl: formData.get("sourceUrl") || undefined
  });

  if (!parsed.success) {
    redirect("/admin?v1Settlement=invalid");
  }

  const result = await voidV1Market({
    adminUserId: admin.id,
    marketId: parsed.data.marketId,
    reason: parsed.data.reason,
    sourceUrl: parsed.data.sourceUrl || undefined
  });

  revalidateV1Paths();
  redirect(`/admin?contest=${result.slateId}&v1Settlement=void`);
}

function revalidateV1Paths() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/picks");
}

function parseSettlementSourceEvidence(
  value: string | undefined
): SettlementSourceEvidence | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as SettlementSourceEvidence;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

function getDefaultDiversityConfig() {
  return {
    maxPerCompetition: 16,
    maxPerCompetitor: 6,
    maxPerEvent: 12,
    maxPerMarketType: 8
  };
}

function parseWCADate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getWCALocation(competition: {
  city?: string;
  country_iso2?: string;
  venue_address?: string;
}) {
  return [competition.city, competition.country_iso2]
    .filter(Boolean)
    .join(", ");
}

function getCompetitionStatus(
  startDate: Date,
  endDate: Date
): CompetitionStatus {
  const now = new Date();

  if (endDate < now) {
    return CompetitionStatus.COMPLETED;
  }

  if (startDate <= now && endDate >= now) {
    return CompetitionStatus.ACTIVE;
  }

  return CompetitionStatus.UPCOMING;
}

type AcceptedWCIFPerson = NonNullable<WCIFPublicPayload["persons"]>[number] & {
  registration: NonNullable<
    NonNullable<WCIFPublicPayload["persons"]>[number]["registration"]
  >;
};

type AcceptedWCIFCompetitor = AcceptedWCIFPerson & {
  wcaId: string;
};

type WCARecommendation = {
  acceptedCompetitors: AcceptedWCIFPerson[];
  competition: WCACompetitionPayload;
  competitorCount: number;
  marketEligibleCompetitors: AcceptedWCIFCompetitor[];
  wcif: WCIFPublicPayload | null;
  registrationError?: string;
};

async function fetchAllWCACompetitions({
  end,
  start,
  lastStartDate
}: {
  end?: string;
  start: string;
  lastStartDate?: Date;
}, assertActive?: () => Promise<void>) {
  const competitions = [];

  for (let page = 1; page <= WCA_COMPETITION_PAGE_LIMIT; page += 1) {
    await assertActive?.();
    const pageCompetitions = await fetchWCACompetitions({
      end,
      page,
      start,
      sort: "start_date,name"
    });

    competitions.push(...pageCompetitions);

    if (pageCompetitions.length < WCA_COMPETITION_PAGE_SIZE || (lastStartDate && pageCompetitions.some((competition) =>
      (parseWCADate(competition.start_date)?.getTime() ?? 0) > lastStartDate.getTime()
    ))) {
      return competitions;
    }
  }

  throw new Error(
    "Competition pagination exceeded its safety limit; refusing to generate from incomplete data."
  );
}

async function buildWCARecommendations(competitions: WCACompetitionPayload[], assertActive?: () => Promise<void>) {
  const recommendations: WCARecommendation[] = [];

  for (const competition of competitions.filter(
    (competition) => !competition.cancelled_at
  )) {
    await assertActive?.();
    const { wcif, registrationError } = await fetchWCIFSafely(competition.id);
    const acceptedCompetitors = getAcceptedCompetitors(wcif);
    const marketEligibleCompetitors = getMarketEligibleCompetitors(wcif);
    const competitorCount =
      acceptedCompetitors.length || competition.competitor_limit || 0;

    recommendations.push({
      acceptedCompetitors,
      competition,
      competitorCount,
      marketEligibleCompetitors,
      wcif,
      registrationError
    });
  }

  return recommendations;
}

async function fetchWCIFSafely(wcaCompetitionId: string) {
  try {
    return { wcif: await fetchWCAPublicWCIF(wcaCompetitionId) };
  } catch (error) {
    console.warn(`Registration fetch failed for ${wcaCompetitionId}`, error);
    return { wcif: null, registrationError: error instanceof Error ? error.message : "Registration request failed" };
  }
}

function getAcceptedCompetitors(wcif: WCIFPublicPayload | null) {
  return (wcif?.persons ?? []).filter(
    (person): person is AcceptedWCIFPerson =>
      person.registration?.status === "accepted" &&
      person.registration.isCompeting !== false
  );
}

function getMarketEligibleCompetitors(wcif: WCIFPublicPayload | null) {
  return getAcceptedCompetitors(wcif).filter(
    (person): person is AcceptedWCIFCompetitor => Boolean(person.wcaId)
  );
}

function getWCIFEventNames(wcif: WCIFPublicPayload | null) {
  return new Map(
    (wcif?.events ?? []).map((event) => [event.id, getEventName(event.id, event.name)])
  );
}

function getTopRankedCompetitors({
  competitors,
  eventNames
}: {
  competitors: AcceptedWCIFCompetitor[];
  eventNames: Map<string, string>;
}) {
  return competitors
    .map((competitor) => {
      const registeredEventIds = new Set(
        competitor.registration.eventIds ?? []
      );
      const bestRanking = competitor.personalBests
        ?.filter(
          (personalBest) =>
            personalBest.type === "average" &&
            personalBest.worldRanking != null &&
            registeredEventIds.has(personalBest.eventId)
        )
        .sort((left, right) => {
          const leftRanking = left.worldRanking ?? Number.POSITIVE_INFINITY;
          const rightRanking = right.worldRanking ?? Number.POSITIVE_INFINITY;

          return leftRanking - rightRanking;
        })[0];

      if (!bestRanking?.worldRanking) {
        return null;
      }

      return {
        eventId: bestRanking.eventId,
        eventName:
          eventNames.get(bestRanking.eventId) ??
          getEventName(bestRanking.eventId),
        name: competitor.name,
        wcaId: competitor.wcaId,
        worldRanking: bestRanking.worldRanking
      };
    })
    .filter(
      (
        competitor
      ): competitor is {
        eventId: string;
        eventName: string;
        name: string;
        wcaId: string;
        worldRanking: number;
      } => Boolean(competitor)
    )
    .sort((left, right) => left.worldRanking - right.worldRanking)
    .slice(0, 5);
}

async function upsertWCACompetitionFromRecommendation(
  tx: Prisma.TransactionClient,
  recommendation: WCARecommendation
) {
  const startDate =
    parseWCADate(recommendation.competition.start_date) ?? new Date();
  const endDate =
    parseWCADate(recommendation.competition.end_date) ?? startDate;
  const metadata = {
    acceptedCompetitorCount: recommendation.acceptedCompetitors.length,
    competitorLimit: recommendation.competition.competitor_limit ?? null,
    generatedAt: new Date().toISOString(),
    recommendationSource: "weekly-wca-recommendation",
    source: "wca-api-v0",
    topRankedCompetitors: getTopRankedCompetitors({
      competitors: recommendation.marketEligibleCompetitors,
      eventNames: getWCIFEventNames(recommendation.wcif)
    }),
    wcaCompetition: recommendation.competition
  };
  const existing = await tx.competition.findUnique({
    where: { wcaCompetitionId: recommendation.competition.id },
    select: { id: true, sourceMetadata: true }
  });

  const data = {
    country: recommendation.competition.country_iso2 ?? "XX",
    description: `Recommended from upcoming WCA competitions with ${recommendation.competitorCount.toLocaleString()} registered or available competitor slots.`,
    endDate,
    location: getWCALocation(recommendation.competition),
    name: recommendation.competition.name,
    officialUrl:
      recommendation.competition.url ??
      getWCACompetitionUrl(recommendation.competition.id),
    scheduledEndAt: endDate,
    scheduledStartAt: startDate,
    sourceMetadata: {
      ...asMetadata(existing?.sourceMetadata),
      ...metadata
    } as Prisma.InputJsonObject,
    startDate,
    status: getCompetitionStatus(startDate, endDate),
    wcaCompetitionId: recommendation.competition.id
  };

  if (existing) {
    return tx.competition.update({
      where: { id: existing.id },
      data,
      select: { id: true, name: true }
    });
  }

  return tx.competition.create({
    data: {
      ...data,
      slug: withTimestampSuffix(slugify(recommendation.competition.name))
    },
    select: { id: true, name: true }
  });
}

async function getHeadToHeadProbability({
  eventId,
  leftCompetitorWcaId,
  modelEndDate,
  modelStartDate,
  rightCompetitorWcaId
}: {
  eventId: string;
  leftCompetitorWcaId: string;
  modelEndDate: Date;
  modelStartDate: Date;
  rightCompetitorWcaId: string;
}): Promise<number | null> {
  try {
    const modelProbability = await fetchWCAOddsHeadToHeadProbability({
      endDate: modelEndDate,
      eventId,
      leftCompetitorWcaId,
      rightCompetitorWcaId,
      startDate: modelStartDate
    });

    if (modelProbability) {
      return modelProbability.leftProbability;
    }
  } catch {
    return null;
  }

  return null;
}

function formatWCADate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatContestDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(date);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
