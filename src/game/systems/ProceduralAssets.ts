import * as THREE from "three";

export const palette = {
  skyTop: "#22346f",
  skyBottom: "#f6a15a",
  grass: "#5ccf73",
  moss: "#3a9f67",
  earth: "#8f6542",
  stone: "#7d80a1",
  bark: "#734b37",
  leafWarm: "#ffb547",
  leafGreen: "#6df08c",
  glow: "#fff0a3",
  ember: "#ff7b5c",
  blue: "#6bd6ff",
  violet: "#8b72ff",
  shadow: "#181421",
  hazard: "#47255b"
};

export const makeMat = (
  color: string,
  options: { emissive?: string; roughness?: number; metalness?: number; transparent?: boolean; opacity?: number } = {}
): THREE.MeshStandardMaterial => {
  const materialOptions: THREE.MeshStandardMaterialParameters = {};
  materialOptions.color = color;
  materialOptions.emissive = options.emissive ?? "#000000";
  materialOptions.emissiveIntensity = options.emissive ? 0.6 : 0;
  materialOptions.roughness = options.roughness ?? 0.82;
  materialOptions.metalness = options.metalness ?? 0.02;
  materialOptions.flatShading = true;
  if (typeof options.transparent === "boolean") {
    materialOptions.transparent = options.transparent;
  }
  if (typeof options.opacity === "number") {
    materialOptions.opacity = options.opacity;
  }
  return new THREE.MeshStandardMaterial(materialOptions);
};

export const createLowPolyBox = (
  size: THREE.Vector3,
  color: string,
  position: THREE.Vector3
): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), makeMat(color));
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

export const createIsland = (
  size: THREE.Vector3,
  position: THREE.Vector3,
  topColor = palette.grass
): THREE.Group => {
  const group = new THREE.Group();
  const top = createLowPolyBox(size, topColor, new THREE.Vector3(0, 0, 0));
  top.receiveShadow = true;
  group.add(top);

  const underside = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(size.x, size.z) * 0.43, size.y * 2.9, 7),
    makeMat(palette.earth)
  );
  underside.position.y = -size.y * 1.9;
  underside.rotation.y = Math.PI / 7;
  underside.castShadow = true;
  group.add(underside);

  const edgeMat = makeMat("#367d50");
  const edgeThickness = 0.22;
  const edgeHeight = 0.22;
  const edgeY = size.y / 2 - edgeHeight / 2;
  const edgePieces = [
    { box: new THREE.Vector3(size.x + edgeThickness, edgeHeight, edgeThickness), pos: new THREE.Vector3(0, edgeY, size.z / 2 + edgeThickness / 2) },
    { box: new THREE.Vector3(size.x + edgeThickness, edgeHeight, edgeThickness), pos: new THREE.Vector3(0, edgeY, -size.z / 2 - edgeThickness / 2) },
    { box: new THREE.Vector3(edgeThickness, edgeHeight, size.z), pos: new THREE.Vector3(size.x / 2 + edgeThickness / 2, edgeY, 0) },
    { box: new THREE.Vector3(edgeThickness, edgeHeight, size.z), pos: new THREE.Vector3(-size.x / 2 - edgeThickness / 2, edgeY, 0) }
  ];
  for (const piece of edgePieces) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(piece.box.x, piece.box.y, piece.box.z), edgeMat);
    edge.position.copy(piece.pos);
    edge.castShadow = true;
    edge.receiveShadow = true;
    group.add(edge);
  }

  group.position.copy(position);
  return group;
};

export const createTree = (height = 2.8, fruit = false): THREE.Group => {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, height, 5), makeMat(palette.bark));
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  group.add(trunk);

  const crownColors = [palette.leafGreen, palette.leafWarm, "#ff7db8"];
  for (let i = 0; i < 3; i += 1) {
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.88 - i * 0.08, 1),
      makeMat(crownColors[i % crownColors.length] ?? palette.leafGreen)
    );
    crown.position.set((i - 1) * 0.42, height + 0.35 + i * 0.22, i % 2 === 0 ? 0.12 : -0.18);
    crown.scale.set(1.08, 0.78, 1.02);
    crown.castShadow = true;
    group.add(crown);
  }

  if (fruit) {
    for (let i = 0; i < 4; i += 1) {
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.12, 1),
        makeMat(palette.glow, { emissive: palette.glow })
      );
      orb.position.set(Math.sin(i * 1.7) * 0.62, height + 0.6 + (i % 2) * 0.3, Math.cos(i * 1.4) * 0.45);
      group.add(orb);
    }
  }

  return group;
};

export const createSeed = (): THREE.Group => {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.34, 1),
    makeMat(palette.glow, { emissive: palette.glow, roughness: 0.45 })
  );
  shell.scale.set(0.72, 1.15, 0.72);
  group.add(shell);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.035, 5, 12),
    makeMat(palette.blue, { emissive: palette.blue })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  return group;
};

export const createRelic = (): THREE.Group => {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.34, 0),
    makeMat("#f5ddff", { emissive: "#b46dff", roughness: 0.36 })
  );
  core.name = "relic-core";
  group.add(core);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.54, 0.035, 5, 18),
    makeMat(palette.violet, { emissive: palette.violet, transparent: true, opacity: 0.86 })
  );
  halo.name = "relic-halo";
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  const shard = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.56, 5),
    makeMat(palette.glow, { emissive: palette.glow })
  );
  shard.name = "relic-shard";
  shard.position.y = 0.46;
  group.add(shard);

  return group;
};

export const createBell = (): THREE.Group => {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 2.1, 5), makeMat(palette.stone));
  post.position.y = 1.05;
  group.add(post);

  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.08, 6, 12, Math.PI), makeMat(palette.stone));
  arch.position.y = 2.15;
  arch.rotation.z = Math.PI;
  group.add(arch);

  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.72, 7, 1, true), makeMat("#ffc35c", { emissive: "#5d2a08" }));
  bell.position.y = 1.85;
  bell.rotation.x = Math.PI;
  group.add(bell);

  const clapper = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), makeMat(palette.glow, { emissive: palette.glow }));
  clapper.position.y = 1.54;
  group.add(clapper);

  return group;
};

export const createPlayerMesh = (): THREE.Group => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 1), makeMat("#ffd56f", { emissive: "#6a2e08" }));
  body.name = "body";
  body.scale.set(0.88, 1.1, 0.88);
  body.position.y = 0.92;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), makeMat("#ffe8a6"));
  head.name = "head";
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);

  const eyeMat = makeMat(palette.shadow);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.04), eyeMat);
    eye.name = `eye-${side}`;
    eye.position.set(side * 0.13, 1.6, -0.32);
    group.add(eye);
  }

  const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.14, 0.16), makeMat("#ff5d7a"));
  scarf.name = "scarf";
  scarf.position.set(0, 1.26, 0.18);
  group.add(scarf);

  const antennaMat = makeMat(palette.glow, { emissive: palette.glow });
  for (const side of [-1, 1]) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.48, 5), antennaMat);
    antenna.name = `antenna-${side}`;
    antenna.position.set(side * 0.16, 1.95, -0.02);
    antenna.rotation.z = side * 0.34;
    group.add(antenna);

    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), antennaMat);
    star.name = `antenna-star-${side}`;
    star.position.set(side * 0.26, 2.16, -0.02);
    group.add(star);
  }

  const armMat = makeMat("#ffce68");
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.16), armMat);
    arm.name = `arm-${side}`;
    arm.position.set(side * 0.48, 0.96, 0);
    arm.rotation.z = side * 0.18;
    arm.castShadow = true;
    group.add(arm);
  }

  const legMat = makeMat("#7b4d33");
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.18), legMat);
    leg.name = `leg-${side}`;
    leg.position.set(side * 0.22, 0.28, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  const wingMat = makeMat(palette.blue, { transparent: true, opacity: 0.72, emissive: palette.blue });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.95), wingMat);
    wing.name = `wing-${side}`;
    wing.position.set(side * 0.5, 0.96, 0.15);
    wing.rotation.z = side * 0.75;
    wing.visible = false;
    group.add(wing);
  }

  return group;
};

export const createWindCurrent = (radius: number, height: number): THREE.Group => {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: palette.blue,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  for (let i = 0; i < 4; i += 1) {
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(radius * 1.2, height, 1, 5), mat);
    ribbon.name = "wind-ribbon";
    ribbon.position.y = height / 2;
    ribbon.rotation.y = (Math.PI / 2) * i;
    group.add(ribbon);
  }

  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * (0.62 + i * 0.18), 0.045, 5, 22),
      makeMat(palette.blue, { emissive: palette.blue, transparent: true, opacity: 0.7 })
    );
    ring.name = "wind-ring";
    ring.position.y = 0.75 + i * (height / 3);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.62, radius * 0.86, 0.16, 8),
    makeMat("#d9f7ff", { emissive: palette.blue, transparent: true, opacity: 0.78 })
  );
  base.position.y = 0.08;
  group.add(base);

  return group;
};

export const createLaunchPad = (): THREE.Group => {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.92, 0.22, 8),
    makeMat("#3ba56a")
  );
  base.position.y = 0.11;
  base.castShadow = true;
  group.add(base);

  const petals = new THREE.Group();
  petals.name = "launch-petals";
  for (let i = 0; i < 8; i += 1) {
    const petal = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.14, 0.86),
      makeMat(i % 2 === 0 ? "#ff7bb8" : "#ffe071", {
        emissive: i % 2 === 0 ? "#4b1035" : "#4d3300"
      })
    );
    petal.position.z = 0.55;
    petal.position.y = 0.28;
    petal.rotation.y = (Math.PI * 2 * i) / 8;
    petals.add(petal);
  }
  group.add(petals);

  const center = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.32, 1),
    makeMat(palette.glow, { emissive: palette.glow })
  );
  center.name = "launch-core";
  center.position.y = 0.46;
  group.add(center);

  return group;
};

export const createWindmill = (): THREE.Group => {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 5.4, 6), makeMat("#f1cda2"));
  base.position.y = 2.7;
  base.castShadow = true;
  group.add(base);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.2, 6), makeMat("#d65462"));
  cap.position.y = 5.95;
  group.add(cap);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.24, 8), makeMat(palette.glow, { emissive: palette.glow }));
  hub.name = "windmill-hub";
  hub.position.set(0, 4.35, -1.55);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);

  const blades = new THREE.Group();
  blades.name = "windmill-blades";
  blades.position.copy(hub.position);
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.85, 0.08), makeMat("#fff0c8"));
    blade.position.y = 0.92;
    blade.rotation.z = (Math.PI / 2) * i;
    blades.add(blade);
  }
  group.add(blades);

  return group;
};

export const createShrine = (): THREE.Group => {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 4.4), makeMat(palette.stone));
  base.position.y = 0.25;
  group.add(base);

  for (const x of [-1.7, 1.7]) {
    for (const z of [-1.7, 1.7]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.5, 6), makeMat("#b8b0cf"));
      column.position.set(x, 1.5, z);
      group.add(column);
    }
  }

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.2, 4), makeMat("#7d4ddb", { emissive: "#1d0d50" }));
  roof.position.y = 3.1;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  const beacon = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), makeMat(palette.glow, { emissive: palette.glow }));
  beacon.name = "beacon";
  beacon.position.y = 4.0;
  group.add(beacon);

  return group;
};

export const createHazardPool = (radius: number): THREE.Group => {
  const group = new THREE.Group();
  const pool = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.88, 0.12, 8),
    makeMat(palette.hazard, { emissive: "#3b1268" })
  );
  pool.position.y = 0.06;
  pool.name = "pool";
  group.add(pool);

  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.78, 0.045, 5, 20),
    makeMat("#b778ff", { emissive: "#8f48ff", transparent: true, opacity: 0.82 })
  );
  glow.name = "glow";
  glow.position.y = 0.13;
  glow.rotation.x = Math.PI / 2;
  group.add(glow);

  return group;
};

export const createSign = (message: string): THREE.Group => {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.92, 0.16), makeMat(palette.bark));
  post.position.y = 0.46;
  group.add(post);

  const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.56, 0.12), makeMat("#7e5338"));
  board.position.y = 1.08;
  group.add(board);
  group.userData.message = message;
  return group;
};
