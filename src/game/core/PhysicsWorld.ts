import RAPIER from "@dimforge/rapier3d-compat";
import type { ArenaMapDefinition } from "./maps";

export type PhysicsVector = { x: number; y: number; z: number };
type RapierWorld = InstanceType<typeof RAPIER.World>;
type RapierCharacterController = ReturnType<RapierWorld["createCharacterController"]>;
type RapierCollider = ReturnType<RapierWorld["createCollider"]>;

const PLAYER_RADIUS = 0.34;
const STANDING_HALF_HEIGHT = 0.5;
const CROUCHED_HALF_HEIGHT = 0.25;

export class ArenaPhysics {
  private crouched = false;
  private disposed = false;

  constructor(
    private world: RapierWorld,
    private characterController: RapierCharacterController,
    private playerCollider: RapierCollider,
    private spawn: PhysicsVector
  ) {}

  get position(): PhysicsVector {
    const value = this.playerCollider.translation();
    return { x: value.x, y: value.y, z: value.z };
  }

  get eyeHeight(): number {
    return this.crouched ? 0.49 : 0.72;
  }

  get isCrouched(): boolean {
    return this.crouched;
  }

  move(desired: PhysicsVector): { position: PhysicsVector; grounded: boolean } {
    if (this.disposed) return { position: this.spawn, grounded: true };

    this.characterController.computeColliderMovement(this.playerCollider, desired);
    const corrected = this.characterController.computedMovement();
    const current = this.playerCollider.translation();
    const next = {
      x: current.x + corrected.x,
      y: current.y + corrected.y,
      z: current.z + corrected.z
    };

    this.playerCollider.setTranslation(next);
    const grounded = this.characterController.computedGrounded();
    return { position: next, grounded };
  }

  setCrouched(value: boolean): PhysicsVector {
    if (value === this.crouched || this.disposed) return this.position;

    const current = this.position;
    const oldHalfHeight = this.crouched ? CROUCHED_HALF_HEIGHT : STANDING_HALF_HEIGHT;
    const nextHalfHeight = value ? CROUCHED_HALF_HEIGHT : STANDING_HALF_HEIGHT;
    const feetY = current.y - oldHalfHeight - PLAYER_RADIUS;
    const nextCenterY = feetY + nextHalfHeight + PLAYER_RADIUS;

    this.world.removeCollider(this.playerCollider, false);
    const shape = RAPIER.ColliderDesc.capsule(nextHalfHeight, PLAYER_RADIUS)
      .setTranslation(current.x, nextCenterY, current.z)
      .setFriction(0);
    this.playerCollider = this.world.createCollider(shape);
    this.crouched = value;

    return this.position;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.world.removeCharacterController(this.characterController);
    this.world.free();
  }
}

let rapierReady: Promise<void> | null = null;

export async function createArenaPhysics(definition: ArenaMapDefinition): Promise<ArenaPhysics> {
  rapierReady ??= RAPIER.init();
  await rapierReady;

  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const bounds = definition.bounds;
  const addFixedBox = (
    x: number, y: number, z: number,
    halfWidth: number, halfHeight: number, halfDepth: number,
    friction = 0.72
  ) => {
    const collider = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth)
      .setTranslation(x, y, z)
      .setFriction(friction)
      .setRestitution(0);
    world.createCollider(collider);
  };

  // The render floor is mirrored by a real static physics collider.
  addFixedBox(0, -0.12, 0, bounds.width / 2, 0.12, bounds.depth / 2, 0.9);

  const wallThickness = 1.15;
  const wallHeight = 8;
  const halfWidth = bounds.width / 2;
  const halfDepth = bounds.depth / 2;

  addFixedBox(0, wallHeight / 2, -halfDepth, halfWidth, wallHeight / 2, wallThickness / 2);
  addFixedBox(0, wallHeight / 2, halfDepth, halfWidth, wallHeight / 2, wallThickness / 2);
  addFixedBox(-halfWidth, wallHeight / 2, 0, wallThickness / 2, wallHeight / 2, halfDepth);
  addFixedBox(halfWidth, wallHeight / 2, 0, wallThickness / 2, wallHeight / 2, halfDepth);

  for (const structure of definition.structures) {
    addFixedBox(
      structure.x, structure.height / 2, structure.z,
      structure.width / 2, structure.height / 2, structure.depth / 2
    );
  }

  const characterController = world.createCharacterController(0.025);
  characterController.setMaxSlopeClimbAngle(Math.PI / 4);
  characterController.setMinSlopeSlideAngle(Math.PI * 0.28);
  characterController.enableAutostep(0.38, 0.2, false);
  characterController.enableSnapToGround(0.18);

  const spawn = { x: 0, y: STANDING_HALF_HEIGHT + PLAYER_RADIUS, z: bounds.depth / 2 - 7 };
  const playerShape = RAPIER.ColliderDesc.capsule(STANDING_HALF_HEIGHT, PLAYER_RADIUS)
    .setTranslation(spawn.x, spawn.y, spawn.z)
    .setFriction(0)
    .setRestitution(0);

  const playerCollider = world.createCollider(playerShape);
  return new ArenaPhysics(world, characterController, playerCollider, spawn);
}
