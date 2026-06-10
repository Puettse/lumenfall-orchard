# Remote Update Channel

Lumenfall Orchard can be built as a stable Android shell that checks a hosted update manifest before booting the bundled game. If the manifest is valid, the app navigates to the hosted game build inside the WebView. If the manifest is missing, disabled, unreachable, or outside the allowlist, the packaged offline build starts normally.

This is disabled by default. A normal local build does not contact any update server.

## Current GitHub Pages Target

Repository:

```txt
https://github.com/Puettse/lumenfall-orchard
```

Remote update URLs:

```txt
https://puettse.github.io/lumenfall-orchard/manifest.json
https://puettse.github.io/lumenfall-orchard/index.html
```

## Policy And Security Notes

- Google Play does not allow apps to update their native executable package outside Google Play. It does allow interpreted code such as JavaScript in a WebView, but that code must not enable policy violations or security vulnerabilities.
- Capacitor documents `server.url` and broad WebView navigation as development-oriented settings. This project does not set a production `server.url`; it uses a scoped manifest check and an explicit host allowlist.
- Use HTTPS only for production update manifests and hosted builds.
- Only load domains you own and control.
- Do not expose sensitive native bridges to remote web content.

Primary references:

- Google Play Device and Network Abuse policy: https://support.google.com/googleplay/android-developer/answer/16559646
- Capacitor configuration reference: https://capacitorjs.com/docs/config
- Capacitor security guide: https://capacitorjs.com/docs/guides/security

## Manifest Format

Host a JSON file like this:

```json
{
  "enabled": true,
  "version": "2026.06.10.1",
  "minShellVersion": "0.1.0",
  "launchUrl": "https://updates.example.com/lumenfall/index.html",
  "message": "Gameplay balance and art update"
}
```

Fields:

- `enabled`: must be `true` for the app to use the update.
- `version`: a human-readable remote build version.
- `minShellVersion`: optional minimum Android shell version. Current shell version is `0.1.0`.
- `launchUrl`: HTTPS URL for the hosted game entry point.
- `message`: optional status text stored with the active update record.

The manifest server must allow cross-origin fetches from the Android WebView origin. A simple static host can use:

```http
Access-Control-Allow-Origin: *
Cache-Control: no-store
Content-Type: application/json
```

## Build A Remote-Update APK

Use PowerShell environment variables when building:

```powershell
$env:VITE_REMOTE_UPDATE_MANIFEST_URL='https://updates.example.com/lumenfall/manifest.json'
$env:VITE_REMOTE_UPDATE_ALLOWED_ORIGINS='https://updates.example.com'
$env:REMOTE_UPDATE_ALLOWED_ORIGINS='https://updates.example.com'
npm run android:sync
cd android
$env:JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStoreType=Windows-ROOT'
.\gradlew assembleDebug
```

For the current GitHub Pages repo, use:

```powershell
$env:VITE_REMOTE_UPDATE_MANIFEST_URL='https://puettse.github.io/lumenfall-orchard/manifest.json'
$env:VITE_REMOTE_UPDATE_ALLOWED_ORIGINS='https://puettse.github.io'
$env:REMOTE_UPDATE_ALLOWED_ORIGINS='https://puettse.github.io'
npm run android:sync
cd android
$env:JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStoreType=Windows-ROOT'
.\gradlew assembleDebug
```

Why two origin variables:

- `VITE_REMOTE_UPDATE_ALLOWED_ORIGINS` is compiled into the web bootstrap and validates the manifest/launch URL.
- `REMOTE_UPDATE_ALLOWED_ORIGINS` is read by `capacitor.config.ts` during `cap sync` and writes the Android WebView navigation allowlist.

If the manifest and launch URL use the same origin, the manifest URL alone is enough for the Capacitor allowlist, but keeping both variables explicit is safer.

## Publish A Remote Web Build

1. Run `npm run build`.
2. Upload everything in `dist/` to the hosted `launchUrl` path.
3. Update the manifest `version` and `launchUrl`.
4. Keep the previous hosted build available until you have tested the new one on device.

Users get the new hosted version the next time the installed APK starts and has network access.

## Fallback And Disable

- If the update server is down, the app falls back to the packaged build.
- If the manifest has `"enabled": false`, the app clears the active remote update and uses the packaged build.
- Add `?local=1` or `?remoteUpdate=off` to the app URL during testing to force the packaged build and clear the active update record.

## Local Test Manifest

For local-only testing, you can permit localhost with:

```powershell
$env:VITE_REMOTE_UPDATE_ALLOW_INSECURE_LOCALHOST='true'
$env:VITE_REMOTE_UPDATE_MANIFEST_URL='http://localhost:8080/manifest.json'
$env:VITE_REMOTE_UPDATE_ALLOWED_ORIGINS='http://localhost:8080'
$env:REMOTE_UPDATE_ALLOWED_ORIGINS='localhost:8080'
```

Do not use insecure HTTP for production.
