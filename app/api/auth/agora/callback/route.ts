import { NextRequest, NextResponse } from "next/server";
import {
  authMode,
  clearSessionCookie,
  consumeOAuthStateCookie,
  setSessionCookie,
  signSession,
} from "@/lib/auth";
import { exchangeCodeForToken, fetchCustomer } from "@/lib/agora-sso";

export const runtime = "nodejs";

async function handleCallback(request: NextRequest) {
  const url = new URL(request.url);
  const home = new URL("/", url.origin);

  if (authMode() === "bypass") {
    return NextResponse.json(
      { error: "SSO callback is disabled in bypass mode." },
      { status: 403 },
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const ssoError = url.searchParams.get("error");

  if (ssoError) {
    home.searchParams.set("authError", ssoError);
    return NextResponse.redirect(home, 307);
  }

  if (!code || !state) {
    home.searchParams.set("authError", "missing_params");
    return NextResponse.redirect(home, 307);
  }

  const expectedState = await consumeOAuthStateCookie();
  if (!expectedState || expectedState !== state) {
    home.searchParams.set("authError", "state_mismatch");
    return NextResponse.redirect(home, 307);
  }

  try {
    const token = await exchangeCodeForToken(code);
    const customer = await fetchCustomer(token.access_token);
    const sessionJwt = await signSession({
      id: customer.id,
      email: customer.email,
      name: customer.name,
    });
    await setSessionCookie(sessionJwt);
    return NextResponse.redirect(home, 307);
  } catch (err) {
    console.error("[auth] callback failed:", err);
    home.searchParams.set("authError", "exchange_failed");
    return NextResponse.redirect(home, 307);
  }
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}
