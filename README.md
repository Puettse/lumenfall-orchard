# Lumenfall Orchard

An original low-poly 3D retro adventure platformer built for HTML/WebGL and Android APK export.

## Concept

You play as Pip, a tiny star-forged courier sent to revive a drifting orchard island before night consumes it. The island is a compact vertical slice with broken sky bridges, a windmill climb, secret grottoes, three memory bells, light seeds, Moon Pearls, Starflower spring pads, hazards, checkpoints, and a shrine gate that opens only when the orchard has enough light.

## Controls

- Move: `WASD` or arrow keys
- Camera: drag mouse/touch, or `Q`/`R`
- Jump: `Space`
- Glide: hold `Space` while falling
- Spark Dash: `Shift`, `K`, or on-screen dash button
- Interact / ring bells: `E`, `J`, or on-screen action button
- Pause: `Esc`

Gamepad is supported for movement, jump, dash, interact, and camera orbit. Touch controls appear on smaller/coarse-pointer screens and in Android WebView: left pad to move, drag the view to look, hold Jump to glide, Dash for bursts, and Act near bells or the shrine.
The platforming includes coyote time and jump buffering, so late and slightly early jumps still feel fair.

## Objective

Collect at least 16 Lumen Seeds and ring all 3 Memory Bells. Then reach the Beacon Shrine at the far end of the island and activate it to win. There are 24 seeds total, 5 optional Moon Pearls, and several hidden route rewards for replay.

The HUD compass points toward the current priority: nearby seeds first, then unrung bells, then the shrine. Blue Skybreath updrafts act as traversal set pieces; hold glide inside them to steer upward. Starflower pads bounce Pip into high routes and can be chained with glide or dash.

## Web Run

```powershell
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173/`.

## Web Build

```powershell
npm run build
npm run preview
```

The deployable web build is emitted to `dist/`.

## Android APK Build

Prerequisites:

- Node.js
- Android Studio with Android SDK installed
- Java runtime required by the installed Android Gradle plugin

Commands:

```powershell
npm install
npm run android:init
npm run android:sync
npm run android:open
```

In Android Studio, let Gradle sync, then build the APK with **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

For command-line builds after Android has been initialized:

```powershell
npm run android:sync
cd android
$env:JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStoreType=Windows-ROOT'
.\gradlew assembleDebug
```

The debug APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Remote Updates

The APK can be built with an opt-in hosted update channel. On startup, the installed shell checks a HTTPS manifest, validates the launch origin, and navigates to the hosted game build. If the manifest is absent or invalid, the packaged offline build runs.

See [REMOTE_UPDATES.md](docs/REMOTE_UPDATES.md) for the manifest format, build variables, hosting headers, and policy notes.

Current GitHub Pages update endpoints:

- `https://puettse.github.io/lumenfall-orchard/manifest.json`
- `https://puettse.github.io/lumenfall-orchard/index.html`

## Generated Character Assets

The game can use Meshy AI as an offline asset pipeline for Pip's character model and movement animations:

```powershell
npm run assets:meshy:pip
```

On this Windows machine, set `$env:NODE_OPTIONS='--use-system-ca'` first if Node cannot verify Meshy's TLS certificate.

The script reads the local key from `scripts/MeshyAI.txt`, generates and rigs Pip through Meshy, downloads GLB idle/walk/run assets into `public/assets/characters/pip/`, and updates the static manifest. The key is ignored by git and is never bundled into the browser build or APK.

See [MESHY_ASSET_PIPELINE.md](docs/MESHY_ASSET_PIPELINE.md) for details.

## Assets

Most game assets are procedural or code-authored:

- Low-poly character meshes
- Trees, bells, seeds, Moon Pearls, Starflower pads, ruins, shrine, bridges, hazards, particles
- Ambient lighting, fog, gradients, generated audio tones, and sparse ambient pulses

If Meshy-generated Pip assets are present, the runtime loads them as static GLB files with procedural fallback.

No proprietary or paid assets are required.

## Technical Notes

- Engine/framework: Three.js + TypeScript + Vite
- Android wrapper: Capacitor
- Rendering: WebGL through Three.js
- Physics: custom lightweight character/platform controller for the vertical slice
- Save data: localStorage for checkpoint, best completion, and collected best count
- Audio: procedural sound effects and sparse ambient beds; the previous continuous melody loop has been removed
