"use server";

import {
  CompetitionStatus,
  MarketCategory,
  MarketStatus,
  UserRole
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify, withTimestampSuffix } from "@/lib/slug";

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
