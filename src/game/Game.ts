import * as THREE from 'three';
import { PlayerController } from './PlayerController';

type HudState = {
  health: number;
  score: number;
  ammo: number;
  reserve: number;
  status: string;
  accuracy: number;
  elapsed: string;
};
type GameOptions = {
  mount: HTMLElement;
  onHud: (state: HudState) => void;
  onHit: () => void;
  onMessage: (message: string) => void;
};

export class Game {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(76, 1, 0.1, 180);
  private renderer: THREE.WebGLRenderer;
  private controller: PlayerController;
  private clock = new THREE.Clock();
  private targets: THREE.Group[] = [];
  private raycaster = new THREE.Raycaster();
  private ammo = 30;
  private reserve = 120;
  private score = 0;
  private health = 100;
  private shotsFired = 0;
  private hits = 0;
  private reloading = false;
  private started = false;
  private animation = 0;
  private lastShot = 0;
  private lastHudUpdate = 0;
  private sessionStartedAt = 0;
  private pausedAt = 0;
  private pausedDuration = 0;
  private onFire = (event: MouseEvent) => { if (event.button === 0) this.shoot(); };
  private onKey = (event: KeyboardEvent) => { if (event.code === 'KeyR') this.reload(); };

  onPause?: () => void;
  onResume?: () => void;

  constructor(private options: GameOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    options.mount.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 1.7, 8);
    this.scene.background = new THREE.Color('#111722');
    this.scene.fog = new THREE.Fog('#111722', 22, 75);
    this.controller = new PlayerController(this.camera, this.renderer.domElement);
    this.buildArena();
    this.spawnTargets();
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('mousedown', this.onFire);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('pointerlockchange', this.pointerLockChanged);
    this.updateHud('READY');
    this.animate();
  }

  private buildArena() {
    this.scene.add(new THREE.HemisphereLight('#b9d4ff', '#202631', 2.0));
    const sun = new THREE.DirectionalLight('#ffffff', 2.2);
    sun.position.set(-8, 16, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshStandardMaterial({ color: '#252e3a', roughness: 0.88, metalness: 0.12 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(70, 70, '#596879', '#394654');
    grid.position.y = 0.012;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.2; });
    this.scene.add(grid);

    const wallMat = new THREE.MeshStandardMaterial({ color: '#303b49', roughness: 0.78 });
    const redMat = new THREE.MeshStandardMaterial({ color: '#c83c4b', emissive: '#4d111b', roughness: 0.5 });
    const addBox = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };
    addBox(0, 3, -22, 46, 6, 1, wallMat);
    addBox(-23, 3, 0, 1, 6, 46, wallMat);
    addBox(23, 3, 0, 1, 6, 46, wallMat);
    addBox(0, 3, 23, 46, 6, 1, wallMat);
    for (let i = -2; i <= 2; i++) addBox(i * 8, 0.12, -21.35, 3.8, 0.18, 0.12, redMat);

    for (const [x, z] of [[-9, -5], [9, -5], [-9, -14], [9, -14], [0, -10]] as number[][]) {
      addBox(x, 0.9, z, 3.4, 1.8, 2.2, wallMat);
    }
    const platformMat = new THREE.MeshStandardMaterial({ color: '#3b4858', roughness: 0.72 });
    addBox(0, 0.25, -18.5, 18, 0.5, 2.8, platformMat);
    for (const x of [-18, 18]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8, 0.7), redMat);
      pillar.position.set(x, 4, -20);
      this.scene.add(pillar);
    }
  }

  private spawnTargets() {
    const positions: [number, number][] = [
      [-13, -17], [-7, -19], [0, -16], [7, -19], [13, -17],
      [-16, -7], [16, -7], [-5, -11], [5, -11],
    ];
    for (const [x, z] of positions) this.createTarget(x, 1.45, z);
  }

  private createTarget(x: number, y: number, z: number) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 1.35, 20),
      new THREE.MeshStandardMaterial({ color: '#c94b59', roughness: 0.48, metalness: 0.2 }),
    );
    body.position.y = 0.68;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 18, 14),
      new THREE.MeshStandardMaterial({ color: '#e3e9f0', roughness: 0.55 }),
    );
    head.position.y = 1.58;
    head.castShadow = true;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.72, 0.16, 20),
      new THREE.MeshStandardMaterial({ color: '#657487', metalness: 0.55, roughness: 0.45 }),
    );
    base.position.y = 0.08;
    group.add(body, head, base);
    group.position.set(x, y - 1.45, z);
    group.userData.active = true;
    group.userData.spawn = { x, z };
    group.traverse((object) => { if (object instanceof THREE.Mesh) object.userData.target = group; });
    this.scene.add(group);
    this.targets.push(group);
  }

  start() {
    if (!this.started) {
      this.started = true;
      this.sessionStartedAt = performance.now();
    }
    this.renderer.domElement.requestPointerLock();
    this.options.onMessage('Training session started');
  }

  private pointerLockChanged = () => {
    if (!this.started) return;
    if (document.pointerLockElement === this.renderer.domElement) {
      if (this.pausedAt) {
        this.pausedDuration += performance.now() - this.pausedAt;
        this.pausedAt = 0;
      }
      this.onResume?.();
    } else {
      if (!this.pausedAt) this.pausedAt = performance.now();
      this.onPause?.();
    }
    this.updateHud(document.pointerLockElement ? 'READY' : 'PAUSED');
  };

  private shoot() {
    if (!this.started || document.pointerLockElement !== this.renderer.domElement || this.reloading) return;
    const now = performance.now();
    if (now - this.lastShot < 115) return;
    this.lastShot = now;
    if (this.ammo <= 0) {
      this.options.onMessage('Magazine empty — press R to reload');
      return;
    }
    this.ammo--;
    this.shotsFired++;
    this.updateHud(this.ammo === 0 ? 'EMPTY' : 'FIRING');
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const objects = this.targets.filter((target) => target.userData.active).flatMap((target) => target.children);
    const hit = this.raycaster.intersectObjects(objects, false)[0];
    if (hit) {
      const target = hit.object.userData.target as THREE.Group | undefined;
      if (target?.userData.active) {
        target.userData.active = false;
        target.visible = false;
        this.hits++;
        this.score += 100;
        this.options.onHit();
        this.updateHud('HIT CONFIRMED');
        window.setTimeout(() => this.respawnTarget(target), 1800);
      }
    }
  }

  private respawnTarget(target: THREE.Group) {
    if (!this.started) return;
    const spawn = target.userData.spawn as { x: number; z: number };
    target.position.set(spawn.x, 0, spawn.z);
    target.visible = true;
    target.userData.active = true;
  }

  private reload() {
    if (!this.started || document.pointerLockElement !== this.renderer.domElement || this.reloading || this.ammo === 30 || this.reserve <= 0) return;
    this.reloading = true;
    this.updateHud('RELOADING');
    window.setTimeout(() => {
      const amount = Math.min(30 - this.ammo, this.reserve);
      this.ammo += amount;
      this.reserve -= amount;
      this.reloading = false;
      this.updateHud('READY');
    }, 1250);
  }

  private formatTime(milliseconds: number) {
    const seconds = Math.floor(milliseconds / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  private updateHud(status: string) {
    const elapsedNow = this.pausedAt || performance.now();
    const elapsed = this.started ? elapsedNow - this.sessionStartedAt - this.pausedDuration : 0;
    const accuracy = this.shotsFired ? Math.round((this.hits / this.shotsFired) * 100) : 100;
    this.options.onHud({
      health: this.health,
      score: this.score,
      ammo: this.ammo,
      reserve: this.reserve,
      status,
      accuracy,
      elapsed: this.formatTime(elapsed),
    });
  }

  private resize = () => {
    const width = this.options.mount.clientWidth;
    const height = this.options.mount.clientHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate = () => {
    this.animation = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (document.pointerLockElement === this.renderer.domElement) this.controller.update(delta);
    if (this.started && performance.now() - this.lastHudUpdate > 500) {
      this.lastHudUpdate = performance.now();
      this.updateHud(document.pointerLockElement ? 'READY' : 'PAUSED');
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.animation);
    this.controller.dispose();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('mousedown', this.onFire);
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('pointerlockchange', this.pointerLockChanged);
    this.renderer.dispose();
  }
}