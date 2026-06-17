"use client";

import { useAuth } from "@/context/AuthContext";
import { getDailyQuotaSeconds } from "@/lib/dailyQuota";
import SessionWarning from "./SessionWarning";
import AgoraSignInScreen, {
  AgoraSignInLoading,
  AgoraQuotaExhaustedScreen,
} from "./AgoraSignInScreen";

export default function AgoraAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { me, loading, authError, signInUrl, sessionTimer } = useAuth();
  const quotaMinutes = Math.floor(getDailyQuotaSeconds() / 60);

  if (loading || !me) {
    return <AgoraSignInLoading />;
  }

  if (!me.authenticated) {
    return (
      <AgoraSignInScreen
        signInUrl={signInUrl}
        authError={authError}
        quotaMinutes={quotaMinutes}
      />
    );
  }

  if (sessionTimer.quotaExhausted && !sessionTimer.isTracking) {
    return (
      <AgoraQuotaExhaustedScreen
        quotaMinutes={quotaMinutes}
        signOutUrl="/api/auth/agora/logout"
      />
    );
  }

  return (
    <>
      <SessionWarning />
      {children}
    </>
  );
}
