import * as THREE from 'three';

export class PlayerController {
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private readonly height = 1.7;
  private onKeyDown = (event: KeyboardEvent) => this.keys.add(event.code);
  private onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
  private onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.element) return;
    this.yaw -= event.movementX * 0.0022;
    this.pitch -= event.movementY * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2.15, Math.PI / 2.15);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  };

  constructor(private camera: THREE.PerspectiveCamera, private element: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearKeys);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  update(delta: number) {
    const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const input = new THREE.Vector3(side, 0, -forward);
    if (input.lengthSq() > 0) input.normalize();
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 10 : 6;
    input.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    this.camera.position.addScaledVector(input, speed * delta);
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -21.5, 21.5);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -21.5, 21.5);
    this.camera.position.y = this.height;
  }

  private clearKeys = () => this.keys.clear();

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearKeys);
    document.removeEventListener('mousemove', this.onMouseMove);
  }
}