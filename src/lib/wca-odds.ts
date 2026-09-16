const WCA_ODDS_BASE_URL = getWCAOddsBaseUrl();
const WCA_ODDS_MAX_RETRIES = 2;
const WCA_ODDS_RETRY_BASE_DELAY_MS = 1500;
const WCA_ODDS_TIMEOUT_MS = 30_000;

export const WCA_ODDS_DEFAULT_HALF_LIFE_DAYS = 180;
export const WCA_ODDS_DEFAULT_LOOKBACK_DAYS = 365;

type WCAOddsSimulationResult = {
  competitor_results?: {
    id: string;
    name: string;
    win_chance: number;
  }[];
};

export type WCAOddsHeadToHeadProbability = {
  leftProbability: number;
  rightProbability: number;
  source: "wca-odds";
};

export async function fetchWCAOddsHeadToHeadProbability({
  endDate,
  eventId,
  halfLifeDays = WCA_ODDS_DEFAULT_HALF_LIFE_DAYS,
  leftCompetitorWcaId,
  rightCompetitorWcaId,
  startDate
}: {
  endDate: Date;
  eventId: string;
  halfLifeDays?: number;
  leftCompetitorWcaId: string;
  rightCompetitorWcaId: string;
  startDate: Date;
}): Promise<WCAOddsHeadToHeadProbability | null> {
  const result = await fetchWCAOddsSimulation({
    competitorIds: [leftCompetitorWcaId, rightCompetitorWcaId],
    endDate,
    eventId,
    halfLifeDays,
    startDate
  });

  const left = result.competitor_results?.find(
    (competitor) => competitor.id === leftCompetitorWcaId
  );
  const right = result.competitor_results?.find(
    (competitor) => competitor.id === rightCompetitorWcaId
  );

  if (!left || !right) {
    return null;
  }

  const totalWinChance = left.win_chance + right.win_chance;

  if (
    totalWinChance <= 0 ||
    !Number.isFinite(left.win_chance) ||
    !Number.isFinite(right.win_chance)
  ) {
    return null;
  }

  const leftProbability = Math.round((left.win_chance / totalWinChance) * 100);

  return {
    leftProbability,
    rightProbability: 100 - leftProbability,
    source: "wca-odds"
  };
}

async function fetchWCAOddsSimulation(
  {
    competitorIds,
    endDate,
    eventId,
    halfLifeDays,
    startDate
  }: {
    competitorIds: string[];
    endDate: Date;
    eventId: string;
    halfLifeDays: number;
    startDate: Date;
  },
  attempt = 0
): Promise<WCAOddsSimulationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WCA_ODDS_TIMEOUT_MS);

  try {
    const response = await fetch(`${WCA_ODDS_BASE_URL}/api/simulation`, {
      body: JSON.stringify({
        competitor_ids: competitorIds,
        end_date: formatSimulationDate(endDate),
        entered_times: null,
        event_id: eventId,
        half_life: halfLifeDays,
        include_dnf: false,
        start_date: formatSimulationDate(startDate)
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "CubeCast MVP"
      },
      method: "POST",
      signal: controller.signal
    });

    if (response.status === 429 && attempt < WCA_ODDS_MAX_RETRIES) {
      await sleep(getRetryDelayMs(response, attempt));

      return fetchWCAOddsSimulation(
        { competitorIds, endDate, eventId, halfLifeDays, startDate },
        attempt + 1
      );
    }

    if (!response.ok) {
      throw new Error(
        `WCA Odds request failed with ${response.status} for ${eventId}.`
      );
    }

    return (await response.json()) as WCAOddsSimulationResult;
  } finally {
    clearTimeout(timeout);
  }
}

function formatSimulationDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : null;

  if (retryAfterSeconds && Number.isFinite(retryAfterSeconds)) {
    return retryAfterSeconds * 1000;
  }

  return WCA_ODDS_RETRY_BASE_DELAY_MS * (attempt + 1);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWCAOddsBaseUrl() {
  const configuredBaseUrl = process.env.WCA_ODDS_BASE_URL?.trim().replace(/\/$/, "");

  return configuredBaseUrl || "https://odds.nmckee.org";
}
