export interface StravaTokenResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  scope?: string;
  athlete: {
    id: number;
    username?: string | null;
    firstname?: string | null;
    lastname?: string | null;
  };
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
  start_date: string;
}

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

function stravaCredentials() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be configured.");
  }

  return { clientId, clientSecret };
}

async function parseStravaError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; errors?: Array<{ code?: string; resource?: string; field?: string }> };
    const details = payload.errors?.map((item) => `${item.resource ?? "resource"}.${item.field ?? "field"}:${item.code ?? "error"}`).join(", ");
    if (payload.message && details) return `${payload.message} (${details})`;
    if (payload.message) return payload.message;
    if (details) return details;
  } catch {
    // ignore parse errors
  }
  return `Strava request failed with status ${response.status}.`;
}

export async function exchangeStravaCode(code: string): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = stravaCredentials();

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(await parseStravaError(response));
  }

  return (await response.json()) as StravaTokenResponse;
}

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = stravaCredentials();

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseStravaError(response));
  }

  return (await response.json()) as StravaTokenResponse;
}

export async function fetchStravaActivities(
  accessToken: string,
  params: { after?: number; page?: number; perPage?: number },
): Promise<StravaActivity[]> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    per_page: String(params.perPage ?? 100),
  });

  if (params.after) query.set("after", String(params.after));

  const response = await fetch(`${STRAVA_ACTIVITIES_URL}?${query.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseStravaError(response));
  }

  return (await response.json()) as StravaActivity[];
}
