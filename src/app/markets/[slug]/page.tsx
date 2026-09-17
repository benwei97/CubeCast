import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { asMetadata } from "@/lib/wca-result-snapshot";
import { visibleMarkets } from "@/lib/market-visibility";
import { WCAEventLabel } from "@/components/wca-event-label";
import { V1ContestBoard } from "@/components/v1-slate-board";
import { MarketResearch } from "@/components/market-research";
import { DraftMarketInclusion } from "@/components/draft-market-inclusion";

export const dynamic = "force-dynamic";

export default async function MarketPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { slug } = await params;
  const market = await prisma.market.findFirst({
    where: { slug, ...visibleMarkets(session?.user?.role === "ADMIN") },
    include: { competition: true, slate: true, options: { orderBy: { displayOrder: "asc" } }, settlementSnapshots: { orderBy: { settledAt: "desc" } } }
  });
  if (!market || !market.slate) notFound();
  const contest = market.slate;
  const preview = market.publishedAt === null || contest.publishedAt === null;
  const preparation = asMetadata(contest.preparation);
  const recommendation = asMetadata(asMetadata(preparation.recommendations)[market.id]);
  const ranks = asMetadata(recommendation.ranks);
  const entry = session?.user?.id ? await prisma.contestEntry.findUnique({
    where: { userId_slateId: { userId: session.user.id, slateId: contest.id } }, include: { predictions: true }
  }) : null;
  const predictions = entry?.predictions ?? [];
  const ownPick = predictions.find((pick) => pick.marketId === market.id);
  const date = (value: Date) => value.toLocaleString("en-US", { timeZone: "UTC" }) + " UTC";
  return <div className="page-stack market-detail-page">
    <section>
      <Link className="text-link" href={`/competitions/${market.competition.slug}?contest=${contest.id}`}>Back to {market.competition.name}</Link>
      <div className="market-detail-heading"><WCAEventLabel eventId={market.eventId} fallback={market.eventName} /><span className={preview ? "admin-status admin-status-draft" : "status-pill"}>{preview ? "Draft · Admin preview" : market.status.replaceAll("_", " ")}</span></div>
      <h1>{market.category === "HEAD_TO_HEAD" ? "Who places higher?" : market.question}</h1>
      <p className="market-detail-meta">{market.competition.name} · {contest.title}</p>
      <p className="market-detail-meta">{new Date() >= contest.lockAt ? "Picks locked" : "Picks lock"} {date(contest.lockAt)}</p>
      {ownPick && <p className="market-own-pick">Your pick: <strong>{market.options.find((option) => option.id === ownPick.selectedMarketOptionId)?.label}</strong> · {ownPick.resultStatus.replaceAll("_", " ")}{ownPick.scoreChange !== null ? ` · ${ownPick.scoreChange >= 0 ? "+" : ""}${ownPick.scoreChange} points` : ""}</p>}
      {preview ? <>
        <div className="detail-forecast-options">{market.options.map((option) => <div key={option.id}><span>{option.label}</span><strong>{option.probability}%</strong><small>+{100 - option.probability} / −{option.probability} points</small></div>)}</div>
        {contest.status === "DRAFT" && market.status === "DRAFT" && <DraftMarketInclusion contestId={contest.id} marketId={market.id} included={!Array.isArray(preparation.excludedMarketIds) || !preparation.excludedMarketIds.includes(market.id)} disabled={asMetadata(preparation.generationJob).status === "RUNNING"} />}
        <Link className="text-link" href={`/admin?contest=${contest.id}`}>Return to contest review</Link>
      </> : <>
        <p className="market-detail-counter">{predictions.length} / {contest.maxPicks} Picks</p>
        <V1ContestBoard isLocked={contest.status !== "OPEN" || new Date() >= contest.lockAt} isSignedIn={Boolean(session?.user)} pickCount={predictions.length} pickLimit={contest.maxPicks} slateId={contest.id}
          selectedPicks={predictions.map((pick) => ({ marketId: pick.marketId, marketOptionId: pick.selectedMarketOptionId, predictionId: pick.id }))}
          markets={[{ id: market.id, eventId: market.eventId, eventName: market.eventName ?? "Event", category: market.category.replaceAll("_", " "), competitionName: market.competition.name, question: market.question, lockLabel: date(contest.lockAt), status: market.status,
            options: market.options.map((option) => ({ id: option.id, label: option.label, probability: option.probability, sideKey: option.sideKey, worldRanking: typeof ranks[option.competitorWcaId ?? ""] === "number" ? ranks[option.competitorWcaId ?? ""] as number : null })) }]} />
      </>}
    </section>
    {market.eventId && <section className="market-competitor-section"><h2>Competitor stats</h2><div className="market-research-grid">{market.options.filter((option) => option.competitorWcaId).map((option) => <Suspense key={option.id} fallback={<p>Loading stats for {option.label}...</p>}><MarketResearch wcaId={option.competitorWcaId!} eventId={market.eventId!} name={option.label} /></Suspense>)}</div></section>}
    <section className="market-resolution-section"><details><summary>Market rules</summary><p>{market.resolutionRules}</p>
      {market.category === "HEAD_TO_HEAD" && <p>Compare furthest round reached, then official placement in that round. An exact tie awards half the normal positive score to either side. Nonparticipation voids the market; void picks score zero.</p>}
      <p>Results: World Cube Association.</p></details>
      {market.voidReason && <p>Void reason: {market.voidReason}</p>}
      {market.settlementSnapshots.map((snapshot) => <details key={snapshot.id}><summary>Result: {String(asMetadata(snapshot.snapshot).winningMarketOptionLabel ?? asMetadata(snapshot.snapshot).result ?? snapshot.status)}</summary><p>Settled {date(snapshot.settledAt)}</p>{snapshot.sourceUrl && <a className="text-link" href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Official results</a>}{session?.user?.role === "ADMIN" && <details><summary>Settlement evidence</summary><p>Rule {snapshot.ruleVersion} · First observed: {snapshot.observedPublicationAt ? date(snapshot.observedPublicationAt) : "Not recorded"}</p><pre className="settlement-evidence">{JSON.stringify(snapshot.snapshot, null, 2)}</pre></details>}</details>)}
    </section>
  </div>;
}
