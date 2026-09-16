import { getServerSession, type AuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";

import { onboardUser } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import {
  fetchWCAProfile,
  WCAProvider,
  type WCAProfile
} from "@/lib/wca-provider";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const providers: AuthOptions["providers"] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(rawCredentials) {
      const parsed = credentialsSchema.safeParse(rawCredentials);

      if (!parsed.success) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email }
      });

      if (!user?.passwordHash) {
        return null;
      }

      const isValid = await compare(parsed.data.password, user.passwordHash);

      if (!isValid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.username,
        image: user.image
      };
    }
  })
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET
    })
  );
}

if (process.env.AUTH_WCA_ID && process.env.AUTH_WCA_SECRET) {
  providers.push(
    WCAProvider({
      clientId: process.env.AUTH_WCA_ID,
      clientSecret: process.env.AUTH_WCA_SECRET
    })
  );
}

const prismaAdapter = PrismaAdapter(prisma);

type LinkAccountInput = Parameters<
  NonNullable<NonNullable<AuthOptions["adapter"]>["linkAccount"]>
>[0];

const authAdapter: AuthOptions["adapter"] = {
  ...prismaAdapter,
  async linkAccount(account: LinkAccountInput) {
    await prisma.account.create({
      data: {
        access_token: asOptionalString(account.access_token),
        expires_at: account.expires_at,
        id_token: asOptionalString(account.id_token),
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: asOptionalString(account.refresh_token),
        scope: asOptionalString(account.scope),
        session_state: asOptionalString(account.session_state),
        token_type: asOptionalString(account.token_type),
        type: account.type,
        userId: account.userId
      }
    });
  }
};

export const authOptions = {
  adapter: authAdapter,
  session: { strategy: "jwt" },
  providers,
  pages: {
    signIn: "/sign-in"
  },
  callbacks: {
    async jwt({ account, profile, token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      if (account?.provider === "wca" && user?.id && profile) {
        const existingUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true }
        });

        if (existingUser) {
          await syncWCAIdentity(user.id, profile as unknown as WCAProfile);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.sub || !session.user) {
        return session;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          wcaIdentity: {
            select: {
              name: true,
              wcaId: true,
              wcaUserId: true
            }
          }
        }
      });

      if (dbUser) {
        session.user.id = dbUser.id;
        session.user.name =
          dbUser.wcaIdentity?.name ?? dbUser.name ?? dbUser.username;
        session.user.role = dbUser.role;
        session.user.wcaId = dbUser.wcaIdentity?.wcaId ?? null;
        session.user.wcaUserId = dbUser.wcaIdentity?.wcaUserId ?? null;
      }
      return session;
    }
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await onboardUser(user.id, user.email ?? user.name);
      }
    },
    async linkAccount({ account, user }) {
      if (account.provider === "wca" && user.id) {
        const wcaProfile = await fetchWCAProfile(account.access_token);
        await syncWCAIdentity(user.id, wcaProfile);
      }
    }
  }
} satisfies AuthOptions;

export function auth() {
  return getServerSession(authOptions);
}

async function syncWCAIdentity(userId: string, wcaProfile: WCAProfile) {
  await prisma.wCAIdentity.upsert({
    where: {
      userId
    },
    create: {
      avatarUrl: wcaProfile.avatar?.url ?? wcaProfile.avatar?.thumb_url ?? null,
      countryIso2: wcaProfile.country_iso2 ?? null,
      name: wcaProfile.name,
      profileUrl: wcaProfile.url
        ? new URL(wcaProfile.url, "https://www.worldcubeassociation.org").toString()
        : null,
      rawProfile: wcaProfile,
      userId,
      wcaId: wcaProfile.wca_id ?? null,
      wcaUserId: String(wcaProfile.id)
    },
    update: {
      avatarUrl: wcaProfile.avatar?.url ?? wcaProfile.avatar?.thumb_url ?? null,
      countryIso2: wcaProfile.country_iso2 ?? null,
      name: wcaProfile.name,
      profileUrl: wcaProfile.url
        ? new URL(wcaProfile.url, "https://www.worldcubeassociation.org").toString()
        : null,
      rawProfile: wcaProfile,
      wcaId: wcaProfile.wca_id ?? null,
      wcaUserId: String(wcaProfile.id)
    }
  });
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}
