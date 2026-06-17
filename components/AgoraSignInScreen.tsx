import AgoraLogo from "./AgoraLogo";

export function AgoraSignInLoading() {
  return (
    <main className="agora-sign-in-screen">
      <div className="agora-sign-in-spinner" aria-label="Checking sign-in" />
    </main>
  );
}

export default function AgoraSignInScreen({
  signInUrl,
  authError,
  quotaMinutes,
}: {
  signInUrl: string;
  authError: string | null;
  quotaMinutes: number;
}) {
  return (
    <main className="agora-sign-in-screen">
      <div className="agora-sign-in-panel">
        <AgoraLogo />
        <div className="agora-sign-in-copy">
          <h1>Sign in with your Agora account</h1>
          <p>
            This live demo is free for Agora users. You get {quotaMinutes}{" "}
            minutes of demo time per day.
          </p>
        </div>
        {authError ? (
          <p className="agora-sign-in-error">
            Sign-in error: <code>{authError}</code>
          </p>
        ) : null}
        <a href={signInUrl} className="agora-sign-in-btn">
          Sign in with Agora
        </a>
        <p className="agora-sign-in-footnote">
          Don&apos;t have an Agora account yet?{" "}
          <a
            href="https://console.agora.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Create one at console.agora.io
          </a>{" "}
          — it&apos;s free.
        </p>
      </div>
    </main>
  );
}

export function AgoraQuotaExhaustedScreen({
  quotaMinutes,
  signOutUrl,
}: {
  quotaMinutes: number;
  signOutUrl: string;
}) {
  return (
    <main className="agora-sign-in-screen">
      <div className="agora-sign-in-panel">
        <AgoraLogo />
        <div className="agora-sign-in-copy">
          <h1>Daily demo time used up</h1>
          <p>
            You&apos;ve used your {quotaMinutes}-minute daily budget. Quota
            resets at midnight UTC.
          </p>
        </div>
        <a href={signOutUrl} className="agora-sign-in-link">
          Sign out
        </a>
      </div>
    </main>
  );
}
