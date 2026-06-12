const devtoolsUrl = process.env.DEVTOOLS_URL ?? "http://127.0.0.1:9222/json/list";
const gameUrl = process.env.GAME_URL ?? "current";
const shouldNavigate = gameUrl !== "current";

const checkpoints = [
  { label: "gatehouse start", position: [-34, 0.65, 10] },
  { label: "moonroot crossing", position: [-10, 0.65, 10] },
  { label: "north gallery", position: [-8, 0.65, -12] },
  { label: "root crypt", position: [-32, 0.65, -16] },
  { label: "guard hall", position: [9, 0.65, 9] },
  { label: "gloom channel", position: [9, 0.65, -12] },
  { label: "hidden archive", position: [32, 0.65, -16] },
  { label: "balcony keep", position: [31, 0.65, 10] },
  { label: "raised balcony", position: [32, 2.65, 17] },
  { label: "shrine door", position: [37.2, 0.65, 10.2] },
  { label: "shrine hall", position: [52, 0.65, 8] }
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  const targets = await (await fetch(devtoolsUrl)).json();
  const target = targets.find((candidate) => candidate.type === "page");
  if (!target?.webSocketDebuggerUrl) {
    throw new Error("No debuggable page target found.");
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      errors.push(message.params.exceptionDetails?.text ?? "exception");
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      errors.push(
        message.params.args?.map((arg) => arg.value ?? arg.description ?? "").join(" ") || "console error"
      );
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("DevTools websocket failed."));
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const messageId = ++id;
      pending.set(messageId, resolve);
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });

  await send("Runtime.enable");
  await send("Page.enable");
  if (shouldNavigate) {
    await send("Page.navigate", { url: gameUrl });
    await delay(3000);
  }

  await send("Runtime.evaluate", { expression: "window.__LUMENFALL_DEBUG__?.startRun?.();" });
  await delay(600);

  const results = [];
  for (const checkpoint of checkpoints) {
    const [x, y, z] = checkpoint.position;
    await send("Runtime.evaluate", {
      expression: `window.__LUMENFALL_DEBUG__?.teleport?.(${x}, ${y}, ${z});`
    });
    await delay(450);
    const result = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `
        (() => {
          const state = window.__LUMENFALL_DEBUG__?.state?.();
          return {
            label: ${JSON.stringify(checkpoint.label)},
            platform: state?.player?.platform ?? null,
            grounded: state?.player?.grounded ?? false,
            y: state?.player?.y ?? null,
            health: state?.health ?? null,
            avatarReady: state?.avatar?.ready ?? false,
            mode: state?.mode ?? null
          };
        })()
      `
    });
    results.push(result.result.result.value);
  }

  const failed = results.filter((result) => !result.grounded || !result.platform || result.y < -1 || result.health <= 0);
  console.log(
    JSON.stringify(
      {
        gameUrl: shouldNavigate ? gameUrl : target.url,
        passed: failed.length === 0 && errors.length === 0,
        results,
        errors
      },
      null,
      2
    )
  );
  ws.close();

  if (failed.length > 0 || errors.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
