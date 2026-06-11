const devtoolsUrl = process.env.DEVTOOLS_URL ?? "http://127.0.0.1:9222/json/list";
const gameUrl = process.env.GAME_URL ?? `http://127.0.0.1:5173/?qa=avatar-${Date.now()}`;

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
  await send("Page.navigate", { url: gameUrl });
  await delay(3000);

  const readyResult = await send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `
      new Promise((resolve) => {
        const started = Date.now();
        const tick = () => {
          const dbg = window.__LUMENFALL_DEBUG__;
          const state = dbg?.state?.();
          if (state?.avatar?.ready || Date.now() - started > 10000) {
            resolve({
              state,
              pixels: dbg?.samplePixels?.(),
              timedOut: !state?.avatar?.ready
            });
            return;
          }
          setTimeout(tick, 150);
        };
        tick();
      })
    `
  });

  await send("Runtime.evaluate", {
    expression: "window.__LUMENFALL_DEBUG__?.startRun?.();"
  });
  await delay(900);
  await send("Runtime.evaluate", {
    expression: "window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',key:'w',bubbles:true}));"
  });
  await delay(1400);
  await send("Runtime.evaluate", {
    expression: "window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',key:'w',bubbles:true}));"
  });
  await delay(300);

  const moveResult = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `
      ({
        state: window.__LUMENFALL_DEBUG__?.state?.(),
        pixels: window.__LUMENFALL_DEBUG__?.samplePixels?.(),
        canvas: !!document.querySelector('canvas')
      })
    `
  });

  console.log(
    JSON.stringify(
      {
        gameUrl,
        ready: readyResult.result.result.value,
        afterMove: moveResult.result.result.value,
        errors
      },
      null,
      2
    )
  );
  ws.close();
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
