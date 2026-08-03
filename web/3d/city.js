const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';

const QUALITY = {
  cinematic: { buildings: 420, particles: 1200, drones: 16, pixelRatio: 2, shadows: true },
  balanced: { buildings: 260, particles: 700, drones: 10, pixelRatio: 1.5, shadows: false },
  low: { buildings: 130, particles: 260, drones: 5, pixelRatio: 1, shadows: false }
};

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveQuality(requested) {
  if (requested !== 'auto') return QUALITY[requested] ? requested : 'balanced';
  const memory = Number(navigator.deviceMemory || 4);
  const cores = Number(navigator.hardwareConcurrency || 4);
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 760;
  if (smallScreen || memory <= 4 || cores <= 4) return 'low';
  if (memory >= 8 && cores >= 8) return 'cinematic';
  return 'balanced';
}

function worldProfile(name) {
  const lower = String(name || '').toLowerCase();
  if (/dragon|forge|solar|red-alert|high-noon/.test(lower)) {
    return { height: 1.18, spread: .92, fog: .018, central: 1.25, pulse: 1.45 };
  }
  if (/ocean|forest|moss|redwood|aurora|seafoam/.test(lower)) {
    return { height: .76, spread: 1.08, fog: .024, central: .92, pulse: .75 };
  }
  if (/paper|parchment|newsprint|alabaster|linen|typewriter/.test(lower)) {
    return { height: .62, spread: 1.14, fog: .015, central: .82, pulse: .55 };
  }
  if (/brutalist|concrete|graphite|steel|obsidian|void/.test(lower)) {
    return { height: 1.35, spread: .86, fog: .021, central: 1.38, pulse: .8 };
  }
  if (/vaporwave|neon|glitch|netrunner|chrome|stained/.test(lower)) {
    return { height: 1.08, spread: .96, fog: .025, central: 1.14, pulse: 1.65 };
  }
  return { height: 1, spread: 1, fog: .02, central: 1, pulse: 1 };
}

function disposeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  for (const value of Object.values(material)) {
    if (value && typeof value === 'object' && typeof value.dispose === 'function') value.dispose();
  }
  material.dispose?.();
}

function disposeGroup(group) {
  group.traverse((object) => {
    object.geometry?.dispose?.();
    disposeMaterial(object.material);
  });
}

export async function initAgentropolisCity({
  canvas,
  quality = 'auto',
  motion = true,
  onStatus = () => {}
} = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('A canvas element is required.');

  const THREE = await import(THREE_MODULE_URL);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 260);
  const lookTarget = new THREE.Vector3(0, 6, 0);
  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const palette = {
    background: new THREE.Color('#07090d'),
    fog: new THREE.Color('#07090d'),
    primary: new THREE.Color('#25d9ff'),
    secondary: new THREE.Color('#ff3b81'),
    accent: new THREE.Color('#63e67b'),
    border: new THREE.Color('#1f6f7a')
  };

  scene.fog = new THREE.FogExp2(palette.fog, .02);
  camera.position.set(34, 22, 38);

  const ambient = new THREE.HemisphereLight(0x7fa8c4, 0x030507, 1.25);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(12, 34, 18);
  const rim = new THREE.PointLight(0x25d9ff, 26, 90, 2);
  rim.position.set(-18, 14, -14);
  scene.add(ambient, key, rim);

  let requestedQuality = quality;
  let resolvedQuality = resolveQuality(quality);
  let settings = QUALITY[resolvedQuality];
  let motionEnabled = Boolean(motion) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cityRoot = new THREE.Group();
  let cityParts = null;
  let animationFrame = 0;
  let destroyed = false;
  let visible = !document.hidden;
  let sceneName = 'community';
  let rebuildTimer = 0;
  let lastWidth = 0;
  let lastHeight = 0;

  scene.add(cityRoot);

  function configureRenderer() {
    settings = QUALITY[resolvedQuality];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
    renderer.shadowMap.enabled = settings.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    key.castShadow = settings.shadows;
  }

  function makeRoadGrid(size, step, colorA, colorB) {
    const positions = [];
    const colors = [];
    const half = size / 2;
    const first = new THREE.Color(colorA);
    const second = new THREE.Color(colorB);
    for (let value = -half; value <= half; value += step) {
      const major = Math.round((value + half) / step) % 5 === 0;
      const color = major ? second : first;
      positions.push(-half, .035, value, half, .035, value);
      positions.push(value, .035, -half, value, .035, half);
      for (let index = 0; index < 4; index += 1) colors.push(color.r, color.g, color.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .2 });
    return new THREE.LineSegments(geometry, material);
  }

  function buildCity(name = sceneName) {
    const profile = worldProfile(name);
    const seed = hashString(`${name}:${resolvedQuality}`);
    const random = randomFromSeed(seed);
    const newRoot = new THREE.Group();
    newRoot.name = `agentropolis-${name}`;

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: palette.background.clone().lerp(new THREE.Color('#0d1720'), .36),
      roughness: .82,
      metalness: .5,
      transparent: true,
      opacity: .92
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(76, 96), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = settings.shadows;
    newRoot.add(floor);

    const cityGrid = makeRoadGrid(132, 4, palette.primary, palette.secondary);
    cityGrid.scale.set(profile.spread, 1, profile.spread);
    newRoot.add(cityGrid);

    const horizonMaterial = new THREE.MeshBasicMaterial({
      color: palette.primary,
      transparent: true,
      opacity: .18,
      side: THREE.DoubleSide
    });
    const horizon = new THREE.Mesh(new THREE.RingGeometry(52, 52.35, 128), horizonMaterial);
    horizon.rotation.x = -Math.PI / 2;
    horizon.position.y = .08;
    newRoot.add(horizon);

    const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
    const buildingMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: .48,
      metalness: .8,
      emissive: palette.primary,
      emissiveIntensity: .035,
      vertexColors: true
    });
    const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, settings.buildings);
    buildings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    buildings.castShadow = settings.shadows;
    buildings.receiveShadow = settings.shadows;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const rooftopPositions = [];
    const rooftopColors = [];
    const gridWidth = Math.ceil(Math.sqrt(settings.buildings * 1.5));
    const spacing = 4.1 * profile.spread;
    let built = 0;

    for (let row = 0; row < gridWidth && built < settings.buildings; row += 1) {
      for (let column = 0; column < gridWidth && built < settings.buildings; column += 1) {
        const x = (column - gridWidth / 2) * spacing + (random() - .5) * .7;
        const z = (row - gridWidth / 2) * spacing + (random() - .5) * .7;
        const distance = Math.hypot(x, z);
        if (distance < 9 || distance > 62) continue;
        if (Math.abs(x % (spacing * 5)) < 1.15 || Math.abs(z % (spacing * 5)) < 1.15) continue;
        if (random() < .14) continue;

        const centerBias = Math.max(.22, 1 - distance / 74);
        const height = (2.4 + random() * 15 * centerBias + random() * 5) * profile.height;
        const width = 1.3 + random() * 2.1;
        const depth = 1.3 + random() * 2.1;
        position.set(x, height / 2, z);
        scale.set(width, height, depth);
        matrix.compose(position, rotation, scale);
        buildings.setMatrixAt(built, matrix);

        const districtColor = (row + column) % 3 === 0 ? palette.secondary : palette.primary;
        const instanceColor = new THREE.Color('#071018').lerp(districtColor, .16 + random() * .22);
        buildings.setColorAt(built, instanceColor);
        rooftopPositions.push(x, height + .22, z);
        rooftopColors.push(districtColor.r, districtColor.g, districtColor.b);
        built += 1;
      }
    }
    buildings.count = built;
    buildings.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    newRoot.add(buildings);

    const beaconGeometry = new THREE.BufferGeometry();
    beaconGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rooftopPositions, 3));
    beaconGeometry.setAttribute('color', new THREE.Float32BufferAttribute(rooftopColors, 3));
    const beaconMaterial = new THREE.PointsMaterial({
      size: resolvedQuality === 'low' ? .18 : .26,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: .9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beacons = new THREE.Points(beaconGeometry, beaconMaterial);
    newRoot.add(beacons);

    const towerMaterial = new THREE.MeshStandardMaterial({
      color: palette.background.clone().lerp(palette.primary, .13),
      emissive: palette.primary,
      emissiveIntensity: .11,
      roughness: .28,
      metalness: .92
    });
    const towerHeight = 28 * profile.central;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 5.4, towerHeight, 6, 1), towerMaterial);
    tower.position.y = towerHeight / 2;
    tower.castShadow = settings.shadows;
    newRoot.add(tower);

    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(.12, .4, 15, 8),
      new THREE.MeshBasicMaterial({ color: palette.accent })
    );
    spire.position.y = towerHeight + 7.2;
    newRoot.add(spire);

    const crownMaterial = new THREE.MeshBasicMaterial({ color: palette.secondary, transparent: true, opacity: .82 });
    const crown = new THREE.Mesh(new THREE.TorusGeometry(5.8, .11, 8, 80), crownMaterial);
    crown.position.y = towerHeight + .8;
    crown.rotation.x = Math.PI / 2;
    newRoot.add(crown);

    const districtGroup = new THREE.Group();
    const districtNodes = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const radius = 19 + (index % 2) * 4;
      const node = new THREE.Group();
      node.position.set(Math.cos(angle) * radius, .12, Math.sin(angle) * radius);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.1 + (index % 3) * .25, .075, 6, 52),
        new THREE.MeshBasicMaterial({
          color: index % 2 ? palette.secondary : palette.primary,
          transparent: true,
          opacity: .62
        })
      );
      ring.rotation.x = Math.PI / 2;
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(.16, .3, 4 + random() * 5, 6),
        new THREE.MeshBasicMaterial({ color: palette.accent })
      );
      beacon.position.y = 2.1;
      node.add(ring, beacon);
      districtNodes.push({ node, ring, speed: .18 + random() * .26, phase: random() * Math.PI * 2 });
      districtGroup.add(node);
    }
    newRoot.add(districtGroup);

    const particlePositions = new Float32Array(settings.particles * 3);
    const particleColors = new Float32Array(settings.particles * 3);
    for (let index = 0; index < settings.particles; index += 1) {
      const radius = 16 + random() * 68;
      const angle = random() * Math.PI * 2;
      particlePositions[index * 3] = Math.cos(angle) * radius;
      particlePositions[index * 3 + 1] = 1 + random() * 46;
      particlePositions[index * 3 + 2] = Math.sin(angle) * radius;
      const color = index % 3 === 0 ? palette.secondary : index % 5 === 0 ? palette.accent : palette.primary;
      particleColors[index * 3] = color.r;
      particleColors[index * 3 + 1] = color.g;
      particleColors[index * 3 + 2] = color.b;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    const particleMaterial = new THREE.PointsMaterial({
      size: resolvedQuality === 'cinematic' ? .19 : .14,
      vertexColors: true,
      transparent: true,
      opacity: .64,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    newRoot.add(particles);

    const droneGroup = new THREE.Group();
    const drones = [];
    const droneGeometry = new THREE.OctahedronGeometry(.18, 0);
    for (let index = 0; index < settings.drones; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: index % 2 ? palette.secondary : palette.primary });
      const drone = new THREE.Mesh(droneGeometry, material);
      const radius = 11 + random() * 37;
      drones.push({
        mesh: drone,
        radius,
        height: 5 + random() * 24,
        speed: .08 + random() * .14,
        phase: random() * Math.PI * 2
      });
      droneGroup.add(drone);
    }
    newRoot.add(droneGroup);

    const oldRoot = cityRoot;
    cityRoot = newRoot;
    cityParts = {
      profile,
      floorMaterial,
      cityGrid,
      horizonMaterial,
      buildingMaterial,
      beaconMaterial,
      towerMaterial,
      crownMaterial,
      particleMaterial,
      particles,
      crown,
      districtNodes,
      drones,
      pulse: profile.pulse
    };
    scene.add(cityRoot);
    scene.remove(oldRoot);
    disposeGroup(oldRoot);
    scene.fog.density = profile.fog;
  }

  function updateMaterialPalette() {
    if (!cityParts) return;
    cityParts.floorMaterial.color.copy(palette.background).lerp(new THREE.Color('#0d1720'), .36);
    cityParts.horizonMaterial.color.copy(palette.primary);
    cityParts.buildingMaterial.emissive.copy(palette.primary);
    cityParts.towerMaterial.color.copy(palette.background).lerp(palette.primary, .13);
    cityParts.towerMaterial.emissive.copy(palette.primary);
    cityParts.crownMaterial.color.copy(palette.secondary);
    cityParts.districtNodes.forEach(({ node }, index) => {
      node.children[0].material.color.copy(index % 2 ? palette.secondary : palette.primary);
      node.children[1].material.color.copy(palette.accent);
    });
    cityParts.drones.forEach(({ mesh }, index) => mesh.material.color.copy(index % 2 ? palette.secondary : palette.primary));
    rim.color.copy(palette.primary);
  }

  function scheduleRebuild(nextName) {
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(() => {
      if (!destroyed) buildCity(nextName);
    }, 120);
  }

  function resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function render(time = 0) {
    if (destroyed) return;
    animationFrame = window.requestAnimationFrame(render);
    if (!visible) return;
    resize();

    pointer.lerp(pointerTarget, .035);
    const elapsed = time * .001;
    const motionScale = motionEnabled ? 1 : 0;
    const orbit = motionEnabled ? elapsed * .032 : .68;
    const radius = 46;
    camera.position.x = Math.cos(orbit) * radius + pointer.x * 5 * motionScale;
    camera.position.z = Math.sin(orbit) * radius + pointer.x * 2 * motionScale;
    camera.position.y = 19 + Math.sin(elapsed * .18) * 2.1 * motionScale - pointer.y * 3 * motionScale;
    camera.lookAt(lookTarget);

    if (cityParts) {
      const pulse = .74 + Math.sin(elapsed * cityParts.pulse) * .18 * motionScale;
      cityParts.crown.rotation.z = elapsed * .16 * motionScale;
      cityParts.crownMaterial.opacity = .62 + pulse * .2;
      cityParts.particles.rotation.y = elapsed * .012 * motionScale;
      cityParts.particleMaterial.opacity = .46 + pulse * .18;
      cityParts.districtNodes.forEach(({ node, ring, speed, phase }) => {
        ring.rotation.z = elapsed * speed * motionScale + phase;
        node.position.y = .12 + Math.sin(elapsed * speed * 2 + phase) * .22 * motionScale;
      });
      cityParts.drones.forEach(({ mesh, radius: droneRadius, height, speed, phase }, index) => {
        const angle = elapsed * speed * motionScale + phase;
        mesh.position.set(
          Math.cos(angle) * droneRadius,
          height + Math.sin(elapsed * .55 + index) * .7 * motionScale,
          Math.sin(angle) * droneRadius
        );
        mesh.rotation.y = -angle;
      });
    }

    renderer.render(scene, camera);
  }

  function onPointerMove(event) {
    pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerTarget.y = (event.clientY / window.innerHeight) * 2 - 1;
  }

  function onVisibilityChange() {
    visible = !document.hidden;
  }

  function onContextLost(event) {
    event.preventDefault();
    onStatus('WebGL context lost', 'error');
  }

  function onContextRestored() {
    onStatus('City restored', 'success');
    configureRenderer();
    buildCity(sceneName);
  }

  configureRenderer();
  buildCity(sceneName);
  resize();
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  animationFrame = window.requestAnimationFrame(render);
  onStatus(`City online / ${resolvedQuality}`, 'success');

  return {
    setTheme(theme = {}) {
      const nextName = String(theme.name || sceneName);
      palette.background.set(theme.background || '#07090d');
      palette.fog.set(theme.fog || theme.background || '#07090d');
      palette.primary.set(theme.primary || '#25d9ff');
      palette.secondary.set(theme.secondary || '#ff3b81');
      palette.accent.set(theme.accent || '#63e67b');
      palette.border.set(theme.border || theme.primary || '#1f6f7a');
      scene.fog.color.copy(palette.fog);
      renderer.setClearColor(palette.background, 0);
      updateMaterialPalette();
      if (nextName !== sceneName) {
        sceneName = nextName;
        scheduleRebuild(sceneName);
      }
    },

    setQuality(nextQuality = 'auto') {
      requestedQuality = nextQuality;
      const nextResolved = resolveQuality(requestedQuality);
      if (nextResolved === resolvedQuality) return;
      resolvedQuality = nextResolved;
      configureRenderer();
      buildCity(sceneName);
      onStatus(`City quality / ${resolvedQuality}`, 'success');
    },

    setMotion(enabled) {
      motionEnabled = Boolean(enabled) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      onStatus(motionEnabled ? 'City motion active' : 'City motion paused', 'success');
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      window.clearTimeout(rebuildTimer);
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      scene.remove(cityRoot);
      disposeGroup(cityRoot);
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.width = 1;
      canvas.height = 1;
    }
  };
}
