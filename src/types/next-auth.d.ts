import { type UserRole } from "@prisma/client";
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      wcaId: string | null;
      wcaUserId: string | null;
    } & DefaultSession["user"];
  }
}
