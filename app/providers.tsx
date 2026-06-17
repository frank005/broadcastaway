"use client";

import { AuthProvider } from "@/context/AuthContext";
import AgoraAuthGate from "@/components/AgoraAuthGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AgoraAuthGate>{children}</AgoraAuthGate>
    </AuthProvider>
  );
}
