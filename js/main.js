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

const ACID = 0xdaff02; // verde oficial de casacuco.cl
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
    gr.addColorStop(0, 'rgba(240,255,150,.9)'); gr.addColorStop(0.5, 'rgba(218,255,2,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
})();
const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const glowMat = (opacity = 1, tint = 0xffffff) => new THREE.MeshBasicMaterial({
  map: radialTex([[0, 'rgba(225,255,80,.5)'], [0.45, 'rgba(180,215,10,.16)'], [1, 'rgba(0,0,0,0)']]),
  color: tint, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
});
const neonMat = new THREE.MeshStandardMaterial({ color: ACID, emissive: ACID, emissiveIntensity: 3, roughness: 0.3 });

function bar(a, b, thick, mat) {
  const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, len), mat);
  m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.lookAt(b.x, b.y, b.z);
  return m;
}

// ================================================================= EXTERIOR
// Silueta oficial del logo de casacuco.cl (vectorizada desde el PNG, en píxeles del logo).
const LOGO = {
  house: [[40, 411], [40, 897], [433, 896], [483, 856], [547, 895], [592, 793], [683, 895], [759, 850], [984, 894], [968, 438], [865, 380], [731, 162], [638, 257], [342, 95]],
  eyes: [
    [[331, 365], [422, 363], [470, 431], [398, 434], [355, 479], [349, 521], [403, 560], [462, 550], [478, 543], [475, 554], [406, 626], [315, 611], [274, 583], [253, 500], [282, 398]],
    [[678, 435], [714, 467], [727, 530], [694, 588], [669, 610], [627, 608], [584, 565], [583, 524], [585, 522], [620, 551], [653, 550], [668, 541], [672, 508], [658, 486], [640, 477], [604, 472], [609, 462]],
  ],
  // Luna del logo "casa + luna" (otro archivo); se lleva a la misma escala que la casa.
  moon9: [[741, 42], [666, 72], [659, 82], [659, 85], [700, 89], [719, 98], [736, 125], [732, 163], [714, 174], [675, 175], [638, 144], [634, 144], [635, 190], [682, 238], [733, 240], [759, 217], [797, 150], [782, 78]],
  mouth: [[547, 895], [592, 793], [683, 895]], // la "boca" triangular: la puerta de entrada
};
const LOGO_S = 14 / 945;                                      // 14 m de ancho
const logoM = ([x, y]) => [(x - 512) * LOGO_S, (897 - y) * LOGO_S];
const moonPx = ([x, y]) => [40 + (x - 229) * (945 / 465), 897 - (522 - y) * (945 / 465)];
const shapeFrom = (pts, map = logoM) => new THREE.Shape(pts.map((p) => new THREE.Vector2(...map(p))));

function buildExterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070707');
  scene.fog = new THREE.FogExp2('#070707', 0.009);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x151515, 1.35));
  scene.add(new THREE.AmbientLight(0x4a4a4a, 0.4));
  const point = (x, y, z, color, intensity, distance, shadow = false) => {
    const l = new THREE.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z); l.castShadow = shadow; scene.add(l); return l;
  };
  const key = point(-12, 18, 20, 0xffffff, 260, 60, true);
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003;
  point(13, 9, 6, ACID, 40, 30); point(-12, 6, -10, 0xd9f026, 26, 30);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: '#0b0b0b', roughness: 0.32, metalness: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true; scene.add(floor);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), glowMat(0.45));
  glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0, 6); scene.add(glow);

  const DEPTH = 9;
  const stoneTex = stoneTexture('#e6e6e2', 12000); stoneTex.repeat.set(0.25, 0.25);
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex, bumpMap: stoneTex, bumpScale: 0.04, color: '#e9e9e6', roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide });
  const outlineMat = new THREE.LineBasicMaterial({ color: ACID, transparent: true, opacity: 0.2 });

  // Casa: silueta del logo con los ojos calados, extruida en profundidad.
  const shape = shapeFrom(LOGO.house);
  LOGO.eyes.forEach((e) => shape.holes.push(new THREE.Path(e.map((p) => new THREE.Vector2(...logoM(p))))));
  const houseGeo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.08, bevelThickness: 0.08 });
  const house = new THREE.Mesh(houseGeo, stone); house.castShadow = house.receiveShadow = true; scene.add(house);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(houseGeo, 30), outlineMat); scene.add(edges);

  // Ojos: luz verde dentro de cada cavidad.
  const eyeMat = new THREE.MeshStandardMaterial({ color: ACID, emissive: ACID, emissiveIntensity: 2.6, side: THREE.DoubleSide });
  const eyes = LOGO.eyes.map((e) => {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(e)), eyeMat.clone());
    m.position.z = DEPTH * 0.55; scene.add(m);
    const c = e.reduce((a, p) => [a[0] + p[0] / e.length, a[1] + p[1] / e.length], [0, 0]);
    const [cx, cy] = logoM(c);
    point(cx, cy, DEPTH + 1.4, ACID, 9, 10);
    return m;
  });

  // Luna.
  const moonGeo = new THREE.ExtrudeGeometry(shapeFrom(LOGO.moon9, (p) => logoM(moonPx(p))), { depth: 1.4, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.06, bevelThickness: 0.06 });
  const moon = new THREE.Mesh(moonGeo, stone); moon.position.z = DEPTH - 4.2; moon.castShadow = true; scene.add(moon);
  const moonEdges = new THREE.LineSegments(new THREE.EdgesGeometry(moonGeo, 30), outlineMat); moonEdges.position.copy(moon.position); scene.add(moonEdges);

  // Boca triangular = puerta: neón en el borde, túnel iluminado y velo de luz (blanco del clic).
  const [A, B, C] = LOGO.mouth.map(logoM);
  const doorParts = [];
  for (const z of [DEPTH + 0.1, 0.0]) {
    for (const [p, q] of [[A, B], [B, C]]) { const m = bar(new V3(p[0], Math.max(p[1], 0.03), z), new V3(q[0], Math.max(q[1], 0.03), z), 0.07, neonMat); scene.add(m); doorParts.push(m); }
  }
  const sill = bar(new V3(A[0], 0.03, DEPTH + 0.1), new V3(C[0], 0.03, DEPTH + 0.1), 0.05, neonMat); scene.add(sill);
  const veilShape = new THREE.Shape([new THREE.Vector2(A[0], 0), new THREE.Vector2(B[0], B[1]), new THREE.Vector2(C[0], 0)]);
  const veil = new THREE.Mesh(new THREE.ShapeGeometry(veilShape), new THREE.MeshBasicMaterial({ color: 0xf3ff9e, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  veil.position.z = DEPTH * 0.5; scene.add(veil); doorParts.push(veil);
  const doorGlow = point(B[0], 0.8, DEPTH * 0.5, ACID, 16, 12);
  const mouthX = B[0];
  const dotMat = new THREE.MeshBasicMaterial({ color: ACID });
  for (let z = DEPTH + 6; z > DEPTH + 0.4; z -= 0.45) { const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), dotMat); d.position.set(mouthX, 0.06, z); scene.add(d); }

  // Órbita punteada.
  const orbitPts = [];
  for (let i = 0; i < 300; i++) { const a = (i / 300) * Math.PI * 2; orbitPts.push(new V3(Math.cos(a) * 12, 0.03, 4.5 + Math.sin(a) * 13)); }
  const orbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbitPts), new THREE.LineDashedMaterial({ color: ACID, dashSize: 0.12, gapSize: 0.2, transparent: true, opacity: 0.4 }));
  orbitLine.computeLineDistances(); scene.add(orbitLine);
  scene.add(makeDust(400, [-20, 20], [0, 16], [-12, 24]));

  return {
    scene, DEPTH, doorParts, mouthX, mouthTop: B[1],
    doorTri: [A, B, C].map(([x, y]) => new V3(x, Math.max(y, 0), DEPTH + 0.1)),
    update(t) {
      eyes.forEach((e, i) => (e.material.emissiveIntensity = 2.3 + 0.7 * Math.sin(t * 1.4 + i * 0.7)));
      doorGlow.intensity = 14 + 3 * Math.sin(t * 1.1);
      veil.material.opacity = 0.42 + 0.1 * Math.sin(t * 2);
    },
  };
}

function makeDust(n, [x0, x1], [y0, y1], [z0, z1]) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { p[i * 3] = x0 + Math.random() * (x1 - x0); p[i * 3 + 1] = y0 + Math.random() * (y1 - y0); p[i * 3 + 2] = z0 + Math.random() * (z1 - z0); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xf6fe98, size: 0.035, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
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
  scene.background = new THREE.Color('#070707');
  scene.fog = new THREE.FogExp2('#070707', 0.014);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x151515, 0.42));

  const wallTex = stoneTexture('#cfcfcc'); wallTex.repeat.set(1, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, bumpMap: wallTex, bumpScale: 0.22, color: '#b4b4b1', roughness: 0.82, metalness: 0.02, side: THREE.DoubleSide });
  const darkWallMat = wallMat.clone(); darkWallMat.color.set('#8e8e8b');
  const len = NWALL - 1;
  const zEnd = -len * D;

  // Paredes laterales y techo a dos aguas.
  const half = W / 2, slope = R / half, nl = Math.hypot(slope, 1);
  const solids = [], doorHits = []; // para los clics: paredes que tapan y puertas que llevan a otra sala
  const solid = (m) => { solids.push(m); scene.add(m); return m; };
  const doorPart = (m, k) => { m.userData.door = k; doorHits.push(m); scene.add(m); return m; };
  const sides = [-1, 1];
  for (const s of sides) {
    solid(new THREE.Mesh(facetSurface({
      u0: zEnd - 1.5, u1: 1.5, v0: -0.3, v1: H + 1.4, cell: 2.6, amp: 0.13, bias: 0.3, wave: 0.3, jitter: 0.14, seed: s > 0 ? 3 : 5,
      map: (u, v, d) => [s * (half + 0.7 - d), v, u],
    }), wallMat));
    solid(new THREE.Mesh(facetSurface({
      u0: -1.6, u1: half + 0.8, v0: zEnd - 1.5, v1: 1.5, cell: 2.8, amp: 0.16, bias: 0.15, wave: 0.3, jitter: 0.14, seed: s > 0 ? 7 : 11,
      map: (u, v, d) => [s * (half - u) - s * (slope / nl) * d, H + slope * u - d / nl, v],
    }), darkWallMat));
  }

  // Paredes transversales con puerta en forma de casa.
  const doors = [];
  const ringMat = wallMat.clone(); ringMat.color.set('#c9c9c6');
  for (let k = 0; k < NWALL; k++) {
    const zw = -k * D, dx = doorX(k), hole = doorPoly(dx, 0.12);
    solid(new THREE.Mesh(facetSurface({
      u0: -half - 1.2, u1: half + 1.2, v0: -0.3, v1: H + R + 0.8, cell: 1.05, amp: 0.1, wave: 0.4, jitter: 0.1, seed: 20 + k,
      map: (u, v, d) => [u, v, zw + d], hole: (u, v) => pointInPoly(u, v, hole),
    }), wallMat));
    // Marco grueso del vano.
    const outer = doorPoly(dx, 0.95), inner = doorPoly(dx, 0);
    const sh = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, Math.max(y, 0))));
    sh.holes.push(new THREE.Path(inner.map(([x, y]) => new THREE.Vector2(x, Math.max(y, 0))).reverse()));
    const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 1.15, bevelEnabled: false }), ringMat);
    ring.position.z = zw - 0.575; doorPart(ring, k);
    // Neón en ambas caras del vano.
    const P = inner.map(([x, y]) => [x, Math.max(y, 0)]);
    for (const zf of [zw + 0.6, zw - 0.6]) {
      for (const [a, b] of [[P[1], P[2]], [P[2], P[3]], [P[3], P[4]], [P[4], P[0]]]) doorPart(bar(new V3(a[0], a[1], zf), new V3(b[0], b[1], zf), 0.07, neonMat), k);
      doorPart(bar(new V3(dx - DOOR_W, 0.02, zf), new V3(dx + DOOR_W, 0.02, zf), 0.05, neonMat), k);
    }
    // Zona invisible que cubre el vano: un clic en la puerta lleva a la sala del otro lado.
    // Cubre el vano y todo el marco, por delante de ambas caras de la pared, para que cualquier punto de la puerta responda.
    const zoneGeo = new THREE.ShapeGeometry(new THREE.Shape(doorPoly(dx, 1.05).map(([x, y]) => new THREE.Vector2(x, Math.max(y, 0)))));
    const zoneMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    for (const zf of [zw + 0.74, zw - 0.74]) { const zone = new THREE.Mesh(zoneGeo, zoneMat); zone.position.z = zf; doorPart(zone, k); }
    const front = k === 0, back = k === NWALL - 1;
    if (front || back) {
      // Portal de luz: salida al exterior por la entrada (k=0) o por el fondo de la última sala.
      const portalShape = new THREE.Shape(P.map(([x, y]) => new THREE.Vector2(x, y)));
      const portal = new THREE.Mesh(new THREE.ShapeGeometry(portalShape), new THREE.MeshBasicMaterial({
        color: 0xb8d60a, map: beamTex, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false,
      }));
      portal.position.z = zw + (front ? 0.35 : -0.35);
      scene.add(portal);
    }
    const l = new THREE.PointLight(0xe8ff70, back ? 30 : 16, 14, 2); l.position.set(dx, 2.4, zw + (front ? -1 : back ? 1 : 0)); scene.add(l);
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
    g.fillStyle = '#18181a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26000; i++) { const v = Math.random() * 60; g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.35})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  }, 1);
  concrete.repeat.set(floorW / 6, floorD / 6);
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(floorW, floorD), new THREE.MeshStandardMaterial({ map: concrete, color: '#202020', roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.64 }));
  overlay.rotation.x = -Math.PI / 2; overlay.position.set(0, 0.004, zEnd / 2); scene.add(overlay);
  const floorDecals = new THREE.Group(); scene.add(floorDecals);
  const hideInMirror = [overlay, floorDecals];
  const baseBefore = mirror.onBeforeRender;
  mirror.onBeforeRender = function (...a) { hideInMirror.forEach((o) => (o.visible = false)); baseBefore.apply(this, a); hideInMirror.forEach((o) => (o.visible = true)); };

  for (const d of doors) for (const side of [1, -1]) {
    if ((d.k === 0 && side > 0) || (d.k === NWALL - 1 && side < 0)) continue;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), glowMat(0.55)); g.rotation.x = -Math.PI / 2; g.position.set(d.dx, 0.012, d.zw + side * 2.4); floorDecals.add(g);
  }

  // Zócalo de luz a lo largo de ambas paredes: da un acabado de galería.
  for (const sx of [-1, 1]) scene.add(bar(new V3(sx * (half + 0.12), 0.06, 0.5), new V3(sx * (half + 0.12), 0.06, zEnd - 0.5), 0.05, neonMat));

  // Ojos del techo con haz de luz, cuernos y luz de cada sala.
  const eyeDark = new THREE.MeshStandardMaterial({ color: '#040503', roughness: 0.25, metalness: 0.5 });
  const eyeLit = new THREE.MeshStandardMaterial({ color: ACID, emissive: ACID, emissiveIntensity: 4 });
  const hornMat = wallMat.clone(); hornMat.flatShading = true; hornMat.color.set('#d6d6d3');
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
    const lamp = new THREE.PointLight(0xffffff, 30, 26, 2); lamp.position.set(0, H + 1, zc); scene.add(lamp);

    // Luna del logo flotando en lo alto (Nosotros y Contacto).
    if (i === 1 || i === 4) {
      const moon = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeFrom(LOGO.moon9, (p) => { const [x, y] = moonPx(p); return [(x - 1028) * 0.0075, (180 - y) * 0.0075]; }), { depth: 0.5, bevelEnabled: false }), hornMat);
      moon.position.set(nextDx * 1.35, H + 0.2, z0 - D + 3.2); moon.rotation.y = nextDx > 0 ? -0.5 : 0.5; scene.add(moon);
    }

    // Holograma: panel de vidrio con neón + la sección web en vivo (CSS3D).
    const theta = 0.3 * -panelSide;
    const px = panelSide * 3.6, pz = z0 - D * 0.6;
    const pg = new THREE.Group(); pg.position.set(px, 2.75, pz); pg.rotation.y = theta; scene.add(pg);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), glowMat(0.5)); pool.rotation.x = -Math.PI / 2; pool.position.set(px, 0.014, pz + 1.2); pool.rotation.z = theta; floorDecals.add(pool);

    const wrap = document.createElement('div');
    wrap.className = 'holo-wrap';
    wrap.innerHTML = '<div class="holo"></div>';
    wrap.firstChild.appendChild($('#sec-' + room.id).firstElementChild.cloneNode(true));
    wrap.querySelectorAll('.project-detail').forEach((d) => d.remove()); // las fichas se abren flotando
    const light = i % 2 === 1;
    if (light) wrap.classList.add('light');
    wrap.dataset.room = room.id;
    const css = new CSS3DObject(wrap);
    css.position.z = 0.06;
    pg.add(css);

    const normal = new V3(Math.sin(theta), 0, Math.cos(theta));
    const along = new V3(Math.cos(theta), 0, -Math.sin(theta));
    const obstacle = { type: 'seg', a: new V3(), b: new V3(), r: 0.5 };
    obstacles.push(obstacle);
    panels.push({ room: i, group: pg, css, wrap, light, center: new V3(px, 2.75, pz), normal, along, obstacle, opacity: 0, frame: null, slab: null });
  });

  scene.add(makeDust(350, [-half, half], [0.2, H + 2], [zEnd, 0]));

  // Ventana flotante: holograma que se desprende de un panel (fichas de Proyectos, manifiesto de Nosotros)
  // y flota frente a él, proyectado desde un anillo de luz en el piso.
  const fg = new THREE.Group(); fg.visible = false; scene.add(fg);
  const floatWrap = document.createElement('div');
  floatWrap.className = 'holo-wrap float';
  floatWrap.innerHTML = '<div class="holo float-holo"><div class="float-in"></div></div>';
  const floatCss = new CSS3DObject(floatWrap); floatCss.position.z = 0.03; fg.add(floatCss);
  const projMat = new THREE.MeshBasicMaterial({ color: ACID, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const proj = new THREE.Group(); proj.visible = false; scene.add(proj);
  const rings = [[0.78, 0.84], [0.5, 0.53], [1.02, 1.04]].map(([a, b]) => { const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 72), projMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; proj.add(m); return m; });
  const floatBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 1, 64, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: 0xeaff8a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  floatBeam.rotation.x = Math.PI; proj.add(floatBeam);
  const float = { group: fg, css: floatCss, wrap: floatWrap, proj, beam: floatBeam, rings, projMat, center: new V3(), normal: new V3(), along: new V3(), w: 0, h: 0, frame: null, room: 2, portrait: false };
  function layoutFloat(portrait) {
    const pp = panels[float.room];
    float.portrait = portrait;
    fg.rotation.y = pp.group.rotation.y; float.normal.copy(pp.normal); float.along.copy(pp.along);
    const [pxW, pxH, s] = portrait ? [760, 1560, 0.0031] : [880, 1240, 0.0034]; // alta: el texto de la ficha se lee completo
    const w = pxW * s, h = pxH * s, cy = (portrait ? 0.5 : 0.55) + h / 2;
    float.w = w; float.h = h;
    float.center.copy(pp.center).addScaledVector(pp.normal, 2.2); float.center.y = cy;
    fg.position.copy(float.center);
    floatWrap.classList.toggle('portrait', portrait);
    floatCss.scale.setScalar(s);
    if (float.frame) { fg.remove(float.frame); float.frame.traverse((o) => o.geometry?.dispose()); }
    const f = new THREE.Group(), hw = w / 2 + 0.06, hh = h / 2 + 0.06, c = 0.35;
    // Esquinas de luz, al estilo de un visor holográfico.
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      f.add(bar(new V3(sx * hw, sy * hh, 0), new V3(sx * (hw - c), sy * hh, 0), 0.035, neonMat));
      f.add(bar(new V3(sx * hw, sy * hh, 0), new V3(sx * hw, sy * (hh - c), 0), 0.035, neonMat));
    }
    fg.add(f); float.frame = f;
    proj.position.set(float.center.x, 0, float.center.z);
    const beamH = cy - h / 2;
    // Cono de luz: angosto en el anillo del piso, ancho bajo la ficha (girado: la parte brillante abajo).
    floatBeam.geometry.dispose();
    floatBeam.geometry = new THREE.CylinderGeometry(0.82, w / 2 - 0.1, beamH, 64, 1, true);
    floatBeam.position.y = beamH / 2;
  }

  // Formato del holograma: horizontal (1200×720 px) o vertical (800×1240 px) según la pantalla.
  const slabMat = new THREE.MeshStandardMaterial({ color: '#0e1706', emissive: '#283a05', emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.42, depthWrite: false });
  function layoutPanels(portrait) {
    const [pxW, pxH, s] = portrait ? [800, 1240, 0.0045] : [1200, 720, 0.006];
    const w = pxW * s, h = pxH * s, cy = (portrait ? 0.45 : 0.6) + h / 2;
    for (const p of panels) {
      // Contacto en vertical es más alto (1500 px) para que quepa sin desplazarse; mide lo mismo en la sala.
      const tall = portrait && ROOMS[p.room].id === 'contacto', k = tall ? 1240 / 1500 : 1;
      p.wrap.classList.toggle('portrait', portrait); p.wrap.classList.toggle('tall', tall);
      p.css.scale.setScalar(s * k);
      p.group.position.y = cy; p.center.y = cy;
      p.w = w * k; p.h = h;
      if (p.frame) { p.group.remove(p.frame); p.frame.traverse((o) => o.geometry?.dispose()); }
      const f = new THREE.Group();
      const hw = p.w / 2 + 0.15, hh = h / 2 + 0.14;
      p.slab = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, hh * 2, 0.08), slabMat.clone()); f.add(p.slab);
      if (p.light) { p.slab.material.color.set('#d4d6d5'); p.slab.material.emissive.set('#3c3e3d'); }
      for (const [a, b] of [[[-hw, -hh], [hw, -hh]], [[hw, -hh], [hw, hh]], [[hw, hh], [-hw, hh]], [[-hw, hh], [-hw, -hh]]]) f.add(bar(new V3(a[0], a[1], 0), new V3(b[0], b[1], 0), 0.06, neonMat));
      f.add(bar(new V3(-hw, -cy + 0.02, 0), new V3(hw, -cy + 0.02, 0), 0.05, neonMat));
      p.group.add(f); p.frame = f;
      p.obstacle.a.copy(p.center).addScaledVector(p.along, -hw); p.obstacle.b.copy(p.center).addScaledVector(p.along, hw);
    }
    layoutFloat(portrait);
  }

  // Áreas caminables: cada sala + el paso por cada puerta.
  const rects = ROOMS.map((_, i) => ({ x0: -half + 0.9, x1: half - 0.9, z0: -(i + 1) * D + 0.95, z1: -i * D - 0.95 }));
  for (let k = 1; k < NWALL - 1; k++) rects.push({ x0: doorX(k) - 0.85, x1: doorX(k) + 0.85, z0: -k * D - 1.3, z1: -k * D + 1.3 });
  rects.push({ x0: doorX(0) - 0.85, x1: doorX(0) + 0.85, z0: -1.3, z1: 0.9 });
  rects.push({ x0: doorX(NWALL - 1) - 0.85, x1: doorX(NWALL - 1) + 0.85, z0: zEnd - 0.9, z1: zEnd + 1.3 });

  // Marcador para "clic en el piso".
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 40), new THREE.MeshBasicMaterial({ color: ACID, transparent: true, opacity: 0, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; marker.position.y = 0.03; floorDecals.add(marker);

  return {
    scene, panels, float, rects, obstacles, marker, mirror, solids, doorHits, layoutPanels,
    floatTo(room) { if (float.room !== room) { float.room = room; layoutFloat(float.portrait); } },
    update(t) {
      eyes.forEach((e, i) => (e.material.emissiveIntensity = 3.4 + 0.9 * Math.sin(t * 1.3 + i)));
      doors.forEach((d, i) => (d.light.intensity = (d.k === NWALL - 1 ? 30 : 16) + 3 * Math.sin(t * 1.1 + i)));
      beamMat.opacity = 0.1 + 0.025 * Math.sin(t * 0.9);
    },
  };
}

// ================================================================= Construcción
const ext = buildExterior();
const int = buildInterior();
const wantPortrait = () => innerWidth < innerHeight * 0.9;
let portraitLayout = wantPortrait();
int.layoutPanels(portraitLayout);
let scene = ext.scene;
let mode = 'exterior'; // exterior | interior | transition
renderPass.scene = scene;

// ---------------------------------------------------------------- Cámara exterior (órbita)
const portrait = innerWidth < innerHeight;
const ORBIT0 = { az: -0.38, el: 0.24, r: portrait ? 56 : 32 };
const orbit = { target: new V3(portrait ? 2 : 0.6, portrait ? -4 : 5.2, 4.5), ...ORBIT0, auto: false };
function orbitPos(o = orbit, out = new V3()) {
  const ce = Math.cos(o.el);
  return out.set(o.target.x + Math.sin(o.az) * o.r * ce, o.target.y + Math.sin(o.el) * o.r, o.target.z + Math.cos(o.az) * o.r * ce);
}
function applyOrbit() { orbitPos(orbit, camera.position); camera.lookAt(orbit.target); }
applyOrbit();

// ---------------------------------------------------------------- Jugador interior
const player = { pos: new V3(doorX(0), EYE, -2), yaw: 0, pitch: 0, room: 0, lift: 0 };
let flight = null;     // recorrido animado
let walkPath = [];     // puntos a recorrer caminando (clic en el piso)
let atPanel = null;    // sala cuyo holograma está encuadrado
const keys = new Set();

function walkable(x, z, ignore = null) {
  if (!int.rects.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)) return false;
  for (const o of int.obstacles) {
    if (o === ignore) continue;
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
const angleDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// Si por cualquier motivo la cámara queda dentro de un muro u obstáculo, se la lleva al punto libre más cercano.
function nearestWalkable(x, z) {
  if (walkable(x, z)) return null;
  for (let r = 0.15; r <= 6; r += 0.15) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
      if (walkable(nx, nz)) return new V3(nx, EYE, nz);
    }
  }
  return new V3(doorX(roomAt(z)), EYE, -roomAt(z) * D - 3);
}
function unstick() {
  const free = nearestWalkable(player.pos.x, player.pos.z);
  if (free) { player.pos.x = free.x; player.pos.z = free.z; }
}

// ---- Trayectorias: pasan por el centro de las puertas y rodean los paneles, nunca por detrás de ellos.
function segDist(a, b, c, d) { // distancia mínima entre los segmentos ab y cd (plano XZ)
  const near = (p, q, r) => { const qx = r.x - q.x, qz = r.z - q.z, l = qx * qx + qz * qz || 1, t = Math.max(0, Math.min(1, ((p.x - q.x) * qx + (p.z - q.z) * qz) / l)); return Math.hypot(p.x - (q.x + qx * t), p.z - (q.z + qz * t)); };
  const ccw = (p, q, r) => (r.z - p.z) * (q.x - p.x) > (q.z - p.z) * (r.x - p.x);
  if (ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d)) return 0;
  return Math.min(near(a, c, d), near(b, c, d), near(c, a, b), near(d, a, b));
}
const blocking = (a, b) => int.panels.find((p) => segDist(a, b, p.obstacle.a, p.obstacle.b) < 0.75);
// Rodea un panel por uno de sus extremos: uno o dos puntos de giro (si hay que pasar de atrás hacia adelante).
function detour(a, b, panel) {
  const o = panel.obstacle, c = panel.center, n = panel.normal;
  const side = (q) => Math.sign((q.x - c.x) * n.x + (q.z - c.z) * n.z) || 1;
  let best = null, bestLen = Infinity;
  const ok = (pts) => {
    const all = [a, ...pts, b];
    for (const q of pts) if (!walkable(q.x, q.z)) return false;
    for (let i = 1; i < all.length; i++) if (segDist(all[i - 1], all[i], o.a, o.b) < 0.7) return false;
    return true;
  };
  for (const end of [o.a, o.b]) {
    const out = new V3(end.x - c.x, 0, end.z - c.z).normalize();
    const corner = (sd) => new V3(end.x + out.x * 1.2 + n.x * sd * 0.9, EYE, end.z + out.z * 1.2 + n.z * sd * 0.9);
    const options = side(a) === side(b) ? [[corner(side(a))]] : [[corner(side(a)), corner(side(b))]];
    options.push([corner(1)], [corner(-1)]);
    for (const pts of options) {
      if (!ok(pts)) continue;
      const len = [a, ...pts, b].reduce((s2, q, i, arr) => s2 + (i ? q.distanceTo(arr[i - 1]) : 0), 0);
      if (len < bestLen) { bestLen = len; best = pts; }
    }
  }
  return best;
}
function planPath(from, to) {
  const pts = [new V3(from.x, EYE, from.z)];
  let cur = roomAt(from.z);
  const goal = roomAt(to.z), step = goal > cur ? 1 : -1;
  while (cur !== goal) {
    const k = step > 0 ? cur + 1 : cur, dx = doorX(k), zw = -k * D;
    pts.push(new V3(dx, EYE, zw + 1.7 * step), new V3(dx, EYE, zw - 1.7 * step));
    cur += step;
  }
  pts.push(new V3(to.x, EYE, to.z));
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1], next = pts[i], p = blocking(prev, next);
    if (p) { const d = detour(prev, next, p); if (d) out.push(...d); }
    out.push(next);
  }
  return out.filter((q, i) => i === 0 || q.distanceTo(out[i - 1]) > 0.05);
}

function updateWalk(dt) {
  if (flight) return;
  if (zoomDist == null) unstick();
  const speed = 4.2;
  if (walkPath.length) {
    const t = walkPath[0], dx = t.x - player.pos.x, dz = t.z - player.pos.z, dist = Math.hypot(dx, dz);
    if (dist < 0.2) walkPath.shift();
    else {
      atPanel = null; zoomDist = null;
      const step = Math.min(dist, speed * dt);
      if (!tryMove((dx / dist) * step, (dz / dist) * step)) walkPath = [];
      player.yaw += angleDiff(Math.atan2(-dx, -dz), player.yaw) * Math.min(1, dt * 4);
      player.pitch += (0.04 - player.pitch) * Math.min(1, dt * 3); // al caminar, mirada al frente
    }
  }
  player.lift += ((zoomDist == null ? 0 : player.liftWant || 0) - player.lift) * Math.min(1, dt * 6);
  if (player.pos.z > 0.35 || player.pos.z < -(NWALL - 1) * D - 0.35) { exitHouse(); return; }
}

function applyPlayerCamera() {
  camera.position.copy(player.pos);
  camera.position.y = EYE + player.lift;
  camera.rotation.set(player.pitch, player.yaw, 0);
}

// Encuadre del holograma: ocupa la pantalla entre la barra superior y la interfaz inferior.
function hudInsets() {
  const narrow = innerWidth <= 700;
  return { top: 78, bottom: narrow ? 84 : 92, side: narrow ? 10 : 28 };
}
function panelFit(p) {
  const { top, bottom, side } = hudInsets();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), tanH = tanV * camera.aspect;
  const usableV = Math.max(0.3, (innerHeight - top - bottom) / innerHeight);
  const usableH = (innerWidth - side * 2) / innerWidth;
  const hw = p.w / 2 + 0.2, hh = p.h / 2 + 0.2;
  let dist = THREE.MathUtils.clamp(Math.max(hw / (tanH * usableH), hh / (tanV * usableV)), 2.6, 10.2);
  const at = (d) => p.center.clone().addScaledVector(p.normal, d);
  while (dist > 2 && !walkable(at(dist).x, at(dist).z, p.obstacle)) dist -= 0.2; // el punto de vista siempre dentro de la sala
  const view = at(dist); view.y = EYE;
  const ndcY = 1 - (2 * (top + (innerHeight - top - bottom) / 2)) / innerHeight;
  const minD = p.obstacle ? 0.8 : 0.6;
  // Al acercarse, la cámara sube hasta la altura del centro del panel para verlo de frente.
  const liftAt = (d) => (p.center.y - EYE) * THREE.MathUtils.clamp(1 - (d - minD) / Math.max(0.1, dist - minD), 0, 1);
  const pitchAt = (d) => Math.atan2(p.center.y - EYE - liftAt(d), d) - Math.atan(ndcY * tanV) * Math.min(1, d / dist);
  const yaw = Math.atan2(p.normal.x, p.normal.z);
  return { view, pitch: pitchAt(dist), yaw, dist, minD, pitchAt, liftAt };
}

// Recorrido animado hasta quedar frente al holograma (de la sala o de la ficha flotante).
function flyToRoom(i, instant = false, p = int.panels[i]) {
  const fit = panelFit(p);
  walkPath = []; atPanel = i; zoomDist = null; yawVel = 0; player.liftWant = 0;
  if (instant || reduceMotion) { player.pos.copy(fit.view); player.yaw = fit.yaw; player.pitch = fit.pitch; player.lift = 0; flight = null; return; }
  const pts = roundCorners(planPath(player.pos, fit.view));
  const lens = [0];
  for (let k = 1; k < pts.length; k++) lens.push(lens[k - 1] + pts[k].distanceTo(pts[k - 1]));
  const length = lens[lens.length - 1];
  const dur = THREE.MathUtils.clamp(length / 9, 0.9, 6.5) * 1000;
  flight = { pts, lens, length, dur, start: performance.now(), wantYaw: fit.yaw, wantPitch: fit.pitch, last: performance.now() };
}
// Esquinas del recorrido redondeadas (curva corta), para que la cámara no cambie de dirección de golpe.
function roundCorners(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], p = pts[i], b = pts[i + 1];
    const la = p.distanceTo(a), lb = p.distanceTo(b), r = Math.min(1, la * 0.45, lb * 0.45);
    if (r < 0.05) { out.push(p); continue; }
    const p0 = p.clone().lerp(a, r / la), p2 = p.clone().lerp(b, r / lb);
    for (let k = 0; k <= 6; k++) {
      const t = k / 6, u = 1 - t;
      out.push(new V3(u * u * p0.x + 2 * u * t * p.x + t * t * p2.x, EYE, u * u * p0.z + 2 * u * t * p.z + t * t * p2.z));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// Perfil de velocidad: acelera y frena suave, y en el tramo medio va a velocidad pareja (sin picos).
const RAMP = 0.22, VMAX = 1 / (1 - RAMP);
const cruise = (k) => {
  const ramp = (x) => VMAX * RAMP * (x * x * x - (x * x * x * x) / 2); // velocidad sube en curva suave (smoothstep)
  if (k < RAMP) return ramp(k / RAMP);
  if (k > 1 - RAMP) return 1 - ramp((1 - k) / RAMP);
  return ramp(1) + VMAX * (k - RAMP);
};

function updateFlight(now) {
  if (!flight) return;
  const f = flight, dt = Math.min(0.05, (now - f.last) / 1000); f.last = now;
  const k = THREE.MathUtils.clamp((now - f.start) / f.dur, 0, 1), sAt = THREE.MathUtils.clamp(cruise(k), 0, 1) * f.length;
  let i = 1; while (i < f.pts.length - 1 && f.lens[i] < sAt) i++;
  const a = f.pts[i - 1], b = f.pts[i], seg = f.lens[i] - f.lens[i - 1] || 1, u = THREE.MathUtils.clamp((sAt - f.lens[i - 1]) / seg, 0, 1);
  player.pos.lerpVectors(a, b, u); player.pos.y = EYE;
  // Mira hacia donde avanza y, al final, hacia el panel; siempre suavizado (sin giros bruscos en las esquinas).
  const remaining = f.length - sAt;
  const travel = Math.atan2(-(b.x - a.x), -(b.z - a.z));
  const arriving = remaining < 3.5 || f.length < 1.5;
  const want = arriving ? f.wantYaw : travel;
  const r = Math.min(1, dt * (arriving ? 6 : 4));
  player.yaw += angleDiff(want, player.yaw) * r;
  player.pitch += ((arriving ? f.wantPitch : 0.04) - player.pitch) * r;
  player.lift += (0 - player.lift) * r;
  // Al llegar, el giro termina de asentarse suave (nunca un salto en el último cuadro).
  if (k >= 1 && Math.abs(angleDiff(f.wantYaw, player.yaw)) < 0.004 && Math.abs(f.wantPitch - player.pitch) < 0.004) {
    player.yaw = f.wantYaw; player.pitch = f.wantPitch; flight = null; unstick();
  }
}

// ---------------------------------------------------------------- Tweens
const tweens = [];
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function tween(ms, fn, done) { tweens.push({ ms: reduceMotion ? Math.min(ms, 250) : ms, fn, done, t0: performance.now() }); }
function runTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i], k = THREE.MathUtils.clamp((now - tw.t0) / tw.ms, 0, 1);
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
  document.body.classList.toggle('is-inside', inside); // el menú de secciones solo se muestra dentro de la casa
  if (inside) refreshProjectCarousels(); // con la capa visible ya se puede medir el ancho de las tarjetas
}
setScene(ext.scene);

function enterHouse(targetRoom) {
  if (mode !== 'exterior') return;
  mode = 'transition'; orbit.auto = false; syncOrbitBtn();
  const p0 = camera.position.clone(), l0 = orbit.target.clone();
  const mx = ext.mouthX, p1 = new V3(mx, 1.0, ext.DEPTH + 8), l1 = new V3(mx, 0.75, 0), p2 = new V3(mx, 0.65, ext.DEPTH * 0.45);
  const look = new V3();
  tween(1100, (k) => { const e = ease(k); camera.position.lerpVectors(p0, p1, e); camera.lookAt(look.lerpVectors(l0, l1, e)); }, () =>
    tween(1000, (k) => { camera.position.lerpVectors(p1, p2, k * k); camera.lookAt(l1); fade.style.opacity = Math.max(0, (k - 0.4) / 0.6); }, () => {
      setScene(int.scene);
      player.pos.set(doorX(0), EYE, -1.6); player.yaw = 0; player.pitch = 0;
      applyPlayerCamera();
      tween(800, (k) => (fade.style.opacity = 1 - k), () => {
        mode = 'interior'; showTip();
        if (targetRoom != null) flyToRoom(targetRoom);
      });
    }));
}
function exitHouse() {
  if (mode !== 'interior') return;
  mode = 'transition'; flight = null; walkPath = []; atPanel = null; keys.clear(); closeMenu();
  tween(550, (k) => (fade.style.opacity = k), () => {
    setScene(ext.scene);
    const p1 = new V3(ext.mouthX, 1.2, ext.DEPTH + 7), l1 = new V3(ext.mouthX, 1, 0);
    orbit.az = ORBIT0.az; orbit.el = ORBIT0.el; orbit.r = ORBIT0.r;
    const p2 = orbitPos(), look = new V3();
    camera.position.copy(p1); camera.lookAt(l1);
    tween(700, (k) => (fade.style.opacity = 1 - k));
    tween(1800, (k) => { const e = ease(k); camera.position.lerpVectors(p1, p2, e); camera.lookAt(look.lerpVectors(l1, orbit.target, e)); }, () => { mode = 'exterior'; setActive('exterior'); setHash(''); });
  });
}

// ---------------------------------------------------------------- Navegación
function goTo(id) {
  closeMenu(); closeProject(true);
  if (id === 'exterior') { if (mode === 'interior') exitHouse(); return; }
  const i = ROOMS.findIndex((r) => r.id === id);
  if (i < 0) return;
  if (mode === 'exterior') enterHouse(i);
  else if (mode === 'interior') flyToRoom(i);
}
// ---------------------------------------------------------------- Carrusel de tarjetas de Proyectos
// Muestra 4 tarjetas (2 en vertical); las flechas avanzan de a una y al final vuelven al inicio.
function slideProjects(car, i) {
  const track = car.querySelector('.projects'), cards = track.children;
  const vis = Math.round(parseFloat(getComputedStyle(car).getPropertyValue('--vis'))) || 4;
  const max = Math.max(0, cards.length - vis);
  i = i > max ? 0 : i < 0 ? max : i;
  car.dataset.i = i;
  const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 0;
  track.style.transform = `translateX(${-i * step}px)`;
  const dots = car.querySelector('.pcar-dots');
  if (dots.children.length !== max + 1) {
    dots.replaceChildren(...Array.from({ length: max + 1 }, (_, k) => {
      const d = document.createElement('button'); d.type = 'button'; d.className = 'pcar-dot'; d.dataset.i = k;
      d.setAttribute('aria-label', `Proyectos, posición ${k + 1}`); return d;
    }));
  }
  [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
  car.querySelectorAll('.pcar-btn').forEach((b) => (b.hidden = max === 0));
}
const refreshProjectCarousels = () => document.querySelectorAll('#css-layer .pcar').forEach((c) => slideProjects(c, +c.dataset.i || 0));
refreshProjectCarousels();

// ---------------------------------------------------------------- Fichas de proyecto flotantes
let floatOpen = null, carTimer = null;
const closeX = () => {
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'float-x'; x.setAttribute('aria-label', 'Cerrar'); x.textContent = '×';
  return x;
};
// Muestra la ventana flotante frente al panel de la sala `room` con el contenido dado.
function showFloat(id, room, nodes) {
  if (mode !== 'interior') return;
  const fl = int.float, inner = fl.wrap.querySelector('.float-in');
  if (floatOpen && fl.room !== room) closeProject(true);
  int.floatTo(room);
  inner.replaceChildren(...nodes);
  inner.scrollTop = 0;
  fl.wrap.classList.toggle('is-manifesto', id === 'manifiesto');
  const wasOpen = floatOpen; floatOpen = id;
  fl.wrap.classList.remove('closing', 'opening'); void fl.wrap.offsetWidth; fl.wrap.classList.add('opening');
  fl.group.visible = true; fl.proj.visible = true;
  if (!wasOpen) tween(800, (k) => {
    const e = ease(k);
    fl.group.scale.set(Math.max(0.02, ease(Math.min(1, k * 1.5))), Math.max(0.02, ease(Math.max(0, (k - 0.2) / 0.8))), 1);
    fl.beam.material.opacity = 0.32 * e; fl.projMat.opacity = 0.9 * e;
  });
  hideTip();
  flyToRoom(room, false, fl);
}
// «Ver más» de Nosotros: el manifiesto en la ventana flotante.
function openManifesto() {
  const art = document.querySelector('#sec-nosotros .manifesto');
  if (!art) return;
  const copy = document.createElement('div'); copy.className = 'manifesto-copy';
  copy.append(...[...art.children].map((n) => n.cloneNode(true)));
  stopCarousel();
  showFloat('manifiesto', 1, [closeX(), copy]);
}
function openProject(id) {
  const art = document.querySelector(`#sec-proyectos .project-detail[data-project="${id}"]`);
  if (!art || mode !== 'interior') return;
  const car = document.createElement('div'); car.className = 'carousel';
  const dots = document.createElement('div'); dots.className = 'car-dots';
  [...art.querySelectorAll('.detail-media img')].forEach((im, k) => {
    const img = document.createElement('img');
    img.className = 'slide' + (k ? '' : ' on'); img.src = im.src; img.alt = im.alt;
    car.appendChild(img);
    const d = document.createElement('button'); d.type = 'button'; d.className = 'car-dot' + (k ? '' : ' on'); d.dataset.i = k;
    d.setAttribute('aria-label', `Imagen ${k + 1}`); dots.appendChild(d);
  });
  for (const [cls, label, txt] of [['prev', 'Imagen anterior', '‹'], ['next', 'Imagen siguiente', '›']]) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'car-btn ' + cls; b.setAttribute('aria-label', label); b.textContent = txt; car.appendChild(b);
  }
  car.appendChild(dots);
  showFloat(id, 2, [closeX(), car, art.querySelector('.detail-copy').cloneNode(true)]);
  if (car.querySelectorAll('.slide').length > 1) startCarousel(); else { stopCarousel(); car.classList.add('single'); }
}
function closeProject(instant = false) {
  if (!floatOpen) return;
  floatOpen = null; stopCarousel();
  const fl = int.float;
  const hide = () => { if (!floatOpen) { fl.group.visible = false; fl.proj.visible = false; } };
  if (instant) { fl.group.scale.set(1, 1, 1); hide(); return; }
  fl.wrap.classList.remove('opening'); fl.wrap.classList.add('closing');
  tween(450, (k) => {
    const e = 1 - ease(k);
    fl.group.scale.set(Math.max(0.02, e), Math.max(0.02, e * e), 1);
    fl.beam.material.opacity = 0.32 * e; fl.projMat.opacity = 0.9 * e;
  }, () => { fl.group.scale.set(1, 1, 1); hide(); });
  if (mode === 'interior' && atPanel === fl.room) flyToRoom(fl.room);
}
function showSlide(i) {
  const car = int.float.wrap.querySelector('.carousel');
  if (!car) return;
  const slides = car.querySelectorAll('.slide'), dots = car.querySelectorAll('.car-dot');
  const n = slides.length, next = ((i % n) + n) % n;
  slides.forEach((s, k) => s.classList.toggle('on', k === next));
  dots.forEach((d, k) => d.classList.toggle('on', k === next));
  car.dataset.i = next;
}
function startCarousel() { stopCarousel(); if (!reduceMotion) carTimer = setInterval(() => showSlide(+(int.float.wrap.querySelector('.carousel')?.dataset.i || 0) + 1), 3500); }
function stopCarousel() { clearInterval(carTimer); carTimer = null; }

// Clics sobre los hologramas 3D
document.addEventListener('click', (e) => {
  if (!e.target.closest('#css-layer')) return;
  if (e.target.closest('.float')) {
    const btn = e.target.closest('.car-btn, .car-dot');
    if (btn) {
      const cur = +(int.float.wrap.querySelector('.carousel').dataset.i || 0);
      showSlide(btn.classList.contains('car-dot') ? +btn.dataset.i : cur + (btn.classList.contains('next') ? 1 : -1));
      startCarousel();
      return;
    }
    if (e.target.closest('a, input, textarea')) return;
    closeProject(); // clic sobre la ficha: se oculta
    return;
  }
  const pb = e.target.closest('.pcar-btn, .pcar-dot');
  if (pb) {
    const car = pb.closest('.pcar');
    slideProjects(car, pb.classList.contains('pcar-dot') ? +pb.dataset.i : +car.dataset.i + (pb.classList.contains('next') ? 1 : -1));
    return;
  }
  const open = e.target.closest('[data-open]');
  if (open) { openProject(open.dataset.open); return; }
  if (e.target.closest('[data-manifesto]')) { openManifesto(); return; }
  // Clic en un panel que no está encuadrado: la cámara se acerca y lo encuadra.
  const wrap = e.target.closest('.holo-wrap');
  if (wrap && mode === 'interior' && !e.target.closest('a, button, input, textarea, label')) {
    const i = ROOMS.findIndex((r) => r.id === wrap.dataset.room);
    if (i >= 0 && atPanel !== i) flyToRoom(i);
  }
});
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (!g) return;
  e.preventDefault();
  goTo(g.dataset.go);
});
const nav = $('#nav'), menuBtn = $('#menuBtn');
function setMenu(open) { nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.textContent = open ? 'Cerrar menú' : 'Menú'; }
function closeMenu() { setMenu(false); }
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
function setActive(id) { nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.go === id)); }
function setHash(id) { try { history.replaceState(null, '', id ? '#' + id : location.pathname + location.search); } catch { /* sin historial */ } }
setActive('exterior');

$('#enterBtn').addEventListener('click', () => enterHouse());
const orbitBtn = $('#orbitBtn');
function syncOrbitBtn() { orbitBtn.classList.toggle('on', orbit.auto); orbitBtn.textContent = orbit.auto ? 'Pausar recorrido' : 'Explorar 360°'; }
orbitBtn.addEventListener('click', () => { orbit.auto = !orbit.auto; syncOrbitBtn(); });

// Ayuda contextual breve: aparece una sola vez al entrar y se va al primer gesto o a los 6 segundos.
let tipShown = false, tipTimer;
function showTip() {
  if (tipShown) return;
  tipShown = true;
  const tip = $('#tip');
  tip.textContent = isTouch ? 'Desliza para mirar · Toca el piso para avanzar' : 'Arrastra para mirar · Haz clic en el piso para avanzar';
  tip.hidden = false;
  tipTimer = setTimeout(hideTip, 6000);
}
function hideTip() { clearTimeout(tipTimer); $('#tip').hidden = true; }

// Pantalla completa (si el navegador lo permite).
const fsBtn = $('#fsBtn');
if (!document.fullscreenEnabled) fsBtn.hidden = true;
fsBtn.addEventListener('click', () => {
  const req = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  req?.catch?.(() => { fsBtn.hidden = true; });
});
document.addEventListener('fullscreenchange', () => fsBtn.setAttribute('aria-label', document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa'));

// Formulario de contacto. Dentro de WordPress (plugin Casa Cuco 3D) envía por el servidor;
// como página suelta, abre el correo del visitante dirigido a contacto@grupokeipoint.com.
const pageStart = Date.now();
document.addEventListener('submit', (e) => {
  const form = e.target.closest('.contact-form');
  if (!form) return;
  e.preventDefault();
  const status = form.querySelector('.form-status');
  const button = form.querySelector('[type=submit]');
  const data = Object.fromEntries(new FormData(form));
  const missing = ['name', 'email', 'message'].filter((k) => !String(data[k] || '').trim());
  if (missing.length) { status.textContent = 'Completa los campos obligatorios para continuar.'; return; }
  if (!/^\S+@\S+\.\S+$/.test(data.email)) { status.textContent = 'Ingresa un correo electrónico válido.'; return; }
  const endpoint = window.CASA_CUCO?.contactUrl;
  if (endpoint) {
    button.disabled = true; status.textContent = 'Enviando tu mensaje…';
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, elapsed: Date.now() - pageStart }) })
      .then((r) => r.json().catch(() => ({})).then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        status.textContent = ok ? '¡Gracias por escribirnos! Recibimos tu idea y pronto nos pondremos en contacto.' : (j.message || 'No pudimos enviar tu mensaje. Inténtalo nuevamente o escríbenos a contacto@grupokeipoint.com.');
        if (ok) form.reset();
      })
      .catch(() => { status.textContent = 'Parece que no tienes conexión. Revisa tu conexión e inténtalo nuevamente.'; })
      .finally(() => { button.disabled = false; });
    return;
  }
  const mail = `mailto:contacto@grupokeipoint.com?subject=${encodeURIComponent('Casa Cuco · ' + data.name)}&body=${encodeURIComponent(`${data.message}\n\n${data.name} · ${data.email}${data.company ? ' · ' + data.company : ''}`)}`;
  status.innerHTML = `Abrimos tu correo con el mensaje listo. Si no se abre, <a href="${mail}">haz clic aquí</a> o escribe a contacto@grupokeipoint.com.`;
  try { location.href = mail; } catch { /* el enlace queda visible */ }
});

// ---------------------------------------------------------------- Entrada: puntero, rueda, teclado
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
// Arrastre para girar: funciona sobre la escena y también sobre los hologramas
// (si no, cuando un panel ocupa la pantalla no hay dónde arrastrar). Al soltar, el giro sigue
// un instante con inercia para que se sienta fluido.
let drag = null, yawVel = 0, suppressClick = false;
const YAW_K = isTouch ? 0.0055 : 0.0034;
function startDrag(e, onPanel) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, id: e.pointerId, onPanel };
  yawVel = 0;
}
canvas.addEventListener('pointerdown', (e) => { startDrag(e, false); canvas.setPointerCapture(e.pointerId); });
document.addEventListener('pointerdown', (e) => {
  if (mode !== 'interior' || !e.target.closest('#css-layer')) return;
  if (e.target.closest('a, button, input, textarea, select, label')) return; // los controles funcionan normal
  if (e.pointerType === 'mouse') e.preventDefault(); // evita seleccionar texto o arrastrar imágenes
  startDrag(e, true);
}, true);
addEventListener('pointermove', (e) => {
  if (!drag && mode === 'exterior' && e.pointerType === 'mouse' && e.target === canvas) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, camera);
    canvas.classList.toggle('over-door', nearHouseDoor(e.clientX, e.clientY));
  }
  if (!drag || e.pointerId !== drag.id || pinch) return;
  const now = performance.now();
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(1, now - drag.t) / 1000;
  drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > (e.pointerType === 'mouse' ? 6 : 12)) { drag.moved = true; canvas.classList.add('dragging'); if (mode === 'interior') hideTip(); }
  if (!drag.moved) return;
  if (mode === 'exterior') {
    orbit.az -= dx * 0.006; orbit.el = THREE.MathUtils.clamp(orbit.el + dy * 0.004, -0.05, 1.0);
    if (orbit.auto) { orbit.auto = false; syncOrbitBtn(); }
  } else if (mode === 'interior') {
    if (flight) { flight = null; unstick(); } // el usuario toma el control
    player.yaw += dx * YAW_K; // solo eje horizontal
    yawVel = yawVel * 0.6 + ((dx * YAW_K) / dt) * 0.4;
  }
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const { moved, onPanel, t } = drag;
  drag = null; canvas.classList.remove('dragging');
  if (moved) {
    // Si el dedo o el mouse se quedó quieto antes de soltar, no hay inercia.
    yawVel = performance.now() - t > 90 ? 0 : THREE.MathUtils.clamp(yawVel, -4, 4);
    if (onPanel) suppressClick = true; // soltar tras girar no es un clic sobre el panel
  } else if (!onPanel) handleClick(e);
};
addEventListener('pointerup', endDrag);
addEventListener('pointercancel', () => { drag = null; yawVel = 0; canvas.classList.remove('dragging'); });
document.addEventListener('click', (e) => {
  if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); }
}, true);
function updateInertia(dt) {
  if (drag || !yawVel) return;
  player.yaw += yawVel * dt;
  yawVel *= Math.exp(-dt * 5);
  if (Math.abs(yawVel) < 0.02) yawVel = 0;
}

// Puerta de la casa (exterior): responde en el vano, el marco y un margen alrededor, medido en pantalla
// para que sea fácil de acertar desde cualquier distancia, con mouse o con el dedo.
const doorPx = ext.doorTri.map(() => new THREE.Vector2());
function nearHouseDoor(x, y) {
  if (raycaster.intersectObjects(ext.doorParts, false).length) return true;
  if (camera.position.z < ext.DEPTH * 0.6) return false; // la puerta está en la fachada: desde atrás no se ve
  const v = new V3();
  ext.doorTri.forEach((p, i) => { v.copy(p).project(camera); doorPx[i].set((v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight); });
  const [a, b, c] = doorPx, q = new THREE.Vector2(x, y);
  const cross = (p1, p2) => (p2.x - p1.x) * (q.y - p1.y) - (p2.y - p1.y) * (q.x - p1.x);
  const s1 = cross(a, b), s2 = cross(b, c), s3 = cross(c, a);
  if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) return true;
  const segD = (p1, p2) => { const d = p2.clone().sub(p1), t = THREE.MathUtils.clamp(q.clone().sub(p1).dot(d) / d.lengthSq(), 0, 1); return q.distanceTo(p1.clone().addScaledVector(d, t)); };
  const h = Math.abs(b.y - (a.y + c.y) / 2);
  return Math.min(segD(a, b), segD(b, c), segD(c, a)) <= Math.max(isTouch ? 46 : 34, h * 0.3);
}

function handleClick(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (mode === 'exterior') {
    if (nearHouseDoor(e.clientX, e.clientY)) enterHouse();
    return;
  }
  if (mode !== 'interior') return;
  if (floatOpen) { closeProject(); return; }
  const slabs = int.panels.map((p) => p.slab);
  const hit = raycaster.intersectObjects([int.mirror, ...int.solids, ...int.doorHits, ...slabs], false)[0];
  if (!hit || hit.distance > 40) return;
  const o = hit.object;
  if (o.userData.door != null) { goThroughDoor(o.userData.door); return; }
  const slab = int.panels.find((p) => p.slab === o);
  if (slab) { flyToRoom(slab.room); return; }
  if (o !== int.mirror) return; // pared o techo: no hace nada
  const r = roomAt(hit.point.z);
  if (r !== player.room) { flyToRoom(r); return; } // piso de otra sala visto por la puerta
  // Piso justo frente a una puerta (umbral de luz incluido): también cuenta como la puerta.
  for (let k = 0; k < NWALL; k++) {
    if (Math.abs(hit.point.x - doorX(k)) < DOOR_W + 0.5 && Math.abs(hit.point.z + k * D) < 2.2) { goThroughDoor(k); return; }
  }
  if (flight) { flight = null; }
  const dest = nearestWalkable(hit.point.x, hit.point.z) || new V3(hit.point.x, EYE, hit.point.z);
  zoomDist = null; atPanel = null;
  walkPath = planPath(player.pos, dest).slice(1);
  int.marker.position.set(hit.point.x, 0.03, hit.point.z);
  int.marker.material.opacity = 1; int.marker.scale.setScalar(1);
}
// Puerta k une la sala k-1 con la sala k (la primera y la última llevan al exterior).
function goThroughDoor(k) {
  if (k === 0) { if (player.room === 0) exitHouse(); return; }
  if (k >= NWALL - 1) { if (player.room === ROOMS.length - 1) exitHouse(); return; }
  const target = player.pos.z > -k * D ? k : k - 1;
  flyToRoom(target);
}
let zoomDist = null; // distancia elegida al holograma encuadrado (null = encuadre automático)
const zoomTarget = () => (floatOpen ? int.float : atPanel != null ? int.panels[atPanel] : null);
function zoomBy(delta) {
  if (mode !== 'interior') return;
  hideTip();
  if (flight) { flight = null; unstick(); }
  const p = zoomTarget();
  if (!p) { const step = THREE.MathUtils.clamp(-delta * 2.5, -1.2, 1.2); tryMove(-Math.sin(player.yaw) * step, -Math.cos(player.yaw) * step); return; }
  const fit = panelFit(p), min = fit.minD, max = fit.dist + 2.5;
  const cur = zoomDist ?? fit.dist;
  // Paso proporcional a la distancia: fino de cerca, rápido de lejos.
  let d = THREE.MathUtils.clamp(cur + delta * Math.max(0.25, cur / 3.5), min, max);
  const at = (dd) => p.center.clone().addScaledVector(p.normal, dd);
  while (d > min && !walkable(at(d).x, at(d).z, p.obstacle)) d -= 0.1; // nunca dentro de un muro
  zoomDist = d;
  player.liftWant = fit.liftAt(d);
}
function updateZoom(dt) {
  const p = zoomTarget();
  if (zoomDist == null || !p || flight || walkPath.length) return;
  const fit = panelFit(p), want = p.center.clone().addScaledVector(p.normal, zoomDist);
  const k = Math.min(1, dt * 7);
  player.pos.x += (want.x - player.pos.x) * k; player.pos.z += (want.z - player.pos.z) * k;
  player.pitch += (fit.pitchAt(zoomDist) - player.pitch) * k;
}
addEventListener('wheel', (e) => {
  if (mode === 'exterior') {
    if (e.target !== canvas) return;
    e.preventDefault(); orbit.r = THREE.MathUtils.clamp(orbit.r + e.deltaY * 0.022, 16, 58); return;
  }
  if (mode !== 'interior' || e.target.closest?.('.topbar, .map-box')) return;
  const sc = e.target.closest?.('#css-layer .holo-in, #css-layer .float-in');
  if (sc && !e.ctrlKey) { // primero se desplaza el contenido; al llegar al borde, acerca o aleja (el pellizco del trackpad siempre acerca)
    const can = e.deltaY > 0 ? sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1 : sc.scrollTop > 0;
    if (can) return;
  }
  e.preventDefault();
  zoomBy(THREE.MathUtils.clamp(e.deltaY * 0.004, -0.8, 0.8));
}, { passive: false });
$('#zoomIn').addEventListener('click', () => zoomBy(-0.9));
$('#zoomOut').addEventListener('click', () => zoomBy(0.9));
// Pellizco con dos dedos para acercar y alejar.
const touches = new Map();
let pinch = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; }
});
canvas.addEventListener('pointermove', (e) => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2 && pinch) {
    const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    zoomBy((pinch - d) * 0.012); pinch = d;
  }
});
const endTouch = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; };
canvas.addEventListener('pointerup', endTouch); canvas.addEventListener('pointercancel', endTouch);

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeMenu(); return; }
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (mode === 'exterior') {
    if (e.key === 'Enter' && e.target === document.body) enterHouse();
    if (e.key === 'ArrowLeft') orbit.az += 0.08;
    if (e.key === 'ArrowRight') orbit.az -= 0.08;
    if (e.key === 'ArrowUp') orbit.el = Math.min(1, orbit.el + 0.06);
    if (e.key === 'ArrowDown') orbit.el = Math.max(-0.05, orbit.el - 0.06);
    if (e.key === '+' || e.key === '=') orbit.r = Math.max(16, orbit.r - 1);
    if (e.key === '-') orbit.r = Math.min(58, orbit.r + 1);
    if (e.key === 'Home') { Object.assign(orbit, ORBIT0); orbit.auto = false; syncOrbitBtn(); }
    return;
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

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
    mg.fillStyle = on ? '#daff0226' : '#ffffff08'; mg.fillRect(x0 + 1, y0, x1 - x0 - 2, y1 - y0);
    mg.strokeStyle = on ? '#daff02' : '#daff0255'; mg.lineWidth = 1; mg.strokeRect(x0 + 1.5, y0 + 0.5, x1 - x0 - 3, y1 - y0 - 1);
    mg.fillStyle = on ? '#daff02' : '#a4a4a4'; mg.font = '9px ui-monospace,monospace'; mg.textAlign = 'center';
  });
  const p = int.panels[player.room];
  if (p) { mg.fillStyle = '#daff02aa'; mg.fillRect(mmX(p.center.z) - 1, mmY(p.center.x) - 6, 2, 12); }
  const px = mmX(player.pos.z), py = mmY(player.pos.x);
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  mg.fillStyle = '#daff02';
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
function updatePanels(dt) {
  for (const p of int.panels) {
    const rel = camera.position.clone().sub(p.center);
    const dist = rel.length(), front = rel.dot(p.normal);
    const near = p.shown ? dist < 19 && front > 0.2 : dist < 16 && front > 0.5; // histéresis: no titila en el borde
    p.shown = p.room === player.room && near;
    // En un recorrido solo se ve el holograma de destino: los de las salas por las que se pasa quedarían
    // de canto al pasarlos (muy costoso de pintar) y solo distraen. Sus marcos de neón siguen visibles.
    const passing = flight && p.room !== atPanel;
    const want = p.shown && !passing ? (floatOpen && p.room === int.float.room ? 0.14 : 1) : 0;
    p.opacity += (want - p.opacity) * Math.min(1, dt * 6);
    if (Math.abs(want - p.opacity) < 0.004) p.opacity = want;
    // De canto o por detrás se oculta al instante: en ese ángulo el navegador tendría que pintar un área
    // enorme (eso daba tirones al pasar junto a un panel) y de todos modos se ve como una línea.
    if (front < 0.4 || front / dist < 0.3) p.opacity = 0;
    const o = Math.round(p.opacity * 100) / 100;
    if (o !== p.lastO) { p.lastO = o; p.wrap.style.opacity = o; }
    const vis = o > 0.01 ? 'visible' : 'hidden'; // oculto sin sacarlo del DOM: aparece sin tirón
    if (vis !== p.vis) { p.vis = vis; p.wrap.style.visibility = vis; }
    const pe = o > 0.6 ? 'auto' : 'none';
    if (pe !== p.pe) { p.pe = pe; p.wrap.style.pointerEvents = pe; }
    p.slab.material.opacity = 0.18 + 0.3 * (1 - p.opacity);
  }
  const fl = int.float;
  fl.css.visible = fl.group.visible && player.room === fl.room;
  if (fl.group.visible) fl.rings.forEach((r, i) => (r.rotation.z += (i % 2 ? -0.4 : 0.6) * dt));
}

// ---------------------------------------------------------------- HUD de sala
let hudRoom = -1;
function updateRoomHUD() {
  const r = roomAt(player.pos.z);
  if (r === player.room && hudRoom === r) return;
  player.room = r; hudRoom = r;
  setActive(ROOMS[r].id); setHash(ROOMS[r].id);
}

// ---------------------------------------------------------------- Bucle
// Prepara el interior mientras se ve la pantalla de carga: compila los materiales y dibuja una vez
// cada sala, y decodifica las imágenes de los hologramas. Así la primera visita a cada sala no da tirones.
function warmUp() {
  const pos = camera.position.clone(), quat = camera.quaternion.clone(), fov = camera.fov;
  const restore = [];
  try {
    // Todo visible y sin recorte por cámara, solo durante esta preparación.
    int.scene.traverse((o) => {
      restore.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false;
      for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) if (v && v.isTexture) renderer.initTexture(v);
    });
    renderer.compile(int.scene, camera);
    renderPass.scene = int.scene;
    camera.fov = fovFor(true); camera.updateProjectionMatrix();
    for (let i = 0; i < ROOMS.length; i++) {
      camera.position.set(0, EYE, -i * D - 3); camera.lookAt(0, EYE, -i * D - D);
      composer.render();
    }
  } catch { /* si falla, solo se pierde la preparación */ }
  for (const [o, v, f] of restore) { o.visible = v; o.frustumCulled = f; }
  renderPass.scene = scene;
  camera.position.copy(pos); camera.quaternion.copy(quat); camera.fov = fov; camera.updateProjectionMatrix();
  document.querySelectorAll('#css-layer img').forEach((img) => img.decode?.().catch(() => {}));
}

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
    if (mode === 'interior') { updateFlight(now); updateWalk(dt); updateZoom(dt); updateInertia(dt); }
    if (mode !== 'transition' || player.pos.z < 0) applyPlayerCamera();
    updatePanels(dt);
    updateRoomHUD();
    drawMinimap();
    int.update(t);
    if (int.marker.material.opacity > 0) { int.marker.material.opacity = Math.max(0, int.marker.material.opacity - dt * 0.9); int.marker.scale.setScalar(1 + (1 - int.marker.material.opacity) * 0.8); }
  }
  composer.render();
  if (scene === int.scene) cssRenderer.render(int.scene, camera);
  if (!booted) { booted = true; warmUp(); setTimeout(() => $('#loading').classList.add('off'), 350); }
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.fov = fovFor(scene === int.scene); camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  cssRenderer.setSize(innerWidth, innerHeight);
  if (wantPortrait() !== portraitLayout) { portraitLayout = wantPortrait(); int.layoutPanels(portraitLayout); }
  refreshProjectCarousels();
  if (atPanel != null && !flight && mode === 'interior') {
    const f = panelFit(zoomTarget());
    player.pos.copy(f.view); player.yaw = f.yaw; player.pitch = f.pitch; zoomDist = null;
  }
});

// Enlace directo a una sala (p. ej. index.html#proyectos): entra y viaja hasta ella.
const start = ROOMS.findIndex((r) => r.id === location.hash.slice(1));
if (start >= 0) {
  setScene(int.scene); mode = 'interior';
  player.pos.set(doorX(0), EYE, -1.6);
  flyToRoom(start, true);
}

// Acceso para pruebas y depuración.
window.casaCuco = { goTo, enterHouse, exitHouse, player, roundCorners, get mode() { return mode; }, get flying() { return !!flight; }, planPath, walkable, panelFit, panels: int.panels, flyToRoom, zoomBy, get zoomDist() { return zoomDist; },
  // Prueba interna: qué toca un clic dirigido a un punto del mundo (pared, puerta, panel o piso).
  probe(x, y, z) {
    const o = camera.position.clone(); raycaster.set(o, new V3(x, y, z).sub(o).normalize());
    const h = raycaster.intersectObjects([int.mirror, ...int.solids, ...int.doorHits, ...int.panels.map((p) => p.slab)], false)[0];
    if (!h) return 'nada';
    if (h.object.userData.door != null) return 'puerta ' + h.object.userData.door;
    if (h.object === int.mirror) return 'piso';
    return int.panels.some((p) => p.slab === h.object) ? 'panel' : 'pared';
  } };
