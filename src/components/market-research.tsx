import { fetchWCAPerson, fetchWCAPersonCompetitions, fetchWCAPersonResults, getWCACompetitionUrl } from "@/lib/wca";
import { formatWCAResult } from "@/lib/market-visibility";
import { getHistoryRoundLabel, getRecentWCAResults } from "@/lib/wca-person-history";

export async function MarketResearch({ wcaId, eventId, name }: { wcaId: string; eventId: string; name: string }) {
  const [profile, results, competitions] = await Promise.allSettled([
    fetchWCAPerson(wcaId), fetchWCAPersonResults(wcaId, eventId), fetchWCAPersonCompetitions(wcaId)
  ]);
  const average = profile.status === "fulfilled" ? profile.value.personal_records?.[eventId]?.average : undefined;
  const competitionMap = new Map(competitions.status === "fulfilled" && Array.isArray(competitions.value) ? competitions.value.map((competition) => [competition.id, competition]) : []);
  const rows = results.status === "fulfilled" && Array.isArray(results.value)
    ? getRecentWCAResults(results.value, competitionMap, eventId) : [];
  return <section className="market-research-person">
    <h3><a className="text-link" href={`https://www.worldcubeassociation.org/persons/${encodeURIComponent(wcaId)}`} target="_blank" rel="noreferrer">{name}</a></h3>
    <dl className="market-stat-list">
      <div><dt>Average world rank</dt><dd>{average?.world_rank ? `#${average.world_rank}` : "Not available"}</dd></div>
      <div><dt>Personal-best average</dt><dd>{formatWCAResult(average?.best)}</dd></div>
    </dl>
    {profile.status === "rejected" && <p className="form-error">WCA stats could not be loaded. Please try again later.</p>}
    <div className="market-recent-results"><h4>Recent results</h4>
    {results.status === "rejected" || competitions.status === "rejected" ? <p className="form-error">Recent results could not be loaded. Please try again later.</p> : null}
    {rows.length ? <div className="research-table-wrap"><table className="research-table"><thead><tr><th>Competition</th><th>Round</th><th>Average</th></tr></thead><tbody>{rows.map((row, index) => {
      const competition = competitionMap.get(row.competition_id)!;
      return <tr key={`${row.competition_id}-${row.round_type_id}-${index}`}><td><a className="text-link" href={getWCACompetitionUrl(row.competition_id)} target="_blank" rel="noreferrer">{competition.name}</a><small>{competition.start_date}</small></td><td>{getHistoryRoundLabel(row.round_type_id)}</td><td>{row.average === 0 ? "—" : formatWCAResult(row.average)}</td></tr>;
    })}</tbody></table></div> : <p>No recent averages available.</p>}
    </div>
  </section>;
}
