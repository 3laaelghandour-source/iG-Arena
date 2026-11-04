import * as THREE from "three";
import { getArenaMap, type ArenaMapDefinition } from "./maps";

const palette = {
  concrete: new THREE.MeshStandardMaterial({ color: "#343d49", roughness: 0.88 }),
  metal: new THREE.MeshStandardMaterial({ color: "#465362", roughness: 0.48, metalness: 0.34 }),
  accent: new THREE.MeshStandardMaterial({ color: "#a83e4d", roughness: 0.62, metalness: 0.16 })
};

export interface BuiltArena {
  definition: ArenaMapDefinition;
  colliders: Array<{ x: number; z: number; width: number; depth: number }>;
  dispose: () => void;
}

export function buildArenaMap(scene: THREE.Scene, mapId: string): BuiltArena {
  const definition = getArenaMap(mapId);
  if (!definition) throw new Error(`Unknown arena map: ${mapId}`);

  const owned: THREE.Object3D[] = [];
  const ownedMaterials = new Set<THREE.Material>();
  const add = (object: THREE.Object3D) => {
    scene.add(object);
    owned.push(object);
  };

  scene.background = new THREE.Color("#111720");
  scene.fog = new THREE.Fog("#111720", 35, 120);
  add(new THREE.HemisphereLight("#c3d6ef", "#222832", 1.7));

  const keyLight = new THREE.DirectionalLight("#fff4e8", 2.1);
  keyLight.position.set(-18, 28, 12);
  add(keyLight);

  const floorMaterial = new THREE.MeshStandardMaterial({ color: "#252d37", roughness: 0.9 });
  ownedMaterials.add(floorMaterial);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(definition.bounds.width, definition.bounds.depth),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  add(floor);

  const grid = new THREE.GridHelper(
    Math.max(definition.bounds.width, definition.bounds.depth),
    Math.max(definition.bounds.width, definition.bounds.depth),
    "#586575",
    "#3a4653"
  );
  grid.position.y = 0.015;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMaterials.forEach((material) => {
    ownedMaterials.add(material);
    material.transparent = true;
    material.opacity = 0.16;
  });
  add(grid);

  const halfWidth = definition.bounds.width / 2;
  const halfDepth = definition.bounds.depth / 2;
  const wallHeight = 7;
  const wallThickness = 1.2;
  const walls = [
    { x: 0, z: -halfDepth, w: definition.bounds.width, d: wallThickness },
    { x: 0, z: halfDepth, w: definition.bounds.width, d: wallThickness },
    { x: -halfWidth, z: 0, w: wallThickness, d: definition.bounds.depth },
    { x: halfWidth, z: 0, w: wallThickness, d: definition.bounds.depth }
  ];

  for (const wall of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, wallHeight, wall.d), palette.concrete);
    mesh.position.set(wall.x, wallHeight / 2, wall.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    add(mesh);
  }

  for (const structure of definition.structures) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(structure.width, structure.height, structure.depth),
      palette[structure.material]
    );
    mesh.position.set(structure.x, structure.height / 2, structure.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    add(mesh);
  }

  return {
    definition,
    colliders: definition.structures.map((structure) => ({
      x: structure.x, z: structure.z, width: structure.width, depth: structure.depth
    })),
    dispose: () => {
      for (const object of owned) {
        scene.remove(object);
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) object.geometry.dispose();
      }
      for (const material of ownedMaterials) material.dispose();
    }
  };
}
