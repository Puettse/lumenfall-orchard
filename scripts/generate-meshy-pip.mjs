import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE_URL = "https://api.meshy.ai";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const KEY_FILE = process.env.MESHY_API_KEY_FILE ?? path.join(SCRIPT_DIR, "MeshyAI.txt");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public", "assets", "characters", "pip");
const CACHE_DIR = path.join(SCRIPT_DIR, ".meshy-cache");

const CHARACTER_PROMPT =
  "Original low-poly humanoid biped game hero named Pip, star-forged courier, clear head torso arms legs, childlike non-human proportions, glowing antenna tips, red scarf, tiny boots, folded cloth glide wings, chunky SNES-to-N64 era silhouette, warm yellow and amber body, expressive simple black eyes, clean A-pose, face toward +Z, no logos, no text, no weapon, not based on existing IP.";

const TEXTURE_PROMPT =
  "Diffuse-only retro game texture style, low-resolution point-filtered look, flat hand-painted colors, warm yellow star body, amber head, red scarf, teal wing cloth, brown boots, simple black eyes, readable from third-person distance, no PBR shine, no realistic skin, no logos, no text.";

const main = async () => {
  const apiKey = await readApiKey();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });

  console.log("[meshy] Creating low-poly Pip preview task.");
  const previewId = await createTask(
    "/openapi/v2/text-to-3d",
    {
      mode: "preview",
      prompt: CHARACTER_PROMPT,
      model_type: "lowpoly",
      pose_mode: "a-pose",
      target_formats: ["glb"],
      alpha_thumbnail: true,
      moderation: true
    },
    apiKey
  );
  const preview = await pollTask(`/openapi/v2/text-to-3d/${previewId}`, "preview", apiKey);

  console.log("[meshy] Refining Pip with diffuse-only texture.");
  const refineId = await createTask(
    "/openapi/v2/text-to-3d",
    {
      mode: "refine",
      preview_task_id: preview.id,
      enable_pbr: false,
      hd_texture: false,
      texture_prompt: TEXTURE_PROMPT,
      remove_lighting: true,
      target_formats: ["glb"],
      auto_size: true,
      origin_at: "bottom",
      moderation: true
    },
    apiKey
  );
  const refined = await pollTask(`/openapi/v2/text-to-3d/${refineId}`, "refine", apiKey);

  console.log("[meshy] Rigging Pip and requesting basic movement clips.");
  const rigId = await createTask(
    "/openapi/v1/rigging",
    {
      input_task_id: refined.id,
      height_meters: 1.65
    },
    apiKey
  );
  const rigged = await pollTask(`/openapi/v1/rigging/${rigId}`, "rigging", apiKey, 20 * 60 * 1000);

  const rigResult = rigged.result ?? {};
  const basicAnimations = rigResult.basic_animations ?? {};
  await downloadRequired(rigResult.rigged_character_glb_url, "pip-idle.glb");
  await downloadRequired(basicAnimations.walking_glb_url, "pip-walk.glb");
  await downloadRequired(basicAnimations.running_glb_url, "pip-run.glb");

  const thumbnailUrl = refined.alpha_thumbnail_url ?? refined.thumbnail_url;
  if (thumbnailUrl) {
    await downloadOptional(thumbnailUrl, "pip-thumbnail.png");
  }

  const manifest = {
    enabled: true,
    source: "meshy",
    version: new Date().toISOString(),
    targetHeight: 2.05,
    scale: 1,
    rotationY: Math.PI,
    heightOffset: 0,
    states: {
      idle: "pip-idle.glb",
      walk: "pip-walk.glb",
      run: "pip-run.glb"
    }
  };
  await writeJson(path.join(OUTPUT_DIR, "manifest.json"), manifest);
  await writeJson(path.join(CACHE_DIR, "pip-last-generation.json"), {
    createdAt: manifest.version,
    tasks: {
      preview: preview.id,
      refine: refined.id,
      rigging: rigged.id
    },
    consumedCredits: {
      preview: preview.consumed_credits ?? null,
      refine: refined.consumed_credits ?? null,
      rigging: rigged.consumed_credits ?? null
    },
    outputFiles: ["pip-idle.glb", "pip-walk.glb", "pip-run.glb", "manifest.json"]
  });

  console.log("[meshy] Pip character and movement animations are ready in public/assets/characters/pip.");
};

const readApiKey = async () => {
  const fromEnv = process.env.MESHY_API_KEY?.trim();
  if (fromEnv) {
    return extractApiKey(fromEnv);
  }
  const fromFile = await readFile(KEY_FILE, "utf8");
  const apiKey = extractApiKey(fromFile);
  if (!apiKey) {
    throw new Error(`Meshy API key file is empty: ${KEY_FILE}`);
  }
  return apiKey;
};

const extractApiKey = (value) => {
  const match = value.match(/msy_[A-Za-z0-9]+/);
  return match?.[0] ?? value.trim();
};

const createTask = async (endpoint, body, apiKey) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await readJsonResponse(response);
  if (!response.ok || !payload.result) {
    throw new Error(`Meshy task creation failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.result;
};

const pollTask = async (endpoint, label, apiKey, timeoutMs = 15 * 60 * 1000) => {
  const startedAt = Date.now();
  let lastProgress = "";
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(`Meshy ${label} poll failed (${response.status}): ${JSON.stringify(payload)}`);
    }

    const progress = `${payload.status ?? "UNKNOWN"} ${payload.progress ?? 0}%`;
    if (progress !== lastProgress) {
      console.log(`[meshy] ${label}: ${progress}`);
      lastProgress = progress;
    }

    if (payload.status === "SUCCEEDED") {
      return payload;
    }
    if (payload.status === "FAILED" || payload.status === "CANCELED") {
      throw new Error(`Meshy ${label} task ended as ${payload.status}: ${JSON.stringify(payload.task_error ?? {})}`);
    }
    await sleep(5000);
  }
  throw new Error(`Timed out waiting for Meshy ${label} task.`);
};

const downloadRequired = async (url, fileName) => {
  if (!url) {
    throw new Error(`Meshy did not return required output URL for ${fileName}.`);
  }
  await downloadOptional(url, fileName);
};

const downloadOptional = async (url, fileName) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${fileName} (${response.status}).`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(OUTPUT_DIR, fileName), bytes);
  console.log(`[meshy] Downloaded ${fileName} (${bytes.length} bytes).`);
};

const readJsonResponse = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
};

const writeJson = async (filePath, value) => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const redactSecrets = (value) =>
  value
    .replace(/msy_[A-Za-z0-9]+/g, "msy_[redacted]")
    .replace(/Bearer\s+[^\s"']+/g, "Bearer [redacted]");

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[meshy] ${redactSecrets(message)}`);
  process.exitCode = 1;
});
