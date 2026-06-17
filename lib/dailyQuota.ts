const STORAGE_PREFIX = "broadcastaway_demo_usage_";

export function utcDateBucket(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getDailyQuotaSeconds(): number {
  const raw = process.env.NEXT_PUBLIC_DEMO_QUOTA_SECONDS;
  const parsed = raw ? parseInt(raw, 10) : 900;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 900;
}

function bypassAccounts(): string[] {
  const raw = process.env.NEXT_PUBLIC_QUOTA_BYPASS_ACCOUNTS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAgoraDomainEmail(email: string | undefined): boolean {
  const lower = (email || "").toLowerCase().trim();
  if (!lower.includes("@")) return false;
  const domain = lower.split("@").pop()!;
  return domain === "agora.io" || domain.endsWith(".agora.io");
}

export function isQuotaBypassed(user: { id?: string; email?: string } | null): boolean {
  if (!user) return false;
  if (isAgoraDomainEmail(user.email)) return true;
  const allow = bypassAccounts();
  if (!allow.length) return false;
  const id = (user.id || "").toLowerCase();
  const email = (user.email || "").toLowerCase();
  return allow.includes(id) || allow.includes(email);
}

function storageKey(userId: string, bucket: string): string {
  return `${STORAGE_PREFIX}${userId}_${bucket}`;
}

export function getUsedSeconds(userId: string, bucket = utcDateBucket()): number {
  if (!userId || typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(storageKey(userId, bucket));
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setUsedSeconds(
  userId: string,
  seconds: number,
  bucket = utcDateBucket(),
): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(
      storageKey(userId, bucket),
      String(Math.max(0, Math.floor(seconds))),
    );
  } catch {
    // ignore
  }
}

export function addUsedSeconds(
  userId: string,
  deltaSeconds: number,
  bucket = utcDateBucket(),
): number {
  const next = getUsedSeconds(userId, bucket) + Math.max(0, deltaSeconds);
  setUsedSeconds(userId, next, bucket);
  return next;
}

export function getRemainingSeconds(
  user: { id?: string; email?: string } | null,
  bucket = utcDateBucket(),
): number {
  if (!user?.id) return getDailyQuotaSeconds();
  if (isQuotaBypassed(user)) return Infinity;
  const quota = getDailyQuotaSeconds();
  return Math.max(0, quota - getUsedSeconds(user.id, bucket));
}

export function isQuotaExhausted(
  user: { id?: string; email?: string } | null,
  bucket = utcDateBucket(),
): boolean {
  if (!user?.id || isQuotaBypassed(user)) return false;
  return getRemainingSeconds(user, bucket) <= 0;
}
