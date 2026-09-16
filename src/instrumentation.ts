export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    !process.env.VERCEL
  ) {
    const { startWCAResultMonitor } = await import("@/lib/wca-result-monitor");
    startWCAResultMonitor();
  }
}
