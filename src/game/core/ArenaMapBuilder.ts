import * as THREE from "three";
import { getArenaMap, type ArenaMapDefinition } from "./maps";

export interface BuiltArena {
  definition: ArenaMapDefinition;
  colliders: Array<{ x: number; z: number; width: number; depth: number }>;
  dispose: () => void;
}

export function buildArenaMap(scene: THREE.Scene, mapId: string): BuiltArena {
  const definition = getArenaMap(mapId);
  if (!definition) throw new Error(`Unknown arena map: ${mapId}`);

  const owned: THREE.Object3D[] = [];
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const add = <T extends THREE.Object3D>(object: T): T => {
    scene.add(object);
    owned.push(object);
    return object;
  };
  const createSurfaceTexture = (baseColor: string, seed: number, repeat: number, brushed = false) => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return undefined;

    const pixels = context.createImageData(canvas.width, canvas.height);
    let state = seed >>> 0;
    for (let index = 0; index < canvas.width * canvas.height; index++) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const noise = ((state >>> 24) & 31) - 15;
      const offset = index * 4;
      const shade = THREE.MathUtils.clamp(222 + noise, 0, 255);
      pixels.data[offset] = shade;
      pixels.data[offset + 1] = shade;
      pixels.data[offset + 2] = shade;
      pixels.data[offset + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);

    state = seed >>> 0;
    context.lineWidth = 1;
    context.strokeStyle = brushed ? "rgba(220,235,245,.055)" : "rgba(225,235,242,.035)";
    for (let line = 0; line < 74; line++) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const y = (state >>> 8) % canvas.height;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y + (brushed ? 0 : ((state >>> 20) % 5) - 2));
      context.stroke();
    }
    if (!brushed) {
      context.strokeStyle = "rgba(5,10,16,.16)";
      for (let seam = 32; seam < canvas.width; seam += 64) {
        context.beginPath();
        context.moveTo(seam, 0);
        context.lineTo(seam, canvas.height);
        context.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.anisotropy = 4;
    textures.add(texture);
    return texture;
  };

  const concreteTexture = createSurfaceTexture("#39434e", 381, 2);
  const metalTexture = createSurfaceTexture("#586675", 814, 2, true);
  const floorTexture = createSurfaceTexture("#252d37", 157, 7);

  const material = (
    color: THREE.ColorRepresentation,
    roughness = 0.72,
    metalness = 0.12,
    emissive?: THREE.ColorRepresentation,
    map?: THREE.Texture,
    bumpScale = 0
  ) => {
    const result = new THREE.MeshStandardMaterial({
      color,
      roughness, metalness,
      ...(emissive ? { emissive, emissiveIntensity: 1.15 } : {}),
      ...(map ? { map, bumpMap: map, bumpScale } : {})
    });
    materials.add(result);
    return result;
  };

  const concrete = material("#39434e", 0.92, 0.08, undefined, concreteTexture, 0.025);
  const metal = material("#586675", 0.43, 0.6, undefined, metalTexture, 0.008);
  const darkMetal = material("#202a35", 0.62, 0.42, undefined, metalTexture, 0.01);
  const trim = material("#718090", 0.36, 0.72, undefined, metalTexture, 0.006);
  const accent = material("#a83e4d", 0.48, 0.35, undefined, metalTexture, 0.008);
  const floorMaterial = material("#252d37", 0.96, 0.02, undefined, floorTexture, 0.018);
  const glowColor = mapId === "district" ? "#63d9e8" : mapId === "overpass" ? "#f3bd72" : "#ef665e";
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: glowColor, emissive: glowColor, emissiveIntensity: 2.2,
    roughness: 0.3, metalness: 0.15
  });
  materials.add(glowMaterial);
  const stripeMaterial = material("#d4b775", 0.78, 0.15);

  const addBox = (
    x: number, y: number, z: number,
    width: number, height: number, depth: number,
    surface: THREE.Material,
    shadow = true
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), surface);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    return add(mesh);
  };

  const addPointLight = (x: number, y: number, z: number, intensity: number, distance: number) => {
    const light = new THREE.PointLight(glowColor, intensity, distance, 2);
    light.position.set(x, y, z);
    add(light);
  };

  const halfWidth = definition.bounds.width / 2;
  const halfDepth = definition.bounds.depth / 2;
  const wallHeight = 8;
  const wallThickness = 1.15;

  scene.background = new THREE.Color("#101720");
  scene.fog = new THREE.Fog("#101720", 43, 138);
  add(new THREE.HemisphereLight("#c8d9eb", "#202832", 1.65));

  const keyLight = new THREE.DirectionalLight("#fff1de", 2.35);
  keyLight.position.set(-25, 34, 17);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1536, 1536);
  keyLight.shadow.camera.left = -halfWidth;
  keyLight.shadow.camera.right = halfWidth;
  keyLight.shadow.camera.top = halfDepth;
  keyLight.shadow.camera.bottom = -halfDepth;
  keyLight.shadow.bias = -0.0004;
  add(keyLight);

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
    "#667787",
    "#3c4a58"
  );
  grid.position.y = 0.018;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMaterials.forEach((item) => {
    materials.add(item);
    item.transparent = true;
    item.opacity = 0.12;
  });
  add(grid);

  // Perimeter walls receive layered trim, support columns and luminous wayfinding.
  const walls = [
    { x: 0, z: -halfDepth, width: definition.bounds.width, depth: wallThickness },
    { x: 0, z: halfDepth, width: definition.bounds.width, depth: wallThickness },
    { x: -halfWidth, z: 0, width: wallThickness, depth: definition.bounds.depth },
    { x: halfWidth, z: 0, width: wallThickness, depth: definition.bounds.depth }
  ];
  for (const wall of walls) {
    addBox(wall.x, wallHeight / 2, wall.z, wall.width, wallHeight, wall.depth, concrete);
    addBox(wall.x, wallHeight - 0.28, wall.z, wall.width, 0.42, wall.depth + 0.12, darkMetal);
    addBox(wall.x, 0.26, wall.z, wall.width, 0.22, wall.depth + 0.16, trim);
  }

  const cornerX = halfWidth - 1.25;
  const cornerZ = halfDepth - 1.25;
  for (const x of [-cornerX, cornerX]) {
    for (const z of [-cornerZ, cornerZ]) {
      addBox(x, wallHeight / 2, z, 1.15, wallHeight, 1.15, darkMetal);
      addBox(x, 5.9, z, 1.22, 0.12, 1.22, glowMaterial, false);
    }
  }

  // High overhead rails make the arenas feel like enclosed, purpose-built facilities.
  addBox(0, 7.2, -halfDepth + 4, definition.bounds.width - 5, 0.24, 0.35, darkMetal);
  addBox(0, 7.2, halfDepth - 4, definition.bounds.width - 5, 0.24, 0.35, darkMetal);
  addBox(-halfWidth + 4, 7.2, 0, 0.35, 0.24, definition.bounds.depth - 5, darkMetal);
  addBox(halfWidth - 4, 7.2, 0, 0.35, 0.24, definition.bounds.depth - 5, darkMetal);

  for (const z of [-halfDepth + 5, halfDepth - 5]) {
    for (const x of [-halfWidth * 0.55, 0, halfWidth * 0.55]) {
      addBox(x, 7.02, z, 2.3, 0.09, 0.28, glowMaterial, false);
      addPointLight(x, 6.3, z, 0.72, 13);
    }
  }

  // Distinct surface layers, corner guards and light strips turn each blockout into a readable structure.
  for (const structure of definition.structures) {
    const { x, z, width, depth, height } = structure;
    const baseMaterial = structure.material === "concrete"
      ? concrete : structure.material === "metal" ? metal : accent;

    addBox(x, height / 2, z, width, height, depth, baseMaterial);
    addBox(x, height + 0.09, z, width + 0.18, 0.18, depth + 0.18, trim);
    addBox(x, 0.14, z, width + 0.22, 0.28, depth + 0.22, darkMetal);

    const faceZ = depth >= width ? depth / 2 + 0.012 : width / 2 + 0.012;
    if (depth >= width) {
      for (const side of [-1, 1]) {
        addBox(x + side * (width / 2 - 0.09), height / 2, z, 0.12, height * 0.82, depth + 0.035, darkMetal);
        addBox(x + side * (width / 2 - 0.095), Math.min(height - 0.22, height * 0.72), z, 0.035, 0.055, depth + 0.05, glowMaterial, false);
      }
      addBox(x, height * 0.34, z - faceZ, width * 0.72, 0.08, 0.035, trim, false);
      addBox(x, height * 0.34, z + faceZ, width * 0.72, 0.08, 0.035, trim, false);
    } else {
      for (const side of [-1, 1]) {
        addBox(x, height / 2, z + side * (depth / 2 - 0.09), width + 0.035, height * 0.82, 0.12, darkMetal);
        addBox(x, Math.min(height - 0.22, height * 0.72), z + side * (depth / 2 - 0.095), width + 0.05, 0.055, 0.035, glowMaterial, false);
      }
      addBox(x - faceZ, height * 0.34, z, 0.035, 0.08, depth * 0.72, trim, false);
      addBox(x + faceZ, height * 0.34, z, 0.035, 0.08, depth * 0.72, trim, false);
    }

    // Recessed-looking front panels add scale without adding new collision volumes.
    const panelWidth = Math.min(width * 0.48, 2.2);
    const panelDepth = Math.min(depth * 0.48, 0.16);
    if (depth >= width) {
      addBox(x, height * 0.62, z - depth / 2 - 0.035, panelWidth, 0.52, panelDepth, darkMetal);
      addBox(x, height * 0.62, z - depth / 2 - 0.12, panelWidth * 0.72, 0.045, 0.035, glowMaterial, false);
    } else {
      addBox(x + width / 2 + 0.035, height * 0.62, z, panelDepth, 0.52, panelWidth, darkMetal);
      addBox(x + width / 2 + 0.12, height * 0.62, z, 0.035, 0.045, panelWidth * 0.72, glowMaterial, false);
    }
  }

  // Floor lane markers, perimeter guides and small illuminated checkpoints.
  const laneOffset = Math.min(halfWidth * 0.62, 22);
  for (const x of [-laneOffset, laneOffset]) {
    addBox(x, 0.024, 0, 0.055, 0.014, definition.bounds.depth - 8, trim, false);
    for (const z of [-halfDepth + 8, halfDepth - 8]) {
      addBox(x, 0.03, z, 0.23, 0.02, 2.1, stripeMaterial, false);
    }
  }

  for (const side of [-1, 1]) {
    const x = side * (halfWidth - 1.9);
    for (let index = 0; index < 7; index++) {
      const z = -halfDepth + 7 + index * ((definition.bounds.depth - 14) / 6);
      addBox(x, 0.05, z, 0.12, 0.035, 1.35, glowMaterial, false);
    }
  }

  // A low-contrast central floor emblem gives each map a clear visual anchor.
  const emblem = new THREE.Mesh(
    new THREE.RingGeometry(3.8, 4.05, 64),
    new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
  );
  materials.add(emblem.material as THREE.Material);
  emblem.rotation.x = -Math.PI / 2;
  emblem.position.y = 0.035;
  add(emblem);

  return {
    definition,
    colliders: definition.structures.map((structure) => ({
      x: structure.x, z: structure.z, width: structure.width, depth: structure.depth
    })),
    dispose: () => {
      const geometries = new Set<THREE.BufferGeometry>();
      for (const object of owned) {
        scene.remove(object);
        object.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
            geometries.add(child.geometry);
          }
        });
      }
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((item) => item.dispose());
      textures.forEach((texture) => texture.dispose());
    }
  };
}
