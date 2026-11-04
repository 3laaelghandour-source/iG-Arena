import * as THREE from 'three';
import { PlayerController } from './PlayerController';

type HudState = { health: number; score: number; ammo: number; reserve: number; status: string };
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
  private reloading = false;
  private started = false;
  private animation = 0;
  private lastShot = 0;
  private onFire = (event: MouseEvent) => { if (event.button === 0) this.shoot(); };
  private onKey = (event: KeyboardEvent) => { if (event.code === 'KeyR') this.reload(); };

  onPause?: () => void;
  onResume?: () => void;

  constructor(private options: GameOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    gridMaterials.forEach((m) => { m.transparent = true; m.opacity = 0.2; });
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
    for (let i = -2; i <= 2; i++) {
      addBox(i * 8, 0.12, -21.35, 3.8, 0.18, 0.12, redMat);
    }
    // Low cover blocks create depth without obstructing the training lanes.
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
    const positions = [
      [-13, 1.45, -17], [-7, 1.45, -19], [0, 1.45, -16],
      [7, 1.45, -19], [13, 1.45, -17], [-16, 1.45, -7],
      [16, 1.45, -7], [-5, 1.45, -11], [5, 1.45, -11],
    ];
    for (const [x, y, z] of positions) this.createTarget(x, y, z);
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
    group.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.userData.target = group; });
    this.scene.add(group);
    this.targets.push(group);
  }

  start() {
    this.started = true;
    this.renderer.domElement.requestPointerLock();
    this.options.onMessage('Training session started');
  }

  private pointerLockChanged = () => {
    if (!this.started) return;
    if (document.pointerLockElement === this.renderer.domElement) this.onResume?.();
    else this.onPause?.();
  };

  private shoot() {
    if (!this.started || document.pointerLockElement !== this.renderer.domElement || this.reloading) return;
    const now = performance.now();
    if (now - this.lastShot < 115) return;
    this.lastShot = now;
    if (this.ammo <= 0) { this.options.onMessage('Magazine empty — press R to reload'); return; }
    this.ammo--;
    this.updateHud(this.ammo === 0 ? 'EMPTY' : 'FIRING');
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const objects = this.targets.filter((t) => t.userData.active).flatMap((t) => t.children);
    const hit = this.raycaster.intersectObjects(objects, false)[0];
    if (hit) {
      const target = hit.object.userData.target as THREE.Group | undefined;
      if (target?.userData.active) {
        target.userData.active = false;
        target.visible = false;
        this.score += 100;
        this.options.onHit();
        this.updateHud('HIT CONFIRMED');
        window.setTimeout(() => this.respawnTarget(target), 1800);
      }
    }
  }

  private respawnTarget(target: THREE.Group) {
    if (!this.started) return;
    target.visible = true;
    target.userData.active = true;
    const positions = [[-13, -17], [-7, -19], [0, -16], [7, -19], [13, -17], [-16, -7], [16, -7], [-5, -11], [5, -11]];
    const [x, z] = positions[Math.floor(Math.random() * positions.length)];
    target.position.set(x, 0, z);
  }

  private reload() {
    if (!this.started || this.reloading || this.ammo === 30 || this.reserve <= 0) return;
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

  private updateHud(status: string) {
    this.options.onHud({ health: this.health, score: this.score, ammo: this.ammo, reserve: this.reserve, status });
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