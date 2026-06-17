"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useAgoraAuth } from "@/hooks/useAgoraAuth";
import { useSessionTimer } from "@/hooks/useSessionTimer";

type AuthContextValue = ReturnType<typeof useAgoraAuth> & {
  sessionTimer: ReturnType<typeof useSessionTimer>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAgoraAuth();
  const authUser = auth.me?.authenticated ? auth.me.user : null;
  const sessionTimer = useSessionTimer(authUser);
  const value = useMemo(
    () => ({ ...auth, sessionTimer }),
    [auth, sessionTimer],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
