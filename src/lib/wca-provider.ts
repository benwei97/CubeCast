import type {
  OAuthConfig,
  OAuthUserConfig
} from "next-auth/providers/oauth";

export type WCAProfile = {
  avatar?: {
    is_default?: boolean;
    thumb_url?: string | null;
    url?: string | null;
  } | null;
  country_iso2?: string | null;
  id: number;
  name: string;
  url?: string | null;
  wca_id?: string | null;
};

const WCA_BASE_URL = getWCABaseUrl();

export function WCAProvider(
  options: OAuthUserConfig<WCAProfile>
): OAuthConfig<WCAProfile> {
  return {
    id: "wca",
    name: "WCA",
    type: "oauth",
    authorization: {
      params: {
        scope: "public"
      },
      url: `${WCA_BASE_URL}/oauth/authorize`
    },
    checks: ["state"],
    client: {
      token_endpoint_auth_method: "client_secret_post"
    },
    profile(profile: WCAProfile) {
      return {
        id: String(profile.id),
        image: profile.avatar?.url ?? profile.avatar?.thumb_url ?? null,
        name: profile.name
      };
    },
    token: `${WCA_BASE_URL}/oauth/token`,
    userinfo: {
      async request({ tokens }: { tokens: { access_token?: string } }) {
        return fetchWCAProfile(tokens.access_token);
      }
    },
    ...options
  };
}

export async function fetchWCAProfile(accessToken: string | undefined) {
  if (!accessToken) {
    throw new Error("WCA access token is missing.");
  }

  const response = await fetch(`${WCA_BASE_URL}/api/v0/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`WCA /me request failed with ${response.status}.`);
  }

  const body = (await response.json()) as { me: WCAProfile };
  return body.me;
}

function getWCABaseUrl() {
  const configuredBaseUrl = process.env.WCA_BASE_URL?.trim().replace(/\/$/, "");

  return configuredBaseUrl || "https://www.worldcubeassociation.org";
}
