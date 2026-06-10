import * as THREE from "three";
import { FrameInput, Platform } from "../types";
import { createPlayerMesh } from "./ProceduralAssets";

export type PlayerEvents = {
  jumped: boolean;
  dashed: boolean;
  landed: boolean;
  fell: boolean;
};

const scratchForward = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchDesired = new THREE.Vector3();

export class PlayerController {
  readonly mesh = createPlayerMesh();
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly checkpoint = new THREE.Vector3();

  health = 100;
  grounded = false;
  gliding = false;
  dashCooldown = 0;
  dashTimer = 0;
  invulnerableTimer = 0;

  private previousGrounded = false;
  private groundedPlatform: Platform | null = null;
  private facingYaw = Math.PI;
  private animationTime = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;

  constructor(startPosition: THREE.Vector3) {
    this.position.copy(startPosition);
    this.checkpoint.copy(startPosition);
    this.mesh.position.copy(this.position);
  }

  reset(startPosition = this.checkpoint): void {
    this.position.copy(startPosition);
    this.velocity.set(0, 0, 0);
    this.health = 100;
    this.grounded = false;
    this.gliding = false;
    this.previousGrounded = false;
    this.groundedPlatform = null;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.invulnerableTimer = 1.2;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
  }

  setCheckpoint(position: THREE.Vector3): void {
    this.checkpoint.copy(position).add(new THREE.Vector3(0, 1.2, 0));
  }

  damage(amount: number): boolean {
    if (this.invulnerableTimer > 0) {
      return false;
    }
    this.health = Math.max(0, this.health - amount);
    this.invulnerableTimer = 0.65;
    this.velocity.y = Math.max(this.velocity.y, 5.2);
    if (this.health <= 0) {
      this.reset(this.checkpoint);
    }
    return true;
  }

  update(dt: number, input: FrameInput, cameraYaw: number, platforms: Platform[]): PlayerEvents {
    const events: PlayerEvents = {
      jumped: false,
      dashed: false,
      landed: false,
      fell: false
    };
    this.animationTime += dt;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    this.previousGrounded = this.grounded;
    this.coyoteTimer = this.grounded ? 0.13 : Math.max(0, this.coyoteTimer - dt);
    this.jumpBufferTimer = input.jumpPressed ? 0.14 : Math.max(0, this.jumpBufferTimer - dt);

    if (this.grounded && this.groundedPlatform?.velocity) {
      this.position.addScaledVector(this.groundedPlatform.velocity, dt);
    }

    scratchForward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    scratchRight.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    scratchDesired
      .copy(scratchRight)
      .multiplyScalar(input.moveX)
      .addScaledVector(scratchForward, input.moveY);

    const moving = scratchDesired.lengthSq() > 0.001;
    if (moving) {
      scratchDesired.normalize();
      this.facingYaw = Math.atan2(scratchDesired.x, scratchDesired.z);
    }

    const maxSpeed = this.dashTimer > 0 ? 15.5 : this.grounded ? 8.2 : 7.2;
    const accel = this.grounded ? 42 : 18;
    const targetX = moving ? scratchDesired.x * maxSpeed : 0;
    const targetZ = moving ? scratchDesired.z * maxSpeed : 0;
    this.velocity.x = approach(this.velocity.x, targetX, accel * dt);
    this.velocity.z = approach(this.velocity.z, targetZ, accel * dt);

    if (this.jumpBufferTimer > 0 && (this.grounded || this.coyoteTimer > 0)) {
      this.velocity.y = 10.6;
      this.grounded = false;
      this.groundedPlatform = null;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      events.jumped = true;
    }

    if (input.dashPressed && this.dashCooldown <= 0) {
      const dashVector = moving ? scratchDesired : scratchForward;
      this.velocity.x = dashVector.x * 16.5;
      this.velocity.z = dashVector.z * 16.5;
      this.velocity.y = Math.max(this.velocity.y, 2.7);
      this.dashTimer = 0.18;
      this.dashCooldown = 0.82;
      events.dashed = true;
    }

    this.gliding = !this.grounded && input.jump && this.velocity.y < 1.2;
    const gravity = this.gliding ? -9.5 : -28;
    this.velocity.y += gravity * dt;
    if (!input.jump && this.velocity.y > 1.2 && !this.grounded) {
      this.velocity.y -= 18 * dt;
    }
    if (this.gliding) {
      this.velocity.y = Math.max(this.velocity.y, -4.2);
      this.velocity.x *= 1 - 0.35 * dt;
      this.velocity.z *= 1 - 0.35 * dt;
    } else {
      this.velocity.y = Math.max(this.velocity.y, -24);
    }
    this.velocity.y = Math.min(this.velocity.y, 18);

    const previousY = this.position.y;
    this.position.addScaledVector(this.velocity, dt);
    this.resolveGround(previousY, platforms);

    if (!events.jumped && this.jumpBufferTimer > 0 && this.grounded) {
      this.velocity.y = 10.6;
      this.grounded = false;
      this.groundedPlatform = null;
      this.jumpBufferTimer = 0;
      events.jumped = true;
    }

    if (!this.previousGrounded && this.grounded) {
      events.landed = true;
    }

    if (this.position.y < -26) {
      this.health = Math.max(25, this.health - 18);
      this.reset(this.checkpoint);
      events.fell = true;
    }

    this.animate(dt, moving);
    return events;
  }

  private resolveGround(previousY: number, platforms: Platform[]): void {
    this.grounded = false;
    this.groundedPlatform = null;
    let bestTop = -Infinity;
    let bestPlatform: Platform | null = null;
    const radius = 0.56;

    for (const platform of platforms) {
      const withinX = Math.abs(this.position.x - platform.center.x) <= platform.size.x / 2 + radius;
      const withinZ = Math.abs(this.position.z - platform.center.z) <= platform.size.z / 2 + radius;
      const crossedTop = this.velocity.y <= 0 && previousY >= platform.top - 0.1 && this.position.y <= platform.top + 0.28;
      if (withinX && withinZ && crossedTop && platform.top > bestTop) {
        bestTop = platform.top;
        bestPlatform = platform;
      }
    }

    if (bestPlatform) {
      this.position.y = bestTop;
      this.velocity.y = 0;
      this.grounded = true;
      this.groundedPlatform = bestPlatform;
    }
  }

  private animate(dt: number, moving: boolean): void {
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, this.facingYaw + Math.PI, 12 * dt);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const bob = Math.sin(this.animationTime * (moving ? 15 : 5)) * (moving ? 0.09 : 0.035);
    const body = this.mesh.getObjectByName("body");
    const head = this.mesh.getObjectByName("head");
    const scarf = this.mesh.getObjectByName("scarf");
    const leftLeg = this.mesh.getObjectByName("leg--1");
    const rightLeg = this.mesh.getObjectByName("leg-1");
    const leftArm = this.mesh.getObjectByName("arm--1");
    const rightArm = this.mesh.getObjectByName("arm-1");
    const leftAntenna = this.mesh.getObjectByName("antenna--1");
    const rightAntenna = this.mesh.getObjectByName("antenna-1");
    const leftStar = this.mesh.getObjectByName("antenna-star--1");
    const rightStar = this.mesh.getObjectByName("antenna-star-1");
    const leftWing = this.mesh.getObjectByName("wing--1");
    const rightWing = this.mesh.getObjectByName("wing-1");

    if (body) {
      body.position.y = 0.92 + bob;
      body.scale.set(0.88 + (this.dashTimer > 0 ? 0.16 : 0), 1.1 - (this.dashTimer > 0 ? 0.08 : 0), 0.88);
    }
    if (head) {
      head.position.y = 1.55 + bob * 0.5;
    }
    if (scarf) {
      scarf.rotation.y = Math.sin(this.animationTime * 8) * 0.2;
      scarf.scale.x = 1 + Math.min(0.8, speed / 12) * 0.45;
    }
    if (leftLeg) {
      leftLeg.rotation.x = Math.sin(this.animationTime * 14) * (moving ? 0.75 : 0.12);
    }
    if (rightLeg) {
      rightLeg.rotation.x = Math.sin(this.animationTime * 14 + Math.PI) * (moving ? 0.75 : 0.12);
    }
    if (leftArm) {
      leftArm.rotation.x = Math.sin(this.animationTime * 14 + Math.PI) * (moving ? 0.55 : 0.16) - (this.gliding ? 0.45 : 0);
      leftArm.rotation.z = -0.22 - (this.dashTimer > 0 ? 0.34 : 0);
    }
    if (rightArm) {
      rightArm.rotation.x = Math.sin(this.animationTime * 14) * (moving ? 0.55 : 0.16) - (this.gliding ? 0.45 : 0);
      rightArm.rotation.z = 0.22 + (this.dashTimer > 0 ? 0.34 : 0);
    }
    for (const [index, object] of [leftAntenna, rightAntenna, leftStar, rightStar].entries()) {
      if (object) {
        object.rotation.x = Math.sin(this.animationTime * 5 + index) * 0.18;
        object.scale.setScalar(1 + Math.sin(this.animationTime * 7 + index) * 0.08);
      }
    }
    for (const wing of [leftWing, rightWing]) {
      if (!wing) {
        continue;
      }
      wing.visible = this.gliding || this.dashTimer > 0;
      wing.rotation.x = Math.sin(this.animationTime * 18) * 0.16;
    }

    this.mesh.visible = this.invulnerableTimer <= 0 || Math.sin(this.animationTime * 36) > -0.2;
  }
}

const approach = (value: number, target: number, step: number): number => {
  if (value < target) {
    return Math.min(value + step, target);
  }
  return Math.max(value - step, target);
};

const lerpAngle = (current: number, target: number, amount: number): number => {
  const delta = ((((target - current) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return current + delta * Math.min(1, amount);
};
