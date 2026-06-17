import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export type AuthMode = "sso" | "bypass";

export function authMode(): AuthMode {
  const raw = (process.env.AUTH_MODE || "").toLowerCase();
  if (raw === "bypass") {
    if (process.env.NODE_ENV !== "production") return "bypass";
    if (process.env.ALLOW_BYPASS_IN_PRODUCTION === "true") return "bypass";
    return "sso";
  }
  return "sso";
}

export const SESSION_COOKIE = "agora_session";
export const OAUTH_STATE_COOKIE = "agora_oauth_state";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

function secretKey(): Uint8Array {
  const raw = process.env.SESSION_JWT_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "SESSION_JWT_SECRET is not set or is shorter than 32 chars. Generate one with `openssl rand -hex 48`.",
    );
  }
  return new TextEncoder().encode(raw);
}

export async function signSession(user: SessionUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setSubject(user.id)
    .sign(secretKey());
}

export async function verifySession(jwt: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(jwt, secretKey(), {
      algorithms: ["HS256"],
    });
    const id = typeof payload.id === "string" ? payload.id : null;
    const email = typeof payload.email === "string" ? payload.email : "";
    const name = typeof payload.name === "string" ? payload.name : "";
    if (!id) return null;
    return { id, email, name };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (authMode() === "bypass") {
    return {
      id: "bypass-user",
      email: "demo@local",
      name: "Demo User",
    };
  }
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return await verifySession(token);
}

export async function setSessionCookie(jwt: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function issueOAuthStateCookie(): Promise<string> {
  const state = randomUUID();
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });
  return state;
}

export async function consumeOAuthStateCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(OAUTH_STATE_COOKIE)?.value ?? null;
  if (value !== null) jar.delete(OAUTH_STATE_COOKIE);
  return value;
}
