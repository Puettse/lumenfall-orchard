import type { CapacitorConfig } from "@capacitor/cli";

declare const process: {
  env: Record<string, string | undefined>;
};

const remoteUpdateHosts = [
  process.env.VITE_REMOTE_UPDATE_MANIFEST_URL,
  process.env.VITE_REMOTE_UPDATE_ALLOWED_ORIGINS,
  process.env.REMOTE_UPDATE_ALLOWED_ORIGINS
]
  .filter((value): value is string => Boolean(value))
  .flatMap((value) => value.split(","))
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      return url.host;
    } catch {
      return "";
    }
  })
  .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);

const config: CapacitorConfig = {
  appId: "com.codex.lumenfallorchard",
  appName: "Lumenfall Orchard",
  webDir: "dist",
  server: {
    androidScheme: "https",
    ...(remoteUpdateHosts.length > 0 ? { allowNavigation: remoteUpdateHosts } : {})
  },
  plugins: {
    SystemBars: {
      insetsHandling: "disable"
    }
  }
};

export default config;
