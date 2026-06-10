import "./styles/game.css";
import { LumenfallGame } from "./game/LumenfallGame";
import { maybeLaunchRemoteUpdate } from "./game/systems/RemoteUpdateManager";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Missing #app root.");
}

const boot = async (): Promise<void> => {
  const updateResult = await maybeLaunchRemoteUpdate();
  (window as unknown as { __LUMENFALL_REMOTE_UPDATE__?: unknown }).__LUMENFALL_REMOTE_UPDATE__ = updateResult;
  if (updateResult.mode === "redirecting") {
    root.innerHTML = `<main class="boot-screen"><strong>Loading update</strong><span>${updateResult.version}</span></main>`;
    return;
  }

  const game = new LumenfallGame(root);
  game.start();
};

void boot();
