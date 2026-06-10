import * as THREE from "three";
import { makeMat, palette } from "./ProceduralAssets";

type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
};

export class ParticleSystem {
  private readonly particles: Particle[] = [];
  private readonly materials = {
    gold: makeMat(palette.glow, { emissive: palette.glow }),
    blue: makeMat(palette.blue, { emissive: palette.blue }),
    hurt: makeMat("#ff5d7a", { emissive: "#ff123f" })
  };

  constructor(private readonly scene: THREE.Scene) {}

  burst(position: THREE.Vector3, kind: "gold" | "blue" | "hurt" = "gold", count = 12): void {
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + Math.random() * 0.05, 0), this.materials[kind]);
      mesh.position.copy(position);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.6 + Math.random() * 4.2;
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 1.6 + Math.random() * 3.4, Math.sin(angle) * speed),
        life: 0.65 + Math.random() * 0.35,
        maxLife: 1
      });
      this.scene.add(mesh);
    }
  }

  trail(position: THREE.Vector3, color: "gold" | "blue" = "blue"): void {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), this.materials[color]);
    mesh.position.copy(position);
    this.particles.push({
      mesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.6, (Math.random() - 0.5) * 0.8),
      life: 0.34,
      maxLife: 0.34
    });
    this.scene.add(mesh);
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      if (!particle) {
        continue;
      }
      particle.life -= dt;
      particle.velocity.y -= 6.8 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      const alpha = Math.max(0, particle.life / particle.maxLife);
      particle.mesh.scale.setScalar(0.45 + alpha * 0.65);
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}
