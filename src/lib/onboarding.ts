import { prisma } from "@/lib/prisma";
import { makeUsernameCandidate, normalizeUsername } from "@/lib/username";

export async function onboardUser(userId: string, identity?: string | null) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true }
  });

  if (!existing) {
    throw new Error("Cannot onboard a missing user.");
  }

  const baseUsername = makeUsernameCandidate(identity ?? existing.username);

  let username = baseUsername;
  let suffix = 1;

  while (
    await prisma.user.findFirst({
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      username,
      usernameLower: normalizeUsername(username)
    }
  });
}
