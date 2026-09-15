const WCA_BASE_URL = getWCABaseUrl();

export type WCACompetitionPayload = {
  city?: string;
  country_iso2?: string;
  end_date?: string;
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

export async function fetchWCACompetition(wcaCompetitionId: string) {
  return fetchWCAJson<WCACompetitionPayload>(
    `/api/v0/competitions/${encodeURIComponent(wcaCompetitionId)}`
  );
}

export async function fetchWCACompetitionResults(wcaCompetitionId: string) {
  return fetchWCAJson<WCACompetitionResultPayload[]>(
    `/api/v0/competitions/${encodeURIComponent(wcaCompetitionId)}/results`
  );
}

export function getWCACompetitionUrl(wcaCompetitionId: string) {
  return `${WCA_BASE_URL}/competitions/${encodeURIComponent(wcaCompetitionId)}`;
}

async function fetchWCAJson<T>(path: string): Promise<T> {
  const response = await fetch(`${WCA_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CubeCast MVP"
    },
    next: {
      revalidate: 60 * 30
    }
  });

  if (!response.ok) {
    throw new Error(`WCA request failed with ${response.status} for ${path}.`);
  }

  return (await response.json()) as T;
}

function getWCABaseUrl() {
  const configuredBaseUrl = process.env.WCA_BASE_URL?.trim().replace(/\/$/, "");

  return configuredBaseUrl || "https://www.worldcubeassociation.org";
}
