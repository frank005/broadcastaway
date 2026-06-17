"use client";

import { useCallback, useEffect, useState } from "react";

export type MeResponse = {
  authenticated: boolean;
  authMode: string;
  user: { id: string; email: string; name: string } | null;
};

export function useAgoraAuth() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = (await res.json()) as MeResponse;
      setMe(data);
    } catch {
      setMe({
        authenticated: false,
        authMode: "sso",
        user: null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("authError");
      if (err) {
        setAuthError(err);
        params.delete("authError");
        const next = params.toString();
        const url = next
          ? `${window.location.pathname}?${next}`
          : window.location.pathname;
        window.history.replaceState({}, "", url);
      }
    }
  }, [refresh]);

  const signInUrl = "/api/auth/agora/start";
  const signOutUrl = "/api/auth/agora/logout";

  return {
    me,
    loading,
    authError,
    signInUrl,
    signOutUrl,
    refresh,
    user: me?.user ?? null,
    authenticated: Boolean(me?.authenticated),
  };
}
