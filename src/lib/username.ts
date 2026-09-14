import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[A-Za-z0-9_]+$/, "Use letters, numbers, and underscores only.");

export function normalizeUsername(username: string) {
  return username.toLowerCase();
}

export function makeUsernameCandidate(input?: string | null) {
  const base = (input ?? "cuber")
    .replace(/@.*$/, "")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 14);

  return usernameSchema.safeParse(base).success ? base : "cuber";
}
