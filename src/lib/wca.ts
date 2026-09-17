import { getWCARateLimitDelay, WCARequestQueue } from "./wca-request-queue";

const WCA_BASE_URL = getWCABaseUrl();
const WCA_MAX_RETRIES = 3;
const WCA_RETRY_BASE_DELAY_MS = 1500;
const WCA_CACHE_TTL_MS = 30 * 60 * 1000;
const WCA_CACHE_MAX_ENTRIES = 128;

// Share pacing, in-flight reads, and successful cache entries across dev reloads.
const worker = globalThis as typeof globalThis & {
  wcaReadClient?: {
    queue: WCARequestQueue;
    cache: Map<string, { expiresAt: number; value: unknown }>;
    pending: Map<string, Promise<unknown>>;
  };
};
const client = worker.wcaReadClient ??= {
  queue: new WCARequestQueue(),
  cache: new Map(),
  pending: new Map()
};

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
  start,
  sort
}: {
  end?: string;
  page?: number;
  start: string;
  sort?: string;
}) {
  const params = new URLSearchParams({
    start
  });
  if (end) params.set("end", end);
  if (sort) params.set("sort", sort);

  if (page) {
    params.set("page", page.toString());
  }

  return fetchWCAJson<WCACompetitionPayload[]>(
    `/api/v0/competitions?${params.toString()}`
  );
}

export async function fetchWCACompetitionResults(wcaCompetitionId: string) {
  return fetchWCAJson<WCACompetitionResultPayload[]>(
    `/api/v0/competitions/${encodeURIComponent(wcaCompetitionId)}/results`,
    true
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

async function fetchWCAJson<T>(path: string, fresh = false): Promise<T> {
  const key = `${WCA_BASE_URL}${path}:${fresh}`;
  const cached = client.cache.get(key);
  if (!fresh && cached && cached.expiresAt > Date.now()) return cached.value as T;
  const pending = client.pending.get(key);
  if (pending) return pending as Promise<T>;
  const request = fetchWCAJsonAttempt<T>(path, 0, fresh).then((value) => {
    if (!fresh) {
      for (const [entryKey, entry] of client.cache) {
        if (entry.expiresAt <= Date.now()) client.cache.delete(entryKey);
      }
      if (client.cache.size >= WCA_CACHE_MAX_ENTRIES) {
        client.cache.delete(client.cache.keys().next().value!);
      }
      client.cache.set(key, { expiresAt: Date.now() + WCA_CACHE_TTL_MS, value });
    }
    return value;
  });
  client.pending.set(key, request);
  try {
    return await request;
  } finally {
    client.pending.delete(key);
  }
}

async function fetchWCAJsonAttempt<T>(path: string, attempt: number, fresh: boolean): Promise<T> {
  let response: Response;
  try {
    response = await client.queue.run(async () => {
      const result = await fetch(`${WCA_BASE_URL}${path}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "CubeCast MVP"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000)
      });
      if (result.status === 429) {
        client.queue.defer(getWCARateLimitDelay(result, attempt));
      }
      return result;
    });
  } catch (error) {
    if (fresh || attempt >= WCA_MAX_RETRIES) throw error;
    await sleep(WCA_RETRY_BASE_DELAY_MS * (attempt + 1));
    return fetchWCAJsonAttempt<T>(path, attempt + 1, fresh);
  }

  if (
    (response.status === 429 || response.status >= 500) &&
    !fresh &&
    attempt < WCA_MAX_RETRIES
  ) {
    if (response.status !== 429) await sleep(getRetryDelayMs(response, attempt));

    return fetchWCAJsonAttempt<T>(path, attempt + 1, fresh);
  }

  if (!response.ok) {
    throw new Error(`WCA request failed with ${response.status} for ${path}.`);
  }

  return (await response.json()) as T;
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : null;

  if (retryAfterSeconds && Number.isFinite(retryAfterSeconds)) {
    return retryAfterSeconds * 1000;
  }
  if (retryAfter && !Number.isFinite(retryAfterSeconds)) {
    const delay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(delay) && delay > 0) return delay;
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
