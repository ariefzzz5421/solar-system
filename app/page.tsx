"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ChevronDown,
  Crosshair,
  Eye,
  EyeOff,
  Focus,
  Info,
  Maximize,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";

type PlanetData = {
  name: string;
  texture: string;
  radius: number;
  orbitRadius: number;
  realAU: number;
  period: number;
  eccentricity: number;
  inclination: number;
  axialTilt: number;
  rotationHours: number;
  color: string;
  category: string;
  fact: string;
};

const PLANETS: PlanetData[] = [
  { name: "Mercury", texture: "/textures/mercury.jpg", radius: 0.34, orbitRadius: 5.8, realAU: 0.39, period: 88, eccentricity: 0.206, inclination: 7, axialTilt: 0.03, rotationHours: 1407.6, color: "#aaa49a", category: "Terrestrial planet", fact: "The fastest world around the Sun, completing an orbit in only 88 Earth days." },
  { name: "Venus", texture: "/textures/venus.jpg", radius: 0.58, orbitRadius: 8.1, realAU: 0.72, period: 224.7, eccentricity: 0.007, inclination: 3.4, axialTilt: 177.4, rotationHours: -5832.5, color: "#d7b27c", category: "Terrestrial planet", fact: "A dense carbon-dioxide atmosphere makes Venus the hottest planet." },
  { name: "Earth", texture: "/textures/earth.jpg", radius: 0.62, orbitRadius: 10.8, realAU: 1, period: 365.26, eccentricity: 0.017, inclination: 0, axialTilt: 23.44, rotationHours: 23.93, color: "#5c91e6", category: "Ocean world", fact: "Our home world is the only known planet with liquid surface oceans and life." },
  { name: "Mars", texture: "/textures/mars.jpg", radius: 0.43, orbitRadius: 14, realAU: 1.52, period: 687, eccentricity: 0.093, inclination: 1.85, axialTilt: 25.19, rotationHours: 24.62, color: "#c56b4d", category: "Terrestrial planet", fact: "Mars hosts Olympus Mons, the largest volcano known in the solar system." },
  { name: "Jupiter", texture: "/textures/jupiter.jpg", radius: 1.35, orbitRadius: 20.5, realAU: 5.2, period: 4332.6, eccentricity: 0.049, inclination: 1.3, axialTilt: 3.13, rotationHours: 9.93, color: "#d0aa82", category: "Gas giant", fact: "Jupiter is more than twice as massive as every other planet combined." },
  { name: "Saturn", texture: "/textures/saturn.jpg", radius: 1.12, orbitRadius: 27.4, realAU: 9.54, period: 10759, eccentricity: 0.057, inclination: 2.49, axialTilt: 26.73, rotationHours: 10.7, color: "#e2c68f", category: "Gas giant", fact: "Its spectacular rings are made of countless pieces of ice and rock." },
  { name: "Uranus", texture: "/textures/uranus.jpg", radius: 0.82, orbitRadius: 34, realAU: 19.19, period: 30687, eccentricity: 0.046, inclination: 0.77, axialTilt: 97.77, rotationHours: -17.2, color: "#95d6dd", category: "Ice giant", fact: "Uranus rotates on its side, likely the result of an ancient collision." },
  { name: "Neptune", texture: "/textures/neptune.jpg", radius: 0.8, orbitRadius: 40.5, realAU: 30.06, period: 60190, eccentricity: 0.011, inclination: 1.77, axialTilt: 28.32, rotationHours: 16.08, color: "#426ee8", category: "Ice giant", fact: "Supersonic winds race through Neptune's deep blue atmosphere." },
];

const START_DATE = new Date("2026-07-12T00:00:00Z");
const SPEEDS = [0.25, 1, 5, 30, 100, 365, 1500];

function solveEccentricAnomaly(meanAnomaly: number, e: number) {
  let eccentricAnomaly = meanAnomaly;
  for (let i = 0; i < 6; i += 1) {
    eccentricAnomaly -= (eccentricAnomaly - e * Math.sin(eccentricAnomaly) - meanAnomaly) / (1 - e * Math.cos(eccentricAnomaly));
  }
  return eccentricAnomaly;
}

function orbitalPosition(planet: PlanetData, elapsedDays: number) {
  const meanAnomaly = ((elapsedDays / planet.period) * Math.PI * 2 + PLANETS.indexOf(planet) * 0.79) % (Math.PI * 2);
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, planet.eccentricity);
  const semiMajor = planet.orbitRadius;
  const semiMinor = semiMajor * Math.sqrt(1 - planet.eccentricity ** 2);
  const x = semiMajor * (Math.cos(eccentricAnomaly) - planet.eccentricity);
  const z = semiMinor * Math.sin(eccentricAnomaly);
  const incline = THREE.MathUtils.degToRad(planet.inclination);
  return new THREE.Vector3(x, z * Math.sin(incline), z * Math.cos(incline));
}

function formatSpeed(speed: number) {
  if (speed < 1) return `${Math.round(speed * 24)} hours / sec`;
  if (speed === 1) return "1 day / sec";
  if (speed < 365) return `${speed} days / sec`;
  if (speed === 365) return "1 year / sec";
  return `${(speed / 365).toFixed(1)} years / sec`;
}

export default function Home() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneApi = useRef<{
    focus: (name: string) => void;
    reset: () => void;
    zoom: (delta: number) => void;
    setOrbits: (visible: boolean) => void;
  } | null>(null);
  const speedRef = useRef(30);
  const pausedRef = useRef(false);
  const [selected, setSelected] = useState("Earth");
  const [speedIndex, setSpeedIndex] = useState(3);
  const [paused, setPaused] = useState(false);
  const [showOrbits, setShowOrbits] = useState(true);
  const [elapsedDays, setElapsedDays] = useState(0);
  const [infoOpen, setInfoOpen] = useState(true);
  const [planetMenuOpen, setPlanetMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedPlanet = PLANETS.find((planet) => planet.name === selected) ?? PLANETS[2];
  const simulationDate = useMemo(() => {
    const date = new Date(START_DATE.getTime() + elapsedDays * 86_400_000);
    return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  }, [elapsedDays]);

  useEffect(() => {
    speedRef.current = SPEEDS[speedIndex];
  }, [speedIndex]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const selectPlanet = useCallback((name: string) => {
    setSelected(name);
    setPlanetMenuOpen(false);
    setInfoOpen(true);
    sceneApi.current?.focus(name);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010207);
    scene.fog = new THREE.FogExp2(0x010207, 0.004);

    const camera = new THREE.PerspectiveCamera(48, mount.clientWidth / mount.clientHeight, 0.05, 600);
    camera.position.set(0, 25, 38);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.minDistance = 2;
    controls.maxDistance = 105;
    controls.maxPolarAngle = Math.PI * 0.96;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x2b416a, 0.11));
    const sunlight = new THREE.PointLight(0xfff1d2, 260, 130, 1.45);
    scene.add(sunlight);

    const textureLoader = new THREE.TextureLoader();
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const loadTexture = (url: string) => {
      const texture = textureLoader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAnisotropy;
      return texture;
    };

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 12000;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starPalette = [new THREE.Color("#ffffff"), new THREE.Color("#a9c9ff"), new THREE.Color("#ffe2b4")];
    for (let i = 0; i < starCount; i += 1) {
      const radius = 75 + Math.random() * 185;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const color = starPalette[Math.floor(Math.random() * starPalette.length)];
      starColors.set([color.r, color.g, color.b], i * 3);
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 0.19, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.88, depthWrite: false }));
    scene.add(stars);

    const milkyWayGeometry = new THREE.BufferGeometry();
    const dustCount = 3600;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 95 + Math.random() * 115;
      dustPositions[i * 3] = Math.cos(angle) * radius;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      dustPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    milkyWayGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const milkyWay = new THREE.Points(milkyWayGeometry, new THREE.PointsMaterial({ color: 0x5b76ba, size: 0.34, transparent: true, opacity: 0.14, depthWrite: false }));
    milkyWay.rotation.z = 0.52;
    scene.add(milkyWay);

    const sunGroup = new THREE.Group();
    const sun = new THREE.Mesh(new THREE.SphereGeometry(2.15, 64, 64), new THREE.MeshBasicMaterial({ map: loadTexture("/textures/sun.jpg") }));
    sunGroup.add(sun);
    const corona = new THREE.Mesh(new THREE.SphereGeometry(2.48, 48, 48), new THREE.MeshBasicMaterial({ color: 0xffa52e, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, side: THREE.BackSide }));
    sunGroup.add(corona);
    scene.add(sunGroup);

    const planetMeshes = new Map<string, THREE.Group>();
    const orbitLines: THREE.Line[] = [];
    const clickableMeshes: THREE.Object3D[] = [];

    PLANETS.forEach((planet) => {
      const group = new THREE.Group();
      const tilt = new THREE.Group();
      tilt.rotation.z = THREE.MathUtils.degToRad(planet.axialTilt);
      const material = new THREE.MeshStandardMaterial({ map: loadTexture(planet.texture), roughness: 0.92, metalness: 0 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(planet.radius, 48, 48), material);
      mesh.userData.planetName = planet.name;
      tilt.add(mesh);
      group.add(tilt);

      if (planet.name === "Earth") {
        const clouds = new THREE.Mesh(new THREE.SphereGeometry(planet.radius * 1.012, 48, 48), new THREE.MeshStandardMaterial({ map: loadTexture("/textures/earth-clouds.jpg"), transparent: true, opacity: 0.33, depthWrite: false, blending: THREE.AdditiveBlending }));
        clouds.userData.clouds = true;
        tilt.add(clouds);
        const moonPivot = new THREE.Group();
        const moon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 28, 28), new THREE.MeshStandardMaterial({ map: loadTexture("/textures/moon.jpg"), roughness: 1 }));
        moon.position.x = 1.45;
        moonPivot.userData.moonPivot = true;
        moonPivot.add(moon);
        group.add(moonPivot);
      }

      if (planet.name === "Saturn") {
        const ringTexture = loadTexture("/textures/saturn-ring.png");
        const ring = new THREE.Mesh(new THREE.RingGeometry(planet.radius * 1.3, planet.radius * 2.3, 96), new THREE.MeshStandardMaterial({ map: ringTexture, transparent: true, opacity: 0.88, side: THREE.DoubleSide, roughness: 0.8, depthWrite: false }));
        ring.rotation.x = Math.PI / 2;
        tilt.add(ring);
      }

      group.userData.planet = planet;
      scene.add(group);
      planetMeshes.set(planet.name, group);
      clickableMeshes.push(mesh);

      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 180; i += 1) {
        const anomaly = (i / 180) * Math.PI * 2;
        const a = planet.orbitRadius;
        const b = a * Math.sqrt(1 - planet.eccentricity ** 2);
        const x = a * (Math.cos(anomaly) - planet.eccentricity);
        const z = b * Math.sin(anomaly);
        const incline = THREE.MathUtils.degToRad(planet.inclination);
        points.push(new THREE.Vector3(x, z * Math.sin(incline), z * Math.cos(incline)));
      }
      const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: planet.color, transparent: true, opacity: 0.19 }));
      orbitLines.push(orbit);
      scene.add(orbit);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerUp = (event: PointerEvent) => {
      if (Math.abs(event.movementX) > 3 || Math.abs(event.movementY) > 3) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickableMeshes, false)[0];
      const name = hit?.object.userData.planetName;
      if (name) selectPlanet(name);
    };
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    let localElapsedDays = 0;
    let lastTime = performance.now();
    let lastUiUpdate = 0;
    let targetCameraPosition: THREE.Vector3 | null = null;
    let targetControlPosition: THREE.Vector3 | null = null;
    let followName: string | null = null;
    let animationFrame = 0;

    const focusPlanet = (name: string) => {
      const group = planetMeshes.get(name);
      const data = PLANETS.find((item) => item.name === name);
      if (!group || !data) return;
      const position = group.position.clone();
      const direction = new THREE.Vector3(0.85, 0.5, 1).normalize();
      targetControlPosition = position;
      targetCameraPosition = position.clone().add(direction.multiplyScalar(Math.max(3.6, data.radius * 5.4)));
      followName = name;
    };

    sceneApi.current = {
      focus: focusPlanet,
      reset: () => {
        followName = null;
        targetControlPosition = new THREE.Vector3(0, 0, 0);
        targetCameraPosition = new THREE.Vector3(0, 25, 38);
      },
      zoom: (delta) => {
        const direction = camera.position.clone().sub(controls.target).normalize();
        camera.position.add(direction.multiplyScalar(delta));
      },
      setOrbits: (visible) => orbitLines.forEach((line) => { line.visible = visible; }),
    };

    const animate = (now: number) => {
      const deltaSeconds = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;
      if (!pausedRef.current) localElapsedDays += deltaSeconds * speedRef.current;

      PLANETS.forEach((planet) => {
        const group = planetMeshes.get(planet.name)!;
        group.position.copy(orbitalPosition(planet, localElapsedDays));
        const tilt = group.children[0] as THREE.Group;
        const mesh = tilt.children[0] as THREE.Mesh;
        mesh.rotation.y += deltaSeconds * (planet.rotationHours < 0 ? -1 : 1) * Math.min(0.65, 16 / Math.abs(planet.rotationHours));
        const clouds = tilt.children.find((child) => child.userData.clouds);
        if (clouds) clouds.rotation.y += deltaSeconds * 0.025;
        const moonPivot = group.children.find((child) => child.userData.moonPivot);
        if (moonPivot) moonPivot.rotation.y = (localElapsedDays / 27.3) * Math.PI * 2;
      });

      sun.rotation.y += deltaSeconds * 0.025;
      corona.scale.setScalar(1 + Math.sin(now * 0.0015) * 0.025);
      stars.rotation.y += deltaSeconds * 0.00045;

      if (followName && !targetCameraPosition) {
        const group = planetMeshes.get(followName);
        if (group) controls.target.lerp(group.position, 0.08);
      }
      if (targetCameraPosition && targetControlPosition) {
        camera.position.lerp(targetCameraPosition, 0.055);
        controls.target.lerp(targetControlPosition, 0.07);
        if (camera.position.distanceTo(targetCameraPosition) < 0.06) {
          targetCameraPosition = null;
          targetControlPosition = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      if (now - lastUiUpdate > 240) {
        setElapsedDays(localElapsedDays);
        lastUiUpdate = now;
      }
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material?.dispose());
        }
      });
      mount.removeChild(renderer.domElement);
      sceneApi.current = null;
    };
  }, [selectPlanet]);

  const filteredPlanets = PLANETS.filter((planet) => planet.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="universe-shell">
      <div ref={mountRef} className="space-canvas" aria-label="Interactive 3D solar system simulation" />
      <div className="vignette" />

      <header className="topbar glass-panel">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={17} strokeWidth={1.7} /></div>
          <div>
            <span className="eyebrow">CELESTIAL ENGINE</span>
            <h1>Orbital Atlas</h1>
          </div>
        </div>
        <div className="topbar-meta">
          <span className="live-indicator"><i /> LIVE SIMULATION</span>
          <span className="coordinate">HELIOCENTRIC · J2000</span>
        </div>
        <button className="icon-button" aria-label="Enter fullscreen" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize size={17} /></button>
      </header>

      <aside className="planet-rail glass-panel" aria-label="Planet navigator">
        <div className="rail-title">SYSTEM</div>
        {PLANETS.map((planet) => (
          <button key={planet.name} className={`planet-dot ${selected === planet.name ? "active" : ""}`} style={{ "--planet-color": planet.color } as React.CSSProperties} onClick={() => selectPlanet(planet.name)} aria-label={`Focus ${planet.name}`}>
            <span className="dot-core" />
            <span className="planet-tooltip">{planet.name}</span>
          </button>
        ))}
        <span className="rail-line" />
      </aside>

      <section className="object-selector glass-panel">
        <button className="object-select-button" onClick={() => setPlanetMenuOpen((open) => !open)} aria-expanded={planetMenuOpen}>
          <span className="planet-swatch" style={{ background: selectedPlanet.color, boxShadow: `0 0 18px ${selectedPlanet.color}` }} />
          <span><small>FOCUSED OBJECT</small><strong>{selectedPlanet.name}</strong></span>
          <ChevronDown size={16} className={planetMenuOpen ? "rotate" : ""} />
        </button>
        {planetMenuOpen && (
          <div className="planet-menu glass-panel">
            <label className="search-field"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a planet" autoFocus /></label>
            {filteredPlanets.map((planet) => <button key={planet.name} onClick={() => selectPlanet(planet.name)}><i style={{ background: planet.color }} />{planet.name}<span>{planet.realAU} AU</span></button>)}
          </div>
        )}
      </section>

      {infoOpen && (
        <aside className="info-card glass-panel">
          <div className="card-header">
            <span className="pill"><i style={{ background: selectedPlanet.color }} /> {selectedPlanet.category}</span>
            <button className="quiet-button" onClick={() => setInfoOpen(false)} aria-label="Close planet details"><X size={16} /></button>
          </div>
          <div className="planet-heading">
            <div><span className="object-index">0{PLANETS.indexOf(selectedPlanet) + 1} / 08</span><h2>{selectedPlanet.name}</h2></div>
            <button className="focus-button" onClick={() => sceneApi.current?.focus(selectedPlanet.name)}><Focus size={15} /> Focus</button>
          </div>
          <p>{selectedPlanet.fact}</p>
          <div className="data-grid">
            <div><span>Distance</span><strong>{selectedPlanet.realAU.toFixed(2)} AU</strong></div>
            <div><span>Orbital period</span><strong>{selectedPlanet.period > 1000 ? `${(selectedPlanet.period / 365.25).toFixed(1)} yr` : `${selectedPlanet.period.toFixed(1)} d`}</strong></div>
            <div><span>Inclination</span><strong>{selectedPlanet.inclination.toFixed(2)}°</strong></div>
            <div><span>Axial tilt</span><strong>{selectedPlanet.axialTilt.toFixed(2)}°</strong></div>
          </div>
          <div className="source-note"><Info size={13} /> Distances and object sizes are visually compressed for navigation.</div>
        </aside>
      )}

      {!infoOpen && <button className="reopen-info glass-panel" onClick={() => setInfoOpen(true)}><Info size={16} /> Object data</button>}

      <div className="view-controls glass-panel">
        <button onClick={() => sceneApi.current?.zoom(-2.8)} aria-label="Zoom in"><Plus size={17} /></button>
        <button onClick={() => sceneApi.current?.zoom(2.8)} aria-label="Zoom out"><Minus size={17} /></button>
        <span />
        <button className={showOrbits ? "active" : ""} onClick={() => { setShowOrbits((value) => { sceneApi.current?.setOrbits(!value); return !value; }); }} aria-label="Toggle orbit paths">{showOrbits ? <Eye size={17} /> : <EyeOff size={17} />}</button>
        <button onClick={() => sceneApi.current?.reset()} aria-label="Reset view"><RotateCcw size={16} /></button>
      </div>

      <section className="timeline-panel glass-panel">
        <button className="play-button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Resume simulation" : "Pause simulation"}>{paused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}</button>
        <div className="timeline-main">
          <div className="timeline-labels"><span>SIMULATION SPEED</span><strong>{paused ? "Paused" : formatSpeed(SPEEDS[speedIndex])}</strong></div>
          <input className="speed-slider" type="range" min="0" max={SPEEDS.length - 1} step="1" value={speedIndex} onChange={(event) => setSpeedIndex(Number(event.target.value))} aria-label="Simulation speed" />
          <div className="ticks"><span>6H</span><span>1D</span><span>5D</span><span>30D</span><span>100D</span><span>1Y</span><span>4Y</span></div>
        </div>
        <div className="date-readout"><span>UTC DATE</span><strong>{simulationDate.toUpperCase()}</strong></div>
      </section>

      <div className="interaction-hint"><Crosshair size={14} /><span>Drag to orbit · Scroll to zoom · Select any world</span></div>
    </main>
  );
}
