import * as THREE from "three";
import { AudioDirector } from "./systems/AudioDirector";
import { InputController } from "./systems/InputController";
import { ParticleSystem } from "./systems/ParticleSystem";
import { PlayerController } from "./systems/PlayerController";
import { SaveSystem } from "./systems/SaveSystem";
import { makeMat, palette } from "./systems/ProceduralAssets";
import { GameMode, WorldState } from "./types";
import { WorldBuilder } from "./world/WorldBuilder";

const requiredSeeds = 16;

type HudElements = {
  seeds: HTMLElement;
  bells: HTMLElement;
  relics: HTMLElement;
  health: HTMLElement;
  healthFill: HTMLElement;
  dashFill: HTMLElement;
  compass: HTMLElement;
  compassArrow: HTMLElement;
  compassLabel: HTMLElement;
  objective: HTMLElement;
  timer: HTMLElement;
  prompt: HTMLElement;
  toast: HTMLElement;
  winBody: HTMLElement;
  bestBody: HTMLElement;
};

export class LumenfallGame {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 260);
  private readonly cameraRaycaster = new THREE.Raycaster();
  private readonly input: InputController;
  private readonly audio = new AudioDirector();
  private readonly save = new SaveSystem();
  private readonly particles: ParticleSystem;
  private readonly world: WorldState;
  private readonly player: PlayerController;
  private readonly playerShadow: THREE.Mesh;
  private readonly hud: HudElements;
  private readonly titleOverlay: HTMLElement;
  private readonly pauseOverlay: HTMLElement;
  private readonly winOverlay: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly debugProbe: HTMLElement;

  private mode = GameMode.Title;
  private rafHandle = 0;
  private timeoutHandle = 0;
  private lastFrame = performance.now();
  private cameraYaw = Math.PI * 0.18;
  private cameraPosition = new THREE.Vector3(0, 7, 13);
  private toastTimer = 0;
  private promptText = "";
  private seedCount = 0;
  private bellCount = 0;
  private relicCount = 0;
  private elapsed = 0;
  private gateOpen = false;
  private gateAnnounced = false;
  private hurtPulse = 0;
  private cameraShake = 0;
  private cameraKick = 0;
  private inputLockTimer = 0;
  private lastInputDebug = {
    moveX: 0,
    moveY: 0,
    jump: false,
    jumpPressed: false,
    dashPressed: false,
    interactPressed: false,
    pausePressed: false,
    locked: false,
    source: {
      jumpHeldSource: "",
      jumpPressedSource: "",
      heldKeys: "",
      touchHeld: "",
      touchPressed: "",
      gamepad: ""
    }
  };
  private activeWindDebug = "";
  private activeLaunchDebug = "";
  private debugJumpCount = 0;
  private debugLandCount = 0;
  private debugLaunchCount = 0;
  private debugWindCount = 0;
  private debugMaxY = 0;
  private debugJumpSources: Record<string, number> = {};

  constructor(private readonly root: HTMLElement) {
    this.root.innerHTML = this.renderShell();
    this.root.classList.toggle("touch-ui", window.matchMedia?.("(pointer: coarse)").matches ?? false);
    const viewport = this.query<HTMLElement>("#viewport");
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.15));
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    viewport.append(this.renderer.domElement);

    this.world = new WorldBuilder(this.scene).build();
    this.player = new PlayerController(this.world.startPosition);
    this.scene.add(this.player.mesh);
    this.playerShadow = this.createPlayerShadow();
    this.scene.add(this.playerShadow);
    this.player.setCheckpoint(this.world.startPosition.clone().add(new THREE.Vector3(0, -1.2, 0)));
    this.particles = new ParticleSystem(this.scene);
    this.input = new InputController(this.root);

    this.titleOverlay = this.query("#title-overlay");
    this.pauseOverlay = this.query("#pause-overlay");
    this.winOverlay = this.query("#win-overlay");
    this.vignette = this.query("#hurt-vignette");
    this.debugProbe = this.query("#debug-probe");
    this.hud = {
      seeds: this.query("#hud-seeds"),
      bells: this.query("#hud-bells"),
      relics: this.query("#hud-relics"),
      health: this.query("#hud-health"),
      healthFill: this.query("#health-fill"),
      dashFill: this.query("#dash-fill"),
      compass: this.query("#compass"),
      compassArrow: this.query("#compass-arrow"),
      compassLabel: this.query("#compass-label"),
      objective: this.query("#hud-objective"),
      timer: this.query("#hud-timer"),
      prompt: this.query("#prompt"),
      toast: this.query("#toast"),
      winBody: this.query("#win-body"),
      bestBody: this.query("#best-body")
    };

    this.bindUi();
    this.installDebugHooks();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.updateHud();
    this.showToast("Lumenfall Orchard awaits. Restore the shrine before night settles.", 4.5);
  }

  start(): void {
    this.loop(performance.now());
  }

  destroy(): void {
    cancelAnimationFrame(this.rafHandle);
    window.clearTimeout(this.timeoutHandle);
    window.removeEventListener("resize", this.resize);
    this.input.destroy();
    this.renderer.dispose();
  }

  private bindUi(): void {
    this.query<HTMLButtonElement>("#start-button").addEventListener("click", () => this.startRun());
    this.query<HTMLButtonElement>("#resume-button").addEventListener("click", () => this.setMode(GameMode.Playing));
    this.query<HTMLButtonElement>("#pause-restart-button").addEventListener("click", () => this.startRun());
    this.query<HTMLButtonElement>("#win-restart-button").addEventListener("click", () => this.startRun());
    this.query<HTMLButtonElement>("#title-button").addEventListener("click", () => {
      this.setMode(GameMode.Title);
      this.titleOverlay.classList.remove("hidden");
      this.pauseOverlay.classList.add("hidden");
      this.winOverlay.classList.add("hidden");
    });
    this.query<HTMLButtonElement>("#mute-button").addEventListener("click", (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const muted = button.dataset.muted !== "true";
      button.dataset.muted = String(muted);
      button.textContent = muted ? "Sound" : "Mute";
      this.audio.setMuted(muted);
    });
  }

  private installDebugHooks(): void {
    (window as unknown as { __LUMENFALL_DEBUG__?: unknown }).__LUMENFALL_DEBUG__ = {
      state: () => ({
        mode: this.mode,
        seeds: this.seedCount,
        bells: this.bellCount,
        health: this.player.health,
        player: {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z,
          velocityY: this.player.velocity.y,
          grounded: this.player.grounded,
          gliding: this.player.gliding,
          platform: this.player.getGroundedPlatformId()
        },
        avatar: this.player.getAvatarDebug(),
        gateOpen: this.gateOpen,
        objective: this.hud.objective.textContent
      }),
      startRun: () => this.startRun(),
      teleport: (x: number, y: number, z: number) => {
        this.player.position.set(x, y, z);
        this.player.velocity.set(0, 0, 0);
        this.player.mesh.position.copy(this.player.position);
        this.cameraPosition.copy(this.player.position).add(new THREE.Vector3(0, 5.25, 9.6));
      },
      setCameraYaw: (yaw: number) => {
        this.cameraYaw = yaw;
      },
      samplePixels: () => this.samplePixels()
    };
  }

  private startRun(): void {
    this.audio.resume();
    this.audio.play("start");
    this.seedCount = 0;
    this.bellCount = 0;
    this.relicCount = 0;
    this.elapsed = 0;
    this.gateOpen = false;
    this.gateAnnounced = false;
    this.hurtPulse = 0;
    this.cameraShake = 0;
    this.cameraKick = 0;
    this.inputLockTimer = 0.45;
    this.input.reset();
    this.debugJumpCount = 0;
    this.debugLandCount = 0;
    this.debugLaunchCount = 0;
    this.debugWindCount = 0;
    this.debugMaxY = this.world.startPosition.y;
    this.debugJumpSources = {};

    this.world.collectibles.forEach((collectible) => {
      collectible.collected = false;
      collectible.mesh.visible = true;
    });
    this.world.bells.forEach((bell) => {
      bell.rung = false;
      bell.mesh.scale.setScalar(1);
    });
    this.world.loreMarkers.forEach((marker) => {
      marker.seen = false;
    });
    this.world.windCurrents.forEach((current) => {
      current.discovered = false;
    });
    this.world.launchPads.forEach((pad) => {
      pad.discovered = false;
    });
    this.world.checkpoints.forEach((checkpoint, index) => {
      checkpoint.active = index === 0;
      this.updateCheckpointVisual(checkpoint);
    });
    this.world.gate.visible = true;
    this.world.gate.position.set(0, 0, 0);
    this.player.setCheckpoint(this.world.startPosition.clone().add(new THREE.Vector3(0, -1.2, 0)));
    this.player.reset(this.world.startPosition);
    this.cameraYaw = Math.PI * 0.18;
    this.showToast("Find 16 seeds, ring 3 Memory Bells, then awaken the Beacon Shrine.", 4.2);
    this.setMode(GameMode.Playing);
  }

  private setMode(mode: GameMode): void {
    this.mode = mode;
    this.titleOverlay.classList.toggle("hidden", mode !== GameMode.Title);
    this.pauseOverlay.classList.toggle("hidden", mode !== GameMode.Paused);
    this.winOverlay.classList.toggle("hidden", mode !== GameMode.Won);
  }

  private readonly loop = (time: number) => {
    cancelAnimationFrame(this.rafHandle);
    window.clearTimeout(this.timeoutHandle);

    const dt = Math.min(0.05, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    const rawInput = this.input.snapshot();
    if (this.inputLockTimer > 0) {
      this.inputLockTimer = Math.max(0, this.inputLockTimer - dt);
    }
    const frameInput = this.inputLockTimer > 0
      ? {
          ...rawInput,
          jump: false,
          jumpPressed: false,
          dashPressed: false,
          interactPressed: false,
          pausePressed: false
        }
      : rawInput;
    this.lastInputDebug = {
      moveX: Number(frameInput.moveX.toFixed(2)),
      moveY: Number(frameInput.moveY.toFixed(2)),
      jump: frameInput.jump,
      jumpPressed: frameInput.jumpPressed,
      dashPressed: frameInput.dashPressed,
      interactPressed: frameInput.interactPressed,
      pausePressed: frameInput.pausePressed,
      locked: this.inputLockTimer > 0,
      source: this.input.debugSnapshot()
    };

    if (frameInput.pausePressed) {
      if (this.mode === GameMode.Playing) {
        this.setMode(GameMode.Paused);
      } else if (this.mode === GameMode.Paused) {
        this.setMode(GameMode.Playing);
      }
    }

    this.animateWorld(time / 1000, dt);
    this.audio.update(dt);

    if (this.mode === GameMode.Playing) {
      this.elapsed += dt;
      this.cameraYaw += frameInput.cameraX * dt * 1.7 + frameInput.pointerLookX;
      const events = this.player.update(dt, frameInput, this.cameraYaw, this.world.platforms, this.world.barriers);
      if (events.jumped) {
        this.debugJumpCount += 1;
        const jumpSource = this.lastInputDebug.source.jumpPressedSource || "buffer";
        this.debugJumpSources[jumpSource] = (this.debugJumpSources[jumpSource] ?? 0) + 1;
        this.audio.play("jump");
        this.cameraKick = Math.max(this.cameraKick, 0.18);
      }
      if (events.dashed) {
        this.audio.play("dash");
        this.cameraShake = Math.max(this.cameraShake, 0.18);
        this.cameraKick = Math.max(this.cameraKick, 0.35);
      }
      if (events.landed) {
        this.debugLandCount += 1;
        this.cameraShake = Math.max(this.cameraShake, 0.08);
        this.particles.burst(this.player.position.clone().add(new THREE.Vector3(0, 0.25, 0)), "blue", 5);
      }
      if (events.fell) {
        this.audio.play("hurt");
        this.cameraShake = Math.max(this.cameraShake, 0.4);
        this.showToast("The clouds caught Pip and returned them to the last lantern.", 2.8);
      }

      if (this.player.dashTimer > 0 || this.player.gliding) {
        this.particles.trail(this.player.position.clone().add(new THREE.Vector3(0, 0.8, 0)), this.player.gliding ? "blue" : "gold");
      }

      this.handleInteractions(frameInput.interactPressed, dt);
      this.handleWindCurrents(dt);
      this.handleLaunchPads();
      this.debugMaxY = Math.max(this.debugMaxY, this.player.position.y);
      this.updateGate(dt);
      this.updatePrompt();
      this.updateHud();
      this.updateCompass();
    } else if (this.mode === GameMode.Title) {
      this.cameraYaw += dt * 0.12;
      this.player.mesh.rotation.y += dt * 0.65;
    }

    this.updateCamera(dt);
    this.updatePlayerShadow();
    this.particles.update(dt);
    this.updateToast(dt);
    this.updateVignette(dt);
    this.renderer.render(this.scene, this.camera);
    this.rafHandle = requestAnimationFrame(this.loop);
    this.timeoutHandle = window.setTimeout(() => this.loop(performance.now()), 1000 / 30);
    this.updateDebugProbe();
  };

  private handleInteractions(interactPressed: boolean, dt: number): void {
    const playerCenter = this.player.position.clone().add(new THREE.Vector3(0, 0.9, 0));

    for (const collectible of this.world.collectibles) {
      if (collectible.collected || collectible.position.distanceTo(playerCenter) > 1.15) {
        continue;
      }
      collectible.collected = true;
      collectible.mesh.visible = false;

      if (collectible.kind === "secret") {
        this.relicCount += 1;
        this.audio.play("secret");
        this.cameraShake = Math.max(this.cameraShake, 0.18);
        this.cameraKick = Math.max(this.cameraKick, 0.25);
        this.particles.burst(collectible.position, "blue", 26);
        this.showToast(`Moon Pearl found (${this.relicCount}/5). The old orchard keeps optional memories.`, 3.1);
      } else {
        this.seedCount += 1;
        this.audio.play("collect");
        this.cameraShake = Math.max(this.cameraShake, 0.06);
        this.particles.burst(collectible.position, "gold", 16);
        this.save.recordSeeds(this.seedCount);
        if (this.seedCount === requiredSeeds) {
          this.showToast("The seeds hum in rhythm. The shrine gate wants the three bells now.", 3.8);
        } else if (this.seedCount % 4 === 0) {
          this.showToast(`${this.seedCount} seeds glow in Pip's satchel.`, 2.1);
        }
      }
    }

    for (const hazard of this.world.hazards) {
      const horizontalDistance = Math.hypot(
        this.player.position.x - hazard.position.x,
        this.player.position.z - hazard.position.z
      );
      const closeY = Math.abs(this.player.position.y - hazard.position.y) < 1.7;
      if (horizontalDistance < hazard.radius && closeY) {
        if (this.player.damage(hazard.damagePerSecond * dt)) {
          this.audio.play("hurt");
          this.hurtPulse = 1;
          this.cameraShake = Math.max(this.cameraShake, 0.34);
          this.particles.burst(this.player.position.clone().add(new THREE.Vector3(0, 1, 0)), "hurt", 12);
          this.showToast("Gloom thorns burn. Dash or jump clear of the purple pools.", 2.5);
        }
      }
    }

    for (const checkpoint of this.world.checkpoints) {
      if (checkpoint.position.distanceTo(playerCenter) > 1.6 || checkpoint.active) {
        continue;
      }
      this.world.checkpoints.forEach((other) => {
        other.active = false;
        this.updateCheckpointVisual(other);
      });
      checkpoint.active = true;
      this.updateCheckpointVisual(checkpoint);
      this.player.setCheckpoint(checkpoint.position);
      this.audio.play("checkpoint");
      this.cameraKick = Math.max(this.cameraKick, 0.22);
      this.particles.burst(checkpoint.position.clone().add(new THREE.Vector3(0, 0.8, 0)), "blue", 16);
      this.showToast(`${checkpoint.name} is now your return lantern.`, 2.6);
    }

    for (const marker of this.world.loreMarkers) {
      if (!marker.seen && marker.position.distanceTo(playerCenter) < marker.radius) {
        marker.seen = true;
        this.showToast(marker.message, 4.4);
      }
    }

    const nearBell = this.world.bells.find((bell) => bell.position.distanceTo(playerCenter) < 2.1);
    if (nearBell && interactPressed) {
      if (!nearBell.rung) {
        nearBell.rung = true;
        nearBell.mesh.scale.setScalar(1.12);
        this.bellCount += 1;
        this.audio.play("bell");
        this.cameraShake = Math.max(this.cameraShake, 0.25);
        this.cameraKick = Math.max(this.cameraKick, 0.3);
        this.particles.burst(nearBell.position.clone().add(new THREE.Vector3(0, 1.8, 0)), "blue", 22);
        this.showToast(nearBell.lore, 4.5);
      } else {
        this.audio.play("deny");
        this.showToast("This bell is already awake.", 1.5);
      }
    }

    const shrineDistance = this.world.shrinePosition.distanceTo(playerCenter);
    if (shrineDistance < 3.1 && interactPressed) {
      if (this.gateOpen) {
        this.win();
      } else {
        this.audio.play("deny");
        this.showToast(`The shrine listens for ${requiredSeeds} seeds and 3 bells.`, 2.5);
      }
    }
  }

  private handleWindCurrents(dt: number): void {
    const player = this.player.position;
    this.activeWindDebug = "";
    for (const current of this.world.windCurrents) {
      const dx = player.x - current.position.x;
      const dz = player.z - current.position.z;
      const horizontalDistance = Math.hypot(dx, dz);
      const vertical = player.y - current.position.y;
      const inside = horizontalDistance < current.radius && vertical >= -0.2 && vertical < current.height;
      if (!inside) {
        continue;
      }

      this.activeWindDebug = current.id;
      this.debugWindCount += 1;
      const strength = 1 - horizontalDistance / current.radius;
      this.player.velocity.y = Math.min(13.5, this.player.velocity.y + current.lift * (0.35 + strength) * dt);
      this.player.gliding = true;
      this.particles.trail(player.clone().add(new THREE.Vector3(0, 0.35, 0)), "blue");
      this.cameraKick = Math.max(this.cameraKick, 0.16);

      if (!current.discovered) {
        current.discovered = true;
        this.audio.play("checkpoint");
        this.showToast("A skybreath current lifts Pip. Hold glide to steer the climb.", 3.2);
      }
    }
  }

  private handleLaunchPads(): void {
    this.activeLaunchDebug = "";
    for (const pad of this.world.launchPads) {
      const horizontalDistance = Math.hypot(
        this.player.position.x - pad.position.x,
        this.player.position.z - pad.position.z
      );
      const vertical = this.player.position.y - pad.position.y;
      const onPad = horizontalDistance < pad.radius && vertical > -0.15 && vertical < 0.95 && this.player.velocity.y <= 1.8;
      if (!onPad) {
        continue;
      }

      this.activeLaunchDebug = pad.id;
      this.debugLaunchCount += 1;
      this.player.velocity.y = pad.strength;
      this.player.grounded = false;
      this.audio.play("launch");
      this.cameraShake = Math.max(this.cameraShake, 0.16);
      this.cameraKick = Math.max(this.cameraKick, 0.38);
      this.particles.burst(pad.position.clone().add(new THREE.Vector3(0, 0.55, 0)), "gold", 22);

      if (!pad.discovered) {
        pad.discovered = true;
        this.showToast("Starflower spring! Chain it with glide or dash to reach higher ledges.", 2.8);
      }
    }
  }

  private updateGate(dt: number): void {
    const canOpen = this.seedCount >= requiredSeeds && this.bellCount >= 3;
    if (canOpen && !this.gateOpen) {
      this.gateOpen = true;
      this.audio.play("gate");
      this.showToast("The moon gate exhales. The Beacon Shrine is open.", 3.2);
    }
    if (this.gateOpen) {
      this.world.gate.position.y = Math.min(3.8, this.world.gate.position.y + dt * 3.6);
      if (!this.gateAnnounced && this.world.gate.position.y > 1.8) {
        this.gateAnnounced = true;
      }
    }
  }

  private updatePrompt(): void {
    const playerCenter = this.player.position.clone().add(new THREE.Vector3(0, 0.9, 0));
    this.promptText = "";

    const nearBell = this.world.bells.find((bell) => bell.position.distanceTo(playerCenter) < 2.1);
    if (nearBell) {
      this.promptText = nearBell.rung ? "Bell already rung" : "Press E / Action to ring memory bell";
    }

    if (this.world.shrinePosition.distanceTo(playerCenter) < 3.1) {
      this.promptText = this.gateOpen ? "Press E / Action to awaken the shrine" : "Shrine requires 16 seeds and 3 bells";
    }

    this.hud.prompt.textContent = this.promptText;
    this.hud.prompt.classList.toggle("hidden", this.promptText.length === 0);
  }

  private win(): void {
    if (this.mode === GameMode.Won) {
      return;
    }
    this.audio.play("win");
    this.particles.burst(this.world.shrinePosition.clone().add(new THREE.Vector3(0, 2.8, 0)), "gold", 40);
    this.save.recordWin(this.elapsed, this.seedCount);
    const timeText = formatTime(this.elapsed);
    this.hud.winBody.textContent = `The Beacon Shrine blooms again. You restored ${this.seedCount}/24 seeds, found ${this.relicCount}/5 Moon Pearls, and rang all three Memory Bells in ${timeText}.`;
    const save = this.save.snapshot;
    this.hud.bestBody.textContent = `Best: ${save.bestSeeds}/24 seeds${save.bestTime ? `, ${formatTime(save.bestTime)}` : ""}. Clears: ${save.wins}.`;
    this.setMode(GameMode.Won);
  }

  private updateCamera(dt: number): void {
    const target = this.mode === GameMode.Title ? new THREE.Vector3(6, 4.4, -8) : this.player.position.clone().add(new THREE.Vector3(0, 0.95, 0));
    const distance = this.player.gliding ? 11.4 : 9.6;
    const height = this.player.gliding ? 6.2 : 5.25;
    const offset = new THREE.Vector3(Math.sin(this.cameraYaw) * distance, height, Math.cos(this.cameraYaw) * distance);
    const lookahead = this.player.velocity.clone().multiplyScalar(0.08);
    lookahead.y = 0;
    const desired = target.clone().add(offset).add(lookahead);
    const collidedDesired = this.resolveCameraCollision(target, desired);
    this.cameraPosition.lerp(collidedDesired, 1 - Math.pow(0.001, dt));
    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8);
    this.cameraKick = Math.max(0, this.cameraKick - dt * 1.2);
    const shake = this.cameraShake * this.cameraShake;
    const jitter = new THREE.Vector3(
      (Math.random() - 0.5) * shake * 0.42,
      (Math.random() - 0.5) * shake * 0.28,
      (Math.random() - 0.5) * shake * 0.42
    );
    this.camera.position.copy(this.cameraPosition).add(jitter);
    this.camera.fov = 62 + this.cameraKick * 10 + (this.player.dashTimer > 0 ? 4 : 0);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(target);
  }

  private resolveCameraCollision(target: THREE.Vector3, desired: THREE.Vector3): THREE.Vector3 {
    const direction = desired.clone().sub(target);
    const distance = direction.length();
    if (distance <= 0.001) {
      return desired;
    }

    direction.normalize();
    this.cameraRaycaster.set(target, direction);
    this.cameraRaycaster.far = distance;
    const hits = this.cameraRaycaster.intersectObjects(
      [
        ...this.world.platforms.map((platform) => platform.mesh),
        ...this.world.barriers.map((barrier) => barrier.mesh)
      ],
      true
    );
    const hit = hits.find((candidate) => candidate.distance > 1.2);
    if (!hit) {
      return desired;
    }

    return target.clone().addScaledVector(direction, Math.max(4.2, hit.distance - 0.95));
  }

  private createPlayerShadow(): THREE.Mesh {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.78, 24),
      new THREE.MeshBasicMaterial({
        color: "#120f1a",
        transparent: true,
        opacity: 0.36,
        depthWrite: false
      })
    );
    shadow.name = "player-fake-shadow";
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 2;
    shadow.visible = false;
    return shadow;
  }

  private updatePlayerShadow(): void {
    const ground = this.findGroundBelow(this.player.position);
    if (!ground || this.mode === GameMode.Title) {
      this.playerShadow.visible = false;
      return;
    }

    const height = Math.max(0, this.player.position.y - ground.top);
    const fade = Math.max(0, Math.min(1, 1 - height / 7));
    const scale = 0.42 + fade * 0.68;
    this.playerShadow.visible = fade > 0.08;
    this.playerShadow.position.set(this.player.position.x, ground.top + 0.026, this.player.position.z);
    this.playerShadow.scale.set(scale, scale * 0.72, 1);
    const material = this.playerShadow.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = 0.12 + fade * 0.24;
    }
  }

  private findGroundBelow(position: THREE.Vector3): { top: number } | null {
    let bestTop = -Infinity;
    for (const platform of this.world.platforms) {
      if (platform.top > position.y + 0.35 || position.y - platform.top > 9) {
        continue;
      }
      if (!pointWithinRotatedRect(
        position.x,
        position.z,
        platform.center.x,
        platform.center.z,
        platform.size.x / 2 + 0.45,
        platform.size.z / 2 + 0.45,
        platform.rotationY ?? 0
      )) {
        continue;
      }
      bestTop = Math.max(bestTop, platform.top);
    }
    return bestTop > -Infinity ? { top: bestTop } : null;
  }

  private animateWorld(time: number, dt: number): void {
    this.world.platforms.forEach((platform) => platform.update?.(time, dt));
    this.world.collectibles.forEach((collectible, index) => {
      if (collectible.collected) {
        return;
      }
      collectible.mesh.rotation.y += dt * 1.9;
      collectible.mesh.rotation.x = Math.sin(time * 2 + index) * 0.22;
      collectible.mesh.position.y = collectible.position.y + Math.sin(time * 2.5 + index) * 0.18;
      if (collectible.kind === "secret") {
        collectible.mesh.scale.setScalar(1 + Math.sin(time * 4 + index) * 0.08);
      }
    });
    this.world.bells.forEach((bell, index) => {
      const clapper = bell.mesh.children[3];
      if (clapper) {
        clapper.rotation.z = Math.sin(time * (bell.rung ? 9 : 2) + index) * (bell.rung ? 0.35 : 0.1);
      }
      if (bell.rung) {
        bell.mesh.rotation.y += dt * 0.2;
      }
    });
    this.world.hazards.forEach((hazard) => {
      const pulse = 1 + Math.sin(time * 4 + hazard.pulseOffset) * 0.08;
      hazard.mesh.scale.set(pulse, 1, pulse);
      hazard.mesh.rotation.y += dt * 0.7;
    });
    this.world.windCurrents.forEach((current, index) => {
      current.mesh.rotation.y += dt * (0.5 + index * 0.08);
      let ringIndex = 0;
      current.mesh.children.forEach((child, childIndex) => {
        if (child.name === "wind-ring") {
          child.position.y =
            0.75 +
            ringIndex * (current.height / 3) +
            ((time * 1.8 + index + ringIndex) % 1) * 0.35;
          child.rotation.z += dt * (0.8 + childIndex * 0.12);
          ringIndex += 1;
        }
      });
    });
    this.world.launchPads.forEach((pad, index) => {
      pad.mesh.rotation.y += dt * 0.4;
      const core = pad.mesh.getObjectByName("launch-core");
      const petals = pad.mesh.getObjectByName("launch-petals");
      if (core) {
        core.scale.setScalar(1 + Math.sin(time * 6 + index) * 0.12);
      }
      if (petals) {
        petals.rotation.y += dt * (0.8 + index * 0.12);
        petals.scale.setScalar(1 + Math.sin(time * 5 + index) * 0.05);
      }
    });
    this.world.checkpoints.forEach((checkpoint) => {
      const flame = checkpoint.mesh.getObjectByName("checkpoint-flame");
      if (flame) {
        flame.scale.setScalar((checkpoint.active ? 1.1 : 0.72) + Math.sin(time * 5) * 0.08);
      }
    });
    this.scene.traverse((object) => {
      if (object.name === "windmill-blades") {
        object.rotation.z += dt * 1.7;
      }
      if (object.name === "beacon") {
        object.rotation.y += dt * 0.8;
        object.scale.setScalar(1 + Math.sin(time * 3) * 0.08);
      }
      if (object.name === "twinkle-star") {
        object.scale.setScalar(0.7 + Math.sin(time * 1.7 + object.position.x) * 0.28);
      }
      if (object.name === "waterfall") {
        object.position.y = -3.9 + Math.sin(time * 2) * 0.08;
      }
    });
  }

  private updateCheckpointVisual(checkpoint: { mesh: THREE.Object3D; active: boolean }): void {
    const flame = checkpoint.mesh.getObjectByName("checkpoint-flame");
    if (flame instanceof THREE.Mesh) {
      flame.material = checkpoint.active
        ? makeMat(palette.glow, { emissive: palette.glow })
        : makeMat("#8a8da8", { emissive: "#111144" });
    }
  }

  private updateHud(): void {
    this.hud.seeds.textContent = `${this.seedCount}/24`;
    this.hud.bells.textContent = `${this.bellCount}/3`;
    this.hud.relics.textContent = `${this.relicCount}/5`;
    this.hud.health.textContent = `${Math.ceil(this.player.health)}%`;
    this.hud.healthFill.style.width = `${Math.max(0, this.player.health)}%`;
    this.hud.dashFill.style.width = `${Math.max(0, 100 - (this.player.dashCooldown / 0.82) * 100)}%`;
    this.hud.timer.textContent = formatTime(this.elapsed);
    if (this.seedCount < requiredSeeds) {
      this.hud.objective.textContent = `Find ${requiredSeeds - this.seedCount} more seeds`;
    } else if (this.bellCount < 3) {
      this.hud.objective.textContent = `Ring ${3 - this.bellCount} Memory Bell${3 - this.bellCount === 1 ? "" : "s"}`;
    } else {
      this.hud.objective.textContent = "Reach the Beacon Shrine";
    }
  }

  private updateCompass(): void {
    const target = this.getCurrentObjectiveTarget();
    if (!target) {
      this.hud.compass.classList.add("hidden");
      return;
    }

    this.hud.compass.classList.remove("hidden");
    const direction = target.position.clone().sub(this.player.position);
    const worldAngle = Math.atan2(direction.x, direction.z);
    const relative = worldAngle - this.cameraYaw;
    this.hud.compassArrow.style.transform = `rotate(${relative}rad)`;
    this.hud.compassLabel.textContent = target.label;
  }

  private getCurrentObjectiveTarget(): { position: THREE.Vector3; label: string } | null {
    if (this.seedCount < requiredSeeds) {
      const seed = this.world.collectibles
        .filter((collectible) => collectible.kind === "seed" && !collectible.collected)
        .sort((a, b) => a.position.distanceToSquared(this.player.position) - b.position.distanceToSquared(this.player.position))[0];
      return seed ? { position: seed.position, label: "Seed" } : null;
    }

    if (this.bellCount < 3) {
      const bell = this.world.bells
        .filter((candidate) => !candidate.rung)
        .sort((a, b) => a.position.distanceToSquared(this.player.position) - b.position.distanceToSquared(this.player.position))[0];
      return bell ? { position: bell.position, label: "Bell" } : null;
    }

    return { position: this.world.shrinePosition, label: "Shrine" };
  }

  private updateToast(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.hud.toast.classList.add("hidden");
      }
    }
  }

  private updateVignette(dt: number): void {
    this.hurtPulse = Math.max(0, this.hurtPulse - dt * 1.8);
    this.vignette.style.opacity = String(this.hurtPulse * 0.7);
  }

  private showToast(message: string, duration = 2.5): void {
    this.hud.toast.textContent = message;
    this.hud.toast.classList.remove("hidden");
    this.toastTimer = duration;
  }

  private samplePixels(): { checked: number; nonBlack: number; bright: number } {
    const gl = this.renderer.getContext();
    const width = this.renderer.domElement.width;
    const height = this.renderer.domElement.height;
    const samplePoints = [
      [0.18, 0.2],
      [0.5, 0.28],
      [0.82, 0.22],
      [0.24, 0.55],
      [0.5, 0.58],
      [0.76, 0.55],
      [0.36, 0.82],
      [0.64, 0.82]
    ];
    const pixel = new Uint8Array(4);
    let nonBlack = 0;
    let bright = 0;
    for (const [sx, sy] of samplePoints) {
      gl.readPixels(
        Math.max(0, Math.min(width - 1, Math.floor(sx * width))),
        Math.max(0, Math.min(height - 1, Math.floor(sy * height))),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel
      );
      const luminance = pixel[0] + pixel[1] + pixel[2];
      if (luminance > 18) nonBlack += 1;
      if (luminance > 180) bright += 1;
    }
    return { checked: samplePoints.length, nonBlack, bright };
  }

  private updateDebugProbe(): void {
    let pixels: { checked: number; nonBlack: number; bright: number } | { error: string };
    try {
      pixels = this.samplePixels();
    } catch (error) {
      pixels = { error: error instanceof Error ? error.message : "pixel probe failed" };
    }

    this.debugProbe.textContent = JSON.stringify({
      mode: this.mode,
      seeds: this.seedCount,
      bells: this.bellCount,
      relics: this.relicCount,
      health: Math.round(this.player.health),
      player: {
        x: Number(this.player.position.x.toFixed(2)),
        y: Number(this.player.position.y.toFixed(2)),
        z: Number(this.player.position.z.toFixed(2)),
        velocityY: Number(this.player.velocity.y.toFixed(2)),
        grounded: this.player.grounded,
        gliding: this.player.gliding,
        platform: this.player.getGroundedPlatformId()
      },
      gateOpen: this.gateOpen,
      objective: this.hud.objective.textContent,
      input: this.lastInputDebug,
      activeWind: this.activeWindDebug,
      activeLaunch: this.activeLaunchDebug,
      events: {
        jumps: this.debugJumpCount,
        lands: this.debugLandCount,
        winds: this.debugWindCount,
        launches: this.debugLaunchCount,
        maxY: Number(this.debugMaxY.toFixed(2))
      },
      jumpSources: this.debugJumpSources,
      barriers: this.world.barriers.length,
      pixels
    });
  }

  private readonly resize = () => {
    const width = this.root.clientWidth || window.innerWidth;
    const height = this.root.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private renderShell(): string {
    return `
      <main class="game-shell">
        <section id="viewport" class="viewport" aria-label="Lumenfall Orchard game viewport"></section>
        <div class="scanlines" aria-hidden="true"></div>
        <div id="hurt-vignette" class="hurt-vignette" aria-hidden="true"></div>
        <div id="debug-probe" class="hidden" aria-hidden="true"></div>

        <header class="hud">
          <div class="hud-title">
            <strong>Lumenfall Orchard</strong>
            <span id="hud-objective">Find 16 seeds</span>
          </div>
          <div class="hud-cluster">
            <div class="hud-chip"><span>Seeds</span><strong id="hud-seeds">0/24</strong></div>
            <div class="hud-chip"><span>Bells</span><strong id="hud-bells">0/3</strong></div>
            <div class="hud-chip optional"><span>Pearls</span><strong id="hud-relics">0/5</strong></div>
            <div class="hud-chip"><span>Time</span><strong id="hud-timer">00:00</strong></div>
            <div class="compass" id="compass">
              <span id="compass-arrow">^</span>
              <strong id="compass-label">Seeds</strong>
            </div>
            <div class="hud-meter">
              <span>Health <strong id="hud-health">100%</strong></span>
              <i><b id="health-fill"></b></i>
            </div>
            <div class="hud-meter">
              <span>Dash</span>
              <i><b id="dash-fill"></b></i>
            </div>
          </div>
          <div class="hud-actions">
            <button type="button" id="mute-button">Mute</button>
            <button type="button" id="title-button">Title</button>
          </div>
        </header>

        <div id="toast" class="toast hidden"></div>
        <div id="prompt" class="prompt hidden"></div>

        <section id="title-overlay" class="overlay title-overlay">
          <div class="title-copy">
            <p class="eyebrow">Original 3D retro adventure</p>
            <h1>Lumenfall Orchard</h1>
            <p>
              Sprint, glide, and spark-dash through a floating orchard where every bell remembers why the island is falling.
            </p>
            <div class="title-actions">
              <button type="button" class="primary" id="start-button">Begin Courier Run</button>
            </div>
            <dl class="control-grid desktop-controls">
              <div><dt>Move</dt><dd>WASD / Stick</dd></div>
              <div><dt>Jump + Glide</dt><dd>Space / A</dd></div>
              <div><dt>Spark Dash</dt><dd>Shift / B</dd></div>
              <div><dt>Ring Bells</dt><dd>E / Action</dd></div>
            </dl>
            <dl class="control-grid touch-title-controls">
              <div><dt>Move</dt><dd>Left pad</dd></div>
              <div><dt>Look</dt><dd>Drag view</dd></div>
              <div><dt>Glide</dt><dd>Hold Jump</dd></div>
              <div><dt>Use</dt><dd>Act near bells</dd></div>
            </dl>
          </div>
        </section>

        <section id="pause-overlay" class="overlay modal hidden">
          <div class="modal-panel">
            <h2>Paused</h2>
            <p>The orchard waits. Your checkpoint and progress are held for this run.</p>
            <button type="button" class="primary" id="resume-button">Resume</button>
            <button type="button" id="pause-restart-button">Restart Run</button>
          </div>
        </section>

        <section id="win-overlay" class="overlay modal hidden">
          <div class="modal-panel">
            <h2>Beacon Restored</h2>
            <p id="win-body"></p>
            <p id="best-body"></p>
            <button type="button" class="primary" id="win-restart-button">Play Again</button>
          </div>
        </section>

        <section class="touch-controls" aria-label="Touch controls">
          <div class="touch-stick" data-stick>
            <span></span>
          </div>
          <div class="touch-buttons">
            <button type="button" data-touch-action="jump">Jump</button>
            <button type="button" data-touch-action="dash">Dash</button>
            <button type="button" data-touch-action="interact">Act</button>
            <button type="button" data-touch-action="pause">Pause</button>
          </div>
        </section>
      </main>
    `;
  }

  private query<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing UI element: ${selector}`);
    }
    return element;
  }
}

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
};

const pointWithinRotatedRect = (
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  halfX: number,
  halfZ: number,
  rotationY: number
): boolean => {
  const dx = x - centerX;
  const dz = z - centerZ;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  return Math.abs(localX) <= halfX && Math.abs(localZ) <= halfZ;
};
