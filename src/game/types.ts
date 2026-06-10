import * as THREE from "three";

export const enum GameMode {
  Title = "title",
  Playing = "playing",
  Paused = "paused",
  Won = "won"
}

export type FrameInput = {
  moveX: number;
  moveY: number;
  cameraX: number;
  jump: boolean;
  jumpPressed: boolean;
  dashPressed: boolean;
  interactPressed: boolean;
  pausePressed: boolean;
  pointerLookX: number;
};

export type Platform = {
  id: string;
  center: THREE.Vector3;
  size: THREE.Vector3;
  mesh: THREE.Object3D;
  top: number;
  velocity?: THREE.Vector3;
  update?: (time: number, dt: number) => void;
};

export type Collectible = {
  id: string;
  kind: "seed" | "secret";
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  collected: boolean;
};

export type Bell = {
  id: string;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  rung: boolean;
  lore: string;
};

export type Checkpoint = {
  id: string;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  active: boolean;
  name: string;
};

export type Hazard = {
  id: string;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  radius: number;
  damagePerSecond: number;
  pulseOffset: number;
};

export type WindCurrent = {
  id: string;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  radius: number;
  height: number;
  lift: number;
  discovered: boolean;
};

export type LaunchPad = {
  id: string;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  radius: number;
  strength: number;
  discovered: boolean;
};

export type LoreMarker = {
  id: string;
  position: THREE.Vector3;
  radius: number;
  message: string;
  seen: boolean;
};

export type WorldState = {
  scene: THREE.Scene;
  platforms: Platform[];
  collectibles: Collectible[];
  bells: Bell[];
  checkpoints: Checkpoint[];
  hazards: Hazard[];
  windCurrents: WindCurrent[];
  launchPads: LaunchPad[];
  loreMarkers: LoreMarker[];
  shrine: THREE.Object3D;
  shrinePosition: THREE.Vector3;
  gate: THREE.Object3D;
  startPosition: THREE.Vector3;
};
