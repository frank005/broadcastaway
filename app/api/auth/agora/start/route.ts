import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { authMode, issueOAuthStateCookie } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/agora-sso";

export const runtime = "nodejs";

export async function GET() {
  if (authMode() === "bypass") {
    redirect("/");
  }
  const state = await issueOAuthStateCookie();
  redirect(buildAuthorizeUrl(state));
}
