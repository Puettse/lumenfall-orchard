# Lumenfall Orchard Design Summary

## Creative Direction

Lumenfall Orchard is an original low-poly 3D adventure platformer inspired by the emotional jump from late 16-bit color palettes to early console 3D spaces. It uses chunky silhouettes, saturated twilight colors, floating islands, simple readable geometry, and musical environmental objects to create a compact world that feels old, strange, and inviting.

No characters, music, names, levels, or assets are copied from existing Nintendo properties.

## Player Fantasy

The player is Pip, a tiny star-forged courier who can sprint, jump, glide, and spark-dash across a collapsing orchard in the clouds. The fantasy is not combat power; it is nimble traversal, curiosity, and restoring a sleeping place by finding what it remembers.

## Core Loop

1. Explore the orchard from a central hub.
2. Spot seeds, bells, landmarks, and route opportunities.
3. Use jump, glide, dash, Starflower launches, and camera control to reach them.
4. Ring Memory Bells for lore and progression.
5. Activate checkpoints to reduce risk.
6. Ride Skybreath updrafts and Starflower springs to discover vertical routes and shortcuts.
7. Avoid gloom pools and recover from falls.
8. Hunt optional Moon Pearls for hidden route mastery.
9. Unlock and awaken the Beacon Shrine.

## Objective

Collect at least 16 of 24 Lumen Seeds and ring all 3 Memory Bells. Then reach the Beacon Shrine and interact with it to win. Optional mastery comes from finding all 5 Moon Pearls tucked into harder or less obvious routes.

## Level Design

The vertical slice has four main spaces:

- Home Orchard: safe central area, first seeds, tutorial sign, first checkpoint.
- Lower Grove: lower-risk descent route with a root bell and gloom hazard.
- Windmill Ridge: vertical climb, moving wind platform, higher-value seed placement.
- Waterfall Cave and Shrine Route: hidden path, secret bell, final approach, shrine gate.

The shrine is visible early but cannot be completed immediately, giving the player a clear destination while encouraging exploration.

## Engagement Choices

- Movement is fast and forgiving so experimentation is fun.
- Dash has a short cooldown, making it useful without replacing platforming.
- Glide turns falls into recoverable moments and creates route-planning decisions.
- Coyote time and jump buffering make edge jumps feel intentional rather than brittle.
- Skybreath updrafts create authored set pieces for climbing, shortcuts, and secret-route recovery.
- Starflower launch pads create fast vertical beats and reward chaining bounce, glide, and dash.
- The compass points to the current class of objective without revealing the whole route.
- Seeds are placed on routes, edges, and optional detours to pull the player through the world.
- Moon Pearls mark hidden, optional discoveries so replay has more texture than simply collecting every seed.
- Bells provide both progression and environmental storytelling.
- Checkpoints reward traversal milestones.
- Hazards are readable purple pools rather than surprise damage.
- Android and touch screens use a touch-specific control guide instead of desktop keyboard bindings.

## Art Direction

The visual style is low-poly twilight fantasy:

- Boxy island slabs with cone undersides.
- Oversized fruit trees with faceted crowns.
- Icosahedron light seeds and beacon crystals.
- Pearl relics and animated flower launch pads as readable reward and traversal props.
- Simple shrine and windmill silhouettes.
- Heavy fog, warm key light, cool fill light, and scanline overlay.

## Audio Direction

Audio is procedural WebAudio:

- Jump, dash, collect, secret, launch, bell, checkpoint, hurt, gate, and win cues.
- Sparse ambient tones only; the continuous procedural melody was removed because it competed with play instead of supporting it.
- No external music or copyrighted audio.
