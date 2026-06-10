type RemoteUpdateManifest = {
  enabled: boolean;
  version: string;
  launchUrl: string;
  minShellVersion?: string;
  checkIntervalMinutes?: number;
  message?: string;
};

type RemoteUpdateRecord = {
  version: string;
  launchUrl: string;
  checkedAt: number;
  message?: string;
};

export type RemoteUpdateResult =
  | { mode: "disabled"; reason: string }
  | { mode: "local"; reason: string }
  | { mode: "redirecting"; version: string; launchUrl: string };

const shellVersion = "0.1.0";
const activeUpdateKey = "lumenfall.remoteUpdate.active";
const lastCheckKey = "lumenfall.remoteUpdate.lastCheck";
const fetchTimeoutMs = 4500;

export const maybeLaunchRemoteUpdate = async (): Promise<RemoteUpdateResult> => {
  const config = getRemoteUpdateConfig();
  if (!config.manifestUrl) {
    return { mode: "disabled", reason: "No VITE_REMOTE_UPDATE_MANIFEST_URL configured." };
  }

  if (shouldForceLocal()) {
    localStorage.removeItem(activeUpdateKey);
    return { mode: "local", reason: "Remote updates disabled by URL flag." };
  }

  const manifestUrl = parseUrl(config.manifestUrl);
  if (!manifestUrl || !isAllowedSecureUrl(manifestUrl, config.allowInsecureLocalhost)) {
    return { mode: "local", reason: "Remote update manifest URL is not a permitted HTTPS URL." };
  }

  const allowedOrigins = config.allowedOrigins.length > 0 ? config.allowedOrigins : [manifestUrl.origin];
  if (!allowedOrigins.includes(manifestUrl.origin)) {
    return { mode: "local", reason: "Remote update manifest origin is not allowlisted." };
  }

  const now = Date.now();

  try {
    const manifest = await fetchManifest(manifestUrl.toString());
    localStorage.setItem(lastCheckKey, String(now));
    const validation = validateManifest(manifest, allowedOrigins, config.allowInsecureLocalhost);
    if (!validation.ok) {
      localStorage.removeItem(activeUpdateKey);
      return { mode: "local", reason: validation.reason };
    }

    const record: RemoteUpdateRecord = {
      version: manifest.version,
      launchUrl: manifest.launchUrl,
      checkedAt: now,
      message: manifest.message
    };
    localStorage.setItem(activeUpdateKey, JSON.stringify(record));
    if (shouldRedirectTo(record.launchUrl, allowedOrigins)) {
      return redirectTo(record);
    }
    return { mode: "local", reason: "Already running on the active remote origin." };
  } catch (error) {
    return {
      mode: "local",
      reason: error instanceof Error ? error.message : "Remote update check failed."
    };
  }
};

const getRemoteUpdateConfig = () => {
  const env = ((import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env ?? {}) as Record<
    string,
    string | boolean | undefined
  >;
  const manifestUrl = String(env.VITE_REMOTE_UPDATE_MANIFEST_URL ?? "").trim();
  const allowInsecureLocalhost = String(env.VITE_REMOTE_UPDATE_ALLOW_INSECURE_LOCALHOST ?? "false") === "true";
  const explicitOrigins = String(env.VITE_REMOTE_UPDATE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const allowedOrigins = explicitOrigins
    .map((entry) => parseOrigin(entry, allowInsecureLocalhost))
    .filter((entry): entry is string => Boolean(entry));

  return {
    manifestUrl,
    allowedOrigins,
    allowInsecureLocalhost
  };
};

const fetchManifest = async (url: string): Promise<RemoteUpdateManifest> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), fetchTimeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Remote update manifest returned HTTP ${response.status}.`);
    }
    return (await response.json()) as RemoteUpdateManifest;
  } finally {
    window.clearTimeout(timeout);
  }
};

const validateManifest = (
  manifest: RemoteUpdateManifest,
  allowedOrigins: string[],
  allowInsecureLocalhost: boolean
): { ok: true } | { ok: false; reason: string } => {
  if (!manifest || typeof manifest !== "object") {
    return { ok: false, reason: "Remote update manifest is not an object." };
  }
  if (manifest.enabled !== true) {
    return { ok: false, reason: "Remote update manifest is disabled." };
  }
  if (!manifest.version || typeof manifest.version !== "string") {
    return { ok: false, reason: "Remote update manifest is missing a version." };
  }
  if (manifest.minShellVersion && compareSemver(shellVersion, manifest.minShellVersion) < 0) {
    return { ok: false, reason: `Remote update requires shell ${manifest.minShellVersion}.` };
  }

  const launchUrl = parseUrl(manifest.launchUrl);
  if (!launchUrl || !isAllowedSecureUrl(launchUrl, allowInsecureLocalhost)) {
    return { ok: false, reason: "Remote update launch URL is not a permitted HTTPS URL." };
  }
  if (!allowedOrigins.includes(launchUrl.origin)) {
    return { ok: false, reason: "Remote update launch origin is not allowlisted." };
  }

  return { ok: true };
};

const redirectTo = (record: RemoteUpdateRecord): RemoteUpdateResult => {
  const url = new URL(record.launchUrl);
  url.searchParams.set("lumenfallShell", shellVersion);
  url.searchParams.set("lumenfallRemoteVersion", record.version);
  window.location.replace(url.toString());
  return { mode: "redirecting", version: record.version, launchUrl: url.toString() };
};

const shouldRedirectTo = (launchUrl: string, allowedOrigins: string[]): boolean => {
  const parsed = parseUrl(launchUrl);
  return Boolean(parsed && allowedOrigins.includes(parsed.origin) && parsed.origin !== window.location.origin);
};

const shouldForceLocal = (): boolean => {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("local") === "1" ||
    params.get("remoteUpdate") === "off" ||
    params.get("remote_update") === "off" ||
    params.get("noRemote") === "1"
  );
};

const parseOrigin = (value: string, allowInsecureLocalhost: boolean): string | null => {
  const parsed = parseUrl(value.includes("://") ? value : `https://${value}`);
  return parsed && isAllowedSecureUrl(parsed, allowInsecureLocalhost) ? parsed.origin : null;
};

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isAllowedSecureUrl = (url: URL, allowInsecureLocalhost: boolean): boolean => {
  if (url.protocol === "https:") {
    return true;
  }
  return allowInsecureLocalhost && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
};

const compareSemver = (left: string, right: string): number => {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
};
