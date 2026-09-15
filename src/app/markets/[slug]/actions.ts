"use server";

import {
  MarketOutcome,
  UserRole
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buySharesForUser, resolveMarketForAdmin } from "@/lib/trading";

const buySharesSchema = z.object({
  slug: z.string().min(1),
  outcome: z.nativeEnum(MarketOutcome),
  quantity: z.coerce.number().int().min(1).max(100)
});

const resolveMarketSchema = z.object({
  slug: z.string().min(1),
  confirmResolution: z.literal("confirm"),
  outcome: z.enum(["YES", "NO", "CANCELED"])
});

export async function buyShares(formData: FormData) {
  const parsed = buySharesSchema.safeParse({
    slug: formData.get("slug"),
    outcome: formData.get("outcome"),
    quantity: formData.get("quantity")
  });

  if (!parsed.success) {
    redirect("/competitions?trade=invalid");
  }

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/sign-in`);
  }

  const { slug, outcome, quantity } = parsed.data;
  let redirectPath = `/markets/${slug}?trade=success`;

  await prisma.$transaction(async (tx) => {
    const result = await buySharesForUser({
      outcome,
      quantity,
      slug,
      tx,
      userId: session.user.id
    });

    redirectPath =
      result.status === "missing-market"
        ? "/competitions?trade=missing-market"
        : `/markets/${result.marketSlug ?? slug}?trade=${result.status}`;
  });

  revalidatePath("/");
  revalidatePath("/competitions");
  revalidatePath(`/markets/${slug}`);
  revalidatePath("/portfolio");
  revalidatePath("/leaderboard");
  redirect(redirectPath);
}

export async function resolveMarket(formData: FormData) {
  const parsed = resolveMarketSchema.safeParse({
    confirmResolution: formData.get("confirmResolution"),
    slug: formData.get("slug"),
    outcome: formData.get("outcome")
  });

  if (!parsed.success) {
    redirect("/competitions?resolution=invalid");
  }

  const session = await auth();

  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    redirect(`/markets/${parsed.data.slug}?resolution=unauthorized`);
  }

  const { slug, outcome } = parsed.data;
  let redirectPath = `/markets/${slug}?resolution=success`;

  await prisma.$transaction(async (tx) => {
    const result = await resolveMarketForAdmin({
      adminUserId: session.user.id,
      outcome,
      slug,
      tx
    });

    redirectPath =
      result.status === "missing-market"
        ? "/competitions?resolution=missing-market"
        : `/markets/${result.marketSlug ?? slug}?resolution=${result.status}`;
  });

  revalidatePath("/");
  revalidatePath("/competitions");
  revalidatePath(`/markets/${slug}`);
  revalidatePath("/portfolio");
  revalidatePath("/leaderboard");
  redirect(redirectPath);
}
