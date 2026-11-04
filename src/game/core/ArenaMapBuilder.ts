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

  const addCylinderColumn = (
    x: number, y: number, z: number,
    radius: number, height: number,
    surface: THREE.Material
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 18),
      surface
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    add(mesh);
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

  const addPipe = (
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
    surface: THREE.Material
  ) => {
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 14, 1, false),
      surface
    );
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    add(mesh);
  };

  // Each location gets its own large-scale landmarks, rather than only a palette swap.
  if (mapId === "foundry") {
    // Industrial steam lines, pressure conduits and service gantries.
    for (const side of [-1, 1]) {
      const x = side * (halfWidth - 4.6);
      addPipe(
        new THREE.Vector3(x, 5.1, -halfDepth + 8),
        new THREE.Vector3(x, 5.1, halfDepth - 8),
        0.26,
        metal
      );
      addPipe(
        new THREE.Vector3(x - side * 0.58, 4.35, -halfDepth + 8),
        new THREE.Vector3(x - side * 0.58, 4.35, halfDepth - 8),
        0.105,
        glowMaterial
      );
      for (const z of [-halfDepth + 10, -10, 10, halfDepth - 10]) {
        addBox(x, 2.45, z, 0.62, 4.9, 0.62, darkMetal);
        addBox(x, 4.95, z, 0.9, 0.14, 0.9, trim);
      }
    }

    for (const x of [-18, 0, 18]) {
      addBox(x, 6.35, -halfDepth + 7, 3.8, 0.35, 0.7, darkMetal);
      addBox(x, 6.58, -halfDepth + 7, 2.7, 0.055, 0.16, glowMaterial, false);
      addPointLight(x, 5.85, -halfDepth + 7, 0.8, 14);
    }

    // Exhaust housings sit above the outer service bays.
    for (const x of [-halfWidth + 10, halfWidth - 10]) {
      for (const z of [-halfDepth + 11, halfDepth - 11]) {
        addBox(x, 2.2, z, 3.6, 4.4, 3.6, darkMetal);
        addBox(x, 4.48, z, 4.0, 0.18, 4.0, trim);
        addCylinderColumn(x, 4.7, z, 0.95, 1.1, glowMaterial);
      }
    }
  } else if (mapId === "district") {
    // Repeated shopfronts and apartment windows create an urban street block.
    for (const side of [-1, 1]) {
      const z = side * (halfDepth - 1.15);
      for (let x = -halfWidth + 9; x <= halfWidth - 9; x += 13) {
        addBox(x, 3.05, z, 7.2, 5.8, 0.34, darkMetal);
        addBox(x, 0.62, z - side * 0.28, 7.6, 0.18, 0.72, concrete);
        addBox(x, 5.72, z - side * 0.24, 7.6, 0.24, 0.62, trim);
        for (const windowX of [x - 2.15, x, x + 2.15]) {
          addBox(windowX, 3.65, z - side * 0.2, 1.55, 1.65, 0.08, metal, false);
          addBox(windowX, 3.65, z - side * 0.26, 1.3, 1.38, 0.055, glowMaterial, false);
          addBox(windowX, 2.45, z - side * 0.2, 1.68, 0.12, 0.16, trim, false);
        }
        addBox(x, 1.55, z - side * 0.3, 5.8, 0.12, 0.28, accent, false);
      }
    }

    for (const side of [-1, 1]) {
      const x = side * (halfWidth - 1.2);
      for (const z of [-halfDepth + 10, -8, 8, halfDepth - 10]) {
        addCylinderColumn(x, 2.6, z, 0.095, 5.2, trim);
        addBox(x - side * 0.1, 5.28, z, 0.52, 0.13, 0.9, glowMaterial, false);
        addPointLight(x - side * 0.65, 4.9, z, 0.6, 11);
      }
    }

    // Rooftop air-conditioning units and service ducts break up the skyline.
    for (const x of [-halfWidth + 13, 0, halfWidth - 13]) {
      addBox(x, 6.45, -halfDepth + 3.2, 3.3, 0.72, 1.1, metal);
      addBox(x, 6.84, -halfDepth + 3.2, 2.6, 0.08, 0.68, trim);
      addBox(x, 6.45, halfDepth - 3.2, 3.3, 0.72, 1.1, metal);
    }
  } else if (mapId === "overpass") {
    // An elevated transit deck defines the overpass while leaving a clear lower route.
    const deckWidth = definition.bounds.width - 8;
    addBox(0, 5.55, 0, deckWidth, 0.48, 7.2, darkMetal);
    addBox(0, 5.82, -3.48, deckWidth, 0.42, 0.2, trim);
    addBox(0, 5.82, 3.48, deckWidth, 0.42, 0.2, trim);
    addBox(0, 5.82, 0, 0.14, 0.018, 6.5, stripeMaterial, false);

    for (let x = -deckWidth / 2 + 5; x <= deckWidth / 2 - 5; x += 10) {
      addBox(x, 5.24, 0, 0.38, 0.16, 7.1, metal);
      addBox(x, 6.14, 0, 0.08, 0.06, 6.6, glowMaterial, false);
    }

    for (const x of [-halfWidth + 8, halfWidth - 8]) {
      addBox(x, 5.1, 0, 0.75, 0.18, 7.8, accent);
      addBox(x, 6.05, -3.48, 0.3, 0.22, 0.32, glowMaterial, false);
      addBox(x, 6.05, 3.48, 0.3, 0.22, 0.32, glowMaterial, false);
    }

    for (const x of [-24, -8, 8, 24]) {
      addBox(x, 4.95, 0, 1.65, 0.08, 0.08, glowMaterial, false);
      addPointLight(x, 4.55, 0, 0.75, 16);
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
