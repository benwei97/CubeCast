import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { asMetadata } from "@/lib/wca-result-snapshot";
import { formatWCAResult, visibleMarkets } from "@/lib/market-visibility";
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
  const pbs = asMetadata(recommendation.averagePBs);
  const model = asMetadata(recommendation.model);
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
      <p>{market.competition.name} · {contest.title}</p>
      <p>Picks lock {date(contest.lockAt)}</p>
      {ownPick && <p>Your pick: {market.options.find((option) => option.id === ownPick.selectedMarketOptionId)?.label} · {ownPick.resultStatus}{ownPick.scoreChange !== null ? ` · ${ownPick.scoreChange >= 0 ? "+" : ""}${ownPick.scoreChange} points` : ""}</p>}
      {preview ? <>
        <div className="detail-forecast-options">{market.options.map((option) => <div key={option.id}><span>{option.label}</span><strong>{option.probability}%</strong><small>+{100 - option.probability} / −{option.probability} points</small></div>)}</div>
        {contest.status === "DRAFT" && market.status === "DRAFT" && <DraftMarketInclusion contestId={contest.id} marketId={market.id} included={!Array.isArray(preparation.excludedMarketIds) || !preparation.excludedMarketIds.includes(market.id)} disabled={asMetadata(preparation.generationJob).status === "RUNNING"} />}
        <Link className="text-link" href={`/admin?contest=${contest.id}`}>Return to contest review</Link>
      </> : <>
        <p>{predictions.length} / {contest.maxPicks} Picks</p>
        <V1ContestBoard isLocked={contest.status !== "OPEN" || new Date() >= contest.lockAt} isSignedIn={Boolean(session?.user)} pickCount={predictions.length} pickLimit={contest.maxPicks} slateId={contest.id}
          selectedPicks={predictions.map((pick) => ({ marketId: pick.marketId, marketOptionId: pick.selectedMarketOptionId, predictionId: pick.id }))}
          markets={[{ id: market.id, eventId: market.eventId, eventName: market.eventName ?? "Event", category: market.category.replaceAll("_", " "), competitionName: market.competition.name, question: market.question, lockLabel: date(contest.lockAt), status: market.status,
            options: market.options.map((option) => ({ id: option.id, label: option.label, probability: option.probability, sideKey: option.sideKey, worldRanking: typeof ranks[option.competitorWcaId ?? ""] === "number" ? ranks[option.competitorWcaId ?? ""] as number : null })) }]} />
      </>}
    </section>
    <section><h2>Forecast at generation</h2>
      <p>Rankings and personal bests guide matchup selection; they are not direct probability inputs.</p>
      <div className="research-table-wrap"><table className="research-table"><thead><tr><th>Competitor</th><th>Average world rank at generation</th><th>Personal-best average at generation</th><th>Probability</th></tr></thead><tbody>{market.options.map((option) => <tr key={option.id}><td>{option.label}</td><td>{ranks[option.competitorWcaId ?? ""] ? `#${ranks[option.competitorWcaId ?? ""]}` : "Not recorded"}</td><td>{formatWCAResult(pbs[option.competitorWcaId ?? ""])}</td><td>{option.probability}%</td></tr>)}</tbody></table></div>
      {Object.keys(model).length ? <dl className="market-stat-list">
        <div><dt>Probability source</dt><dd>{String(model.source)}</dd></div>
        <div><dt>Historical solve window</dt><dd>{String(model.historyStart)} – {String(model.historyEnd)}</dd></div>
        <div><dt>Recency half-life</dt><dd>{String(model.halfLifeDays)} days</dd></div>
        <div><dt>Include DNF setting</dt><dd>{model.includeDnf === true ? "Enabled" : "Disabled"}</dd></div>
        <div><dt>Generated</dt><dd>{String(model.generatedAt)}</dd></div>
      </dl> : <p>Exact model settings and personal-best snapshots were not recorded for this older market. Its probability remains fixed.</p>}
    </section>
    {market.eventId && <section><h2>Current WCA context</h2><p>Official round results are supplementary context, not the exact historical solve inputs used by WCA Odds. Cached for up to 30 minutes; newer results do not reprice this forecast.</p><div className="market-research-grid">{market.options.filter((option) => option.competitorWcaId).map((option) => <Suspense key={option.id} fallback={<p>Loading WCA history for {option.label}...</p>}><MarketResearch wcaId={option.competitorWcaId!} eventId={market.eventId!} name={option.label} /></Suspense>)}</div></section>}
    <section><h2>Settlement rules</h2><p>{market.resolutionRules}</p><p>Source: {market.resolutionSource}. Rule version: {market.settlementRuleVersion}.</p>
      {market.category === "HEAD_TO_HEAD" && <p>Compare furthest round reached, then official placement in that round. An exact tie awards half the normal positive score to either side. Nonparticipation voids the market; void picks score zero.</p>}
      {market.voidReason && <p>Void reason: {market.voidReason}</p>}
      {market.settlementSnapshots.map((snapshot) => <details key={snapshot.id}><summary>{String(asMetadata(snapshot.snapshot).result ?? snapshot.status)} · {date(snapshot.settledAt)}</summary><p>Rule {snapshot.ruleVersion} · Outcome: {String(asMetadata(snapshot.snapshot).winningMarketOptionLabel ?? asMetadata(snapshot.snapshot).result ?? snapshot.status)}</p>{snapshot.sourceUrl && <a className="text-link" href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Official source</a>}<p>First observed: {snapshot.observedPublicationAt ? date(snapshot.observedPublicationAt) : "Not recorded"}</p><pre className="settlement-evidence">{JSON.stringify(snapshot.snapshot, null, 2)}</pre></details>)}
    </section>
  </div>;
}
