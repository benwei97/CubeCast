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
import { z } from "zod";

import { auth } from "@/auth";
import { maintainContestLockState } from "@/lib/contest-maintenance";
import { prisma } from "@/lib/prisma";
import {
  CURRENT_CONTEST_ORDER,
  PUBLIC_CONTEST_WHERE,
  getContestPublishError
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
const WCA_COMPETITION_PAGE_LIMIT = 10;
const WCA_RECOMMENDATION_REQUEST_SPACING_MS = 250;
const MARKET_PROBABILITY_MIN = 35;
const MARKET_PROBABILITY_MAX = 65;

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
  const startsAt = previous
    ? new Date(
        Math.max(now.getTime(), previous.endsAt.getTime() + 24 * 60 * 60 * 1000)
      )
    : now;
  const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
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
  const existing = await prisma.contestSlate.findFirst({
    where: {
      status: "DRAFT",
      ...(current ? { startsAt: { gt: current.endsAt } } : {})
    },
    orderBy: { createdAt: "desc" }
  });
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
  const draft = await getOrCreateDraft(
    formData.get("contestId")?.toString() ?? null,
    admin.id
  );
  const preparation = asMetadata(draft.preparation);
  const start =
    typeof preparation.windowStart === "string"
      ? new Date(preparation.windowStart)
      : draft.startsAt;
  const end =
    typeof preparation.windowEnd === "string"
      ? new Date(preparation.windowEnd)
      : new Date(start.getTime() + 7 * 86400000);
  const now = new Date();
  let recommendations: WCARecommendation[];
  try {
    const competitions = await fetchAllWCACompetitions({
      start: formatWCADate(start),
      end: formatWCADate(end)
    });
    recommendations = (await buildWCARecommendations(competitions))
      .filter(
        ({ competition }) =>
          (parseWCADate(competition.start_date)?.getTime() ?? 0) >
          now.getTime() + 3600000
      )
      .sort(
        (a, b) => b.acceptedCompetitors.length - a.acceptedCompetitors.length
      )
      .slice(0, 9);
  } catch {
    redirect(`/admin?contest=${draft.id}&wca=unavailable`);
  }
  if (recommendations.length < 3)
    redirect(`/admin?contest=${draft.id}&wca=no-recommendations`);
  await prisma.$transaction(async (tx) => {
    await claimDraft(tx, draft);
    const candidateIds: string[] = [];
    for (const recommendation of recommendations) {
      const competition = await upsertWCACompetitionFromRecommendation(
        tx,
        recommendation
      );
      candidateIds.push(competition.id);
    }
    await tx.market.deleteMany({ where: { slateId: draft.id } });
    await tx.contestCompetition.deleteMany({ where: { slateId: draft.id } });
    await tx.contestSlate.update({
      where: { id: draft.id },
      data: {
        preparation: {
          windowStart: start.toISOString(),
          windowEnd: end.toISOString(),
          candidateIds
        },
        adminActions: {
          create: {
            actionType: "SLATE_UPDATE",
            adminUserId: admin.id,
            metadata: { operation: "GENERATE_COMPETITIONS", candidateIds }
          }
        }
      }
    });
  });
  revalidateV1Paths();
  redirect(`/admin?contest=${draft.id}&wca=competitions-generated`);
}

export async function generateSelectedCompetitionMarkets(formData: FormData) {
  const admin = await requireAdmin();
  const contestId = formData.get("contestId")?.toString();
  const competitionIds = [
    ...new Set(formData.getAll("competitionIds").map(String))
  ];
  if (!contestId || competitionIds.length !== 3)
    redirect("/admin?wca=invalid-competitions");
  const draft = await getOrCreateDraft(contestId, admin.id);
  const preparation = asMetadata(draft.preparation);
  const allowed = Array.isArray(preparation.candidateIds)
    ? preparation.candidateIds
    : (
        await prisma.contestCompetition.findMany({
          where: { slateId: contestId }
        })
      ).map((row) => row.competitionId);
  if (competitionIds.some((id) => !allowed.includes(id)))
    throw new Error("Choose only suggested competitions for this contest.");
  const competitions = await prisma.competition.findMany({
    where: { id: { in: competitionIds } }
  });
  if (competitions.length !== 3)
    throw new Error("Selected competitions are no longer available.");
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
  const lockAt = new Date(startsAt.getTime() - 3600000);
  if (lockAt <= new Date())
    redirect(`/admin?contest=${contestId}&wca=deadline-passed`);
  const marketsByCompetition = new Map<string, RecommendedMarket[]>();
  try {
    for (const competition of competitions) {
      if (!competition.wcaCompetitionId)
        throw new Error("A WCA competition ID is required.");
      const wcif = await fetchWCAPublicWCIF(competition.wcaCompetitionId);
      marketsByCompetition.set(
        competition.id,
        await buildRecommendedMarkets({
          competitors: getMarketEligibleCompetitors(wcif),
          competitionName: competition.name,
          eventNames: getWCIFEventNames(wcif),
          lockAt
        })
      );
    }
  } catch {
    redirect(`/admin?contest=${contestId}&wca=unavailable`);
  }
  await prisma.$transaction(async (tx) => {
    await claimDraft(tx, draft);
    await tx.market.deleteMany({ where: { slateId: contestId } });
    await tx.contestCompetition.deleteMany({ where: { slateId: contestId } });
    await tx.contestSlate.update({
      where: { id: contestId },
      data: {
        startsAt,
        endsAt,
        lockAt,
        title: `WCA Contest - ${formatContestDate(startsAt)}`,
        competitions: {
          create: competitionIds.map((competitionId) => ({ competitionId }))
        },
        adminActions: {
          create: {
            actionType: "SLATE_UPDATE",
            adminUserId: admin.id,
            metadata: { operation: "GENERATE_MARKETS", competitionIds }
          }
        }
      }
    });
    for (const competition of competitions) {
      for (const market of marketsByCompetition.get(competition.id) ?? []) {
        await tx.market.create({
          data: {
            category: MarketCategory.HEAD_TO_HEAD,
            closeTime: lockAt,
            competitionId: competition.id,
            createdByUserId: admin.id,
            description:
              "Head-to-head forecast based on accepted WCA registrations and WCA Odds probabilities.",
            eventId: market.eventId,
            eventName: market.eventName,
            lockAt,
            options: { create: market.options },
            question: market.question,
            resolutionRules: market.resolutionRules,
            resolutionSource: "Official WCA competition results",
            settlementRuleVersion: "v1",
            slateId: contestId,
            slug: withTimestampSuffix(slugify(market.question)),
            status: MarketStatus.DRAFT
          }
        });
      }
    }
  });
  revalidateV1Paths();
  redirect(`/admin?contest=${contestId}&wca=markets-generated`);
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
          competitions: true
        }
      });
      const selected = contest.markets.filter((market) =>
        marketIds.includes(market.id)
      );
      const previous = await tx.contestSlate.findFirst({
        where: PUBLIC_CONTEST_WHERE,
        orderBy: CURRENT_CONTEST_ORDER
      });
      const now = new Date();
      error = getContestPublishError({
        status: contest.status,
        lockAt: contest.lockAt,
        startsAt: contest.startsAt,
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
        data: { publishedAt: now, status: "OPEN" }
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
};

type RecommendedMarket = {
  eventId: string;
  eventName: string;
  lockAt: Date;
  options: {
    competitorWcaId: string;
    displayOrder: number;
    label: string;
    probability: number;
    sideKey: string;
  }[];
  question: string;
  resolutionRules: string;
};

async function fetchAllWCACompetitions({
  end,
  start
}: {
  end: string;
  start: string;
}) {
  const competitions = [];

  for (let page = 1; page <= WCA_COMPETITION_PAGE_LIMIT; page += 1) {
    const pageCompetitions = await fetchWCACompetitions({
      end,
      page,
      start
    });

    competitions.push(...pageCompetitions);

    if (pageCompetitions.length < WCA_COMPETITION_PAGE_SIZE) {
      break;
    }
  }

  return competitions;
}

async function buildWCARecommendations(competitions: WCACompetitionPayload[]) {
  const recommendations: WCARecommendation[] = [];

  for (const competition of competitions.filter(
    (competition) => !competition.cancelled_at
  )) {
    await sleep(WCA_RECOMMENDATION_REQUEST_SPACING_MS);

    const wcif = await fetchWCIFSafely(competition.id);
    const acceptedCompetitors = getAcceptedCompetitors(wcif);
    const marketEligibleCompetitors = getMarketEligibleCompetitors(wcif);
    const competitorCount =
      acceptedCompetitors.length || competition.competitor_limit || 0;

    recommendations.push({
      acceptedCompetitors,
      competition,
      competitorCount,
      marketEligibleCompetitors,
      wcif
    });
  }

  return recommendations;
}

async function fetchWCIFSafely(wcaCompetitionId: string) {
  try {
    return await fetchWCAPublicWCIF(wcaCompetitionId);
  } catch {
    return null;
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
    (wcif?.events ?? []).map((event) => [event.id, event.name ?? event.id])
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

async function buildRecommendedMarkets({
  competitors,
  competitionName,
  eventNames,
  lockAt
}: {
  competitors: AcceptedWCIFCompetitor[];
  competitionName: string;
  eventNames: Map<string, string>;
  lockAt: Date;
}): Promise<RecommendedMarket[]> {
  const markets: RecommendedMarket[] = [];
  const eventIds = getRecommendedEventIds(competitors);
  const modelEndDate = new Date();
  const modelStartDate = new Date(
    modelEndDate.getTime() -
      WCA_ODDS_DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  );

  for (const eventId of eventIds) {
    const rankedCompetitors = competitors
      .map((competitor) => ({
        competitor,
        personalBest: getAveragePersonalBest(competitor, eventId)
      }))
      .filter(
        (
          entry
        ): entry is {
          competitor: AcceptedWCIFCompetitor;
          personalBest: number;
        } =>
          entry.personalBest !== null &&
          entry.competitor.registration.eventIds?.includes(eventId) === true
      )
      .sort((left, right) => left.personalBest - right.personalBest)
      .slice(0, 16);

    for (let index = 0; index < rankedCompetitors.length - 1; index += 1) {
      const left = rankedCompetitors[index];
      const right = rankedCompetitors[index + 1];
      await sleep(WCA_ODDS_REQUEST_SPACING_MS);

      const modelProbability = await getHeadToHeadProbability({
        eventId,
        leftCompetitorWcaId: left.competitor.wcaId,
        modelEndDate,
        modelStartDate,
        rightCompetitorWcaId: right.competitor.wcaId
      });

      if (!modelProbability || !isTightMarketProbability(modelProbability)) {
        continue;
      }

      const probability = modelProbability;
      const probabilitySourceLabel = `WCA Odds simulation, ${WCA_ODDS_DEFAULT_LOOKBACK_DAYS}-day history, ${WCA_ODDS_DEFAULT_HALF_LIFE_DAYS}-day half-life`;
      const resolutionRules = `Whoever places higher in the specified official WCA event wins. Probability source: ${probabilitySourceLabel}.`;
      const eventName = eventNames.get(eventId) ?? getEventName(eventId);

      markets.push({
        eventId,
        eventName,
        lockAt,
        options: [
          {
            competitorWcaId: left.competitor.wcaId,
            displayOrder: 0,
            label: left.competitor.name,
            probability,
            sideKey: "YES"
          },
          {
            competitorWcaId: right.competitor.wcaId,
            displayOrder: 1,
            label: right.competitor.name,
            probability: 100 - probability,
            sideKey: "NO"
          }
        ],
        question: `Who places higher in ${eventName} at ${competitionName}?`,
        resolutionRules
      });

      if (markets.length >= 10) {
        return markets;
      }
    }
  }

  return markets;
}

function getRecommendedEventIds(competitors: AcceptedWCIFCompetitor[]) {
  const eventCounts = new Map<string, number>();

  for (const competitor of competitors) {
    for (const eventId of competitor.registration.eventIds ?? []) {
      eventCounts.set(eventId, (eventCounts.get(eventId) ?? 0) + 1);
    }
  }

  return [...eventCounts.entries()]
    .filter(([eventId]) =>
      ["222", "333", "333oh", "444", "555"].includes(eventId)
    )
    .sort((left, right) => right[1] - left[1])
    .map(([eventId]) => eventId);
}

function getAveragePersonalBest(
  competitor: AcceptedWCIFCompetitor,
  eventId: string
) {
  const personalBest = competitor.personalBests?.find(
    (best) => best.eventId === eventId && best.type === "average"
  );

  return personalBest?.best ?? null;
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

function isTightMarketProbability(probability: number) {
  return (
    Number.isFinite(probability) &&
    probability >= MARKET_PROBABILITY_MIN &&
    probability <= MARKET_PROBABILITY_MAX
  );
}

function getEventName(eventId: string) {
  const eventNames: Record<string, string> = {
    "222": "2x2",
    "333": "3x3",
    "333oh": "3x3 One-Handed",
    "444": "4x4",
    "555": "5x5"
  };

  return eventNames[eventId] ?? eventId;
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
