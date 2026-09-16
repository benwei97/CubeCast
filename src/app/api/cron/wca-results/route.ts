import { timingSafeEqual } from "node:crypto";
import { monitorWCAResults } from "@/lib/wca-result-monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Result scheduler is not configured." }, { status: 503 });
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await monitorWCAResults();
  return Response.json(result, { status: result.failures.length ? 502 : 200 });
}
