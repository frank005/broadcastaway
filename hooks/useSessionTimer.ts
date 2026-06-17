"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addUsedSeconds,
  getDailyQuotaSeconds,
  getRemainingSeconds,
  isQuotaBypassed,
  isQuotaExhausted,
  utcDateBucket,
} from "@/lib/dailyQuota";

const TICK_MS = 1000;
const WARNING_THRESHOLD_SECONDS = 120;

export function useSessionTimer(user: { id?: string; email?: string } | null) {
  const [isTracking, setIsTracking] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const bucketRef = useRef(utcDateBucket());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number | null>(null);

  const refreshRemaining = useCallback(() => {
    if (!user?.id) {
      setTimeRemaining(null);
      setQuotaExhausted(false);
      return;
    }
    if (isQuotaBypassed(user)) {
      setTimeRemaining(Infinity);
      setQuotaExhausted(false);
      return;
    }
    const remaining = getRemainingSeconds(user, bucketRef.current);
    setTimeRemaining(remaining);
    setQuotaExhausted(remaining <= 0);
  }, [user]);

  useEffect(() => {
    refreshRemaining();
  }, [refreshRemaining]);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (user?.id && lastTickRef.current && !isQuotaBypassed(user)) {
      const elapsed = Math.floor((Date.now() - lastTickRef.current) / 1000);
      if (elapsed > 0) {
        addUsedSeconds(user.id, elapsed, bucketRef.current);
      }
    }
    lastTickRef.current = null;
    setIsTracking(false);
    refreshRemaining();
  }, [user, refreshRemaining]);

  const startTracking = useCallback(() => {
    if (!user?.id || isQuotaBypassed(user)) {
      setIsTracking(true);
      refreshRemaining();
      return;
    }
    if (isQuotaExhausted(user, bucketRef.current)) {
      setQuotaExhausted(true);
      return;
    }
    if (intervalRef.current) return;
    lastTickRef.current = Date.now();
    setIsTracking(true);
    refreshRemaining();
    intervalRef.current = setInterval(() => {
      if (!user?.id || !lastTickRef.current) return;
      const now = Date.now();
      const elapsed = Math.floor((now - lastTickRef.current) / 1000);
      if (elapsed >= 1) {
        addUsedSeconds(user.id, elapsed, bucketRef.current);
        lastTickRef.current = now;
        const remaining = getRemainingSeconds(user, bucketRef.current);
        setTimeRemaining(remaining);
        if (remaining <= 0) {
          setQuotaExhausted(true);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsTracking(false);
        }
      }
    }, TICK_MS);
  }, [user, refreshRemaining]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const showWarning =
    timeRemaining !== null &&
    timeRemaining !== Infinity &&
    timeRemaining <= WARNING_THRESHOLD_SECONDS &&
    timeRemaining > 0;

  const formatTimeRemaining = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "unlimited";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return {
    isTracking,
    timeRemaining,
    quotaExhausted,
    showWarning,
    startTracking,
    stopTracking,
    formatTimeRemaining,
    dailyQuotaSeconds: getDailyQuotaSeconds(),
  };
}
