import { NextRequest, NextResponse } from "next/server";
import { authMode, clearSessionCookie } from "@/lib/auth";
import { buildLogoutUrl } from "@/lib/agora-sso";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const home = new URL("/", url.origin);

  await clearSessionCookie();

  if (authMode() === "bypass") {
    return NextResponse.redirect(home, 307);
  }

  const logoutUrl = buildLogoutUrl(home.toString());
  return NextResponse.redirect(logoutUrl, 307);
}
