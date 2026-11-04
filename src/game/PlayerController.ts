import * as THREE from "three";
import type { SpawnPoint } from "./core/maps";

type MapBounds = { width: number; depth: number };
type MapCollider = SpawnPoint & { width: number; depth: number };

export class PlayerController {
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private verticalVelocity = 0;
  private verticalOffset = 0;
  private grounded = true;
  private bobTime = 0;
  private readonly standingHeight = 1.68;
  private readonly crouchedHeight = 1.12;
  private readonly radius = 0.38;
  private readonly velocity = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();

  private onKeyDown = (event: KeyboardEvent) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
    }
    this.keys.add(event.code);
  };
  private onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
  private onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.element) return;
    this.yaw -= event.movementX * 0.00215;
    this.pitch -= event.movementY * 0.00215;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2.12, Math.PI / 2.12);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  };

  constructor(
    private camera: THREE.PerspectiveCamera,
    private element: HTMLElement,
    private bounds: MapBounds,
    private colliders: readonly MapCollider[] = []
  ) {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clearKeys);
    document.addEventListener("mousemove", this.onMouseMove);
  }

  get motionAmount(): number {
    return Math.min(1, this.velocity.length() / 10);
  }

  update(delta: number) {
    const dt = Math.min(delta, 0.04);
    const forward = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const side = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    this.desired.set(side, 0, -forward);
    if (this.desired.lengthSq() > 1) this.desired.normalize();
    this.desired.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const crouching = this.keys.has("ControlLeft") || this.keys.has("ControlRight");
    const sprinting = !crouching && (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"));
    const maxSpeed = crouching ? 3.6 : sprinting ? 10.5 : 7.1;
    const acceleration = this.desired.lengthSq() > 0 ? 25 : 17;

    this.velocity.x = THREE.MathUtils.damp(
      this.velocity.x, this.desired.x * maxSpeed, acceleration, dt
    );
    this.velocity.z = THREE.MathUtils.damp(
      this.velocity.z, this.desired.z * maxSpeed, acceleration, dt
    );

    if (this.keys.has("Space") && this.grounded && !crouching) {
      this.verticalVelocity = 6.1;
      this.grounded = false;
    }

    this.verticalVelocity -= 18 * dt;
    this.verticalOffset += this.verticalVelocity * dt;
    if (this.verticalOffset <= 0) {
      this.verticalOffset = 0;
      this.verticalVelocity = 0;
      this.grounded = true;
    }

    const currentX = this.camera.position.x;
    const currentZ = this.camera.position.z;
    const minX = -this.bounds.width / 2 + this.radius;
    const maxX = this.bounds.width / 2 - this.radius;
    const minZ = -this.bounds.depth / 2 + this.radius;
    const maxZ = this.bounds.depth / 2 - this.radius;

    let nextX = THREE.MathUtils.clamp(currentX + this.velocity.x * dt, minX, maxX);
    let nextZ = currentZ;

    // Resolve each axis independently so the player can slide along walls.
    for (const obstacle of this.colliders) {
      const overlapsZ = Math.abs(nextZ - obstacle.z) < obstacle.depth / 2 + this.radius;
      const crossesX = nextX > obstacle.x - obstacle.width / 2 - this.radius &&
        nextX < obstacle.x + obstacle.width / 2 + this.radius;
      if (overlapsZ && crossesX) {
        nextX = currentX <= obstacle.x
          ? obstacle.x - obstacle.width / 2 - this.radius
          : obstacle.x + obstacle.width / 2 + this.radius;
        this.velocity.x = 0;
      }
    }

    nextZ = THREE.MathUtils.clamp(currentZ + this.velocity.z * dt, minZ, maxZ);
    for (const obstacle of this.colliders) {
      const overlapsX = Math.abs(nextX - obstacle.x) < obstacle.width / 2 + this.radius;
      const crossesZ = nextZ > obstacle.z - obstacle.depth / 2 - this.radius &&
        nextZ < obstacle.z + obstacle.depth / 2 + this.radius;
      if (overlapsX && crossesZ) {
        nextZ = currentZ <= obstacle.z
          ? obstacle.z - obstacle.depth / 2 - this.radius
          : obstacle.z + obstacle.depth / 2 + this.radius;
        this.velocity.z = 0;
      }
    }

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const targetHeight = crouching ? this.crouchedHeight : this.standingHeight;
    const bob = this.grounded && speed > 0.7
      ? Math.sin(this.bobTime += dt * (sprinting ? 13 : 9)) * (sprinting ? 0.045 : 0.025)
      : 0;
    if (speed <= 0.7) this.bobTime = 0;

    this.camera.position.set(nextX, targetHeight + this.verticalOffset + bob, nextZ);
    const targetFov = sprinting && speed > 2 ? 81 : 76;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
    this.camera.updateProjectionMatrix();
  }

  private clearKeys = () => this.keys.clear();

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clearKeys);
    document.removeEventListener("mousemove", this.onMouseMove);
  }
}
