import { getServerSession, type AuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";

import { onboardUser } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

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

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers,
  pages: {
    signIn: "/sign-in"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
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
          username: true,
          role: true,
          balance: true
        }
      });

      if (dbUser) {
        session.user.id = dbUser.id;
        session.user.name = dbUser.username;
        session.user.role = dbUser.role;
        session.user.balance = dbUser.balance;
      }

      return session;
    }
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await onboardUser(user.id, user.email ?? user.name);
      }
    }
  }
} satisfies AuthOptions;

export function auth() {
  return getServerSession(authOptions);
}
