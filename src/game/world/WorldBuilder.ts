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
  createIsland,
  createLaunchPad,
  createLowPolyBox,
  createRelic,
  createSeed,
  createShrine,
  createSign,
  createTree,
  createWindCurrent,
  createWindmill,
  makeMat,
  palette
} from "../systems/ProceduralAssets";

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

  private seedIndex = 0;

  constructor(private readonly scene: THREE.Scene) {}

  build(): WorldState {
    this.createSkyAndLighting();
    this.createStaticRoute();
    this.createDecorations();
    const { shrine, gate, shrinePosition } = this.createShrineIsland();
    this.createCollectibles();
    this.createBells();
    this.createHazards();
    this.createWindCurrents();
    this.createLaunchPads();
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
      startPosition: new THREE.Vector3(-8, 1.15, 5.5)
    };
  }

  private createSkyAndLighting(): void {
    this.scene.background = new THREE.Color(palette.skyTop);
    this.scene.fog = new THREE.FogExp2("#27316d", 0.018);

    const hemi = new THREE.HemisphereLight("#ffe2aa", "#26305d", 2.3);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#fff1c4", 2.5);
    sun.position.set(-12, 18, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -42;
    sun.shadow.camera.right = 42;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -42;
    this.scene.add(sun);

    const moon = new THREE.DirectionalLight("#8db7ff", 0.7);
    moon.position.set(18, 12, -18);
    this.scene.add(moon);

    const skyOrb = new THREE.Mesh(
      new THREE.SphereGeometry(140, 24, 14),
      new THREE.MeshBasicMaterial({
        map: createSkyGradientTexture(),
        side: THREE.BackSide,
        fog: false
      })
    );
    this.scene.add(skyOrb);

    this.createDistantClouds();
    this.createCloudSea();

    for (let i = 0; i < 42; i += 1) {
      const star = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.08 + Math.random() * 0.06, 0),
        new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? "#fff0a3" : "#bcd6ff" })
      );
      star.position.set(
        -55 + Math.random() * 110,
        17 + Math.random() * 22,
        -64 + Math.random() * 112
      );
      star.name = "twinkle-star";
      this.scene.add(star);
    }
  }

  private createDistantClouds(): void {
    const cloudMat = new THREE.MeshBasicMaterial({
      color: "#d6f3ff",
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      fog: false
    });
    const duskMat = new THREE.MeshBasicMaterial({
      color: "#ffd39b",
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      fog: false
    });

    for (let i = 0; i < 18; i += 1) {
      const cloud = new THREE.Group();
      const lumps = 3 + (i % 3);
      for (let j = 0; j < lumps; j += 1) {
        const puff = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.2 + ((i + j) % 4) * 0.28, 0),
          j % 2 === 0 ? cloudMat : duskMat
        );
        puff.position.set(j * 1.2, Math.sin(j + i) * 0.25, Math.cos(j * 1.7) * 0.3);
        puff.scale.set(1.9, 0.45, 0.82);
        cloud.add(puff);
      }
      const angle = (i / 18) * Math.PI * 2;
      const distance = 58 + (i % 4) * 7;
      cloud.position.set(Math.cos(angle) * distance, 11 + (i % 5) * 1.7, Math.sin(angle) * distance);
      cloud.rotation.y = -angle + Math.PI / 2;
      cloud.scale.setScalar(1.2 + (i % 4) * 0.18);
      this.scene.add(cloud);
    }
  }

  private createCloudSea(): void {
    const cloudMat = new THREE.MeshBasicMaterial({
      color: "#d8f3ff",
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      fog: false
    });
    const roseMat = new THREE.MeshBasicMaterial({
      color: "#ffd2c2",
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      fog: false
    });

    for (let i = 0; i < 34; i += 1) {
      const cloud = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.2 + (i % 5) * 0.28, 0),
        i % 3 === 0 ? roseMat : cloudMat
      );
      const angle = i * 2.16;
      const radius = 18 + (i % 9) * 5.7;
      cloud.position.set(Math.cos(angle) * radius, -12.8 - (i % 4) * 0.45, Math.sin(angle) * radius);
      cloud.scale.set(4.6 + (i % 4) * 1.1, 0.42, 2.2 + (i % 3) * 0.7);
      cloud.rotation.y = angle * 0.37;
      this.scene.add(cloud);
    }
  }

  private createStaticRoute(): void {
    this.addPlatform("home-orchard", new THREE.Vector3(-4, 0, 3), new THREE.Vector3(19, 2, 14), palette.grass);
    this.addPlatform("east-yard", new THREE.Vector3(10, 0.6, 1.5), new THREE.Vector3(10, 2, 12), "#62c66a");
    this.addPlatform("orchard-east-step", new THREE.Vector3(4.72, 0.62, 1.5), new THREE.Vector3(1.35, 1.24, 11.1), "#58bd68");
    this.addPlatform("east-bridge-mouth", new THREE.Vector3(14.65, 1.15, -4.5), new THREE.Vector3(1.9, 1.25, 2.8), "#5fc66d");
    this.addPlatform("lower-grove", new THREE.Vector3(-20, -4.2, 6), new THREE.Vector3(13, 2, 12), "#4fbf7f");
    this.addPlatform("waterfall-cave", new THREE.Vector3(-27, -8.2, -11), new THREE.Vector3(11, 2, 9), "#50667d");
    this.addPlatform("ridge-base", new THREE.Vector3(5, 3.8, -15), new THREE.Vector3(13, 2, 10), "#6ed071");
    this.addPlatform("windmill-hill", new THREE.Vector3(5, 7.2, -26), new THREE.Vector3(11, 2, 12), "#73cf69");
    this.addPlatform("moon-step-a", new THREE.Vector3(19, 3.2, -9), new THREE.Vector3(5.4, 1.4, 4.2), "#6cc878");
    this.addPlatform("moon-step-b", new THREE.Vector3(24, 5.7, -10.6), new THREE.Vector3(4.3, 1.2, 3.6), "#6cc878");
    this.addPlatform("shrine-approach", new THREE.Vector3(28.8, 7.9, -8.5), new THREE.Vector3(5.6, 1.3, 4.2), "#7bcf7a");

    this.addBridge("home-to-lower", new THREE.Vector3(-13.1, -1.9, 5.1), new THREE.Vector3(8.7, 0.65, 2.2), -0.15);
    this.addBridge("home-to-ridge", new THREE.Vector3(0.2, 1.8, -7.9), new THREE.Vector3(3, 0.65, 10), 0);
    this.addBridge("ridge-to-hill", new THREE.Vector3(5, 5.55, -20.5), new THREE.Vector3(3.2, 0.65, 6.7), 0);
    this.addBridge("east-hop-1", new THREE.Vector3(16.1, 1.65, -4.5), new THREE.Vector3(4.8, 0.65, 2.2), 0.08);

    const moving = this.addPlatform(
      "wind-platform",
      new THREE.Vector3(19.5, 5.4, -17),
      new THREE.Vector3(3.5, 0.8, 3.5),
      "#6bd6ff"
    );
    const origin = moving.center.clone();
    moving.update = (time, dt) => {
      const previous = moving.center.clone();
      moving.center.set(origin.x + Math.sin(time * 1.15) * 3.2, origin.y + Math.sin(time * 0.8) * 0.55, origin.z);
      moving.mesh.position.copy(moving.center);
      moving.top = moving.center.y + moving.size.y / 2;
      moving.velocity = moving.center.clone().sub(previous).divideScalar(Math.max(0.001, dt));
    };

    this.createBoundaryRails();
  }

  private createBoundaryRails(): void {
    this.addRailSegment("home-north-west", new THREE.Vector3(-7.85, 1.48, -4.16), new THREE.Vector3(10.8, 0.96, 0.34));
    this.addRailSegment("home-north-east", new THREE.Vector3(3.85, 1.48, -4.16), new THREE.Vector3(3.4, 0.96, 0.34));
    this.addRailSegment("home-west-lower", new THREE.Vector3(-13.64, 1.48, -0.35), new THREE.Vector3(0.34, 0.96, 7.3));
    this.addRailSegment("home-west-upper", new THREE.Vector3(-13.64, 1.48, 8.55), new THREE.Vector3(0.34, 0.96, 2.7));
    this.addRailSegment("home-south", new THREE.Vector3(-4, 1.48, 10.14), new THREE.Vector3(18.6, 0.96, 0.34));
    this.addRailSegment("home-east-south", new THREE.Vector3(5.64, 1.48, 8.7), new THREE.Vector3(0.34, 0.96, 2.5));

    this.addRailSegment("east-yard-south", new THREE.Vector3(10, 2.08, 7.66), new THREE.Vector3(9.4, 0.96, 0.34));
    this.addRailSegment("east-yard-north-west", new THREE.Vector3(8.8, 2.08, -4.66), new THREE.Vector3(7.1, 0.96, 0.34));
    this.addRailSegment("east-yard-east", new THREE.Vector3(15.16, 2.08, 2.6), new THREE.Vector3(0.34, 0.96, 9.6));

    this.addRailSegment("lower-west", new THREE.Vector3(-26.66, -2.72, 6), new THREE.Vector3(0.34, 0.96, 11.4));
    this.addRailSegment("lower-south", new THREE.Vector3(-20, -2.72, 12.16), new THREE.Vector3(12.4, 0.96, 0.34));
    this.addRailSegment("lower-east-south", new THREE.Vector3(-13.34, -2.72, 9.35), new THREE.Vector3(0.34, 0.96, 5.1));
    this.addRailSegment("lower-east-north", new THREE.Vector3(-13.34, -2.72, 1.45), new THREE.Vector3(0.34, 0.96, 2.9));
    this.addRailSegment("lower-north-west", new THREE.Vector3(-25.0, -2.72, -0.16), new THREE.Vector3(3.0, 0.96, 0.34));
    this.addRailSegment("lower-north-east", new THREE.Vector3(-16.6, -2.72, -0.16), new THREE.Vector3(6.6, 0.96, 0.34));

    this.addRailSegment("cave-west", new THREE.Vector3(-32.66, -6.72, -11), new THREE.Vector3(0.34, 0.96, 8.4));
    this.addRailSegment("cave-north", new THREE.Vector3(-27, -6.72, -15.66), new THREE.Vector3(10.4, 0.96, 0.34));
    this.addRailSegment("cave-east", new THREE.Vector3(-21.34, -6.72, -11.4), new THREE.Vector3(0.34, 0.96, 7.8));
    this.addRailSegment("cave-south-west", new THREE.Vector3(-30.1, -6.72, -6.34), new THREE.Vector3(4.8, 0.96, 0.34));

    this.addRailSegment("ridge-west", new THREE.Vector3(-1.66, 5.28, -15), new THREE.Vector3(0.34, 0.96, 9.4));
    this.addRailSegment("ridge-east", new THREE.Vector3(11.66, 5.28, -15), new THREE.Vector3(0.34, 0.96, 9.4));
    this.addRailSegment("ridge-south-left", new THREE.Vector3(-0.6, 5.28, -9.84), new THREE.Vector3(1.8, 0.96, 0.34));
    this.addRailSegment("ridge-south-right", new THREE.Vector3(7.0, 5.28, -9.84), new THREE.Vector3(8.5, 0.96, 0.34));
    this.addRailSegment("ridge-north-left", new THREE.Vector3(0.2, 5.28, -20.16), new THREE.Vector3(3.4, 0.96, 0.34));
    this.addRailSegment("ridge-north-right", new THREE.Vector3(9.0, 5.28, -20.16), new THREE.Vector3(5.0, 0.96, 0.34));

    this.addRailSegment("hill-west", new THREE.Vector3(-0.66, 8.68, -26), new THREE.Vector3(0.34, 0.96, 11.4));
    this.addRailSegment("hill-east", new THREE.Vector3(10.66, 8.68, -26), new THREE.Vector3(0.34, 0.96, 11.4));
    this.addRailSegment("hill-north", new THREE.Vector3(5, 8.68, -32.16), new THREE.Vector3(10.4, 0.96, 0.34));
    this.addRailSegment("hill-south-left", new THREE.Vector3(1.0, 8.68, -19.84), new THREE.Vector3(3.0, 0.96, 0.34));
    this.addRailSegment("hill-south-right", new THREE.Vector3(9.0, 8.68, -19.84), new THREE.Vector3(3.0, 0.96, 0.34));

    this.addRailSegment("approach-north", new THREE.Vector3(28.8, 8.98, -10.76), new THREE.Vector3(5.0, 0.86, 0.3));
    this.addRailSegment("approach-south", new THREE.Vector3(28.8, 8.98, -6.24), new THREE.Vector3(5.0, 0.86, 0.3));

    this.addRailSegment("shrine-north", new THREE.Vector3(35.5, 10.38, -15.16), new THREE.Vector3(12.4, 0.96, 0.34));
    this.addRailSegment("shrine-south", new THREE.Vector3(35.5, 10.38, -1.84), new THREE.Vector3(12.4, 0.96, 0.34));
    this.addRailSegment("shrine-east", new THREE.Vector3(42.16, 10.38, -8.5), new THREE.Vector3(0.34, 0.96, 12.4));
    this.addRailSegment("shrine-west-upper", new THREE.Vector3(28.84, 10.38, -12.9), new THREE.Vector3(0.34, 0.96, 4.2));
    this.addRailSegment("shrine-west-lower", new THREE.Vector3(28.84, 10.38, -4.1), new THREE.Vector3(0.34, 0.96, 4.2));
  }

  private createDecorations(): void {
    const treeSpots = [
      [-10, 1.1, -1, true],
      [-6, 1.1, 8, false],
      [2.5, 1.1, 7.5, true],
      [9.3, 1.7, 5.8, false],
      [-22, -3.1, 9.2, true],
      [-17, -3.1, 2.4, false],
      [1.8, 4.9, -14.1, true],
      [9, 4.9, -17.8, false],
      [2.2, 8.3, -29.6, true],
      [8.1, 8.3, -23.5, false]
    ] as const;

    for (const [x, y, z, fruit] of treeSpots) {
      const tree = createTree(2.1 + Math.random() * 0.7, fruit);
      tree.position.set(x, y, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(tree);
    }

    const windmill = createWindmill();
    windmill.position.set(5.5, 8.2, -27);
    windmill.scale.setScalar(0.95);
    this.scene.add(windmill);

    const waterfall = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 8.5, 1, 4),
      new THREE.MeshBasicMaterial({ color: "#69dcff", transparent: true, opacity: 0.48, side: THREE.DoubleSide })
    );
    waterfall.position.set(-22.4, -3.9, -9.5);
    waterfall.rotation.y = Math.PI / 2;
    waterfall.name = "waterfall";
    this.scene.add(waterfall);

    const moonGate = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.16, 6, 16),
      makeMat("#e0d6ff", { emissive: "#5b4dff" })
    );
    moonGate.position.set(14.6, 2.4, -4.5);
    moonGate.rotation.y = Math.PI / 2;
    this.scene.add(moonGate);

    const sign = createSign("The orchard remembers those who leap twice before looking down.");
    sign.position.set(-1.7, 1.1, 9.1);
    sign.rotation.y = -0.2;
    this.scene.add(sign);
  }

  private createShrineIsland() {
    this.addPlatform("shrine-island", new THREE.Vector3(35.5, 8.9, -8.5), new THREE.Vector3(13, 2, 13), "#79d780");
    const shrine = createShrine();
    shrine.position.set(36.3, 10.0, -8.5);
    this.scene.add(shrine);

    const gate = new THREE.Group();
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.2, 0.7), makeMat("#2e2242"));
    const right = left.clone();
    left.position.set(31.4, 10.25, -10.1);
    right.position.set(31.4, 10.25, -6.9);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 2.55, 2.2),
      makeMat("#30294b", { emissive: "#12062c" })
    );
    door.name = "gate-door";
    door.position.set(31.4, 10.15, -8.5);
    gate.add(left, right, door);
    this.scene.add(gate);

    return {
      shrine,
      gate,
      shrinePosition: new THREE.Vector3(36.3, 10.1, -8.5)
    };
  }

  private createCollectibles(): void {
    [
      [-9, 2.15, 0],
      [-4, 2.15, -3],
      [2, 2.15, 5.5],
      [8.8, 2.75, 4.6],
      [11.6, 2.75, -2.6],
      [-13.2, -0.8, 5.1],
      [-20, -2.95, 10.4],
      [-23.8, -2.95, 5.2],
      [-17.8, -2.95, 0.9],
      [-26.6, -7.05, -11.6],
      [-30.2, -7.05, -8.4],
      [-22.9, -7.05, -14.1],
      [0.2, 2.95, -7.2],
      [5.2, 5.1, -13.5],
      [8.5, 5.1, -18.3],
      [5.1, 8.55, -23.2],
      [2.2, 8.55, -28.4],
      [8.6, 8.55, -29.2],
      [16.2, 2.55, -4.5],
      [19.6, 4.35, -8.8],
      [24.2, 6.6, -10.8],
      [29, 8.75, -8.2],
      [34.8, 10.1, -12.6],
      [39.2, 10.1, -5.3]
    ].forEach((coords) => this.addSeed(new THREE.Vector3(coords[0], coords[1], coords[2])));

    [
      [-30.9, -6.95, -14.8],
      [-4.6, 2.15, 10.7],
      [12.4, 2.7, 7.2],
      [11.4, 8.55, -29.1],
      [38.6, 10.05, -13.4]
    ].forEach((coords, index) => this.addRelic(`moon-pearl-${index + 1}`, new THREE.Vector3(coords[0], coords[1], coords[2])));
  }

  private createBells(): void {
    this.addBell(
      "root-bell",
      new THREE.Vector3(-23.2, -3.05, 1.3),
      "A bell hums under the roots: this orchard was grown from a fallen comet."
    );
    this.addBell(
      "wind-bell",
      new THREE.Vector3(8.8, 8.45, -24.2),
      "Wind carries an old warning: the shrine opens only for a courier who returns light."
    );
    this.addBell(
      "water-bell",
      new THREE.Vector3(-30.4, -7.05, -13.3),
      "Behind the waterfall, stone birds point toward the shortest route home."
    );
  }

  private createHazards(): void {
    [
      [7.5, 1.75, -4.2, 1.65],
      [-18.2, -3.05, 6.2, 1.4],
      [3.5, 4.95, -17.4, 1.25],
      [34.8, 10.05, -7.1, 1.45]
    ].forEach(([x, y, z, radius], index) => {
      const mesh = createHazardPool(radius);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.hazards.push({
        id: `gloom-${index}`,
        mesh,
        position: new THREE.Vector3(x, y, z),
        radius,
        damagePerSecond: 32,
        pulseOffset: index * 0.8
      });
    });
  }

  private createWindCurrents(): void {
    [
      {
        id: "waterfall-lift",
        position: new THREE.Vector3(-22.8, -7.1, -10.4),
        radius: 1.75,
        height: 8.8,
        lift: 19
      },
      {
        id: "windmill-lift",
        position: new THREE.Vector3(10.5, 5.0, -21.0),
        radius: 1.55,
        height: 7.2,
        lift: 17
      },
      {
        id: "shrine-lift",
        position: new THREE.Vector3(24.3, 6.5, -13.7),
        radius: 1.35,
        height: 5.8,
        lift: 15
      }
    ].forEach((current) => {
      const mesh = createWindCurrent(current.radius, current.height);
      mesh.position.copy(current.position);
      this.scene.add(mesh);
      this.windCurrents.push({
        ...current,
        mesh,
        position: current.position.clone(),
        discovered: false
      });
    });
  }

  private createLaunchPads(): void {
    [
      {
        id: "orchard-starflower",
        position: new THREE.Vector3(3.2, 1.05, 9.0),
        radius: 1.15,
        strength: 13.5
      },
      {
        id: "cave-starflower",
        position: new THREE.Vector3(-29.8, -7.05, -8.2),
        radius: 1.05,
        strength: 16
      },
      {
        id: "ridge-starflower",
        position: new THREE.Vector3(1.4, 4.95, -16.4),
        radius: 1.05,
        strength: 15
      }
    ].forEach((pad) => {
      const mesh = createLaunchPad();
      mesh.position.copy(pad.position);
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
    this.addCheckpoint("orchard-stone", "Orchard Stone", new THREE.Vector3(-10.5, 1.2, 7.6), true);
    this.addCheckpoint("ridge-lantern", "Ridge Lantern", new THREE.Vector3(3.5, 4.95, -12.5), false);
    this.addCheckpoint("shrine-lantern", "Shrine Lantern", new THREE.Vector3(29.4, 8.8, -8.2), false);
  }

  private createLore(): void {
    this.loreMarkers.push(
      {
        id: "home-lore",
        position: new THREE.Vector3(-1.7, 1.2, 8.8),
        radius: 2.2,
        message: "Carved sign: No branch grows alone. Ring the three memories before the night tide rises.",
        seen: false
      },
      {
        id: "cave-lore",
        position: new THREE.Vector3(-26.7, -7, -10.2),
        radius: 2.8,
        message: "The hidden grotto smells of rain and old starlight. Someone left fresh footprints here.",
        seen: false
      },
      {
        id: "shrine-lore",
        position: new THREE.Vector3(31, 9.8, -8.5),
        radius: 2.8,
        message: "The shrine gate counts warm seeds and remembered songs. It is not locked. It is listening.",
        seen: false
      }
    );
  }

  private addPlatform(id: string, center: THREE.Vector3, size: THREE.Vector3, color: string): Platform {
    const mesh = createIsland(size, center, color);
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

  private addBridge(id: string, center: THREE.Vector3, size: THREE.Vector3, rotation: number): Platform {
    const mesh = createLowPolyBox(size, "#a47a50", center);
    const longAlongX = size.x >= size.z;
    const visualRailSize = longAlongX
      ? new THREE.Vector3(size.x, 0.34, 0.18)
      : new THREE.Vector3(0.18, 0.34, size.z);
    const visualRailA = longAlongX
      ? new THREE.Vector3(0, 0.5, size.z / 2 + 0.02)
      : new THREE.Vector3(size.x / 2 + 0.02, 0.5, 0);
    const visualRailB = visualRailA.clone().multiply(new THREE.Vector3(longAlongX ? 1 : -1, 1, longAlongX ? -1 : 1));
    const railA = createLowPolyBox(visualRailSize, "#6b4a35", visualRailA);
    const railB = createLowPolyBox(visualRailSize, "#6b4a35", visualRailB);
    const group = new THREE.Group();
    group.position.copy(center);
    mesh.position.set(0, 0, 0);
    group.rotation.y = rotation;
    group.add(mesh, railA, railB);
    this.scene.add(group);
    const platform: Platform = {
      id,
      center: center.clone(),
      size: size.clone(),
      mesh: group,
      top: center.y + size.y / 2,
      rotationY: rotation,
      velocity: new THREE.Vector3()
    };
    this.platforms.push(platform);
    this.addBridgeBarrier(`${id}-rail-a`, center, size, rotation, 1);
    this.addBridgeBarrier(`${id}-rail-b`, center, size, rotation, -1);
    return platform;
  }

  private addBridgeBarrier(id: string, center: THREE.Vector3, size: THREE.Vector3, rotation: number, side: 1 | -1): void {
    const longAlongX = size.x >= size.z;
    const railThickness = 0.36;
    const railHeight = 0.92;
    const local = longAlongX
      ? new THREE.Vector3(0, size.y / 2 + railHeight / 2, side * (size.z / 2 + railThickness / 2))
      : new THREE.Vector3(side * (size.x / 2 + railThickness / 2), size.y / 2 + railHeight / 2, 0);
    const worldCenter = center.clone().add(local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation));
    const baseSize = longAlongX
      ? new THREE.Vector3(size.x, railHeight, railThickness)
      : new THREE.Vector3(railThickness, railHeight, size.z);
    this.addCollisionBarrier(id, worldCenter, baseSize, rotation);
  }

  private addRailSegment(id: string, center: THREE.Vector3, size: THREE.Vector3, addPosts = true, rotationY = 0): Barrier {
    const group = new THREE.Group();
    const plank = createLowPolyBox(size, "#6a4a36", new THREE.Vector3(0, 0, 0));
    group.add(plank);

    if (addPosts) {
      const postSize = size.x >= size.z
        ? new THREE.Vector3(0.22, size.y + 0.12, Math.min(0.28, size.z + 0.06))
        : new THREE.Vector3(Math.min(0.28, size.x + 0.06), size.y + 0.12, 0.22);
      const longAxis = size.x >= size.z ? "x" : "z";
      const halfLength = (longAxis === "x" ? size.x : size.z) / 2;
      const postCount = Math.max(2, Math.min(5, Math.floor(halfLength / 2.4) + 1));
      for (let i = 0; i < postCount; i += 1) {
        const t = postCount === 1 ? 0 : i / (postCount - 1);
        const post = createLowPolyBox(postSize, "#835f43", new THREE.Vector3(0, 0.04, 0));
        if (longAxis === "x") {
          post.position.x = -halfLength + t * halfLength * 2;
        } else {
          post.position.z = -halfLength + t * halfLength * 2;
        }
        group.add(post);
      }
    }

    group.position.copy(center);
    group.rotation.y = rotationY;
    this.scene.add(group);
    const barrier = this.createBarrierRecord(id, center, size, group, rotationY);
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
    mesh.userData.baseY = position.y;
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
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), makeMat(active ? palette.glow : "#8a8da8", { emissive: active ? palette.glow : "#111144" }));
    flame.position.y = 0.8;
    flame.name = "checkpoint-flame";
    group.add(base, flame);
    group.position.copy(position);
    this.scene.add(group);
    this.checkpoints.push({ id, name, position, mesh: group, active });
  }
}

const createSkyGradientTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create sky gradient");
  }

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#141c4c");
  gradient.addColorStop(0.44, "#263f88");
  gradient.addColorStop(0.72, "#a15d82");
  gradient.addColorStop(1, "#f0a35e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};
