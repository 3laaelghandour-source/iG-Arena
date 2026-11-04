import * as THREE from "three";
import type { SpawnPoint } from "./core/maps";

type MapBounds = { width: number; depth: number };
type MapCollider = SpawnPoint & { width: number; depth: number };

export class PlayerController {
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private readonly height = 1.7;
  private readonly radius = 0.55;
  private onKeyDown = (event: KeyboardEvent) => this.keys.add(event.code);
  private onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
  private onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.element) return;
    this.yaw -= event.movementX * 0.0022;
    this.pitch -= event.movementY * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2.15, Math.PI / 2.15);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  };

  constructor(
    private camera: THREE.PerspectiveCamera,
    private element: HTMLElement,
    private bounds: MapBounds,
    private colliders: readonly MapCollider[] = []
  ) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clearKeys);
    document.addEventListener("mousemove", this.onMouseMove);
  }

  update(delta: number) {
    const forward = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const side = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    const input = new THREE.Vector3(side, 0, -forward);
    if (input.lengthSq() > 0) input.normalize();

    const speed = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 10 : 6;
    input.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const currentX = this.camera.position.x;
    const currentZ = this.camera.position.z;
    let nextX = currentX + input.x * speed * delta;
    let nextZ = currentZ + input.z * speed * delta;

    nextX = THREE.MathUtils.clamp(nextX, -this.bounds.width / 2 + this.radius, this.bounds.width / 2 - this.radius);
    nextZ = THREE.MathUtils.clamp(nextZ, -this.bounds.depth / 2 + this.radius, this.bounds.depth / 2 - this.radius);

    for (const obstacle of this.colliders) {
      const halfWidth = obstacle.width / 2 + this.radius;
      const halfDepth = obstacle.depth / 2 + this.radius;
      const blockedX = Math.abs(nextX - obstacle.x) < halfWidth &&
        Math.abs(currentZ - obstacle.z) < halfDepth;
      if (blockedX) nextX = currentX;

      const blockedZ = Math.abs(nextX - obstacle.x) < halfWidth &&
        Math.abs(nextZ - obstacle.z) < halfDepth;
      if (blockedZ) nextZ = currentZ;
    }

    this.camera.position.set(nextX, this.height, nextZ);
  }

  private clearKeys = () => this.keys.clear();

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clearKeys);
    document.removeEventListener("mousemove", this.onMouseMove);
  }
}
