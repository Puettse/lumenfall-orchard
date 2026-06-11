import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { makeMat, palette } from "./ProceduralAssets";

type AvatarStateName = "idle" | "walk" | "run";

type GeneratedAvatarManifest = {
  enabled?: boolean;
  source?: string;
  version?: string;
  targetHeight?: number;
  scale?: number;
  rotationY?: number;
  heightOffset?: number;
  states?: Partial<Record<AvatarStateName, string>>;
};

type AvatarRuntimeState = {
  group: THREE.Group;
  mixer?: THREE.AnimationMixer;
  action?: THREE.AnimationAction;
};

type AvatarUpdateContext = {
  moving: boolean;
  grounded: boolean;
  gliding: boolean;
  dashTimer: number;
  speed: number;
  animationTime: number;
};

const MANIFEST_URL = "assets/characters/pip/manifest.json";
const ASSET_ROOT_URL = "assets/characters/pip/";
const DEFAULT_TARGET_HEIGHT = 2.05;
const DEFAULT_ROTATION_Y = Math.PI;

const scratchBox = new THREE.Box3();
const scratchCenter = new THREE.Vector3();

export class GeneratedPlayerAvatar {
  private readonly loader = new GLTFLoader();
  private readonly fallbackChildren: THREE.Object3D[];
  private readonly states = new Map<AvatarStateName, AvatarRuntimeState>();
  private readonly vfx: THREE.Group;

  private ready = false;
  private activeState: AvatarStateName | null = null;
  private targetHeight = DEFAULT_TARGET_HEIGHT;
  private assetScale = 1;
  private rotationY = DEFAULT_ROTATION_Y;
  private heightOffset = 0;

  constructor(private readonly root: THREE.Group) {
    this.fallbackChildren = [...root.children];
    this.vfx = createGeneratedAvatarVfx();
    root.add(this.vfx);
    void this.load();
  }

  update(dt: number, context: AvatarUpdateContext): void {
    updateGeneratedAvatarVfx(this.vfx, context);

    if (!this.ready) {
      return;
    }

    for (const state of this.states.values()) {
      state.mixer?.update(dt);
    }

    const nextState = this.chooseState(context);
    if (nextState !== this.activeState) {
      this.activateState(nextState);
    }

    const active = nextState ? this.states.get(nextState) : undefined;
    if (active?.action) {
      active.action.timeScale = context.dashTimer > 0 ? 1.35 : THREE.MathUtils.clamp(context.speed / 6.5, 0.75, 1.25);
    }
  }

  debugSnapshot() {
    return {
      ready: this.ready,
      activeState: this.activeState,
      availableStates: [...this.states.keys()],
      proceduralFallbackVisible: this.fallbackChildren.some((child) => child.visible)
    };
  }

  private async load(): Promise<void> {
    try {
      const response = await fetch(MANIFEST_URL, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const manifest = (await response.json()) as GeneratedAvatarManifest;
      if (!manifest.enabled || !manifest.states) {
        return;
      }

      this.targetHeight = manifest.targetHeight ?? DEFAULT_TARGET_HEIGHT;
      this.assetScale = manifest.scale ?? 1;
      this.rotationY = manifest.rotationY ?? DEFAULT_ROTATION_Y;
      this.heightOffset = manifest.heightOffset ?? 0;

      await Promise.all(
        (Object.entries(manifest.states) as Array<[AvatarStateName, string | undefined]>)
          .filter((entry): entry is [AvatarStateName, string] => Boolean(entry[1]))
          .map(([stateName, fileName]) => this.loadState(stateName, fileName))
      );

      if (this.states.size === 0) {
        return;
      }

      this.ready = true;
      this.setProceduralFallbackVisible(false);
      this.activateState(this.states.has("idle") ? "idle" : this.firstAvailableState());
    } catch {
      this.setProceduralFallbackVisible(true);
    }
  }

  private async loadState(stateName: AvatarStateName, fileName: string): Promise<void> {
    const gltf = await this.loader.loadAsync(`${ASSET_ROOT_URL}${fileName}`);
    const group = normalizeGeneratedAvatar(gltf.scene, {
      targetHeight: this.targetHeight,
      assetScale: this.assetScale,
      rotationY: this.rotationY,
      heightOffset: this.heightOffset
    });
    group.name = `generated-pip-${stateName}`;
    group.visible = false;
    this.root.add(group);

    const clip = gltf.animations[0];
    const runtimeState: AvatarRuntimeState = { group };
    if (clip) {
      runtimeState.mixer = new THREE.AnimationMixer(gltf.scene);
      runtimeState.action = runtimeState.mixer.clipAction(clip);
      runtimeState.action.enabled = true;
      runtimeState.action.setLoop(THREE.LoopRepeat, Infinity);
      runtimeState.action.play();
    }
    this.states.set(stateName, runtimeState);
  }

  private chooseState(context: AvatarUpdateContext): AvatarStateName | null {
    if (context.dashTimer > 0 && this.states.has("run")) {
      return "run";
    }
    if (!context.grounded && this.states.has("run")) {
      return "run";
    }
    if (context.moving) {
      if (context.speed > 6.4 && this.states.has("run")) {
        return "run";
      }
      if (this.states.has("walk")) {
        return "walk";
      }
    }
    if (this.states.has("idle")) {
      return "idle";
    }
    return this.firstAvailableState();
  }

  private firstAvailableState(): AvatarStateName | null {
    return this.states.keys().next().value ?? null;
  }

  private activateState(nextState: AvatarStateName | null): void {
    this.activeState = nextState;
    for (const [stateName, state] of this.states) {
      state.group.visible = stateName === nextState;
    }
  }

  private setProceduralFallbackVisible(visible: boolean): void {
    for (const child of this.fallbackChildren) {
      child.visible = visible;
    }
  }
}

const normalizeGeneratedAvatar = (
  scene: THREE.Group,
  options: {
    targetHeight: number;
    assetScale: number;
    rotationY: number;
    heightOffset: number;
  }
): THREE.Group => {
  retrofitGeneratedAvatarMaterials(scene);
  scratchBox.setFromObject(scene);
  scratchBox.getCenter(scratchCenter);

  const height = Math.max(0.001, scratchBox.max.y - scratchBox.min.y);
  scene.position.x -= scratchCenter.x;
  scene.position.y -= scratchBox.min.y;
  scene.position.z -= scratchCenter.z;

  const container = new THREE.Group();
  container.add(scene);
  container.scale.setScalar((options.targetHeight / height) * options.assetScale);
  container.rotation.y = options.rotationY;
  container.position.y = options.heightOffset;
  return container;
};

const retrofitGeneratedAvatarMaterials = (root: THREE.Object3D): void => {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => createRetroTextureMaterial(material))
      : createRetroTextureMaterial(mesh.material);
  });
};

const createRetroTextureMaterial = (source: THREE.Material): THREE.MeshBasicMaterial => {
  const sourceWithTexture = source as THREE.Material & {
    color?: THREE.Color;
    map?: THREE.Texture | null;
    alphaTest?: number;
  };
  const map = sourceWithTexture.map ?? null;
  if (map) {
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }

  const material = new THREE.MeshBasicMaterial({
    color: sourceWithTexture.color?.clone() ?? new THREE.Color("#ffffff"),
    map,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: sourceWithTexture.alphaTest ?? 0,
    side: source.side,
    fog: true,
    toneMapped: false
  });
  material.name = `${source.name || "generated"}-retro`;
  return material;
};

const createGeneratedAvatarVfx = (): THREE.Group => {
  const group = new THREE.Group();
  group.name = "generated-avatar-vfx";
  group.visible = false;

  const wingMat = makeMat(palette.blue, { transparent: true, opacity: 0.58, emissive: palette.blue });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.56, 1.05), wingMat);
    wing.name = `generated-wing-${side}`;
    wing.position.set(side * 0.55, 0.95, 0.08);
    wing.rotation.z = side * 0.76;
    group.add(wing);
  }

  const spark = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.035, 5, 16),
    makeMat(palette.glow, { transparent: true, opacity: 0.74, emissive: palette.glow })
  );
  spark.name = "generated-spark-ring";
  spark.position.y = 1.08;
  spark.rotation.x = Math.PI / 2;
  group.add(spark);

  return group;
};

const updateGeneratedAvatarVfx = (vfx: THREE.Group, context: AvatarUpdateContext): void => {
  const visible = context.gliding || context.dashTimer > 0;
  vfx.visible = visible;
  if (!visible) {
    return;
  }

  const flap = Math.sin(context.animationTime * (context.dashTimer > 0 ? 22 : 14)) * 0.18;
  for (const child of vfx.children) {
    if (child.name.startsWith("generated-wing-")) {
      const side = child.name.endsWith("-1") ? 1 : -1;
      child.rotation.z = side * (0.76 + flap);
      child.rotation.x = flap * 0.45;
    } else {
      child.rotation.z += 0.08;
      child.scale.setScalar(1 + Math.sin(context.animationTime * 9) * 0.08);
    }
  }
};
