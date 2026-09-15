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
import { prisma } from "@/lib/prisma";
import { slugify, withTimestampSuffix } from "@/lib/slug";
import {
  fetchWCACompetition,
  fetchWCACompetitionResults,
  getWCACompetitionUrl
} from "@/lib/wca";
import {
  resolveV1Market,
  type SettlementSourceEvidence,
  tieV1Market,
  voidV1Market
} from "@/lib/v1-settlement";

const createCompetitionSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().min(10).max(1000),
  location: z.string().min(2).max(120),
  country: z.string().min(2).max(2),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.nativeEnum(CompetitionStatus),
  officialUrl: z.string().url().optional().or(z.literal(""))
});

const importWCACompetitionSchema = z.object({
  wcaCompetitionId: z.string().min(3).max(80).regex(/^[A-Za-z0-9_-]+$/)
});

const refreshWCAResultsSchema = z.object({
  competitionId: z.string().min(1)
});

const createMarketSchema = z.object({
  competitionId: z.string().min(1),
  question: z.string().min(8).max(180),
  description: z.string().min(10).max(1000),
  category: z.nativeEnum(MarketCategory),
  closeTime: z.coerce.date(),
  resolutionRules: z.string().min(10).max(1200),
  resolutionSource: z.string().min(3).max(200),
  liquidityParameter: z.coerce.number().int().min(100).max(100000)
});

const createV1SlateSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(1000),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  status: z
    .enum([ContestSlateStatus.DRAFT, ContestSlateStatus.OPEN])
    .default(ContestSlateStatus.DRAFT)
});

const attachSlateCompetitionSchema = z.object({
  competitionId: z.string().min(1),
  slateId: z.string().min(1)
});

const updateDiversityConfigSchema = z.object({
  maxPerCompetition: z.coerce.number().int().min(1).max(30),
  maxPerCompetitor: z.coerce.number().int().min(1).max(30),
  maxPerEvent: z.coerce.number().int().min(1).max(30),
  maxPerMarketType: z.coerce.number().int().min(1).max(30),
  slateId: z.string().min(1)
});

const createV1SlateMarketSchema = z.object({
  category: z.nativeEnum(MarketCategory),
  competitionId: z.string().min(1),
  description: z.string().min(10).max(1000),
  eventId: z.string().min(2).max(20),
  eventName: z.string().min(2).max(80),
  optionALabel: z.string().min(1).max(80),
  optionAProbability: z.coerce.number().int().min(35).max(65),
  optionACompetitorWcaId: z.string().max(20).optional(),
  optionBLabel: z.string().min(1).max(80),
  optionBProbability: z.coerce.number().int().min(35).max(65),
  optionBCompetitorWcaId: z.string().max(20).optional(),
  publishNow: z.string().optional(),
  question: z.string().min(8).max(180),
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

export async function createCompetition(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = createCompetitionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    country: formData.get("country"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    status: formData.get("status"),
    officialUrl: formData.get("officialUrl")
  });

  if (!parsed.success || parsed.data.endDate < parsed.data.startDate) {
    redirect("/admin?competition=invalid");
  }

  const slug = withTimestampSuffix(slugify(parsed.data.name));

  await prisma.competition.create({
    data: {
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      location: parsed.data.location,
      country: parsed.data.country.toUpperCase(),
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      status: parsed.data.status,
      officialUrl: parsed.data.officialUrl || null
    }
  });

  void admin;
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/competitions");
  redirect(`/competitions/${slug}`);
}

export async function importWCACompetition(formData: FormData) {
  await requireAdmin();
  const parsed = importWCACompetitionSchema.safeParse({
    wcaCompetitionId: formData.get("wcaCompetitionId")
  });

  if (!parsed.success) {
    redirect("/admin?wca=invalid");
  }

  const wcaCompetition = await fetchWCACompetition(parsed.data.wcaCompetitionId);
  const startDate = parseWCADate(wcaCompetition.start_date);
  const endDate = parseWCADate(wcaCompetition.end_date) ?? startDate;

  if (!startDate || !endDate) {
    redirect("/admin?wca=missing-dates");
  }

  const existing = await prisma.competition.findUnique({
    where: { wcaCompetitionId: wcaCompetition.id },
    select: { id: true, slug: true }
  });

  const competitionData = {
    country: wcaCompetition.country_iso2 ?? "XX",
    description: `Imported from the WCA competition page for ${wcaCompetition.name}.`,
    endDate,
    location: getWCALocation(wcaCompetition),
    name: wcaCompetition.name,
    officialUrl: wcaCompetition.url ?? getWCACompetitionUrl(wcaCompetition.id),
    scheduledEndAt: endDate,
    scheduledStartAt: startDate,
    sourceMetadata: {
      importedAt: new Date().toISOString(),
      source: "wca-api-v0",
      wcaCompetition
    },
    startDate,
    status: getCompetitionStatus(startDate, endDate),
    wcaCompetitionId: wcaCompetition.id
  };

  const competition = existing
    ? await prisma.competition.update({
        where: { id: existing.id },
        data: competitionData,
        select: { slug: true }
      })
    : await prisma.competition.create({
        data: {
          ...competitionData,
          slug: withTimestampSuffix(slugify(wcaCompetition.name))
        },
        select: { slug: true }
      });

  revalidatePath("/admin");
  revalidatePath("/competitions");
  revalidatePath(`/competitions/${competition.slug}`);
  redirect("/admin?wca=competition-imported");
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

export async function createMarket(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = createMarketSchema.safeParse({
    competitionId: formData.get("competitionId"),
    question: formData.get("question"),
    description: formData.get("description"),
    category: formData.get("category"),
    closeTime: formData.get("closeTime"),
    resolutionRules: formData.get("resolutionRules"),
    resolutionSource: formData.get("resolutionSource"),
    liquidityParameter: formData.get("liquidityParameter")
  });

  if (!parsed.success) {
    redirect("/admin?market=invalid");
  }

  const competition = await prisma.competition.findUnique({
    where: { id: parsed.data.competitionId },
    select: { slug: true }
  });

  if (!competition) {
    redirect("/admin?market=missing-competition");
  }

  const slug = withTimestampSuffix(slugify(parsed.data.question));

  await prisma.market.create({
    data: {
      competitionId: parsed.data.competitionId,
      createdByUserId: admin.id,
      question: parsed.data.question,
      slug,
      description: parsed.data.description,
      category: parsed.data.category,
      resolutionRules: parsed.data.resolutionRules,
      resolutionSource: parsed.data.resolutionSource,
      status: MarketStatus.OPEN,
      closeTime: parsed.data.closeTime,
      liquidityParameter: parsed.data.liquidityParameter
    }
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/competitions");
  revalidatePath(`/competitions/${competition.slug}`);
  redirect(`/markets/${slug}`);
}

export async function createV1Slate(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = createV1SlateSchema.safeParse({
    description: formData.get("description"),
    endsAt: formData.get("endsAt"),
    startsAt: formData.get("startsAt"),
    status: formData.get("status"),
    title: formData.get("title")
  });

  if (!parsed.success || parsed.data.endsAt < parsed.data.startsAt) {
    redirect("/admin?v1Slate=invalid");
  }

  const slug = withTimestampSuffix(slugify(parsed.data.title));
  const lockAt = new Date(parsed.data.startsAt.getTime() - 60 * 60 * 1000);
  const publishedAt =
    parsed.data.status === ContestSlateStatus.OPEN ? new Date() : null;

  await prisma.contestSlate.create({
    data: {
      description: parsed.data.description,
      diversityConfig: getDefaultDiversityConfig(),
      endsAt: parsed.data.endsAt,
      lockAt,
      publishedAt,
      slug,
      startsAt: parsed.data.startsAt,
      status: parsed.data.status,
      title: parsed.data.title,
      adminActions: {
        create: {
          actionType: "SLATE_CREATE",
          adminUserId: admin.id,
          metadata: {
            title: parsed.data.title
          }
        }
      }
    }
  });

  revalidateV1Paths();
  redirect("/admin?v1Slate=created");
}

export async function attachCompetitionToSlate(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = attachSlateCompetitionSchema.safeParse({
    competitionId: formData.get("competitionId"),
    slateId: formData.get("slateId")
  });

  if (!parsed.success) {
    redirect("/admin?v1Slate=invalid-competition");
  }

  await prisma.$transaction(async (tx) => {
    await tx.contestCompetition.upsert({
      where: {
        slateId_competitionId: {
          competitionId: parsed.data.competitionId,
          slateId: parsed.data.slateId
        }
      },
      create: {
        competitionId: parsed.data.competitionId,
        slateId: parsed.data.slateId
      },
      update: {}
    });

    await recomputeSlateWindow(tx, parsed.data.slateId);

    await tx.adminAction.create({
      data: {
        actionType: "SLATE_UPDATE",
        adminUserId: admin.id,
        metadata: {
          attachedCompetitionId: parsed.data.competitionId
        },
        slateId: parsed.data.slateId
      }
    });
  });

  revalidateV1Paths();
  redirect("/admin?v1Slate=competition-attached");
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

export async function createV1SlateMarket(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = createV1SlateMarketSchema.safeParse({
    category: formData.get("category"),
    competitionId: formData.get("competitionId"),
    description: formData.get("description"),
    eventId: formData.get("eventId"),
    eventName: formData.get("eventName"),
    optionACompetitorWcaId: formData.get("optionACompetitorWcaId") || undefined,
    optionALabel: formData.get("optionALabel"),
    optionAProbability: formData.get("optionAProbability"),
    optionBCompetitorWcaId: formData.get("optionBCompetitorWcaId") || undefined,
    optionBLabel: formData.get("optionBLabel"),
    optionBProbability: formData.get("optionBProbability"),
    publishNow: formData.get("publishNow") || undefined,
    question: formData.get("question"),
    slateId: formData.get("slateId")
  });

  if (!parsed.success) {
    redirect("/admin?v1Market=invalid");
  }

  if (parsed.data.optionAProbability + parsed.data.optionBProbability !== 100) {
    redirect("/admin?v1Market=probability-total");
  }

  await prisma.$transaction(async (tx) => {
    const slateCompetition = await tx.contestCompetition.findUnique({
      where: {
        slateId_competitionId: {
          competitionId: parsed.data.competitionId,
          slateId: parsed.data.slateId
        }
      },
      include: {
        slate: {
          select: {
            lockAt: true,
            status: true
          }
        }
      }
    });

    if (!slateCompetition) {
      throw new Error("Competition must be attached to the selected slate.");
    }

    if (
      slateCompetition.slate.status !== ContestSlateStatus.DRAFT &&
      slateCompetition.slate.status !== ContestSlateStatus.OPEN
    ) {
      throw new Error("Only draft or open slates can receive new markets.");
    }

    const publishNow = parsed.data.publishNow === "on";
    const status = publishNow ? MarketStatus.OPEN : MarketStatus.DRAFT;
    const slug = withTimestampSuffix(slugify(parsed.data.question));

    const market = await tx.market.create({
      data: {
        category: parsed.data.category,
        closeTime: slateCompetition.slate.lockAt,
        competitionId: parsed.data.competitionId,
        createdByUserId: admin.id,
        description: parsed.data.description,
        eventId: parsed.data.eventId,
        eventName: parsed.data.eventName,
        lockAt: slateCompetition.slate.lockAt,
        options: {
          create: [
            {
              competitorWcaId: parsed.data.optionACompetitorWcaId || null,
              displayOrder: 0,
              label: parsed.data.optionALabel,
              probability: parsed.data.optionAProbability,
              sideKey: "YES"
            },
            {
              competitorWcaId: parsed.data.optionBCompetitorWcaId || null,
              displayOrder: 1,
              label: parsed.data.optionBLabel,
              probability: parsed.data.optionBProbability,
              sideKey: "NO"
            }
          ]
        },
        publishedAt: publishNow ? new Date() : null,
        question: parsed.data.question,
        resolutionRules:
          "Resolves from first-published official WCA results using CubeCast V1 settlement rules.",
        resolutionSource: "Official WCA competition results",
        settlementRuleVersion: "v1",
        slateId: parsed.data.slateId,
        slug,
        status
      }
    });

    await tx.adminAction.createMany({
      data: [
        {
          actionType: "MARKET_CREATE",
          adminUserId: admin.id,
          marketId: market.id,
          metadata: {
            published: publishNow
          },
          slateId: parsed.data.slateId
        },
        ...(publishNow
          ? [
              {
                actionType: "MARKET_PUBLISH" as const,
                adminUserId: admin.id,
                marketId: market.id,
                metadata: {
                  optionAProbability: parsed.data.optionAProbability,
                  optionBProbability: parsed.data.optionBProbability
                },
                slateId: parsed.data.slateId
              }
            ]
          : [])
      ]
    });
  });

  revalidateV1Paths();
  redirect("/admin?v1Market=created");
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
      throw new Error("Only draft V1 markets can be published.");
    }

    if (market.options.length !== 2) {
      throw new Error("V1 markets must have two outcomes before publishing.");
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

async function recomputeSlateWindow(
  tx: Prisma.TransactionClient,
  slateId: string
) {
  const slateCompetitions = await tx.contestCompetition.findMany({
    where: { slateId },
    include: {
      competition: {
        select: {
          endDate: true,
          scheduledEndAt: true,
          scheduledStartAt: true,
          startDate: true
        }
      }
    }
  });

  if (slateCompetitions.length === 0) {
    return;
  }

  const startsAt = new Date(
    Math.min(
      ...slateCompetitions.map(({ competition }) =>
        (competition.scheduledStartAt ?? competition.startDate).getTime()
      )
    )
  );
  const endsAt = new Date(
    Math.max(
      ...slateCompetitions.map(({ competition }) =>
        (competition.scheduledEndAt ?? competition.endDate).getTime()
      )
    )
  );
  const lockAt = new Date(startsAt.getTime() - 60 * 60 * 1000);

  await tx.contestSlate.update({
    where: { id: slateId },
    data: {
      endsAt,
      lockAt,
      startsAt
    }
  });

  await tx.market.updateMany({
    where: {
      slateId,
      status: { in: [MarketStatus.DRAFT, MarketStatus.OPEN] }
    },
    data: {
      closeTime: lockAt,
      lockAt
    }
  });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
