import { fetchWCAPerson, fetchWCAPersonCompetitions, fetchWCAPersonResults, getWCACompetitionUrl } from "@/lib/wca";
import { formatWCAResult } from "@/lib/market-visibility";

export async function MarketResearch({ wcaId, eventId, name }: { wcaId: string; eventId: string; name: string }) {
  const [profile, results, competitions] = await Promise.allSettled([
    fetchWCAPerson(wcaId), fetchWCAPersonResults(wcaId, eventId), fetchWCAPersonCompetitions(wcaId)
  ]);
  const average = profile.status === "fulfilled" ? profile.value.personal_records?.[eventId]?.average : undefined;
  const competitionMap = new Map(competitions.status === "fulfilled" && Array.isArray(competitions.value) ? competitions.value.map((competition) => [competition.id, competition]) : []);
  const rows = results.status === "fulfilled" && Array.isArray(results.value) ? results.value.filter((row) => row.event_id === eventId && typeof row.round_type_id === "string" && Number.isFinite(row.average) && row.average !== 0 && competitionMap.has(row.competition_id))
    .sort((a, b) => (competitionMap.get(b.competition_id)?.start_date ?? "").localeCompare(competitionMap.get(a.competition_id)?.start_date ?? "") || b.round_type_id.localeCompare(a.round_type_id)).slice(0, 8) : [];
  return <section className="market-research-person">
    <h3><a className="text-link" href={`https://www.worldcubeassociation.org/persons/${encodeURIComponent(wcaId)}`} target="_blank" rel="noreferrer">{name}</a></h3>
    <dl className="market-stat-list">
      <div><dt>Current average world rank</dt><dd>{average?.world_rank ? `#${average.world_rank}` : "Not available"}</dd></div>
      <div><dt>Current personal-best average</dt><dd>{formatWCAResult(average?.best)}</dd></div>
    </dl>
    <h4>Recent official averages</h4>
    {results.status === "rejected" || competitions.status === "rejected" ? <p className="form-error">Some WCA history is unavailable. The forecast has not changed.</p> : null}
    {rows.length ? <div className="research-table-wrap"><table className="research-table"><thead><tr><th>Competition</th><th>Round</th><th>Average</th></tr></thead><tbody>{rows.map((row, index) => {
      const competition = competitionMap.get(row.competition_id)!;
      return <tr key={`${row.competition_id}-${row.round_type_id}-${index}`}><td><a className="text-link" href={getWCACompetitionUrl(row.competition_id)} target="_blank" rel="noreferrer">{competition.name}</a><small>{competition.start_date}</small></td><td>{row.round_type_id === "f" ? "Final" : /^[1-3]$/.test(row.round_type_id) ? `Round ${row.round_type_id}` : row.round_type_id}</td><td>{formatWCAResult(row.average)}</td></tr>;
    })}</tbody></table></div> : <p>No recent averages available.</p>}
  </section>;
}
