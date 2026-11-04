import * as THREE from 'three';
import { PlayerController } from './PlayerController';
import { buildArenaMap, type BuiltArena } from './core/ArenaMapBuilder';

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
  mapId?: string;
  onHud: (state: HudState) => void;
  onHit: () => void;
  onMessage: (message: string) => void;
};

export class Game {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(76, 1, 0.1, 180);
  private renderer: THREE.WebGLRenderer;
  private controller: PlayerController;
  private arena: BuiltArena;
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
    this.scene.background = new THREE.Color('#111722');
    this.scene.fog = new THREE.Fog('#111722', 22, 75);
    this.arena = buildArenaMap(this.scene, options.mapId ?? "foundry");
    const mapBounds = this.arena.definition.bounds;
    this.camera.position.set(0, 1.7, mapBounds.depth / 2 - 7);
    this.controller = new PlayerController(
      this.camera,
      this.renderer.domElement,
      mapBounds,
      this.arena.colliders
    );
    this.spawnTargets(mapBounds);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('mousedown', this.onFire);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('pointerlockchange', this.pointerLockChanged);
    this.updateHud('READY');
    this.animate();
  }

  private spawnTargets(bounds: { width: number; depth: number }) {
    const targetZ = -bounds.depth / 2 + 14;
    const lane = bounds.width * 0.31;
    const positions = [-lane, -lane * 0.52, 0, lane * 0.52, lane];
    for (const x of positions) this.createTarget(x, 1.45, targetZ);
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
    this.arena.dispose();
    this.renderer.dispose();
  }
}