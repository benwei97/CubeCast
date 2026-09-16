"use server";

import {
  CompetitionStatus,
  ContestSlateStatus,
  MarketCategory,
  MarketStatus,
  type Prisma,
  UserRole
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { maintainContestLockState } from "@/lib/contest-maintenance";
import { prisma } from "@/lib/prisma";
import { slugify, withTimestampSuffix } from "@/lib/slug";
import {
  fetchWCACompetitions,
  fetchWCACompetitionResults,
  fetchWCAPublicWCIF,
  getWCACompetitionUrl,
  type WCACompetitionPayload,
  type WCIFPublicPayload
} from "@/lib/wca";
import {
  resolveV1Market,
  type SettlementSourceEvidence,
  tieV1Market,
  voidV1Market
} from "@/lib/v1-settlement";

const WCA_COMPETITION_PAGE_SIZE = 25;
const WCA_COMPETITION_PAGE_LIMIT = 10;
const WCA_RECOMMENDATION_REQUEST_SPACING_MS = 250;

const refreshWCAResultsSchema = z.object({
  competitionId: z.string().min(1)
});

const updateDiversityConfigSchema = z.object({
  maxPerCompetition: z.coerce.number().int().min(1).max(30),
  maxPerCompetitor: z.coerce.number().int().min(1).max(30),
  maxPerEvent: z.coerce.number().int().min(1).max(30),
  maxPerMarketType: z.coerce.number().int().min(1).max(30),
  slateId: z.string().min(1)
});

const publishV1MarketSchema = z.object({
  marketId: z.string().min(1)
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

export async function generateWeeklyRecommendedContest() {
  const admin = await requireAdmin();
  const now = new Date();
  const rangeEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const wcaCompetitions = await fetchAllWCACompetitions({
    end: formatWCADate(rangeEnd),
    start: formatWCADate(now)
  });
  const recommendations = (await buildWCARecommendations(wcaCompetitions))
    .filter(({ competition }) => parseWCADate(competition.start_date))
    .sort((left, right) => right.competitorCount - left.competitorCount)
    .slice(0, 3);

  if (recommendations.length === 0) {
    redirect("/admin?wca=no-recommendations");
  }

  const startsAt = new Date(
    Math.min(
      ...recommendations.map(({ competition }) =>
        parseWCADate(competition.start_date)?.getTime() ?? now.getTime()
      )
    )
  );
  const endsAt = new Date(
    Math.max(
      ...recommendations.map(({ competition }) =>
        parseWCADate(competition.end_date)?.getTime() ?? startsAt.getTime()
      )
    )
  );
  const lockAt = new Date(startsAt.getTime() - 60 * 60 * 1000);
  const title = `Weekly WCA Contest - ${formatContestDate(startsAt)}`;

  await prisma.$transaction(async (tx) => {
    const contest = await tx.contestSlate.create({
      data: {
        description:
          "Generated from the largest upcoming WCA competitions. Review and publish selected markets.",
        diversityConfig: getDefaultDiversityConfig(),
        endsAt,
        lockAt,
        slug: withTimestampSuffix(slugify(title)),
        startsAt,
        status: ContestSlateStatus.DRAFT,
        title
      }
    });

    for (const recommendation of recommendations) {
      const competition = await upsertWCACompetitionFromRecommendation(
        tx,
        recommendation
      );

      await tx.contestCompetition.create({
        data: {
          competitionId: competition.id,
          slateId: contest.id
        }
      });

      const markets = buildRecommendedMarkets({
        competitors: recommendation.marketEligibleCompetitors,
        competitionId: competition.id,
        competitionName: competition.name,
        eventNames: getWCIFEventNames(recommendation.wcif),
        lockAt,
        slateId: contest.id
      });

      for (const market of markets) {
        await tx.market.create({
          data: {
            category: MarketCategory.HEAD_TO_HEAD,
            closeTime: lockAt,
            competitionId: market.competitionId,
            createdByUserId: admin.id,
            description:
              "Generated head-to-head market using accepted WCA registrations and personal-best heuristics. Review before publishing.",
            eventId: market.eventId,
            eventName: market.eventName,
            lockAt,
            options: {
              create: market.options
            },
            publishedAt: null,
            question: market.question,
            resolutionRules:
              "Whoever places higher in the specified official WCA event wins.",
            resolutionSource: "Official WCA competition results",
            settlementRuleVersion: "v1",
            slateId: contest.id,
            slug: withTimestampSuffix(slugify(market.question)),
            status: MarketStatus.DRAFT
          }
        });
      }
    }
  });

  revalidateV1Paths();
  revalidatePath("/competitions");
  redirect("/admin?wca=recommendations-generated");
}

export async function refreshWCACompetitionResults(formData: FormData) {
  await requireAdmin();
  const parsed = refreshWCAResultsSchema.safeParse({
    competitionId: formData.get("competitionId")
  });

  if (!parsed.success) {
    redirect("/admin?wca=invalid-results");
  }

  const competition = await prisma.competition.findUnique({
    where: { id: parsed.data.competitionId },
    select: {
      id: true,
      sourceMetadata: true,
      wcaCompetitionId: true
    }
  });

  if (!competition?.wcaCompetitionId) {
    redirect("/admin?wca=missing-wca-id");
  }

  const results = await fetchWCACompetitionResults(competition.wcaCompetitionId);

  await prisma.competition.update({
    where: { id: competition.id },
    data: {
      sourceMetadata: {
        ...(isRecord(competition.sourceMetadata) ? competition.sourceMetadata : {}),
        resultsObservedAt: new Date().toISOString(),
        resultsSnapshot: results,
        resultsSource: "wca-api-v0",
        resultsSourceUrl: getWCACompetitionUrl(competition.wcaCompetitionId),
        resultCount: results.length
      }
    }
  });

  revalidatePath("/admin");
  revalidatePath("/competitions");
  redirect("/admin?wca=results-refreshed");
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

export async function publishV1Market(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = publishV1MarketSchema.safeParse({
    marketId: formData.get("marketId")
  });

  if (!parsed.success) {
    redirect("/admin?v1Market=invalid");
  }

  await prisma.$transaction(async (tx) => {
    const market = await tx.market.findUnique({
      where: { id: parsed.data.marketId },
      select: {
        id: true,
        options: { select: { id: true } },
        slateId: true,
        status: true
      }
    });

    if (!market?.slateId || market.status !== MarketStatus.DRAFT) {
      throw new Error("Only draft markets can be published.");
    }

    if (market.options.length !== 2) {
      throw new Error("Markets must have two outcomes before publishing.");
    }

    await tx.market.update({
      where: { id: market.id },
      data: {
        publishedAt: new Date(),
        status: MarketStatus.OPEN
      }
    });

    await tx.adminAction.create({
      data: {
        actionType: "MARKET_PUBLISH",
        adminUserId: admin.id,
        marketId: market.id,
        metadata: {
          publishedFromDraft: true
        },
        slateId: market.slateId
      }
    });
  });

  revalidateV1Paths();
  redirect("/admin?v1Market=published");
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

  await resolveV1Market({
    adminUserId: admin.id,
    marketId: parsed.data.marketId,
    sourceEvidence: parseSettlementSourceEvidence(parsed.data.sourceEvidence),
    sourceNote: parsed.data.sourceNote,
    sourceUrl: parsed.data.sourceUrl || undefined,
    winningMarketOptionId: parsed.data.winningMarketOptionId
  });

  revalidateV1Paths();
  redirect("/admin?v1Settlement=resolved");
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

  await tieV1Market({
    adminUserId: admin.id,
    marketId: parsed.data.marketId,
    sourceNote: parsed.data.reason,
    sourceUrl: parsed.data.sourceUrl || undefined
  });

  revalidateV1Paths();
  redirect("/admin?v1Settlement=tie");
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

  await voidV1Market({
    adminUserId: admin.id,
    marketId: parsed.data.marketId,
    reason: parsed.data.reason,
    sourceUrl: parsed.data.sourceUrl || undefined
  });

  revalidateV1Paths();
  redirect("/admin?v1Settlement=void");
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
  return [competition.city, competition.country_iso2].filter(Boolean).join(", ");
}

function getCompetitionStatus(startDate: Date, endDate: Date): CompetitionStatus {
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
  registration: NonNullable<NonNullable<WCIFPublicPayload["persons"]>[number]["registration"]>;
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
  return new Map((wcif?.events ?? []).map((event) => [event.id, event.name ?? event.id]));
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
      const registeredEventIds = new Set(competitor.registration.eventIds ?? []);
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
        eventName: eventNames.get(bestRanking.eventId) ?? getEventName(bestRanking.eventId),
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
  const startDate = parseWCADate(recommendation.competition.start_date) ?? new Date();
  const endDate = parseWCADate(recommendation.competition.end_date) ?? startDate;
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
    select: { id: true }
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
    sourceMetadata: metadata,
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

function buildRecommendedMarkets({
  competitors,
  competitionId,
  competitionName,
  eventNames,
  lockAt,
  slateId
}: {
  competitors: AcceptedWCIFCompetitor[];
  competitionId: string;
  competitionName: string;
  eventNames: Map<string, string>;
  lockAt: Date;
  slateId: string;
}) {
  const markets = [];
  const eventIds = getRecommendedEventIds(competitors);

  for (const eventId of eventIds) {
    const rankedCompetitors = competitors
      .map((competitor) => ({
        competitor,
        personalBest: getAveragePersonalBest(competitor, eventId)
      }))
      .filter(
        (entry): entry is { competitor: AcceptedWCIFCompetitor; personalBest: number } =>
          entry.personalBest !== null &&
          entry.competitor.registration.eventIds?.includes(eventId) === true
      )
      .sort((left, right) => left.personalBest - right.personalBest)
      .slice(0, 8);

    for (let index = 0; index < rankedCompetitors.length - 1; index += 2) {
      const left = rankedCompetitors[index];
      const right = rankedCompetitors[index + 1];
      const probability = getHeadToHeadProbability(
        left.personalBest,
        right.personalBest
      );
      const eventName = eventNames.get(eventId) ?? getEventName(eventId);

      markets.push({
        competitionId,
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
        slateId
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
    .filter(([eventId]) => ["222", "333", "333oh", "444", "555"].includes(eventId))
    .sort((left, right) => right[1] - left[1])
    .map(([eventId]) => eventId);
}

function getAveragePersonalBest(competitor: AcceptedWCIFCompetitor, eventId: string) {
  const personalBest = competitor.personalBests?.find(
    (best) => best.eventId === eventId && best.type === "average"
  );

  return personalBest?.best ?? null;
}

function getHeadToHeadProbability(leftBest: number, rightBest: number) {
  if (leftBest <= 0 || rightBest <= 0) {
    return 50;
  }

  const relativeGap = (rightBest - leftBest) / Math.max(leftBest, rightBest);
  const estimatedProbability = Math.round(50 + relativeGap * 80);

  return Math.min(65, Math.max(35, estimatedProbability));
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
