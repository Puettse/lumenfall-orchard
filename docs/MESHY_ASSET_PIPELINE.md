# Meshy Character Asset Pipeline

This project can use Meshy AI as an offline content pipeline for Pip's generated character model and movement animations. The generated assets are copied into `public/assets/characters/pip/`, so Vite, GitHub Pages remote updates, and the Android WebView can load them as ordinary static GLB files.

The Meshy API key is never bundled into the web app or APK. Keep it in `scripts/MeshyAI.txt` or pass it as `MESHY_API_KEY` when running the script.

## Generate Pip

```powershell
npm run assets:meshy:pip
```

If Node reports certificate verification errors on Windows, run:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
npm run assets:meshy:pip
```

The script performs this pipeline:

1. Create a Meshy Text to 3D preview task with `model_type: "lowpoly"` and an A-pose humanoid prompt.
2. Refine it with diffuse-only texture settings and no PBR maps.
3. Rig the refined humanoid model.
4. Download the rigged GLB plus basic walking and running GLB animations.
5. Write `public/assets/characters/pip/manifest.json` so the game loads the generated avatar automatically.

Expected generated files:

```txt
public/assets/characters/pip/
  manifest.json
  pip-idle.glb
  pip-walk.glb
  pip-run.glb
  pip-thumbnail.png
```

If generation fails, or if `manifest.json` has `"enabled": false`, the game falls back to the original procedural Pip model and transform-based animation.

## Runtime Behavior

`GeneratedPlayerAvatar` reads the static manifest at startup. When generated assets are present, it hides the procedural body, loads the GLB states, applies unlit point-filtered materials, normalizes the model to Pip's gameplay height, and switches between idle, walk, and run clips based on movement state. The procedural glide/dash spark wings remain active as VFX.

## Security Notes

- Do not commit `scripts/MeshyAI.txt`.
- Do not paste the Meshy API key into source files, docs, environment examples, or Android resources.
- The `.meshy-cache` folder stores non-secret task IDs and local generation metadata only, and is ignored by git.
