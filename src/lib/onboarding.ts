import { prisma } from "@/lib/prisma";
import { makeUsernameCandidate, normalizeUsername } from "@/lib/username";

export const STARTING_BALANCE = 1000;

export async function onboardUser(userId: string, identity?: string | null) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, balance: true }
  });

  if (!existing) {
    throw new Error("Cannot onboard a missing user.");
  }

  const startingTransaction = await prisma.ledgerTransaction.findFirst({
    where: { userId, type: "STARTING_BALANCE" },
    select: { id: true }
  });

  if (startingTransaction) {
    return;
  }

  const baseUsername = makeUsernameCandidate(identity ?? existing.username);

  await prisma.$transaction(async (tx) => {
    let username = baseUsername;
    let suffix = 1;

    while (
      await tx.user.findFirst({
        where: {
          usernameLower: normalizeUsername(username),
          NOT: { id: userId }
        },
        select: { id: true }
      })
    ) {
      const nextSuffix = String(suffix);
      username = `${baseUsername.slice(0, 20 - nextSuffix.length)}${nextSuffix}`;
      suffix += 1;
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        username,
        usernameLower: normalizeUsername(username),
        balance: { increment: STARTING_BALANCE }
      }
    });

    await tx.ledgerTransaction.create({
      data: {
        userId,
        type: "STARTING_BALANCE",
        amount: STARTING_BALANCE,
        balanceAfter: existing.balance + STARTING_BALANCE,
        description: "Starting CubeCoins balance"
      }
    });
  });
}
