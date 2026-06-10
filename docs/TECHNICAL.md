# Technical Documentation

## Stack

- Three.js for WebGL 3D rendering.
- TypeScript for source structure and strict type checks.
- Vite for web development and production builds.
- Capacitor for Android WebView packaging and APK export.

## Project Structure

```txt
src/
  main.ts
  game/
    LumenfallGame.ts
    types.ts
    systems/
      AudioDirector.ts
      InputController.ts
      ParticleSystem.ts
      PlayerController.ts
      ProceduralAssets.ts
      SaveSystem.ts
    world/
      WorldBuilder.ts
  styles/
    game.css
docs/
  DESIGN.md
  TECHNICAL.md
android/
  Capacitor Android project
```

## Runtime Systems

- `LumenfallGame` owns the scene, game state, camera, HUD, menus, objective logic, and run loop.
- `WorldBuilder` creates all level geometry, seeds, Moon Pearls, bells, hazards, wind currents, Starflower launch pads, checkpoints, lore markers, and shrine objects.
- `PlayerController` implements movement physics, coyote time, jump buffering, jumping, gliding, dashing, collision with authored platform boxes, respawn, health, and animation. The run loop clamps frame delta to a non-negative range so fallback timers cannot invert gravity or grow movement timers. Camera-relative right movement was corrected so left/right input no longer runs opposite the view.
- `InputController` supports keyboard, gamepad, pointer camera look, and touch controls. Android/coarse-pointer screens get touch-specific title instructions instead of keyboard copy.
- `AudioDirector` creates procedural WebAudio cues plus sparse ambient tones; the earlier continuous melody loop was removed.
- `RemoteUpdateManager` optionally checks a hosted update manifest before game boot and redirects to an allowlisted HTTPS game build while keeping the packaged build as fallback.
- `ParticleSystem` handles bursts and movement trails.
- `SaveSystem` stores best seed count, best completion time, and clears in `localStorage`.

## Web Build

```powershell
npm install
npm run dev
npm run build
```

## Android Build

The Android project is generated and synced with Capacitor.

```powershell
npm install
npm run android:sync
cd android
.\gradlew assembleDebug
```

If Java certificate validation fails on Windows, use:

```powershell
$env:JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStoreType=Windows-ROOT'
.\gradlew assembleDebug
```

The Gradle wrapper is configured to use the smaller `gradle-8.14.3-bin.zip` distribution and a 60-second network timeout.

## Local APK Build Status

The Capacitor Android project was created, synced, and compiled successfully on June 10, 2026. The local build uses this SDK pointer:

```properties
sdk.dir=C:/Users/sethp/AppData/Local/Android/Sdk
```

To rebuild the debug APK:

```powershell
npm run android:sync
cd android
$env:JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStoreType=Windows-ROOT'
.\gradlew assembleDebug
```

The debug APK is emitted under:

```txt
android/app/build/outputs/apk/debug/app-debug.apk
```

## Remote Update Builds

Remote updates are disabled unless `VITE_REMOTE_UPDATE_MANIFEST_URL` is set at build time. See `docs/REMOTE_UPDATES.md` for the hosted manifest format and required Android allowlist variables.

## QA Performed

- `npm run build` passes.
- `npm run android:init` succeeded.
- `npm run android:sync` succeeded.
- `.\gradlew assembleDebug` succeeded and produced `android/app/build/outputs/apk/debug/app-debug.apk`.
- Browser DOM check confirmed title overlay, HUD, compass, canvas, gameplay start, and no console errors.
- WebGL frame probe confirmed nonblank rendered output from the canvas.
- Gameplay probe confirmed run start, ground settle, compass state, relic HUD state, corrected spawn/checkpoint separation, intentional jump behavior, and no console errors after the polish pass.

## Known Tradeoffs

- The vertical slice uses custom lightweight physics instead of a full physics engine to keep the build small and deterministic.
- The first playable level is handcrafted with primitive colliders rather than terrain meshes.
- The production bundle is slightly over Vite's default 500 KB warning threshold because Three.js is included in one chunk; this is acceptable for the current scope and can be code-split later.
