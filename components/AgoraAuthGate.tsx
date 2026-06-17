"use client";

import { Radio, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getDailyQuotaSeconds } from "@/lib/dailyQuota";
import SessionWarning from "./SessionWarning";

export default function AgoraAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { me, loading, authError, signInUrl, sessionTimer } = useAuth();
  const quotaMinutes = Math.floor(getDailyQuotaSeconds() / 60);

  if (loading || !me) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--agora-blue)] mx-auto mb-4" />
          <p className="text-gray-600">Checking sign-in…</p>
        </div>
      </div>
    );
  }

  if (!me.authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div className="agora-card max-w-md w-full text-center p-8">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--agora-blue)] flex items-center justify-center shadow-md">
              <Radio className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">BroadCastAway</h1>
          <p className="text-gray-600 mb-6">
            Sign in with your Agora account to start or join live broadcasts.
            Each user gets {quotaMinutes} minutes of demo time per day.
          </p>
          {authError ? (
            <p className="text-red-600 text-sm mb-4">
              Sign-in error: <code>{authError}</code>
            </p>
          ) : null}
          <a href={signInUrl} className="agora-btn-primary inline-flex items-center gap-2 px-8 py-3">
            <Sparkles size={18} />
            Sign in with Agora
          </a>
          <p className="text-xs text-gray-400 mt-4">
            Auth mode: <code>{me.authMode}</code>
          </p>
        </div>
      </div>
    );
  }

  if (sessionTimer.quotaExhausted && !sessionTimer.isTracking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div className="agora-card max-w-md w-full text-center p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Daily demo time used up
          </h1>
          <p className="text-gray-600 mb-6">
            You&apos;ve used your {quotaMinutes}-minute daily budget on BroadCastAway.
            Quota resets at midnight UTC.
          </p>
          <a
            href="/api/auth/agora/logout"
            className="text-[var(--agora-blue)] hover:underline text-sm font-medium"
          >
            Sign out
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <SessionWarning />
      {children}
    </>
  );
}
