import * as THREE from "three";
import { PlayerController } from "./PlayerController";
import { buildArenaMap, type BuiltArena } from "./core/ArenaMapBuilder";
import { getArenaEquipment } from "./core/equipment";

type HudState = {
  health: number;
  score: number;
  ammo: number;
  reserve: number;
  status: string;
  accuracy: number;
  elapsed: string;
  equipment: string;
};
type GameOptions = {
  mount: HTMLElement;
  mapId?: string;
  equipmentId?: string;
  onHud: (state: HudState) => void;
  onHit: () => void;
  onMessage: (message: string) => void;
};
type PulseEffect = { group: THREE.Group; expiresAt: number };

export class Game {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(76, 1, 0.1, 180);
  private renderer: THREE.WebGLRenderer;
  private controller: PlayerController;
  private arena: BuiltArena;
  private equipment;
  private pulseRig: THREE.Group;
  private clock = new THREE.Clock();
  private targets: THREE.Group[] = [];
  private pulseEffects: PulseEffect[] = [];
  private raycaster = new THREE.Raycaster();
  private ammo: number;
  private reserve: number;
  private score = 0;
  private health = 100;
  private shotsFired = 0;
  private hits = 0;
  private recharging = false;
  private started = false;
  private animation = 0;
  private lastShot = 0;
  private lastHudUpdate = 0;
  private sessionStartedAt = 0;
  private pausedAt = 0;
  private pausedDuration = 0;
  private onFire = (event: MouseEvent) => { if (event.button === 0) this.shoot(); };
  private onKey = (event: KeyboardEvent) => { if (event.code === "KeyR") this.recharge(); };

  onPause?: () => void;
  onResume?: () => void;

  constructor(private options: GameOptions) {
    this.equipment = getArenaEquipment(options.equipmentId ?? "pulse-arc");
    this.ammo = this.equipment.capacity;
    this.reserve = this.equipment.reserve;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    options.mount.appendChild(this.renderer.domElement);

    this.arena = buildArenaMap(this.scene, options.mapId ?? "foundry");
    this.scene.background = new THREE.Color("#101720");
    const mapBounds = this.arena.definition.bounds;
    this.camera.position.set(0, 1.68, mapBounds.depth / 2 - 7);
    this.controller = new PlayerController(
      this.camera,
      this.renderer.domElement,
      mapBounds,
      this.arena.colliders
    );

    this.pulseRig = this.createPulseRig();
    this.camera.add(this.pulseRig);
    this.spawnTargets(mapBounds);
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("mousedown", this.onFire);
    window.addEventListener("keydown", this.onKey);
    document.addEventListener("pointerlockchange", this.pointerLockChanged);
    this.updateHud("READY");
    this.animate();
  }

  private createPulseRig(): THREE.Group {
    // A wrist-mounted energy projector: intentionally stylized, with no real-world weapon parts.
    const rig = new THREE.Group();
    rig.position.set(0.34, -0.29, -0.48);
    rig.rotation.set(-0.13, -0.2, -0.06);

    const shell = new THREE.MeshStandardMaterial({
      color: "#263441", metalness: 0.72, roughness: 0.32
    });
    const edge = new THREE.MeshStandardMaterial({
      color: "#758897", metalness: 0.78, roughness: 0.28
    });
    const glow = new THREE.MeshStandardMaterial({
      color: this.equipment.accent,
      emissive: this.equipment.glow,
      emissiveIntensity: 2.1,
      metalness: 0.22,
      roughness: 0.24
    });

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.34), shell);
    forearm.position.set(0, -0.035, 0.02);
    forearm.rotation.x = -0.08;
    rig.add(forearm);

    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.22), edge);
    topPlate.position.set(0, 0.045, -0.005);
    rig.add(topPlate);

    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.021, 10, 32), edge);
    outerRing.position.set(0, 0.035, -0.2);
    rig.add(outerRing);

    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.012, 8, 28), glow);
    innerRing.position.set(0, 0.035, -0.205);
    rig.add(innerRing);

    const energyCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.052, 1), glow);
    energyCore.position.set(0, 0.035, -0.21);
    rig.add(energyCore);

    const sideA = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.19), edge);
    sideA.position.set(-0.105, 0, -0.015);
    const sideB = sideA.clone();
    sideB.position.x = 0.105;
    rig.add(sideA, sideB);

    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.075), glow);
    indicator.position.set(0, 0.07, 0.06);
    rig.add(indicator);

    rig.userData.core = energyCore;
    rig.userData.glow = glow;
    return rig;
  }

  private spawnTargets(bounds: { width: number; depth: number }) {
    const targetZ = -bounds.depth / 2 + 14;
    const lane = bounds.width * 0.22;
    const positions = [-lane, -lane * 0.52, 0, lane * 0.52, lane];
    for (const x of positions) this.createTarget(x, 1.55, targetZ);
  }

  private createTarget(x: number, y: number, z: number) {
    // Floating training drones replace the temporary humanoid-shaped test dummies.
    const group = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: "#9aabb9", metalness: 0.66, roughness: 0.28
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: "#263542", metalness: 0.58, roughness: 0.34
    });
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: "#a8f3ff", emissive: "#168ba6", emissiveIntensity: 2.1,
      metalness: 0.18, roughness: 0.2
    });

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.39, 1), bodyMaterial);
    core.castShadow = true;
    const innerCore = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), coreMaterial);
    innerCore.position.z = 0.04;

    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.045, 10, 36), darkMaterial);
    ringA.rotation.x = Math.PI / 2.5;
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.73, 0.025, 8, 36), coreMaterial);
    ringB.rotation.y = Math.PI / 2;
    ringB.rotation.x = 0.4;

    const finGeometry = new THREE.OctahedronGeometry(0.18, 0);
    const finLeft = new THREE.Mesh(finGeometry, bodyMaterial);
    finLeft.position.set(-0.66, 0, 0);
    const finRight = new THREE.Mesh(finGeometry, bodyMaterial);
    finRight.position.set(0.66, 0, 0);

    group.add(core, innerCore, ringA, ringB, finLeft, finRight);
    group.position.set(x, y, z);
    group.userData.active = true;
    group.userData.spawn = { x, y, z };
    group.userData.baseY = y;
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.userData.target = group;
      }
    });
    this.scene.add(group);
    this.targets.push(group);
  }

  start() {
    if (!this.started) {
      this.started = true;
      this.sessionStartedAt = performance.now();
    }
    this.renderer.domElement.requestPointerLock();
    this.options.onMessage("Training session started");
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
    this.updateHud(document.pointerLockElement ? "READY" : "PAUSED");
  };

  private shoot() {
    if (!this.started || document.pointerLockElement !== this.renderer.domElement || this.recharging) return;
    const now = performance.now();
    if (now - this.lastShot < this.equipment.pulseCooldownMs) return;
    this.lastShot = now;

    if (this.ammo <= 0) {
      this.options.onMessage("ENERGY DEPLETED — PRESS R TO RECHARGE");
      this.updateHud("EMPTY");
      return;
    }

    this.ammo--;
    this.shotsFired++;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const activeTargets = this.targets.filter((target) => target.userData.active);
    const hit = this.raycaster.intersectObjects(activeTargets, true)[0];
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    const endpoint = hit?.point ?? this.camera.position.clone().add(direction.multiplyScalar(38));
    this.createPulseEffect(endpoint);

    if (hit) {
      const target = hit.object.userData.target as THREE.Group | undefined;
      if (target?.userData.active) {
        target.userData.active = false;
        target.visible = false;
        this.hits++;
        this.score += 100;
        this.options.onHit();
        this.updateHud("PULSE CONFIRMED");
        window.setTimeout(() => this.respawnTarget(target), 1550);
        return;
      }
    }
    this.updateHud(this.ammo === 0 ? "EMPTY" : "READY");
  }

  private createPulseEffect(endpoint: THREE.Vector3) {
    const group = new THREE.Group();
    this.camera.updateMatrixWorld();
    const origin = this.pulseRig.localToWorld(new THREE.Vector3(0, 0.035, -0.27));
    const beamMaterial = new THREE.LineBasicMaterial({
      color: this.equipment.accent, transparent: true, opacity: 0.92,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const beam = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([origin, endpoint]),
      beamMaterial
    );
    group.add(beam);

    const flashMaterial = new THREE.MeshBasicMaterial({
      color: this.equipment.accent,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), flashMaterial);
    flash.position.copy(endpoint);
    group.add(flash);

    this.scene.add(group);
    this.pulseEffects.push({ group, expiresAt: performance.now() + 105 });
  }

  private respawnTarget(target: THREE.Group) {
    if (!this.started) return;
    const spawn = target.userData.spawn as { x: number; y: number; z: number };
    target.position.set(spawn.x, spawn.y, spawn.z);
    target.visible = true;
    target.userData.active = true;
  }

  private recharge() {
    if (!this.started || document.pointerLockElement !== this.renderer.domElement ||
      this.recharging || this.ammo === this.equipment.capacity || this.reserve <= 0) return;

    this.recharging = true;
    this.updateHud("RECHARGING");
    window.setTimeout(() => {
      const amount = Math.min(this.equipment.capacity - this.ammo, this.reserve);
      this.ammo += amount;
      this.reserve -= amount;
      this.recharging = false;
      this.updateHud("READY");
    }, this.equipment.rechargeMs);
  }

  private updatePulseEffects(now: number) {
    for (let index = this.pulseEffects.length - 1; index >= 0; index--) {
      const effect = this.pulseEffects[index];
      const remaining = effect.expiresAt - now;
      if (remaining <= 0) {
        this.scene.remove(effect.group);
        effect.group.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
            object.geometry.dispose();
            const list = Array.isArray(object.material) ? object.material : [object.material];
            list.forEach((item) => item.dispose());
          }
        });
        this.pulseEffects.splice(index, 1);
      } else {
        const opacity = Math.min(1, remaining / 105);
        effect.group.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
            const list = Array.isArray(object.material) ? object.material : [object.material];
            list.forEach((item) => {
              if ("opacity" in item) item.opacity = opacity;
            });
          }
        });
      }
    }
  }

  private formatTime(milliseconds: number) {
    const seconds = Math.floor(milliseconds / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
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
      equipment: this.equipment.name
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
    const now = performance.now();

    if (document.pointerLockElement === this.renderer.domElement) {
      this.controller.update(delta);
      const movement = this.controller.motionAmount;
      this.pulseRig.position.y = -0.29 + Math.sin(now * 0.009) * 0.008 * movement;
      this.pulseRig.position.x = 0.34 + Math.cos(now * 0.006) * 0.006 * movement;
      const core = this.pulseRig.userData.core as THREE.Mesh;
      core.rotation.y += delta * 1.8;
    }

    for (const target of this.targets) {
      if (!target.userData.active) continue;
      const baseY = target.userData.baseY as number;
      target.position.y = baseY + Math.sin(now * 0.0018 + target.position.x) * 0.11;
      target.rotation.y += delta * 0.52;
      const ring = target.children[2];
      if (ring) ring.rotation.z += delta * 0.65;
    }

    this.updatePulseEffects(now);
    if (this.started && now - this.lastHudUpdate > 500) {
      this.lastHudUpdate = now;
      this.updateHud(document.pointerLockElement ? "READY" : "PAUSED");
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.animation);
    this.controller.dispose();
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("mousedown", this.onFire);
    window.removeEventListener("keydown", this.onKey);
    document.removeEventListener("pointerlockchange", this.pointerLockChanged);

    this.camera.remove(this.pulseRig);
    this.pulseRig.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach((item) => item.dispose());
      }
    });

    for (const target of this.targets) {
      this.scene.remove(target);
      target.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const list = Array.isArray(object.material) ? object.material : [object.material];
          list.forEach((item) => item.dispose());
        }
      });
    }
    for (const effect of this.pulseEffects) {
      this.scene.remove(effect.group);
      effect.group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const list = Array.isArray(object.material) ? object.material : [object.material];
          list.forEach((item) => item.dispose());
        }
      });
    }

    this.arena.dispose();
    this.renderer.dispose();
  }
}
