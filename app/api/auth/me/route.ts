import { NextResponse } from "next/server";
import { authMode, getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({
      authenticated: false,
      authMode: authMode(),
      user: null,
    });
  }

  return NextResponse.json({
    authenticated: true,
    authMode: authMode(),
    user: { id: user.id, email: user.email, name: user.name },
  });
}
