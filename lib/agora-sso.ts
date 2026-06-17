function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function ssoBaseUrl(): string {
  return (process.env.AGORA_SSO_BASE_URL || "https://sso2.agora.io").replace(
    /\/+$/,
    "",
  );
}

function ssoOpenHost(): string {
  return (
    process.env.AGORA_SSO_OPEN_HOST || "https://sso-open.agora.io"
  ).replace(/\/+$/, "");
}

function ssoClientId(): string {
  return requiredEnv("AGORA_SSO_CLIENT_ID");
}

function ssoClientSecret(): string {
  return requiredEnv("AGORA_SSO_CLIENT_SECRET");
}

export function ssoRedirectUri(): string {
  return requiredEnv("AGORA_SSO_REDIRECT_URI");
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: ssoClientId(),
    redirect_uri: ssoRedirectUri(),
    scope: "basic_info",
    state,
  });
  return `${ssoBaseUrl()}/api/v0/oauth/authorize?${params.toString()}`;
}

export function buildLogoutUrl(redirectUri: string): string {
  const params = new URLSearchParams({ redirect_uri: redirectUri });
  return `${ssoBaseUrl()}/api/v0/logout?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
};

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: ssoClientId(),
    client_secret: ssoClientSecret(),
    code,
    redirect_uri: ssoRedirectUri(),
  });
  const res = await fetch(`${ssoBaseUrl()}/api/v0/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SSO token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export type AgoraCustomer = {
  id: string;
  email: string;
  name: string;
};

function normalizeCustomer(data: Record<string, unknown>): AgoraCustomer {
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const v = data[key];
      if (v == null) continue;
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return "";
  };

  const id =
    pick("customerId", "customer_id", "userId", "user_id", "id", "uid") ||
    pick("accountId", "account_id") ||
    pick("email", "emailAddress", "email_address", "loginEmail");
  const email = pick("email", "emailAddress", "email_address", "loginEmail");
  const name = pick(
    "name",
    "displayName",
    "display_name",
    "nickname",
    "fullName",
    "full_name",
    "username",
  );

  if (!id) {
    throw new Error(
      "Agora /customer response did not include a stable user identifier.",
    );
  }

  return {
    id,
    email,
    name: name || email || id,
  };
}

export async function fetchCustomer(accessToken: string): Promise<AgoraCustomer> {
  const host = ssoOpenHost();
  const candidates = [
    `${host}/api/v0/customer/user-auth`,
    `${host}/api/v0/customer/company/basic-info`,
  ];
  let lastError: string | null = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        lastError = `${url} → ${res.status} ${text.slice(0, 200)}`;
        continue;
      }
      const json = (await res.json()) as Record<string, unknown>;
      const data =
        (json.data as Record<string, unknown> | undefined) ??
        (json.customer as Record<string, unknown> | undefined) ??
        json;
      try {
        return normalizeCustomer(data);
      } catch (normErr) {
        lastError = `${url} → 200 but ${(normErr as Error).message}`;
      }
    } catch (err) {
      lastError = `${url} → ${(err as Error).message}`;
    }
  }
  throw new Error(
    `Failed to fetch Agora customer profile. Last error: ${lastError ?? "unknown"}`,
  );
}
