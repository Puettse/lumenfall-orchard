import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const baseUrl = normalizeBaseUrl(process.env.REMOTE_UPDATE_BASE_URL);

if (!baseUrl) {
  throw new Error("REMOTE_UPDATE_BASE_URL is required, for example https://username.github.io/lumenfall-orchard/");
}

const version =
  process.env.REMOTE_UPDATE_VERSION ??
  process.env.GITHUB_SHA?.slice(0, 12) ??
  packageJson.version ??
  new Date().toISOString();

const manifest = {
  enabled: true,
  version,
  minShellVersion: packageJson.version ?? "0.1.0",
  launchUrl: new URL("index.html", baseUrl).toString(),
  message: process.env.REMOTE_UPDATE_MESSAGE ?? "Remote web build"
};

await mkdir(path.join(projectRoot, "dist"), { recursive: true });
await writeFile(path.join(projectRoot, "dist", "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

function normalizeBaseUrl(value) {
  if (!value) {
    return "";
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("REMOTE_UPDATE_BASE_URL must be HTTPS for production.");
  }
  if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`;
  }
  return parsed.toString();
}
