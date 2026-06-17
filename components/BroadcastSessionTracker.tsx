"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function BroadcastSessionTracker({
  active,
}: {
  active: boolean;
}) {
  const { sessionTimer } = useAuth();
  const { startTracking, stopTracking } = sessionTimer;

  useEffect(() => {
    if (active) {
      startTracking();
    } else {
      stopTracking();
    }
    return () => {
      stopTracking();
    };
  }, [active, startTracking, stopTracking]);

  return null;
}
