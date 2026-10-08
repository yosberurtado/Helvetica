// Casa Cuco · exterior orbitable + interior caminable con secciones holográficas en vivo.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (s) => document.querySelector(s);
const V3 = THREE.Vector3;
const isTouch = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (isTouch) document.documentElement.classList.add('touch');

const ACID = 0xd7ff19;
const ROOMS = [
  { id: 'inicio', name: 'Inicio' },
  { id: 'nosotros', name: 'Nosotros' },
  { id: 'proyectos', name: 'Proyectos' },
  { id: 'servicios', name: 'Servicios' },
  { id: 'contacto', name: 'Contacto' },
];

// ---------------------------------------------------------------- Render base
const canvas = $('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
const PR = Math.min(devicePixelRatio, isTouch ? 1.5 : 1.75);
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 220);
camera.rotation.order = 'YXZ';

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(innerWidth, innerHeight);
$('#css-layer').appendChild(cssRenderer.domElement);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.62, 0.5, 0.92);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- Utilidades
function hash(seed) {
  return (i, j, k) => {
    const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + seed * 13.37) * 43758.5453;
    return s - Math.floor(s);
  };
}
let rngState = 7;
const rand = () => ((rngState = (rngState * 16807) % 2147483647) / 2147483647);

function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Piedra con textura de papel arrugado, como las paredes de las referencias.
function stoneTexture(base, specks = 16000) {
  return canvasTex(512, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < specks; i++) {
      const v = Math.random() > 0.5 ? 255 : 18;
      g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.13})`;
      g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    g.lineWidth = 1;
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
      g.beginPath();
      let x = Math.random() * s, y = Math.random() * s;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); }
      g.stroke();
    }
  });
}
function radialTex(stops) {
  const t = canvasTex(256, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Superficie facetada: malla irregular desplazada y sombreada plana (low-poly).
function facetSurface({ u0, u1, v0, v1, cell, amp, bias = 0, wave = 0.6, map, hole, seed = 1, jitter = 0.3 }) {
  const nu = Math.max(1, Math.ceil((u1 - u0) / cell)), nv = Math.max(1, Math.ceil((v1 - v0) / cell));
  const du = (u1 - u0) / nu, dv = (v1 - v0) / nv, r = hash(seed);
  const grid = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const edge = i === 0 || j === 0 || i === nu || j === nv;
    const u = u0 + i * du + (edge ? 0 : (r(i, j, 1) - 0.5) * 2 * jitter * du);
    const v = v0 + j * dv + (edge ? 0 : (r(i, j, 2) - 0.5) * 2 * jitter * dv);
    const d = bias + (r(i, j, 3) - 0.5) * 2 * amp + amp * wave * Math.sin(u * 0.33 + seed) * Math.cos(v * 0.41 + seed * 2);
    grid.push([u, v, d]);
  }
  const pos = [], uv = [];
  const at = (i, j) => grid[j * (nu + 1) + i];
  const tri = (a, b, c) => {
    if (hole && hole((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3)) return;
    for (const p of [a, b, c]) { pos.push(...map(p[0], p[1], p[2])); uv.push(p[0] / 4, p[1] / 4); }
  };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    if (r(i, j, 4) > 0.5) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Cono de luz volumétrica bajo cada "ojo" del techo.
const beamTex = (() => {
  const t = canvasTex(64, (g, s) => {
    const gr = g.createLinearGradient(0, 0, 0, s);
    gr.addColorStop(0, 'rgba(235,255,140,.9)'); gr.addColorStop(0.5, 'rgba(200,240,40,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
})();
const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const glowMat = (opacity = 1, tint = 0xffffff) => new THREE.MeshBasicMaterial({
  map: radialTex([[0, 'rgba(225,255,90,.55)'], [0.45, 'rgba(160,210,20,.18)'], [1, 'rgba(0,0,0,0)']]),
  color: tint, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
});
const neonMat = new THREE.MeshStandardMaterial({ color: 0xcfff16, emissive: 0xb6e000, emissiveIntensity: 3.2, roughness: 0.3 });

function bar(a, b, thick, mat) {
  const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, len), mat);
  m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.lookAt(b.x, b.y, b.z);
  return m;
}

// ================================================================= EXTERIOR
function buildExterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050604');
  scene.fog = new THREE.FogExp2('#050604', 0.012);
  scene.add(new THREE.HemisphereLight(0xe6e9d7, 0x11130d, 1.5));
  scene.add(new THREE.AmbientLight(0x555b43, 0.4));
  const point = (x, y, z, color, intensity, distance, shadow = false) => {
    const l = new THREE.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z); l.castShadow = shadow; scene.add(l); return l;
  };
  const key = point(-9, 13, 14, 0xf0f1d9, 125, 42, true);
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.00025;
  point(9, 7, 3, ACID, 34, 26); point(-8, 4, -9, 0xaecb38, 22, 26);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: '#080a07', roughness: 0.34, metalness: 0.32 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.2; floor.receiveShadow = true; scene.add(floor);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), glowMat(0.5));
  glow.rotation.x = -Math.PI / 2; glow.position.set(0, -0.17, 4); scene.add(glow);

  // Silueta frontal de la marca extruida como volumen.
  const DEPTH = 9.2;
  const stoneTex = stoneTexture('#d8d7cb', 15000); stoneTex.repeat.set(3.5, 3.5);
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex, bumpMap: stoneTex, bumpScale: 0.05, color: '#dddcd2', roughness: 0.8, metalness: 0.025, side: THREE.DoubleSide });
  const outlineMat = new THREE.LineBasicMaterial({ color: ACID, transparent: true, opacity: 0.22 });
  const shape = new THREE.Shape();
  [[-5.5, 0.05], [-5.45, 3.35], [-4.7, 4.05], [-2.75, 5.12], [-1.15, 8.12], [0.65, 6.12], [2.1, 4.75], [2.8, 5.95], [3.55, 4.25], [5.35, 0.18], [3.8, 0.08], [2.9, 0.92], [1.95, 0.08], [0.98, 0.67], [0.05, 0.05], [-0.88, 0.72], [-1.72, 0.08], [-2.7, 0.48], [-3.55, 0.04]]
    .forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const doorway = new THREE.Path();
  doorway.moveTo(-4.62, 0.02); doorway.lineTo(-4.62, 3.48); doorway.lineTo(-1.45, 4.55); doorway.lineTo(-1.45, 0.02); doorway.closePath();
  shape.holes.push(doorway);
  const houseGeo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.14, bevelThickness: 0.14, curveSegments: 8 });
  const house = new THREE.Mesh(houseGeo, stone); house.castShadow = house.receiveShadow = true; scene.add(house);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(houseGeo, 32), outlineMat); edges.position.z = 0.008; scene.add(edges);

  // Cuerno / cola.
  const tailCurve = new THREE.CatmullRomCurve3([[2.55, 5.75], [3.55, 5.28], [4.72, 5.5], [5.55, 6.38], [5.52, 7.48], [4.7, 8.42], [3.65, 8.12], [3.18, 7.55]].map(([x, y], i) => new V3(x, y, DEPTH + 0.15 - i * 0.01)));
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 64, 0.62, 8, false), stone);
  tail.castShadow = tail.receiveShadow = true; scene.add(tail);
  scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(tail.geometry, 34), outlineMat));

  // Ojos.
  const socketMat = new THREE.MeshStandardMaterial({ color: '#030403', roughness: 0.16, metalness: 0.48 });
  const irisMat = new THREE.MeshStandardMaterial({ color: ACID, emissive: '#b9ff00', emissiveIntensity: 3.2, roughness: 0.18 });
  const irises = [];
  for (const [x, y, rot] of [[-0.8, 4.65, -0.12], [2.05, 4.18, 0.18]]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 28), socketMat);
    socket.position.set(x, y, DEPTH + 0.12); socket.scale.set(0.7, 0.44, 0.17); socket.rotation.z = rot; scene.add(socket);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.18, 28, 20), irisMat.clone());
    iris.position.set(x, y, DEPTH + 0.29); iris.scale.set(1.05, 0.9, 0.48); scene.add(iris); irises.push(iris);
    point(x, y, DEPTH + 1, ACID, 4.8, 8);
  }
  // Umbral luminoso: la puerta por donde se entra.
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xcfff16, emissive: 0x9bb800, emissiveIntensity: 2.8, roughness: 0.25, metalness: 0.2 });
  const doorParts = [];
  const box = (x, y, z, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat); m.position.set(x, y, z); scene.add(m); doorParts.push(m); };
  for (const z of [DEPTH + 0.16, DEPTH - 4.0]) { box(-4.58, 1.82, z, 0.09, 3.62, 0.12); box(-1.5, 2.28, z, 0.09, 4.5, 0.12); box(-3.04, 4.05, z, 3.16, 0.09, 0.12); }
  const tunnelMat = new THREE.MeshStandardMaterial({ color: '#090b07', roughness: 0.58, metalness: 0.24, emissive: '#333d0b', emissiveIntensity: 0.15, side: THREE.DoubleSide });
  const passage = new THREE.Mesh(new THREE.BoxGeometry(3.12, 0.07, DEPTH), tunnelMat); passage.position.set(-3.05, 0.02, DEPTH / 2); scene.add(passage);
  // Velo de luz en el umbral (también es el blanco del clic para entrar).
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(3.05, 4.2), new THREE.MeshBasicMaterial({ map: beamTex, color: 0xeaff8a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  veil.position.set(-3.04, 2.1, DEPTH - 3.9); scene.add(veil); doorParts.push(veil);
  const doorGlow = point(-3, 2.2, DEPTH - 3.8, 0xcfff16, 13, 12);
  const dotMat = new THREE.MeshBasicMaterial({ color: ACID });
  for (let z = DEPTH - 0.4; z > 0.3; z -= 0.43) { const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), dotMat); d.position.set(-3.05, 0.09, z); scene.add(d); }

  // Órbita punteada.
  const orbitPts = [];
  for (let i = 0; i < 280; i++) { const a = (i / 280) * Math.PI * 2; orbitPts.push(new V3(Math.cos(a) * 9.2, 0.04, 4 + Math.sin(a) * 11.2)); }
  const orbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbitPts), new THREE.LineDashedMaterial({ color: ACID, dashSize: 0.1, gapSize: 0.18, transparent: true, opacity: 0.44 }));
  orbitLine.computeLineDistances(); scene.add(orbitLine);

  // Polvo flotante.
  scene.add(makeDust(500, [-16, 16], [0, 10], [-10, 20]));

  return {
    scene, DEPTH, doorParts,
    door: new V3(-3.05, 1.8, DEPTH),
    update(t) {
      irises.forEach((e, i) => (e.material.emissiveIntensity = 2.8 + 0.6 * Math.sin(t * 1.5 + i * 0.65)));
      doorGlow.intensity = 11 + 2 * Math.sin(t * 1.1);
      veil.material.opacity = 0.18 + 0.06 * Math.sin(t * 2);
    },
  };
}

function makeDust(n, [x0, x1], [y0, y1], [z0, z1]) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { p[i * 3] = x0 + Math.random() * (x1 - x0); p[i * 3 + 1] = y0 + Math.random() * (y1 - y0); p[i * 3 + 2] = z0 + Math.random() * (z1 - z0); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe9ff9a, size: 0.035, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.userData.dust = true;
  return pts;
}

// ================================================================= INTERIOR
// Cinco salas en fila a lo largo de -Z, con techo a dos aguas (forma de casa)
// y puertas con forma de casa que alternan de lado.
const W = 18, D = 18, H = 6.6, R = 3.6, EYE = 1.65;
const NWALL = ROOMS.length + 1;
const doorX = (k) => (k % 2 === 0 ? -4 : 4);
const DOOR_W = 1.3, DOOR_H = 2.9, DOOR_TOP = 3.95;
const doorPoly = (dx, e = 0) => [[dx - DOOR_W - e, -1], [dx + DOOR_W + e, -1], [dx + DOOR_W + e, DOOR_H + e * 0.6], [dx, DOOR_TOP + e * 1.25], [dx - DOOR_W - e, DOOR_H + e * 0.6]];

function buildInterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040503');
  scene.fog = new THREE.FogExp2('#040503', 0.022);
  scene.add(new THREE.HemisphereLight(0xdfe6c4, 0x0b0d08, 0.22));

  const wallTex = stoneTexture('#c9c8b8'); wallTex.repeat.set(1, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, bumpMap: wallTex, bumpScale: 0.6, color: '#a3a291', roughness: 0.86, metalness: 0.02, side: THREE.DoubleSide });
  const darkWallMat = wallMat.clone(); darkWallMat.color.set('#8d8d7e');
  const len = NWALL - 1;
  const zEnd = -len * D;

  // Paredes laterales y techo a dos aguas.
  const half = W / 2, slope = R / half, nl = Math.hypot(slope, 1);
  const sides = [-1, 1];
  for (const s of sides) {
    scene.add(new THREE.Mesh(facetSurface({
      u0: zEnd - 1.5, u1: 1.5, v0: -0.3, v1: H + 1.4, cell: 1.6, amp: 0.36, bias: 0.4, seed: s > 0 ? 3 : 5,
      map: (u, v, d) => [s * (half + 0.7 - d), v, u],
    }), wallMat));
    scene.add(new THREE.Mesh(facetSurface({
      u0: -1.6, u1: half + 0.8, v0: zEnd - 1.5, v1: 1.5, cell: 1.9, amp: 0.45, bias: 0.25, seed: s > 0 ? 7 : 11,
      map: (u, v, d) => [s * (half - u) - s * (slope / nl) * d, H + slope * u - d / nl, v],
    }), darkWallMat));
  }

  // Paredes transversales con puerta en forma de casa.
  const doors = [];
  const ringMat = wallMat.clone(); ringMat.color.set('#c4c3b1');
  for (let k = 0; k < NWALL; k++) {
    const zw = -k * D, dx = doorX(k), hole = doorPoly(dx, 0.12);
    scene.add(new THREE.Mesh(facetSurface({
      u0: -half - 1.2, u1: half + 1.2, v0: -0.3, v1: H + R + 0.8, cell: 1.05, amp: 0.38, seed: 20 + k,
      map: (u, v, d) => [u, v, zw + d], hole: (u, v) => pointInPoly(u, v, hole),
    }), wallMat));
    // Marco grueso del vano.
    const outer = doorPoly(dx, 0.95), inner = doorPoly(dx, 0);
    const sh = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, Math.max(y, 0))));
    sh.holes.push(new THREE.Path(inner.map(([x, y]) => new THREE.Vector2(x, Math.max(y, 0))).reverse()));
    const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 1.15, bevelEnabled: false }), ringMat);
    ring.position.z = zw - 0.575; scene.add(ring);
    // Neón en ambas caras del vano.
    const P = inner.map(([x, y]) => [x, Math.max(y, 0)]);
    for (const zf of [zw + 0.6, zw - 0.6]) {
      for (const [a, b] of [[P[1], P[2]], [P[2], P[3]], [P[3], P[4]], [P[4], P[0]]]) scene.add(bar(new V3(a[0], a[1], zf), new V3(b[0], b[1], zf), 0.07, neonMat));
      const sill = bar(new V3(dx - DOOR_W, 0.02, zf), new V3(dx + DOOR_W, 0.02, zf), 0.05, neonMat); scene.add(sill);
    }
    const sealed = k === NWALL - 1, exit = k === 0;
    if (sealed || exit) {
      // Portal de luz: salida al exterior (k=0) o luz de fondo de la última sala.
      const portalShape = new THREE.Shape(P.map(([x, y]) => new THREE.Vector2(x, y)));
      const portal = new THREE.Mesh(new THREE.ShapeGeometry(portalShape), new THREE.MeshBasicMaterial({
        color: exit ? 0x9fbf3a : 0xeaff9a, map: beamTex, transparent: true, opacity: exit ? 0.55 : 0.95, side: THREE.DoubleSide, fog: false,
      }));
      portal.position.z = zw + (exit ? 0.35 : 0.1);
      if (!exit) portal.material.blending = THREE.AdditiveBlending;
      scene.add(portal);
    }
    const l = new THREE.PointLight(0xdcff5a, sealed ? 34 : 18, 14, 2); l.position.set(dx, 2.4, zw + (exit ? -1 : 0)); scene.add(l);
    doors.push({ k, zw, dx, light: l });
  }

  // Piso: espejo + capa de concreto translúcida para el brillo mojado de las referencias.
  const floorW = W + 2, floorD = len * D + 2;
  const mirror = new Reflector(new THREE.PlaneGeometry(floorW, floorD), {
    textureWidth: Math.round(innerWidth * PR * (isTouch ? 0.35 : 0.5)), textureHeight: Math.round(innerHeight * PR * (isTouch ? 0.35 : 0.5)),
    color: 0x8a8a80, multisample: isTouch ? 0 : 4,
  });
  mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, 0, zEnd / 2); scene.add(mirror);
  const concrete = canvasTex(512, (g, s) => {
    g.fillStyle = '#1a1c15'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26000; i++) { const v = Math.random() * 60; g.fillStyle = `rgba(${v},${v + 4},${v},${Math.random() * 0.35})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  }, 1);
  concrete.repeat.set(floorW / 6, floorD / 6);
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(floorW, floorD), new THREE.MeshStandardMaterial({ map: concrete, color: '#22261a', roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.66 }));
  overlay.rotation.x = -Math.PI / 2; overlay.position.set(0, 0.004, zEnd / 2); scene.add(overlay);
  const floorDecals = new THREE.Group(); scene.add(floorDecals);
  const hideInMirror = [overlay, floorDecals];
  const baseBefore = mirror.onBeforeRender;
  mirror.onBeforeRender = function (...a) { hideInMirror.forEach((o) => (o.visible = false)); baseBefore.apply(this, a); hideInMirror.forEach((o) => (o.visible = true)); };

  for (const d of doors) for (const side of [1, -1]) {
    if ((d.k === 0 && side > 0) || (d.k === NWALL - 1 && side < 0)) continue;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), glowMat(0.55)); g.rotation.x = -Math.PI / 2; g.position.set(d.dx, 0.012, d.zw + side * 2.4); floorDecals.add(g);
  }

  // Ojos del techo con haz de luz, rocas facetadas, cuernos y luz de cada sala.
  const eyeDark = new THREE.MeshStandardMaterial({ color: '#040503', roughness: 0.25, metalness: 0.5 });
  const eyeLit = new THREE.MeshStandardMaterial({ color: ACID, emissive: 0xc8ff00, emissiveIntensity: 4 });
  const rockMat = wallMat.clone(); rockMat.flatShading = true; rockMat.color.set('#a8a795');
  const eyes = [], obstacles = [], panels = [];
  ROOMS.forEach((room, i) => {
    const z0 = -i * D, zc = z0 - D / 2;
    const nextDx = doorX(i + 1);
    const panelSide = nextDx > 0 ? -1 : 1;
    for (const ex of [-4.6, 4.6]) {
      const ez = zc + (ex > 0 ? -1.8 : 1.8) * (i % 2 ? -1 : 1);
      const y = H + slope * (half - Math.abs(ex)) - 0.3;
      const eye = new THREE.Group(); eye.position.set(ex, y, ez); eye.rotation.z = -Math.sign(ex) * Math.atan(slope);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 0.28, 40), eyeDark); eye.add(disc);
      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.36, 32), eyeLit.clone()); iris.rotation.x = Math.PI / 2; iris.position.y = -0.15; eye.add(iris);
      scene.add(eye); eyes.push(iris);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(2.3, y, 40, 1, true), beamMat); beam.position.set(ex, y / 2, ez); scene.add(beam);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), glowMat(0.4)); pool.rotation.x = -Math.PI / 2; pool.position.set(ex, 0.01, ez); floorDecals.add(pool);
    }
    const lamp = new THREE.PointLight(0xf1f4e0, 26, 26, 2); lamp.position.set(0, H + 1, zc); scene.add(lamp);

    // Rocas: grandes poliedros incrustados en las paredes.
    for (let r = 0; r < 5; r++) {
      const s = r % 2 ? 1 : -1;
      let rz = z0 - 2.5 - rand() * (D - 5);
      const isPanelSide = s === panelSide;
      if (isPanelSide && Math.abs(rz - (z0 - D * 0.6)) < 5) rz = z0 - (rand() > 0.5 ? 2.8 : D - 2.8);
      const sz = 1.4 + rand() * 1.6;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockMat);
      rock.scale.set(sz * (0.8 + rand() * 0.6), sz * (1 + rand() * 1.4), sz * (0.8 + rand() * 0.6));
      rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      const rx = s * (half - 0.2 + rand() * 0.4);
      rock.position.set(rx, sz * 0.5, rz); scene.add(rock);
      obstacles.push({ type: 'circle', x: rx, z: rz, r: sz * 1.05 });
    }
    // Cuerno en media luna (Nosotros y Contacto, como en las referencias).
    if (i === 1 || i === 4) {
      const cx = nextDx * 1.55, cy = H + 1.2, cz = z0 - D + 3;
      const pts = []; for (let a = 0; a <= 7; a++) { const t = -0.6 + (a / 7) * 3.4; pts.push(new V3(cx + Math.cos(t) * 1.9 * Math.sign(cx), cy + Math.sin(t) * 1.9, cz)); }
      const horn = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.55, 5, false), rockMat); scene.add(horn);
    }

    // Holograma: panel de vidrio con neón + la sección web en vivo (CSS3D).
    const theta = 0.3 * -panelSide;
    const px = panelSide * 3.6, pz = z0 - D * 0.6, py = 2.75;
    const pg = new THREE.Group(); pg.position.set(px, py, pz); pg.rotation.y = theta; scene.add(pg);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4.6, 0.08), new THREE.MeshStandardMaterial({ color: '#0e1706', emissive: '#283a05', emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.42, depthWrite: false }));
    pg.add(slab);
    const hw = 3.75, hh = 2.3;
    for (const [a, b] of [[[-hw, -hh], [hw, -hh]], [[hw, -hh], [hw, hh]], [[hw, hh], [-hw, hh]], [[-hw, hh], [-hw, -hh]]]) pg.add(bar(new V3(a[0], a[1], 0), new V3(b[0], b[1], 0), 0.06, neonMat));
    const base = bar(new V3(-hw, -py + 0.02, 0), new V3(hw, -py + 0.02, 0), 0.05, neonMat); pg.add(base);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), glowMat(0.5)); pool.rotation.x = -Math.PI / 2; pool.position.set(px, 0.014, pz + 1.2); pool.rotation.z = theta; floorDecals.add(pool);

    const wrap = document.createElement('div');
    wrap.className = 'holo-wrap';
    wrap.innerHTML = '<div class="holo"></div>';
    wrap.firstChild.appendChild($('#tpl-' + room.id).content.cloneNode(true));
    wrap.dataset.room = room.id;
    const css = new CSS3DObject(wrap);
    css.scale.setScalar(7.2 / 1200);
    css.position.z = 0.06;
    pg.add(css);

    const normal = new V3(Math.sin(theta), 0, Math.cos(theta));
    const along = new V3(Math.cos(theta), 0, -Math.sin(theta));
    const center = new V3(px, py, pz);
    obstacles.push({ type: 'seg', a: center.clone().addScaledVector(along, -hw), b: center.clone().addScaledVector(along, hw), r: 0.5 });
    panels.push({ room: i, group: pg, slab, css, wrap, center, normal, opacity: 0 });
  });

  scene.add(makeDust(900, [-half, half], [0.2, H + 2], [zEnd, 0]));

  // Áreas caminables: cada sala + el paso por cada puerta.
  const rects = ROOMS.map((_, i) => ({ x0: -half + 0.9, x1: half - 0.9, z0: -(i + 1) * D + 0.95, z1: -i * D - 0.95 }));
  for (let k = 1; k < NWALL - 1; k++) rects.push({ x0: doorX(k) - 0.85, x1: doorX(k) + 0.85, z0: -k * D - 1.3, z1: -k * D + 1.3 });
  rects.push({ x0: doorX(0) - 0.85, x1: doorX(0) + 0.85, z0: -1.3, z1: 0.9 });

  // Marcador para "clic en el piso".
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 40), new THREE.MeshBasicMaterial({ color: ACID, transparent: true, opacity: 0, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; marker.position.y = 0.03; floorDecals.add(marker);

  return {
    scene, panels, rects, obstacles, marker, mirror,
    update(t) {
      eyes.forEach((e, i) => (e.material.emissiveIntensity = 3.4 + 0.9 * Math.sin(t * 1.3 + i)));
      doors.forEach((d, i) => (d.light.intensity = (d.k === NWALL - 1 ? 34 : 18) + 3 * Math.sin(t * 1.1 + i)));
      beamMat.opacity = 0.1 + 0.025 * Math.sin(t * 0.9);
    },
  };
}

// ================================================================= Construcción
const ext = buildExterior();
const int = buildInterior();
let scene = ext.scene;
let mode = 'exterior'; // exterior | interior | transition
renderPass.scene = scene;

// ---------------------------------------------------------------- Cámara exterior (órbita)
const portrait = innerWidth < innerHeight;
const ORBIT0 = { az: -0.32, el: 0.31, r: portrait ? 34 : 23 };
const orbit = { target: new V3(0, portrait ? 4.6 : 3.9, 4.2), ...ORBIT0, auto: false };
function orbitPos(o = orbit, out = new V3()) {
  const ce = Math.cos(o.el);
  return out.set(o.target.x + Math.sin(o.az) * o.r * ce, o.target.y + Math.sin(o.el) * o.r, o.target.z + Math.cos(o.az) * o.r * ce);
}
function applyOrbit() { orbitPos(orbit, camera.position); camera.lookAt(orbit.target); }
applyOrbit();

// ---------------------------------------------------------------- Jugador interior
const player = { pos: new V3(doorX(0), EYE, -2), yaw: 0, pitch: 0, room: 0, bob: 0 };
let flight = null;    // recorrido animado entre salas
let walkTarget = null; // destino del clic en el piso
const keys = new Set();
const joy = { x: 0, y: 0 };

function walkable(x, z) {
  if (!int.rects.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)) return false;
  for (const o of int.obstacles) {
    if (o.type === 'circle') { if (Math.hypot(x - o.x, z - o.z) < o.r) return false; }
    else {
      const ax = o.b.x - o.a.x, az = o.b.z - o.a.z, t = Math.max(0, Math.min(1, ((x - o.a.x) * ax + (z - o.a.z) * az) / (ax * ax + az * az)));
      if (Math.hypot(x - (o.a.x + ax * t), z - (o.a.z + az * t)) < o.r) return false;
    }
  }
  return true;
}
function tryMove(dx, dz) {
  const p = player.pos;
  let moved = false;
  if (walkable(p.x + dx, p.z)) { p.x += dx; moved = true; }
  if (walkable(p.x, p.z + dz)) { p.z += dz; moved = true; }
  return moved;
}
const roomAt = (z) => Math.max(0, Math.min(ROOMS.length - 1, Math.floor(-z / D)));

function updateWalk(dt) {
  if (flight) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
  let f = 0, s = 0;
  if (!typing && overlay.hidden) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyA')) s -= 1;
    if (keys.has('KeyD')) s += 1;
    if (keys.has('ArrowLeft') || keys.has('KeyQ')) player.yaw += 1.9 * dt;
    if (keys.has('ArrowRight') || keys.has('KeyE')) player.yaw -= 1.9 * dt;
  }
  f += -joy.y; s += joy.x;
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 7.5 : 4.2;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  let mx = 0, mz = 0;
  if (f || s) {
    walkTarget = null;
    const l = Math.min(1, Math.hypot(f, s));
    const n = Math.hypot(f, s) || 1;
    mx = ((fx * f - fz * s) / n) * l; mz = ((fz * f + fx * s) / n) * l;
  } else if (walkTarget) {
    const dx = walkTarget.x - player.pos.x, dz = walkTarget.z - player.pos.z, dist = Math.hypot(dx, dz);
    if (dist < 0.25) walkTarget = null;
    else { mx = dx / dist; mz = dz / dist; const want = Math.atan2(-dx, -dz); player.yaw += angleDiff(want, player.yaw) * Math.min(1, dt * 3); }
  }
  if (mx || mz) {
    const ok = tryMove(mx * speed * dt, mz * speed * dt);
    if (!ok) walkTarget = null;
    player.bob += dt * speed * 1.6;
  }
  if (player.pos.z > 0.35) { exitHouse(); return; }
}
const angleDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

function applyPlayerCamera() {
  camera.position.copy(player.pos);
  camera.position.y = EYE + (reduceMotion ? 0 : Math.sin(player.bob) * 0.035);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

// Distancia al holograma según el ancho de pantalla, para que quepa entero.
function panelView(p) {
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
  const dist = THREE.MathUtils.clamp(4.1 / Math.tan(hfov / 2), 6.8, 9.4);
  const v = p.center.clone().addScaledVector(p.normal, dist); v.y = EYE;
  return v;
}

// Recorrido animado: atraviesa las puertas hasta quedar frente al holograma.
function flyToRoom(i, instant = false) {
  const p = int.panels[i];
  const from = player.pos.clone(); from.y = EYE;
  const pts = [from];
  let cur = roomAt(from.z);
  const step = i > cur ? 1 : -1;
  while (cur !== i) {
    const k = step > 0 ? cur + 1 : cur;
    const dx = doorX(k), zw = -k * D;
    pts.push(new V3(dx, EYE, zw + 2.4 * step), new V3(dx, EYE, zw - 2.4 * step));
    cur += step;
  }
  const view = panelView(p);
  pts.push(view);
  const wantYaw = Math.atan2(-(p.center.x - view.x), -(p.center.z - view.z));
  const wantPitch = Math.atan2(p.center.y - EYE, view.distanceTo(new V3(p.center.x, EYE, p.center.z))) * 0.85;
  walkTarget = null;
  if (instant || reduceMotion) { player.pos.copy(view); player.yaw = wantYaw; player.pitch = wantPitch; return; }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const length = curve.getLength();
  if (length < 0.3) { tween(700, (k) => { player.yaw += angleDiff(wantYaw, player.yaw) * k; player.pitch += (wantPitch - player.pitch) * k; }); return; }
  const dur = THREE.MathUtils.clamp(length / 7, 1.1, 7) * 1000;
  const yaw0 = player.yaw, pitch0 = player.pitch;
  flight = { curve, dur, start: performance.now(), yaw0, pitch0, wantYaw, wantPitch };
}
function updateFlight(now) {
  if (!flight) return;
  const k = Math.min(1, (now - flight.start) / flight.dur), e = ease(k);
  const pt = flight.curve.getPointAt(e), tan = flight.curve.getTangentAt(Math.min(0.999, e));
  player.pos.copy(pt);
  const travelYaw = Math.atan2(-tan.x, -tan.z);
  const blendIn = Math.min(1, k / 0.15), blendOut = Math.max(0, (k - 0.7) / 0.3);
  let yaw = flight.yaw0 + angleDiff(travelYaw, flight.yaw0) * blendIn;
  yaw = yaw + angleDiff(flight.wantYaw, yaw) * ease(blendOut);
  player.yaw = yaw;
  player.pitch = flight.pitch0 * (1 - blendIn) + flight.wantPitch * ease(blendOut);
  player.bob += 0.12;
  if (k >= 1) flight = null;
}

// ---------------------------------------------------------------- Tweens
const tweens = [];
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function tween(ms, fn, done) { tweens.push({ ms: reduceMotion ? Math.min(ms, 250) : ms, fn, done, t0: performance.now() }); }
function runTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i], k = Math.min(1, (now - tw.t0) / tw.ms);
    tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); tw.done?.(); }
  }
}
const fade = $('#fade');

// ---------------------------------------------------------------- Entrar / salir
const fovFor = (inside) => (inside ? (camera.aspect < 1 ? 80 : 66) : (camera.aspect < 1 ? 64 : 48));
function setScene(s) {
  scene = s; renderPass.scene = s;
  const inside = s === int.scene;
  camera.near = inside ? 0.05 : 0.1; camera.fov = fovFor(inside); camera.updateProjectionMatrix();
  cssRenderer.domElement.style.display = inside ? '' : 'none';
  $('#extUI').hidden = inside; $('#intUI').hidden = !inside;
}
setScene(ext.scene);

function enterHouse(targetRoom) {
  if (mode !== 'exterior') return;
  mode = 'transition'; orbit.auto = false; syncOrbitBtn();
  const p0 = camera.position.clone(), l0 = orbit.target.clone();
  const p1 = new V3(-3.05, 1.9, ext.DEPTH + 7.5), l1 = new V3(-3.05, 1.9, 0), p2 = new V3(-3.05, 1.8, ext.DEPTH - 3.4);
  const look = new V3();
  tween(1500, (k) => { const e = ease(k); camera.position.lerpVectors(p0, p1, e); camera.lookAt(look.lerpVectors(l0, l1, e)); }, () =>
    tween(1300, (k) => { camera.position.lerpVectors(p1, p2, k * k); camera.lookAt(l1); fade.style.opacity = Math.max(0, (k - 0.4) / 0.6); }, () => {
      setScene(int.scene);
      player.pos.set(doorX(0), EYE, -1.6); player.yaw = 0; player.pitch = 0;
      applyPlayerCamera();
      tween(800, (k) => (fade.style.opacity = 1 - k), () => {
        mode = 'interior';
        if (targetRoom != null) flyToRoom(targetRoom); else toast('Bienvenido a Casa Cuco');
      });
    }));
}
function exitHouse() {
  if (mode !== 'interior') return;
  mode = 'transition'; flight = null; walkTarget = null; keys.clear();
  closeOverlay();
  tween(550, (k) => (fade.style.opacity = k), () => {
    setScene(ext.scene);
    const p1 = new V3(-3.05, 2.2, ext.DEPTH + 6), l1 = new V3(-3.05, 2, 0);
    orbit.az = ORBIT0.az; orbit.el = ORBIT0.el; orbit.r = ORBIT0.r;
    const p2 = orbitPos(), look = new V3();
    camera.position.copy(p1); camera.lookAt(l1);
    tween(700, (k) => (fade.style.opacity = 1 - k));
    tween(1800, (k) => { const e = ease(k); camera.position.lerpVectors(p1, p2, e); camera.lookAt(look.lerpVectors(l1, orbit.target, e)); }, () => { mode = 'exterior'; setActive('exterior'); setHash(''); });
  });
}

// ---------------------------------------------------------------- Navegación
function goTo(id) {
  closeMenu(); closeOverlay();
  if (id === 'exterior') { if (mode === 'interior') exitHouse(); return; }
  const i = ROOMS.findIndex((r) => r.id === id);
  if (i < 0) return;
  if (mode === 'exterior') enterHouse(i);
  else if (mode === 'interior') flyToRoom(i);
}
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (!g) return;
  e.preventDefault();
  goTo(g.dataset.go);
});
const nav = $('#nav'), menuBtn = $('#menuBtn');
function closeMenu() { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
menuBtn.addEventListener('click', () => { const o = nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(o)); });
function setActive(id) { nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.go === id)); }
function setHash(id) { try { history.replaceState(null, '', id ? '#' + id : location.pathname + location.search); } catch { /* sin historial */ } }
setActive('exterior');

$('#enterBtn').addEventListener('click', () => enterHouse());
$('#exitBtn').addEventListener('click', () => exitHouse());
const orbitBtn = $('#orbitBtn');
function syncOrbitBtn() { orbitBtn.classList.toggle('on', orbit.auto); orbitBtn.textContent = orbit.auto ? 'Pausar órbita' : 'Órbita 360°'; }
orbitBtn.addEventListener('click', () => { orbit.auto = !orbit.auto; syncOrbitBtn(); });

let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }

// Sección a pantalla completa (el mismo HTML del holograma).
const overlay = $('#overlay');
$('#sectionBtn').addEventListener('click', () => openOverlay(player.room));
$('#overlayClose').addEventListener('click', closeOverlay);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
function openOverlay(i) {
  const body = $('#overlayBody');
  body.innerHTML = '<div class="holo-wrap"><div class="holo"></div></div>';
  body.querySelector('.holo').appendChild($('#tpl-' + ROOMS[i].id).content.cloneNode(true));
  overlay.querySelector('.overlay-box').setAttribute('aria-label', ROOMS[i].name);
  updateClocks();
  overlay.hidden = false; keys.clear();
  $('#overlayClose').focus();
}
function closeOverlay() { if (!overlay.hidden) { overlay.hidden = true; $('#overlayBody').innerHTML = ''; } }

// Formulario de contacto (sin servidor: prepara el correo y WhatsApp).
document.addEventListener('submit', (e) => {
  const form = e.target.closest('.contact-form');
  if (!form) return;
  e.preventDefault();
  const status = form.querySelector('.form-status');
  const data = Object.fromEntries(new FormData(form));
  const missing = ['nombre', 'email', 'mensaje'].filter((k) => !String(data[k] || '').trim());
  if (missing.length) { status.textContent = 'Completa ' + missing.join(', ') + ' para enviar.'; return; }
  if (!/^\S+@\S+\.\S+$/.test(data.email)) { status.textContent = 'Revisa el email: falta la @ o el dominio.'; return; }
  const text = `Hola Casa Cuco, soy ${data.nombre} (${data.email}).\n\n${data.mensaje}`;
  const mail = `mailto:contacto@grupokeipoint.com?subject=${encodeURIComponent('Idea para Casa Cuco · ' + data.nombre)}&body=${encodeURIComponent(text)}`;
  const wa = `https://wa.me/56933938347?text=${encodeURIComponent(text)}`;
  status.innerHTML = `Mensaje listo. <a href="${mail}">Abrir en tu correo</a> o <a href="${wa}" target="_blank" rel="noopener">enviarlo por WhatsApp</a>. Si no se abre, escríbenos a contacto@grupokeipoint.com.`;
  try { location.href = mail; } catch { /* el enlace queda visible */ }
});

// Reloj "en vivo" de cada holograma (hora de Santiago de Chile).
function updateClocks() {
  let s;
  try { s = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Santiago' }).format(new Date()); }
  catch { s = new Date().toTimeString().slice(0, 5); }
  const panelClocks = int.panels.flatMap((p) => [...p.wrap.querySelectorAll('.clock')]);
  [...document.querySelectorAll('.clock'), ...panelClocks].forEach((c) => (c.textContent = s));
}
updateClocks(); setInterval(updateClocks, 15000);

// ---------------------------------------------------------------- Entrada: puntero, rueda, teclado
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) { drag.moved = true; canvas.classList.add('dragging'); }
  if (!drag.moved) return;
  if (mode === 'exterior') {
    orbit.az -= dx * 0.006; orbit.el = THREE.MathUtils.clamp(orbit.el + dy * 0.004, -0.05, 1.0);
    if (orbit.auto) { orbit.auto = false; syncOrbitBtn(); }
  } else if (mode === 'interior' && !flight) {
    const k = isTouch ? 0.0055 : 0.0032;
    player.yaw += dx * k; player.pitch = THREE.MathUtils.clamp(player.pitch + dy * k, -1.1, 1.1);
  }
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const wasClick = !drag.moved;
  drag = null; canvas.classList.remove('dragging');
  if (wasClick) handleClick(e);
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('dragging'); });

function handleClick(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (mode === 'exterior') {
    if (raycaster.intersectObjects(ext.doorParts, false).length) enterHouse();
    return;
  }
  if (mode !== 'interior' || flight) return;
  const hitPanel = raycaster.intersectObjects(int.panels.map((p) => p.slab), false)[0];
  if (hitPanel) { const p = int.panels.find((q) => q.slab === hitPanel.object); flyToRoom(p.room); return; }
  const hit = raycaster.intersectObject(int.mirror, false)[0];
  if (hit && hit.distance < 40) {
    walkTarget = new V3(hit.point.x, 0, hit.point.z);
    int.marker.position.set(hit.point.x, 0.03, hit.point.z);
    int.marker.material.opacity = 1; int.marker.scale.setScalar(1);
  }
}
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (mode === 'exterior') orbit.r = THREE.MathUtils.clamp(orbit.r + e.deltaY * 0.018, 11, 40);
  else if (mode === 'interior' && !flight) {
    const step = THREE.MathUtils.clamp(-e.deltaY * 0.01, -1.2, 1.2);
    tryMove(-Math.sin(player.yaw) * step, -Math.cos(player.yaw) * step);
  }
}, { passive: false });

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeOverlay(); closeMenu(); return; }
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (mode === 'exterior') {
    if (e.key === 'Enter' && e.target === document.body) enterHouse();
    if (e.key === 'ArrowLeft') orbit.az += 0.08;
    if (e.key === 'ArrowRight') orbit.az -= 0.08;
    if (e.key === 'ArrowUp') orbit.el = Math.min(1, orbit.el + 0.06);
    if (e.key === 'ArrowDown') orbit.el = Math.max(-0.05, orbit.el - 0.06);
    if (e.key === '+' || e.key === '=') orbit.r = Math.max(11, orbit.r - 1);
    if (e.key === '-') orbit.r = Math.min(36, orbit.r + 1);
    if (e.key === 'Home') { Object.assign(orbit, ORBIT0); orbit.auto = false; syncOrbitBtn(); }
    return;
  }
  if (mode === 'interior') {
    if (/^Digit[1-5]$/.test(e.code)) { flyToRoom(+e.code.slice(5) - 1); return; }
    if (e.code === 'KeyF') { openOverlay(player.room); return; }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    keys.add(e.code);
    if (flight && /Key[WASD]|Arrow/.test(e.code)) flight = null;
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// Joystick táctil.
const joyEl = $('#joy'), knob = $('#joyKnob');
let joyId = null;
joyEl.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joyEl.setPointerCapture(e.pointerId); moveJoy(e); if (flight) flight = null; });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveJoy(e); });
const resetJoy = () => { joyId = null; joy.x = joy.y = 0; knob.style.transform = ''; };
joyEl.addEventListener('pointerup', resetJoy); joyEl.addEventListener('pointercancel', resetJoy);
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect();
  let x = (e.clientX - r.left - r.width / 2) / 42, y = (e.clientY - r.top - r.height / 2) / 42;
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  joy.x = x; joy.y = y; knob.style.transform = `translate(${x * 36}px,${y * 36}px)`;
}
if (isTouch) $('#extHint').innerHTML = '<b>Arrastra</b> girar · <b>Toca la puerta</b> para entrar';
if (isTouch) $('#intHint').innerHTML = '<b>Joystick</b> caminar · <b>Arrastra</b> mirar · <b>Toca el piso</b> ir ahí';

// ---------------------------------------------------------------- Minimapa
const mm = $('#minimap'), mg = mm.getContext('2d');
const MMW = 240, MMH = 64;
mm.width = MMW * 2; mm.height = MMH * 2; mg.scale(2, 2);
const mmScale = (MMW - 12) / (ROOMS.length * D), mmX = (z) => 6 + -z * mmScale, mmY = (x) => MMH / 2 + x * mmScale * 1.25;
function drawMinimap() {
  mg.clearRect(0, 0, MMW, MMH);
  ROOMS.forEach((r, i) => {
    const x0 = mmX(-i * D), x1 = mmX(-(i + 1) * D), y0 = mmY(-W / 2), y1 = mmY(W / 2);
    const on = i === player.room;
    mg.fillStyle = on ? '#d7ff1926' : '#ffffff08'; mg.fillRect(x0 + 1, y0, x1 - x0 - 2, y1 - y0);
    mg.strokeStyle = on ? '#d7ff19' : '#d7ff1955'; mg.lineWidth = 1; mg.strokeRect(x0 + 1.5, y0 + 0.5, x1 - x0 - 3, y1 - y0 - 1);
    mg.fillStyle = on ? '#d7ff19' : '#b7bba6'; mg.font = '9px ui-monospace,monospace'; mg.textAlign = 'center';
    mg.fillText('0' + (i + 1), (x0 + x1) / 2, MMH - 7);
  });
  const p = int.panels[player.room];
  if (p) { mg.fillStyle = '#d7ff19aa'; mg.fillRect(mmX(p.center.z) - 1, mmY(p.center.x) - 6, 2, 12); }
  const px = mmX(player.pos.z), py = mmY(player.pos.x);
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  mg.fillStyle = '#d7ff19';
  mg.beginPath(); mg.arc(px, py, 3, 0, Math.PI * 2); mg.fill();
  mg.strokeStyle = '#f4f4ea'; mg.beginPath(); mg.moveTo(px, py); mg.lineTo(px - fz * 9, py + fx * 9); mg.stroke();
}
mm.addEventListener('click', (e) => {
  const r = mm.getBoundingClientRect();
  const z = -((e.clientX - r.left) / r.width * MMW - 6) / mmScale;
  const i = roomAt(z);
  if (mode === 'interior') flyToRoom(i);
});

// ---------------------------------------------------------------- Hologramas: visibilidad
const camDir = new V3();
function updatePanels(dt) {
  camera.getWorldDirection(camDir);
  for (const p of int.panels) {
    const rel = camera.position.clone().sub(p.center);
    const front = rel.dot(p.normal);
    const sameRoom = p.room === player.room;
    const want = sameRoom && front > 0.4 && rel.length() < 17 ? 1 : 0;
    p.opacity += (want - p.opacity) * Math.min(1, dt * 6);
    const visible = p.opacity > 0.02;
    p.css.visible = visible;
    if (visible) p.wrap.style.opacity = p.opacity.toFixed(3);
    p.wrap.style.pointerEvents = p.opacity > 0.6 ? 'auto' : 'none';
    p.slab.material.opacity = 0.18 + 0.3 * (1 - p.opacity);
  }
}

// ---------------------------------------------------------------- HUD de sala
function updateRoomHUD() {
  const r = roomAt(player.pos.z);
  if (r === player.room && $('#roomTitle').dataset.set) return;
  player.room = r;
  $('#roomTitle').dataset.set = '1';
  $('#roomTitle').textContent = ROOMS[r].name;
  $('#roomEyebrow').textContent = `Sala 0${r + 1} · ${ROOMS[r].name}`;
  setActive(ROOMS[r].id); setHash(ROOMS[r].id);
}

// ---------------------------------------------------------------- Bucle
let last = performance.now(), booted = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  runTweens(now);
  if (mode === 'exterior') {
    if (orbit.auto) orbit.az += dt * 0.16;
    applyOrbit();
  }
  if (scene === ext.scene) ext.update(t);
  if (scene === int.scene) {
    if (mode === 'interior') { updateFlight(now); updateWalk(dt); }
    if (mode !== 'transition' || player.pos.z < 0) applyPlayerCamera();
    updatePanels(dt);
    updateRoomHUD();
    drawMinimap();
    int.update(t);
    if (int.marker.material.opacity > 0) { int.marker.material.opacity = Math.max(0, int.marker.material.opacity - dt * 0.9); int.marker.scale.setScalar(1 + (1 - int.marker.material.opacity) * 0.8); }
  }
  composer.render();
  if (scene === int.scene) cssRenderer.render(int.scene, camera);
  if (!booted) { booted = true; updateClocks(); setTimeout(() => $('#loading').classList.add('off'), 350); }
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.fov = fovFor(scene === int.scene); camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  cssRenderer.setSize(innerWidth, innerHeight);
});

// Enlace directo a una sala (p. ej. index.html#proyectos): entra y viaja hasta ella.
const start = ROOMS.findIndex((r) => r.id === location.hash.slice(1));
if (start >= 0) {
  setScene(int.scene); mode = 'interior';
  player.pos.set(doorX(0), EYE, -1.6);
  flyToRoom(start, true);
}

// Acceso para pruebas y depuración.
window.casaCuco = { goTo, enterHouse, exitHouse, player, get mode() { return mode; } };
