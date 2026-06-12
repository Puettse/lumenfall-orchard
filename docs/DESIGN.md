# Lumenfall Orchard: Moonroot Keep Design Summary

## Creative Direction

Moonroot Keep is an original low-poly 3D dungeon adventure inspired by the emotional jump from late 16-bit color palettes to early console 3D spaces. It uses chunky silhouettes, saturated torchlit colors, enclosed stone rooms, readable corridors, false walls, and musical environmental objects to create a compact world that feels old, strange, and inviting.

No characters, music, names, levels, or assets are copied from existing Nintendo properties.

## Player Fantasy

The player is Pip, a tiny star-forged courier who can sprint, jump, glide, and spark-dash through a sealed keep beneath the old orchard. The fantasy is nimble traversal, curiosity, and restoring a sleeping place by finding what it remembers.

## Core Loop

1. Explore the keep from a flat gatehouse hall.
2. Read corridors, doorframes, bell rooms, false-wall clues, and raised ledges.
3. Use jump, glide, dash, moon-draft lifts, spring tiles, and camera control to reach them.
4. Ring Memory Bells for lore and progression.
5. Activate checkpoints to reduce risk.
6. Ride moon-draft lifts and spring tiles to discover vertical routes and shortcuts.
7. Avoid gloom pools while staying inside a fully enclosed structure.
8. Hunt optional Moon Pearls for hidden route mastery.
9. Unlock and awaken the Beacon Shrine.

## Objective

Collect at least 16 of 24 Lumen Seeds and ring all 3 Memory Bells. Then reach the Beacon Shrine and interact with it to win. Optional mastery comes from finding all 5 Moon Pearls tucked into harder or less obvious routes.

## Level Design

The vertical slice has eight connected spaces:

- Gatehouse Start: flat safe surface, tutorial sign, first seeds, first checkpoint.
- Moonroot Crossing: central hub with doors leading to optional and critical rooms.
- North Gallery: raised dais, bell placement, and moon-draft traversal.
- Root Crypt: heavier stone room with gloom and the first bell.
- Guard Hall: broad readable combat-free traversal space with seeds and pillars.
- Gloom Channel: hazard corridor that teaches risk and dash timing.
- Balcony Keep and Hidden Archive: raised ledges, spring tile traversal, secret wall cue, optional pearl route.
- Shrine Hall: locked moon gate, final shrine, and visible end-state reward.

The moon gate is visible before it opens, giving the player a clear destination while the connected room loop encourages exploration.

## Engagement Choices

- Movement is fast and forgiving so experimentation is fun.
- Dash has a short cooldown, making it useful without replacing platforming.
- Glide turns falls into recoverable moments and creates route-planning decisions.
- Coyote time and jump buffering make edge jumps feel intentional rather than brittle.
- Moon-draft lifts create authored indoor climbing set pieces.
- Moon spring tiles create fast vertical beats and reward chaining bounce, glide, and dash.
- The compass points to the current class of objective without revealing the whole route.
- Seeds are placed on routes, edges, and optional detours to pull the player through the world.
- Moon Pearls mark hidden, optional discoveries so replay has more texture than simply collecting every seed.
- Bells provide both progression and environmental storytelling.
- Checkpoints reward traversal milestones.
- Hazards are readable purple pools rather than surprise damage.
- Android and touch screens use a touch-specific control guide instead of desktop keyboard bindings.

## Art Direction

The visual style is low-poly twilight fantasy:

- Boxy stone rooms, corridors, ceilings, arches, and threshold walls.
- Pillars, banners, torches, cracked secret-wall markings, and low-poly shrine architecture.
- Icosahedron light seeds and beacon crystals.
- Pearl relics and animated spring tiles as readable reward and traversal props.
- Heavy enclosed fog, warm torch color, cool stone fill, and scanline overlay.
- Pip can be upgraded from the procedural body to an original Meshy-generated low-poly humanoid GLB with rigged walk/run movement while keeping the same silhouette language, unlit texture treatment, and glide/dash VFX.

## Audio Direction

Audio is procedural WebAudio:

- Jump, dash, collect, secret, launch, bell, checkpoint, hurt, gate, and win cues.
- Sparse ambient tones only; the continuous procedural melody was removed because it competed with play instead of supporting it.
- No external music or copyrighted audio.
