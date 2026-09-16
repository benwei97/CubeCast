const WCA_BASE_URL = getWCABaseUrl();
const WCA_MAX_RETRIES = 3;
const WCA_RETRY_BASE_DELAY_MS = 1500;

export type WCACompetitionPayload = {
  city?: string;
  cancelled_at?: string | null;
  competitor_limit?: number | null;
  country_iso2?: string;
  end_date?: string;
  event_ids?: string[];
  id: string;
  name: string;
  start_date?: string;
  url?: string;
  venue_address?: string;
};

export type WCACompetitionResultPayload = {
  event_id?: string;
  round_type_id?: string;
  round?: {
    id?: string;
    name?: string;
  };
  person?: {
    id?: string | null;
    name?: string;
    wca_id?: string | null;
  };
  person_id?: string | null;
  person_name?: string;
  pos?: number;
  ranking?: number;
  best?: number;
  average?: number;
};

export type WCIFPublicPayload = {
  events?: {
    id: string;
    name?: string;
  }[];
  persons?: {
    countryIso2?: string;
    name: string;
    personalBests?: {
      best: number;
      eventId: string;
      type: "average" | "single";
      worldRanking?: number | null;
    }[];
    registration?: {
      eventIds?: string[];
      isCompeting?: boolean;
      status?: string;
    };
    wcaId?: string | null;
  }[];
};

export async function fetchWCACompetition(wcaCompetitionId: string) {
  return fetchWCAJson<WCACompetitionPayload>(
    `/api/v0/competitions/${encodeURIComponent(wcaCompetitionId)}`
  );
}

export async function fetchWCACompetitions({
  end,
  page,
  start
}: {
  end: string;
  page?: number;
  start: string;
}) {
  const params = new URLSearchParams({
    end,
    start
  });

  if (page) {
    params.set("page", page.toString());
  }

  return fetchWCAJson<WCACompetitionPayload[]>(
    `/api/v0/competitions?${params.toString()}`
  );
}

export async function fetchWCACompetitionResults(wcaCompetitionId: string) {
  return fetchWCAJson<WCACompetitionResultPayload[]>(
    `/api/v0/competitions/${encodeURIComponent(wcaCompetitionId)}/results`
  );
}

export async function fetchWCAPublicWCIF(wcaCompetitionId: string) {
  return fetchWCAJson<WCIFPublicPayload>(
    `/api/v0/competitions/${encodeURIComponent(wcaCompetitionId)}/wcif/public`
  );
}

export function getWCACompetitionUrl(wcaCompetitionId: string) {
  return `${WCA_BASE_URL}/competitions/${encodeURIComponent(wcaCompetitionId)}`;
}

async function fetchWCAJson<T>(path: string, attempt = 0): Promise<T> {
  const response = await fetch(`${WCA_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CubeCast MVP"
    },
    next: {
      revalidate: 60 * 30
    }
  });

  if (response.status === 429 && attempt < WCA_MAX_RETRIES) {
    await sleep(getRetryDelayMs(response, attempt));

    return fetchWCAJson<T>(path, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`WCA request failed with ${response.status} for ${path}.`);
  }

  return (await response.json()) as T;
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : null;

  if (retryAfterSeconds && Number.isFinite(retryAfterSeconds)) {
    return retryAfterSeconds * 1000;
  }

  return WCA_RETRY_BASE_DELAY_MS * (attempt + 1);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWCABaseUrl() {
  const configuredBaseUrl = process.env.WCA_BASE_URL?.trim().replace(/\/$/, "");

  return configuredBaseUrl || "https://www.worldcubeassociation.org";
}
