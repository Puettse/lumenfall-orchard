import * as THREE from "three";
import {
  Barrier,
  Bell,
  Checkpoint,
  Collectible,
  Hazard,
  LaunchPad,
  LoreMarker,
  Platform,
  WindCurrent,
  WorldState
} from "../types";
import {
  createBell,
  createHazardPool,
  createLaunchPad,
  createLowPolyBox,
  createRelic,
  createSeed,
  createShrine,
  createSign,
  createWindCurrent,
  makeMat,
  palette
} from "../systems/ProceduralAssets";

const cellSize = 4;
const floorTop = 0.5;
const floorThickness = 1;
const wallHeight = 4.8;
const wallThickness = 0.62;
const ceilingY = 5.42;

type DungeonRect = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  color: string;
};

export class WorldBuilder {
  readonly platforms: Platform[] = [];
  readonly barriers: Barrier[] = [];
  readonly collectibles: Collectible[] = [];
  readonly bells: Bell[] = [];
  readonly checkpoints: Checkpoint[] = [];
  readonly hazards: Hazard[] = [];
  readonly windCurrents: WindCurrent[] = [];
  readonly launchPads: LaunchPad[] = [];
  readonly loreMarkers: LoreMarker[] = [];

  private readonly dungeonCells = new Set<string>();
  private seedIndex = 0;

  constructor(private readonly scene: THREE.Scene) {}

  build(): WorldState {
    this.createDungeonAtmosphere();
    this.createDungeonRoute();
    const { shrine, gate, shrinePosition, gateBarrier } = this.createShrineHall();
    this.createDungeonDecorations();
    this.createCollectibles();
    this.createBells();
    this.createHazards();
    this.createArcaneLifts();
    this.createMoonSpringTiles();
    this.createCheckpoints();
    this.createLore();

    return {
      scene: this.scene,
      platforms: this.platforms,
      barriers: this.barriers,
      collectibles: this.collectibles,
      bells: this.bells,
      checkpoints: this.checkpoints,
      hazards: this.hazards,
      windCurrents: this.windCurrents,
      launchPads: this.launchPads,
      loreMarkers: this.loreMarkers,
      shrine,
      shrinePosition,
      gate,
      gateBarrier,
      startPosition: new THREE.Vector3(-34, floorTop + 0.15, 10)
    };
  }

  private createDungeonAtmosphere(): void {
    this.scene.background = new THREE.Color("#090913");
    this.scene.fog = new THREE.FogExp2("#171324", 0.026);

    const warmFill = new THREE.HemisphereLight("#ffdb9b", "#151225", 1.3);
    this.scene.add(warmFill);

    const coldShaft = new THREE.DirectionalLight("#7f95ff", 0.55);
    coldShaft.position.set(-12, 14, -8);
    this.scene.add(coldShaft);

    const undercroft = new THREE.Mesh(
      new THREE.BoxGeometry(128, 2.4, 112),
      makeMat("#06060d", { transparent: true, opacity: 0.72 })
    );
    undercroft.position.set(7, -2.15, 0);
    undercroft.name = "sealed-undercroft-darkness";
    this.scene.add(undercroft);
  }

  private createDungeonRoute(): void {
    const rects: DungeonRect[] = [
      { id: "gatehouse-start", minX: -9, maxX: -5, minZ: 1, maxZ: 4, color: "#585979" },
      { id: "moonroot-crossing", minX: -4, maxX: -1, minZ: 0, maxZ: 4, color: "#62617f" },
      { id: "north-gallery", minX: -4, maxX: -1, minZ: -5, maxZ: -2, color: "#575372" },
      { id: "gallery-throat", minX: -3, maxX: -2, minZ: -1, maxZ: -1, color: "#514f6b" },
      { id: "root-crypt", minX: -9, maxX: -6, minZ: -5, maxZ: -2, color: "#4a495f" },
      { id: "crypt-passage", minX: -5, maxX: -5, minZ: -4, maxZ: -3, color: "#4e4c65" },
      { id: "guard-hall", minX: 0, maxX: 4, minZ: 1, maxZ: 4, color: "#615b77" },
      { id: "gloom-channel", minX: 1, maxX: 4, minZ: -5, maxZ: -2, color: "#4c4964" },
      { id: "channel-neck", minX: 2, maxX: 3, minZ: -1, maxZ: 0, color: "#514d67" },
      { id: "balcony-keep", minX: 5, maxX: 9, minZ: 1, maxZ: 4, color: "#665f7b" },
      { id: "hidden-archive", minX: 5, maxX: 8, minZ: -5, maxZ: -3, color: "#504866" },
      { id: "shrine-hall", minX: 10, maxX: 14, minZ: 0, maxZ: 4, color: "#6b6385" }
    ];

    for (const rect of rects) {
      this.addDungeonRect(rect);
    }

    this.addRaisedPlatform("balcony-archive-ledge", new THREE.Vector3(30, 2.0, 18), new THREE.Vector3(16, 1, 4), "#75658d");
    this.addRaisedPlatform("gallery-dais", new THREE.Vector3(-8, 1.15, -18), new THREE.Vector3(9, 1, 4), "#625473");
    this.addStairRun("balcony-stairs", new THREE.Vector3(23.2, floorTop, 10.8), new THREE.Vector3(3.2, 0.42, 1.25), "z", 5, floorTop + 0.42, 2.5);
    this.addStairRun("gallery-dais-steps", new THREE.Vector3(-5.6, floorTop, -12.6), new THREE.Vector3(2.9, 0.36, 1.15), "z", 4, floorTop + 0.34, 1.65);

    this.addDungeonWalls();
    this.addInteriorThresholdWalls();
    this.addShrineThresholdWalls();
    this.addDoorFrames();
    this.addBalconyRails();
  }

  private createShrineHall() {
    const shrine = createShrine();
    shrine.position.set(52, floorTop, 8);
    shrine.scale.setScalar(1.08);
    this.scene.add(shrine);

    const gate = new THREE.Group();
    gate.position.set(40.05, floorTop, 8);
    gate.name = "moonroot-gate";
    gate.userData.closedY = floorTop;

    const postMat = makeMat("#201832", { emissive: "#0b0615" });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.52, 3.4, 0.58), postMat);
    const right = left.clone();
    left.position.set(0, 1.7, -2.85);
    right.position.set(0, 1.7, 2.85);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 6.4), postMat);
    lintel.position.set(0, 3.45, 0);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 2.8, 4.85),
      makeMat("#2c2442", { emissive: "#130821" })
    );
    door.name = "gate-door";
    door.position.set(0, 1.42, 0);

    const moonSigil = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.06, 5, 18),
      makeMat(palette.glow, { emissive: palette.glow, transparent: true, opacity: 0.86 })
    );
    moonSigil.position.set(-0.34, 2.0, 0);
    moonSigil.rotation.y = Math.PI / 2;

    gate.add(left, right, lintel, door, moonSigil);
    this.scene.add(gate);

    const gateBarrier = this.addCollisionBarrier(
      "moonroot-gate-barrier",
      new THREE.Vector3(40.05, floorTop + 1.55, 8),
      new THREE.Vector3(0.74, 3.1, 5.25)
    );

    return {
      shrine,
      gate,
      gateBarrier,
      shrinePosition: new THREE.Vector3(52, floorTop + 0.1, 8)
    };
  }

  private createDungeonDecorations(): void {
    const torchSpots = [
      [-35.8, 2.4, 5.1, Math.PI / 2],
      [-35.8, 2.4, 18.8, Math.PI / 2],
      [-19.6, 2.4, 2.2, 0],
      [-18.2, 2.4, 18.4, Math.PI],
      [-2.2, 2.4, -1.7, Math.PI],
      [-17.6, 2.4, -18.1, 0],
      [-36.0, 2.4, -10.0, Math.PI / 2],
      [0.4, 2.4, 17.8, Math.PI],
      [19.6, 2.4, 5.4, -Math.PI / 2],
      [20.0, 2.4, -17.6, -Math.PI / 2],
      [24.4, 2.4, 17.8, Math.PI],
      [39.4, 2.4, 18.0, Math.PI],
      [43.0, 2.4, 1.8, 0],
      [58.8, 2.4, 15.8, -Math.PI / 2]
    ] as const;
    for (const [x, y, z, rotation] of torchSpots) {
      this.addTorch(new THREE.Vector3(x, y, z), rotation);
    }

    [
      [-16, 0.5, 4],
      [-16, 0.5, 16],
      [-4, 0.5, 4],
      [-4, 0.5, 16],
      [4, 0.5, 4],
      [16, 0.5, 16],
      [24, 0.5, 4],
      [36, 0.5, 16],
      [44, 0.5, 2],
      [58, 0.5, 14]
    ].forEach(([x, y, z], index) => this.addPillar(`pillar-${index}`, new THREE.Vector3(x, y, z)));

    const sign = createSign("Moonroot Keep has no edge to fall from. Listen for bells, watch for false stone.");
    sign.position.set(-30.5, floorTop + 0.03, 18.2);
    sign.rotation.y = Math.PI;
    this.scene.add(sign);

    this.addBanner(new THREE.Vector3(-12, 2.7, 0.35), "#7a3b8f");
    this.addBanner(new THREE.Vector3(8, 2.7, 19.65), "#9a4747", Math.PI);
    this.addBanner(new THREE.Vector3(52, 2.9, 0.35), "#3d6699");
    this.addCrackedWall(new THREE.Vector3(20.28, 2.2, -14), -Math.PI / 2);
  }

  private createCollectibles(): void {
    [
      [-34, 10],
      [-28, 18],
      [-20, 6],
      [-12, 12],
      [-6, 3],
      [-16, 17],
      [-14, -8],
      [-5, -17],
      [-34, -16],
      [-26, -8],
      [-21, -18],
      [4, 5],
      [13, 14],
      [17, 7],
      [5, -17],
      [14, -9],
      [24, 6],
      [34, 7],
      [24, 17, 3.65],
      [32, 17, 3.65],
      [38, 17, 3.65],
      [25, -16],
      [34, -12],
      [52, 4]
    ].forEach(([x, z, y]) => this.addSeed(new THREE.Vector3(x, y ?? floorTop + 1.15, z)));

    [
      [-36, -18],
      [-7, -18],
      [38, 18, 3.65],
      [36, -18],
      [57, 1]
    ].forEach(([x, z, y], index) => {
      this.addRelic(`moon-pearl-${index + 1}`, new THREE.Vector3(x, y ?? floorTop + 1.15, z));
    });
  }

  private createBells(): void {
    this.addBell(
      "root-bell",
      new THREE.Vector3(-33, floorTop + 0.04, -16),
      "The root bell remembers the keep before the orchard grew over its roof."
    );
    this.addBell(
      "gallery-bell",
      new THREE.Vector3(-6.8, 1.72, -18),
      "The gallery bell sings: moonlit doors open for couriers who bring back light."
    );
    this.addBell(
      "archive-bell",
      new THREE.Vector3(34.5, floorTop + 0.04, -17),
      "The archive bell warns that false stone is thinner where the purple cracks shine."
    );
  }

  private createHazards(): void {
    [
      [8, -14, 1.55],
      [13.5, -6.8, 1.35],
      [-27.5, -12.5, 1.2],
      [49.6, 13.4, 1.45]
    ].forEach(([x, z, radius], index) => {
      const mesh = createHazardPool(radius);
      mesh.position.set(x, floorTop + 0.06, z);
      this.scene.add(mesh);
      this.hazards.push({
        id: `gloom-${index}`,
        mesh,
        position: new THREE.Vector3(x, floorTop + 0.06, z),
        radius,
        damagePerSecond: 32,
        pulseOffset: index * 0.8
      });
    });
  }

  private createArcaneLifts(): void {
    [
      {
        id: "gallery-moondraft",
        position: new THREE.Vector3(-8.4, floorTop + 0.04, -15.4),
        radius: 1.25,
        height: 2.9,
        lift: 13
      },
      {
        id: "balcony-moondraft",
        position: new THREE.Vector3(31.2, floorTop + 0.04, 11.4),
        radius: 1.35,
        height: 3.4,
        lift: 15
      }
    ].forEach((current) => {
      const mesh = createWindCurrent(current.radius, current.height);
      mesh.position.copy(current.position);
      mesh.scale.y = 0.72;
      this.scene.add(mesh);
      this.windCurrents.push({
        ...current,
        mesh,
        position: current.position.clone(),
        discovered: false
      });
    });
  }

  private createMoonSpringTiles(): void {
    [
      {
        id: "gallery-moon-spring",
        position: new THREE.Vector3(-5.4, floorTop + 0.05, -14.2),
        radius: 1.05,
        strength: 10.8
      },
      {
        id: "balcony-moon-spring",
        position: new THREE.Vector3(28.8, floorTop + 0.05, 10.3),
        radius: 1.05,
        strength: 12.6
      }
    ].forEach((pad) => {
      const mesh = createLaunchPad();
      mesh.position.copy(pad.position);
      mesh.scale.set(0.84, 0.58, 0.84);
      this.scene.add(mesh);
      this.launchPads.push({
        ...pad,
        mesh,
        position: pad.position.clone(),
        discovered: false
      });
    });
  }

  private createCheckpoints(): void {
    this.addCheckpoint("gatehouse-lantern", "Gatehouse Lantern", new THREE.Vector3(-34, floorTop + 0.1, 15), true);
    this.addCheckpoint("crossing-lantern", "Crossing Lantern", new THREE.Vector3(-10, floorTop + 0.1, 10), false);
    this.addCheckpoint("shrine-door-lantern", "Shrine Door Lantern", new THREE.Vector3(37.2, floorTop + 0.1, 10.2), false);
  }

  private createLore(): void {
    this.loreMarkers.push(
      {
        id: "start-lore",
        position: new THREE.Vector3(-30.5, floorTop + 0.2, 18.2),
        radius: 2.4,
        message: "Carved sign: Moonroot Keep was built to hold the sky out. Its bells still count brave footsteps.",
        seen: false
      },
      {
        id: "false-wall-lore",
        position: new THREE.Vector3(21, floorTop + 0.2, -14),
        radius: 2.4,
        message: "The cracked wall is colder than the rest. Old mortar hides an archive passage beyond it.",
        seen: false
      },
      {
        id: "shrine-lore",
        position: new THREE.Vector3(42, floorTop + 0.2, 8),
        radius: 2.8,
        message: "The moon gate listens for warm seeds and three remembered bells. The shrine waits behind it.",
        seen: false
      }
    );
  }

  private addDungeonRect(rect: DungeonRect): void {
    for (let x = rect.minX; x <= rect.maxX; x += 1) {
      for (let z = rect.minZ; z <= rect.maxZ; z += 1) {
        this.dungeonCells.add(cellKey(x, z));
      }
    }

    const center = rectCenter(rect.minX, rect.maxX, rect.minZ, rect.maxZ);
    const size = new THREE.Vector3(
      (rect.maxX - rect.minX + 1) * cellSize,
      floorThickness,
      (rect.maxZ - rect.minZ + 1) * cellSize
    );
    this.addFloorPlatform(rect.id, center, size, rect.color);
    this.addCeiling(`${rect.id}-ceiling`, center, new THREE.Vector3(size.x, 0.38, size.z));
  }

  private addFloorPlatform(id: string, center: THREE.Vector3, size: THREE.Vector3, color: string): Platform {
    const mesh = createLowPolyBox(size, color, center);
    mesh.name = id;
    this.scene.add(mesh);
    const platform: Platform = {
      id,
      center: center.clone(),
      size: size.clone(),
      mesh,
      top: center.y + size.y / 2,
      rotationY: 0,
      velocity: new THREE.Vector3()
    };
    this.platforms.push(platform);
    return platform;
  }

  private addRaisedPlatform(id: string, center: THREE.Vector3, size: THREE.Vector3, color: string): Platform {
    const platform = this.addFloorPlatform(id, center, size, color);
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(size.x + 0.2, 0.18, 0.24),
      makeMat("#9b83a8", { emissive: "#1b1025" })
    );
    lip.position.set(center.x, platform.top + 0.09, center.z + size.z / 2 - 0.12);
    lip.name = `${id}-rear-lip`;
    this.scene.add(lip);
    return platform;
  }

  private addCeiling(id: string, floorCenter: THREE.Vector3, size: THREE.Vector3): void {
    const ceiling = createLowPolyBox(size, "#19162b", new THREE.Vector3(floorCenter.x, ceilingY, floorCenter.z));
    ceiling.name = id;
    this.scene.add(ceiling);
  }

  private addDungeonWalls(): void {
    const horizontalEdges = new Map<number, Set<number>>();
    const verticalEdges = new Map<number, Set<number>>();
    const addEdge = (map: Map<number, Set<number>>, fixed: number, span: number) => {
      const spans = map.get(fixed) ?? new Set<number>();
      spans.add(span);
      map.set(fixed, spans);
    };

    for (const key of this.dungeonCells) {
      const [x, z] = key.split(",").map(Number);
      if (!this.hasCell(x, z - 1)) {
        addEdge(horizontalEdges, z * cellSize, x);
      }
      if (!this.hasCell(x, z + 1)) {
        addEdge(horizontalEdges, (z + 1) * cellSize, x);
      }
      if (!this.hasCell(x - 1, z)) {
        addEdge(verticalEdges, x * cellSize, z);
      }
      if (!this.hasCell(x + 1, z)) {
        addEdge(verticalEdges, (x + 1) * cellSize, z);
      }
    }

    let wallIndex = 0;
    for (const [edgeZ, spans] of horizontalEdges) {
      for (const [start, end] of contiguousRanges(spans)) {
        const minX = start * cellSize;
        const maxX = (end + 1) * cellSize;
        const center = new THREE.Vector3((minX + maxX) / 2, floorTop + wallHeight / 2, edgeZ);
        const size = new THREE.Vector3(maxX - minX + wallThickness, wallHeight, wallThickness);
        this.addWall(`wall-h-${wallIndex++}`, center, size);
      }
    }

    for (const [edgeX, spans] of verticalEdges) {
      for (const [start, end] of contiguousRanges(spans)) {
        const minZ = start * cellSize;
        const maxZ = (end + 1) * cellSize;
        const center = new THREE.Vector3(edgeX, floorTop + wallHeight / 2, (minZ + maxZ) / 2);
        const size = new THREE.Vector3(wallThickness, wallHeight, maxZ - minZ + wallThickness);
        this.addWall(`wall-v-${wallIndex++}`, center, size);
      }
    }
  }

  private addShrineThresholdWalls(): void {
    this.addWall(
      "shrine-threshold-south-block",
      new THREE.Vector3(40.05, floorTop + wallHeight / 2, 4.55),
      new THREE.Vector3(wallThickness, wallHeight, 1.4)
    );
    this.addWall(
      "shrine-threshold-north-block",
      new THREE.Vector3(40.05, floorTop + wallHeight / 2, 15.35),
      new THREE.Vector3(wallThickness, wallHeight, 9.3)
    );
  }

  private addInteriorThresholdWalls(): void {
    const thresholds = [
      ["start-cross-south", -16, 5.6, 3.2],
      ["start-cross-north", -16, 16.4, 7.2],
      ["cross-guard-south", 0, 5.2, 2.4],
      ["cross-guard-north", 0, 16.3, 7.4],
      ["guard-balcony-south", 20, 5.5, 3.0],
      ["guard-balcony-north", 20, 16.7, 6.6]
    ] as const;

    for (const [id, x, z, depth] of thresholds) {
      this.addWall(
        `threshold-${id}`,
        new THREE.Vector3(x, floorTop + wallHeight / 2, z),
        new THREE.Vector3(wallThickness, wallHeight, depth)
      );
    }
  }

  private addDoorFrames(): void {
    [
      [-20, 8, Math.PI / 2],
      [-12, 0, 0],
      [-20, -14, Math.PI / 2],
      [0, 8, Math.PI / 2],
      [8, 0, 0],
      [20, 8, Math.PI / 2],
      [20, -14, Math.PI / 2],
      [40, 8, Math.PI / 2]
    ].forEach(([x, z, rotation], index) => this.addDoorFrame(`door-frame-${index}`, new THREE.Vector3(x, floorTop, z), rotation));
  }

  private addBalconyRails(): void {
    this.addRailSegment("balcony-ledge-front-left", new THREE.Vector3(25.2, 2.96, 15.76), new THREE.Vector3(4.6, 0.82, 0.28));
    this.addRailSegment("balcony-ledge-front-right", new THREE.Vector3(36.3, 2.96, 15.76), new THREE.Vector3(5.2, 0.82, 0.28));
    this.addRailSegment("gallery-dais-rail", new THREE.Vector3(-11.2, 2.08, -15.75), new THREE.Vector3(4.5, 0.74, 0.26));
  }

  private addStairRun(
    id: string,
    startCenter: THREE.Vector3,
    stepSize: THREE.Vector3,
    axis: "x" | "z",
    count: number,
    firstTop: number,
    finalTop: number
  ): void {
    for (let index = 0; index < count; index += 1) {
      const t = count === 1 ? 1 : index / (count - 1);
      const top = THREE.MathUtils.lerp(firstTop, finalTop, t);
      const center = startCenter.clone();
      center.y = top - stepSize.y / 2;
      if (axis === "z") {
        center.z += index * stepSize.z * 0.92;
      } else {
        center.x += index * stepSize.x * 0.92;
      }
      this.addFloorPlatform(`${id}-${index}`, center, stepSize, index % 2 === 0 ? "#6f637f" : "#75698a");
    }
  }

  private addWall(id: string, center: THREE.Vector3, size: THREE.Vector3, rotationY = 0): Barrier {
    const mesh = createLowPolyBox(size, "#40384f", center);
    mesh.name = id;
    mesh.rotation.y = rotationY;
    this.scene.add(mesh);
    const barrier = this.createBarrierRecord(id, center, size, mesh, rotationY);
    this.barriers.push(barrier);
    return barrier;
  }

  private addDoorFrame(id: string, position: THREE.Vector3, rotationY: number): void {
    const group = new THREE.Group();
    group.name = id;
    group.position.copy(position);
    group.rotation.y = rotationY;

    const mat = makeMat("#76637f", { emissive: "#171026" });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.38, 3.25, 0.48), mat);
    const right = left.clone();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 4.6), mat);
    left.position.set(0, 1.62, -2.18);
    right.position.set(0, 1.62, 2.18);
    top.position.set(0, 3.3, 0);
    group.add(left, right, top);
    this.scene.add(group);
  }

  private addTorch(position: THREE.Vector3, rotationY = 0): void {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;

    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.7), makeMat("#3a2d35"));
    bracket.position.z = -0.2;
    const flame = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 1),
      makeMat("#ffcf6a", { emissive: "#ff7b3d", transparent: true, opacity: 0.95 })
    );
    flame.position.set(0, 0.24, -0.58);
    const glow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.72, 1),
      makeMat("#ff9f52", { emissive: "#ff7733", transparent: true, opacity: 0.22 })
    );
    glow.position.copy(flame.position);
    group.add(bracket, flame, glow);
    this.scene.add(group);
  }

  private addPillar(id: string, position: THREE.Vector3): void {
    const group = new THREE.Group();
    group.name = id;
    group.position.copy(position);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.92, 0.46, 6), makeMat("#5a5168"));
    base.position.y = 0.23;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 4.2, 6), makeMat("#4a4358"));
    shaft.position.y = 2.34;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.78, 0.46, 6), makeMat("#655b73"));
    cap.position.y = 4.67;
    group.add(base, shaft, cap);
    this.scene.add(group);
    this.addCollisionBarrier(`${id}-barrier`, new THREE.Vector3(position.x, floorTop + 1.8, position.z), new THREE.Vector3(1.35, 3.6, 1.35));
  }

  private addBanner(position: THREE.Vector3, color: string, rotationY = 0): void {
    const banner = new THREE.Group();
    banner.position.copy(position);
    banner.rotation.y = rotationY;
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.0), makeMat("#3b3038"));
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 1.28), makeMat(color, { emissive: "#140814" }));
    cloth.position.set(0, -1.02, 0);
    banner.add(rod, cloth);
    this.scene.add(banner);
  }

  private addCrackedWall(position: THREE.Vector3, rotationY = 0): void {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;
    for (let i = 0; i < 5; i += 1) {
      const crack = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.72 - i * 0.07, 0.055),
        makeMat(i % 2 === 0 ? "#b778ff" : "#ffcf6a", { emissive: "#7d4ddb" })
      );
      crack.position.set(0.02, 0.55 + i * 0.28, -0.45 + i * 0.23);
      crack.rotation.x = (i % 2 === 0 ? 0.42 : -0.3);
      group.add(crack);
    }
    this.scene.add(group);
  }

  private addRailSegment(id: string, center: THREE.Vector3, size: THREE.Vector3, rotationY = 0): Barrier {
    const mesh = createLowPolyBox(size, "#6b536d", center);
    mesh.name = id;
    mesh.rotation.y = rotationY;
    this.scene.add(mesh);
    const barrier = this.createBarrierRecord(id, center, size, mesh, rotationY);
    this.barriers.push(barrier);
    return barrier;
  }

  private addCollisionBarrier(id: string, center: THREE.Vector3, size: THREE.Vector3, rotationY = 0): Barrier {
    const barrier = this.createBarrierRecord(id, center, size, new THREE.Object3D(), rotationY);
    this.barriers.push(barrier);
    return barrier;
  }

  private createBarrierRecord(
    id: string,
    center: THREE.Vector3,
    size: THREE.Vector3,
    mesh: THREE.Object3D,
    rotationY = 0
  ): Barrier {
    return {
      id,
      center: center.clone(),
      size: size.clone(),
      mesh,
      rotationY
    };
  }

  private hasCell(x: number, z: number): boolean {
    return this.dungeonCells.has(cellKey(x, z));
  }

  private addSeed(position: THREE.Vector3): void {
    const mesh = createSeed();
    mesh.position.copy(position);
    mesh.userData.baseY = position.y;
    this.scene.add(mesh);
    this.collectibles.push({
      id: `seed-${this.seedIndex++}`,
      kind: "seed",
      mesh,
      position,
      collected: false
    });
  }

  private addRelic(id: string, position: THREE.Vector3): void {
    const mesh = createRelic();
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.collectibles.push({
      id,
      kind: "secret",
      mesh,
      position,
      collected: false
    });
  }

  private addBell(id: string, position: THREE.Vector3, lore: string): void {
    const mesh = createBell();
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.bells.push({
      id,
      mesh,
      position,
      lore,
      rung: false
    });
  }

  private addCheckpoint(id: string, name: string, position: THREE.Vector3, active: boolean): void {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 0.32, 6), makeMat(palette.stone));
    base.position.y = 0.16;
    const flame = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 1),
      makeMat(active ? palette.glow : "#8a8da8", { emissive: active ? palette.glow : "#111144" })
    );
    flame.position.y = 0.8;
    flame.name = "checkpoint-flame";
    group.add(base, flame);
    group.position.copy(position);
    this.scene.add(group);
    this.checkpoints.push({ id, name, position, mesh: group, active });
  }
}

const cellKey = (x: number, z: number): string => `${x},${z}`;

const rectCenter = (minX: number, maxX: number, minZ: number, maxZ: number): THREE.Vector3 => {
  return new THREE.Vector3(
    ((minX + maxX + 1) * cellSize) / 2,
    floorTop - floorThickness / 2,
    ((minZ + maxZ + 1) * cellSize) / 2
  );
};

const contiguousRanges = (values: Set<number>): Array<[number, number]> => {
  const sorted = [...values].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  let start: number | null = null;
  let previous: number | null = null;

  for (const value of sorted) {
    if (start === null || previous === null || value !== previous + 1) {
      if (start !== null && previous !== null) {
        ranges.push([start, previous]);
      }
      start = value;
      previous = value;
      continue;
    }
    previous = value;
  }

  if (start !== null && previous !== null) {
    ranges.push([start, previous]);
  }
  return ranges;
};
