import * as THREE from "three";
import { ArenaPhysics } from "./core/PhysicsWorld";

export class PlayerController {
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private bobTime = 0;
  private jumpRequested = false;
  private grounded = true;
  private readonly velocity = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();

  private onKeyDown = (event: KeyboardEvent) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === "Space" && !event.repeat) this.jumpRequested = true;
    this.keys.add(event.code);
  };
  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    if (event.code === "Space") this.jumpRequested = false;
  };
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
    private physics: ArenaPhysics
  ) {
    const position = physics.position;
    this.camera.position.set(position.x, position.y + physics.eyeHeight, position.z);
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clearKeys);
    document.addEventListener("mousemove", this.onMouseMove);
  }

  get motionAmount(): number {
    return Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / 10.5);
  }

  update(delta: number) {
    const dt = Math.min(delta, 0.033);
    const forward = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const side = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    const crouching = this.keys.has("ControlLeft") || this.keys.has("ControlRight");
    const sprinting = !crouching && (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"));

    if (crouching !== this.physics.isCrouched) {
      this.physics.setCrouched(crouching);
    }

    this.desired.set(side, 0, -forward);
    if (this.desired.lengthSq() > 1) this.desired.normalize();
    this.desired.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const maxSpeed = crouching ? 3.2 : sprinting ? 9.7 : 6.4;
    const acceleration = this.grounded
      ? this.desired.lengthSq() > 0 ? 24 : 19
      : 7.5;

    this.velocity.x = THREE.MathUtils.damp(
      this.velocity.x, this.desired.x * maxSpeed, acceleration, dt
    );
    this.velocity.z = THREE.MathUtils.damp(
      this.velocity.z, this.desired.z * maxSpeed, acceleration, dt
    );

    let verticalSpeed = this.verticalSpeed;
    if (this.jumpRequested && this.grounded && !crouching) {
      verticalSpeed = 6.2;
      this.grounded = false;
    }
    this.jumpRequested = false;
    verticalSpeed -= 19.6 * dt;
    this.verticalSpeed = verticalSpeed;

    const result = this.physics.move({
      x: this.velocity.x * dt,
      y: verticalSpeed * dt,
      z: this.velocity.z * dt
    });
    this.grounded = result.grounded;
    if (this.grounded && this.verticalSpeed < 0) this.verticalSpeed = 0;

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const bob = this.grounded && speed > 0.7 && !crouching
      ? Math.sin(this.bobTime += dt * (sprinting ? 12.5 : 8.5)) * (sprinting ? 0.042 : 0.022)
      : 0;
    if (speed <= 0.7 || !this.grounded) this.bobTime = 0;

    this.camera.position.set(
      result.position.x,
      result.position.y + this.physics.eyeHeight + bob,
      result.position.z
    );
    const targetFov = sprinting && speed > 2 ? 81 : 76;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
    this.camera.updateProjectionMatrix();
  }

  private verticalSpeed = 0;
  private clearKeys = () => {
    this.keys.clear();
    this.jumpRequested = false;
  };

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clearKeys);
    document.removeEventListener("mousemove", this.onMouseMove);
  }
}
