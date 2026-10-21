/* =====================================================================
   Community One — live 3D hero scene (three.js)
   Used live on computers by index.html, and by studio.html to render the
   looping videos that phones / tablets / slow computers play instead.
   Edit the scene here, then open studio.html?record to re-render the videos.
   ===================================================================== *//* =====================================================================
   Community One — "Inside the centre" 3D hero background
   Every facility from the pricing page as a glossy 3D vignette:
   badminton, table tennis, billiards, darts, chess, carrom, gym + Zumba.
   They're linked by a light web that pulses — move, create, belong.

   Everything is a pure function of time (no hidden state), so pause,
   still-frame (prefers-reduced-motion) and resume are exact.
   ===================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ---------- helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sat = v => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => sat((t - a) / (b - a));
const mod = (a, n) => ((a % n) + n) % n;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const easeOutBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const gauss = (x, w) => Math.exp(-(x * x) / (w * w));
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

/* ---------- palette (from the live site) ---------- */
const C = {
  // the site's own colours: navy surface, slate glass, brand violet, lavender eyebrow…
  // scene colourway: deep teal-navy surfaces, teal + mint accents, warm amber / coral pops
  // (the old names are kept: "violet" is now the main teal accent, "lavender" the mint)
  navy: 0x0a1a20, ink: 0x0c1d24, inkHi: 0x173038,
  violet: 0x0d9488, navyDeep: 0x10262e, slate: 0x23404a,
  violetSoft: 0x5eead4, lavender: 0x99f6e4, pearl: 0xecfdf9, white: 0xf8fafc,
  // …plus the logo's dots, used only as small pops
  amber: 0xf59e0b, pink: 0xfb7185, blue: 0x38bdf8, green: 0x10b981,
};

/* ---------- materials ---------- */
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness: .38, metalness: 0, clearcoat: .7, clearcoatRoughness: .22, envMapIntensity: .75, ...o });
// one knob for how bright all the self-lit parts are
const GLOW = 1.4;
// bloom (desktop only): strength = intensity, radius = spread, threshold = how bright before it glows
const BLOOM = { strength: .2, radius: .35, threshold: .9 };
const glowMat = (color, intensity = 1, o = {}) => new THREE.MeshStandardMaterial({
  color, emissive: color, emissiveIntensity: intensity * GLOW, roughness: .4, ...o });
const M = {
  violet: phys(C.violet),
  slate: phys(C.slate),
  lavender: phys(C.lavender, { roughness: .45 }),
  pearl: phys(C.pearl, { roughness: .4 }),
  white: phys(C.white, { roughness: .35 }),
  ink: phys(C.ink, { roughness: .55, clearcoat: .3 }),
  inkHi: phys(C.inkHi, { roughness: .5 }),
  amber: phys(C.amber, { roughness: .3 }),
  pink: phys(C.pink, { roughness: .3 }),
  blue: phys(C.blue, { roughness: .3 }),
  green: phys(C.green, { roughness: .3 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xd4d9e6, metalness: .9, roughness: .22, envMapIntensity: 1.1 }),
  felt: new THREE.MeshStandardMaterial({ color: 0x0f5a3e, roughness: .95 }), // classic green felt
  black: phys(0x0b0d12, { roughness: .2, clearcoat: 1 }),
  feather: new THREE.MeshPhysicalMaterial({ color: C.white, roughness: .6, transparent: true, opacity: .82, side: THREE.DoubleSide, depthWrite: false }),
  violetGlow: glowMat(C.violet, 1.6),
  lavGlow: glowMat(C.lavender, 1.2),
};
const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

/* ---------- geometry helpers ---------- */
const geo = arr => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return g; };
const mesh = (g, m) => new THREE.Mesh(g, m);
// every box gets softly rounded edges (radius scales with its thinnest side), and round
// parts get plenty of segments, so nothing reads as hard-edged or faceted
const box = (w, h, d, m) => { const r = Math.min(.04, Math.min(w, h, d) * .3); return mesh(r > .002 ? new RoundedBoxGeometry(w, h, d, 4, r) : new THREE.BoxGeometry(w, h, d), m); };
const cyl = (rt, rb, h, m, s = 48) => mesh(new THREE.CylinderGeometry(rt, rb, h, Math.max(s, 40)), m);
const sphere = (r, m, s = 48) => mesh(new THREE.SphereGeometry(r, Math.max(s, 40), Math.round(Math.max(s, 40) * .66)), m);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const lathe = (pts, m) => mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 64), m);

/* =====================================================================
   STATIONS — each returns { root, anchor, update(t) }
   ===================================================================== */

/* ---------- Badminton: a calm, unhurried rally ----------
   Kept deliberately quiet: matte court, painted-on lines, slim rackets with a
   single gold pinstripe, a feathered shuttle and a faint trail. Few meshes,
   no extra lights, so it stays cheap to draw. */
// the scene's current theme; canvas textures drawn with themedTex repaint when it changes
let THEME = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
const themedTexs = [];
const themedTex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const paint = () => { x.clearRect(0, 0, w, h); draw(x, w, h, false); t.needsUpdate = true; }; // same textures in both themes
  paint(); themedTexs.push(paint); return t;
};
const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
};
// Squarish "isometric" head, like modern frames
const superEllipse = (a, b, n, steps = 80) => {
  const p = [];
  for (let i = 0; i < steps; i++) {
    const th = i / steps * TAU, c = Math.cos(th), s = Math.sin(th);
    p.push([a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return p;
};
const RK = { a: .42, b: .56, cy: 1.58, n: 2.4 };
const RS = .7; // racket size on the court
const BM = {
  frame: new THREE.MeshStandardMaterial({ color: 0x24414a, metalness: .45, roughness: .32, envMapIntensity: 1 }),
  grip: new THREE.MeshStandardMaterial({ color: 0x0f1729, roughness: .8 }),
  post: new THREE.MeshStandardMaterial({ color: 0x8b93a8, metalness: .7, roughness: .35 }),
  tape: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: .6 }),
};
let stringTex, featherTex, blobTex, netTex;
function makeRacket(stripe) {
  const { a, b, cy, n } = RK, r = new THREE.Group();
  const outline = superEllipse(a, b, n);
  const loop = (k, z = 0) => new THREE.CatmullRomCurve3(outline.map(([x, y]) => new THREE.Vector3(x * k, cy + y * k, z)), true);
  // frame + throat merged into one mesh
  const shaftTop = cy - b - .22, parts = [new THREE.TubeGeometry(loop(1), 160, .03, 8, true)];
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(s * a * .45, cy - b * .92, 0), new THREE.Vector3(s * .06, cy - b - .09, 0), new THREE.Vector3(0, shaftTop, 0)]);
    parts.push(new THREE.TubeGeometry(c, 20, .02, 8, false));
  }
  r.add(mesh(mergeGeometries(parts), BM.frame));
  // the one accent: a thin gold pinstripe on the face of the frame
  r.add(mesh(new THREE.TubeGeometry(loop(1, .026), 160, .007, 6, true), stripe));
  stringTex ||= themedTex(256, 342, (x, w, h, light) => {
    x.beginPath();
    outline.forEach(([px, py], i) => { const X = (px / a * .5 + .5) * w, Y = (.5 - py / b * .5) * h; i ? x.lineTo(X, Y) : x.moveTo(X, Y); });
    x.closePath(); x.clip();
    x.strokeStyle = light ? 'rgba(51,65,85,.5)' : 'rgba(226,232,240,.55)'; x.lineWidth = 1.2;
    for (let i = 6; i < w; i += 11) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
    for (let j = 6; j < h; j += 11) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
  });
  const strings = new THREE.MeshBasicMaterial({ map: stringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  r.add(at(mesh(new THREE.PlaneGeometry(a * 2, b * 2), strings), 0, cy, 0));
  r.userData = { strings };
  r.add(at(cyl(.014, .019, shaftTop - .4, M.metal, 12), 0, (shaftTop + .4) / 2, 0));
  r.add(at(cyl(.052, .047, .4, BM.grip, 16), 0, .2, 0));
  r.add(at(cyl(.05, .05, .02, M.metal, 16), 0, .405, 0));
  return r;
}
function makeShuttle() {
  const s = new THREE.Group();
  const cork = mesh(new THREE.SphereGeometry(.095, 24, 12, 0, TAU, 0, Math.PI / 2), M.white);
  cork.rotation.x = Math.PI; s.add(cork, at(cyl(.095, .095, .045, M.white, 24), 0, .022, 0));
  const band = mesh(new THREE.TorusGeometry(.096, .008, 6, 40), M.amber); band.rotation.x = Math.PI / 2; band.position.y = .044; s.add(band);
  featherTex ||= canvasTex(64, 256, (x, w, h) => {
    x.fillStyle = 'rgba(248,250,252,.96)'; x.beginPath();
    x.moveTo(w * .44, h); x.lineTo(w * .56, h);
    x.bezierCurveTo(w, h * .55, w * .98, h * .1, w * .62, 0); x.lineTo(w * .38, 0);
    x.bezierCurveTo(w * .02, h * .1, 0, h * .55, w * .44, h); x.fill();
    x.strokeStyle = 'rgba(148,163,184,.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, h * .05); x.stroke();
  });
  // 16 feathers merged into one mesh
  const tilt = Math.atan2(.26 - .085, .42), feathers = [], o = new THREE.Object3D();
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU, f = new THREE.PlaneGeometry(.095, .42); f.translate(0, .21, 0);
    o.position.set(Math.cos(a) * .085, .05, Math.sin(a) * .085); o.rotation.set(tilt, Math.PI / 2 - a, 0, 'YXZ'); o.updateMatrix();
    feathers.push(f.applyMatrix4(o.matrix));
  }
  s.add(mesh(mergeGeometries(feathers), new THREE.MeshStandardMaterial({ map: featherTex, alphaTest: .35, side: THREE.DoubleSide, roughness: .75 })));
  return s;
}
function makeBadminton() {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g); g.position.y = -1.2;
  const W = 2.25, D = 1.05, PW = W * 2 + .56, PD = D * 2 + .5, top = .05;
  // court: one slab + one painted top (lines live in the texture)
  g.add(at(box(PW + .08, .1, PD + .08, new THREE.MeshStandardMaterial({ color: 0x081419, roughness: .7 })), 0, 0, 0));
  const courtTex = themedTex(1024, Math.round(1024 * PD / PW), (x, w, h, light) => {
    const X = v => (v / PW + .5) * w, Z = v => (v / PD + .5) * h;
    if (light) {
      x.fillStyle = '#e6e3f3'; x.fillRect(0, 0, w, h);
      const g2 = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * .6); g2.addColorStop(0, 'rgba(255,255,255,.35)'); g2.addColorStop(1, 'rgba(76,29,149,.05)');
      x.fillStyle = g2; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(109,40,217,.75)'; x.lineWidth = 3.2;
    } else {
      x.fillStyle = '#11303a'; x.fillRect(0, 0, w, h);
      const g2 = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * .6); g2.addColorStop(0, 'rgba(255,255,255,.035)'); g2.addColorStop(1, 'rgba(0,0,0,.12)');
      x.fillStyle = g2; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(153,246,228,.85)'; x.lineWidth = 3.2;
    }
    x.lineCap = 'square';
    const L = (x1, z1, x2, z2) => { x.beginPath(); x.moveTo(X(x1), Z(z1)); x.lineTo(X(x2), Z(z2)); x.stroke(); };
    L(-W, -D, W, -D); L(W, -D, W, D); L(W, D, -W, D); L(-W, D, -W, -D);
    L(-W, -D * .86, W, -D * .86); L(-W, D * .86, W, D * .86);
    L(-.68, -D, -.68, D); L(.68, -D, .68, D);
    L(-W, 0, -.68, 0); L(.68, 0, W, 0);
    L(-W * .9, -D, -W * .9, D); L(W * .9, -D, W * .9, D);
  });
  const court = mesh(new THREE.PlaneGeometry(PW, PD), new THREE.MeshStandardMaterial({ map: courtTex, roughness: .85 }));
  court.rotation.x = -Math.PI / 2; court.position.y = top + .001; g.add(court);
  // net
  const nTop = .98, nH = .4;
  netTex ||= themedTex(512, 96, (x, w, h, light) => {
    x.strokeStyle = light ? 'rgba(51,65,85,.4)' : 'rgba(226,232,240,.4)'; x.lineWidth = 1;
    for (let i = .5; i <= w; i += 9) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
    for (let j = .5; j <= h; j += 9) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
  });
  const net = mesh(new THREE.PlaneGeometry(D * 2, nH), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  net.rotation.y = Math.PI / 2; net.position.set(0, nTop - nH / 2, 0); g.add(net);
  g.add(at(box(.016, .035, D * 2, BM.tape), 0, nTop, 0));
  for (const sz of [-1, 1]) g.add(at(cyl(.022, .022, nTop - top, BM.post, 12), 0, (nTop + top) / 2, sz * (D + .03)));
  // rackets
  const mk = (x, side, stripe) => {
    const pivot = at(new THREE.Group(), x, top + .18, .12);
    const r = makeRacket(stripe); r.rotation.y = side * (Math.PI / 2 - .7); r.scale.setScalar(RS);
    pivot.add(r); g.add(pivot); pivot.userData.racket = r; return pivot;
  };
  const left = mk(-1.95, 1, glowMat(C.violetSoft, .6)), right = mk(1.95, -1, glowMat(C.amber, .5));
  // shuttle, soft contact shadow, faint trail
  const shuttle = makeShuttle(); g.add(shuttle);
  const SH = .66; // shuttle size
  blobTex ||= canvasTex(64, 64, (x, w, h) => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  const shadowM = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const shadow = mesh(new THREE.PlaneGeometry(.45, .45), shadowM); shadow.rotation.x = -Math.PI / 2; g.add(shadow);

  const TN = 18, tPos = new Float32Array(TN * 6), tU = new Float32Array(TN * 2), idx = [];
  for (let i = 0; i < TN; i++) { tU[i * 2] = tU[i * 2 + 1] = i / (TN - 1); if (i < TN - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(tPos, 3)); tg.setAttribute('aU', new THREE.BufferAttribute(tU, 1)); tg.setIndex(idx);
  const trail = mesh(tg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(C.lavender) } },
    vertexShader: 'attribute float aU; varying float vU; void main(){ vU=aU; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uColor; varying float vU; void main(){ gl_FragColor=vec4(uColor, pow(1.0-vU,2.0)*0.22); }',
  }));
  trail.frustumCulled = false; g.add(trail);

  // smooth, unhurried flight: gentle ease rather than a snap off the racket
  const T = 2.4, hx = 1.78, hy = top + .18 + RK.cy * RS, peak = .85;
  const pos = (k, s, out) => {
    s = clamp(s, 0, 1);
    const dir = k % 2 === 0 ? 1 : -1, e = s;
    return out.set(lerp(-hx * dir, hx * dir, e), hy + peak * Math.sin(Math.PI * e), .12 + .14 * Math.sin(Math.PI * e));
  };
  const down = new THREE.Vector3(0, -1, 0), qd = new THREE.Quaternion(), qs = new THREE.Quaternion(), yA = new THREE.Vector3(0, 1, 0);
  const P = new THREE.Vector3(), P2 = new THREE.Vector3(), Q = new THREE.Vector3(), side = new THREE.Vector3(), zA = new THREE.Vector3(0, 0, 1);
  const swing = rel => .26 * gauss(rel + .24, .2) - .42 * gauss(rel - .08, .18);
  // hit effect: droplets fly off the racket head on every hit and arc down under gravity
  const sparkTex = canvasTex(32, 32, x => { const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); });
  const SN = 40, SL = .85, sparkCols = [C.white, C.lavender, C.violetSoft, C.pearl].map(c => new THREE.Color(c));
  const hits = [-1, 1].map((sd, hi) => {
    const R = rng(61 + hi), dirs = [], offs = [], col = new Float32Array(SN * 3), sizes = [];
    for (let i = 0; i < SN; i++) {
      // each droplet leaves from a random spot on the string bed, flung forward and up
      offs.push(new THREE.Vector3(0, (R() - .5) * RK.b * 1.4 * RS, (R() - .5) * RK.a * 1.4 * RS));
      dirs.push(new THREE.Vector3(-sd * (.5 + R() * 1.1), .2 + R() * 1.1, (R() - .5) * 1.2).normalize().multiplyScalar(.9 + R() * 1.5));
      const c = sparkCols[i % sparkCols.length]; col.set([c.r, c.g, c.b], i * 3);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 3), 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pm = new THREE.PointsMaterial({ size: .095, map: sparkTex, vertexColors: true, transparent: true, depthWrite: false });
    const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; pts.visible = false; g.add(pts);
    return { pts, pm, pg, dirs, offs, o: new THREE.Vector3(sd * hx, hy, .12) };
  });
  const hitFx = (h, rel) => {
    if (rel >= 0 && rel < SL) {
      const a = h.pg.attributes.position.array, tt = rel * (1 - .45 * rel / SL);
      h.dirs.forEach((d, i) => { const f = h.offs[i]; a[i * 3] = h.o.x + f.x + d.x * tt; a[i * 3 + 1] = h.o.y + f.y + d.y * tt - 2.4 * rel * rel; a[i * 3 + 2] = h.o.z + f.z + d.z * tt; });
      h.pg.attributes.position.needsUpdate = true;
      h.pm.opacity = Math.pow(1 - rel / SL, 1.1); h.pm.size = .095 * (1 - .4 * rel / SL); h.pts.visible = true;
    } else h.pts.visible = false;
  };
  return {
    root, anchor: new THREE.Vector3(0, .3, 0),
    update(t) {
      const c = t / T, k = Math.floor(c), s = c - k;
      pos(k, s, P); pos(k, s + .01, P2);
      shuttle.position.copy(P);
      const v = P2.sub(P);
      if (v.lengthSq() > 1e-8) qd.setFromUnitVectors(down, v.normalize());
      qs.setFromAxisAngle(yA, t * 3);
      qd.multiply(qs);
      const dtq = clamp(t - (this.lastT ?? t), 0, .1); this.lastT = t;
      if (!dtq) shuttle.quaternion.copy(qd); else shuttle.quaternion.slerp(qd, 1 - Math.pow(.0005, dtq));
      const hgt = P.y - top;
      shadow.position.set(P.x, top + .004, P.z); shadow.scale.setScalar(.8 + hgt * .2); shadowM.opacity = clamp(.5 - hgt * .12, .08, .45);
      for (let i = 0; i < TN; i++) {
        pos(k, s - i * .014, Q); pos(k, s - i * .014 + .007, P2);
        side.copy(P2).sub(Q).cross(zA); if (side.lengthSq() < 1e-9) side.set(0, 1, 0); side.normalize().multiplyScalar(.028 * (1 - i / TN));
        tPos[i * 6] = Q.x + side.x; tPos[i * 6 + 1] = Q.y + side.y; tPos[i * 6 + 2] = Q.z + side.z;
        tPos[i * 6 + 3] = Q.x - side.x; tPos[i * 6 + 4] = Q.y - side.y; tPos[i * 6 + 5] = Q.z - side.z;
      }
      tg.attributes.position.needsUpdate = true;
      const relL = mod(t + T, 2 * T) - T, relR = mod(t, 2 * T) - T;
      left.rotation.z = -swing(relL); right.rotation.z = swing(relR);
      hitFx(hits[0], relL); hitFx(hits[1], relR);
      // the shuttle squashes for a moment as it's struck (along its flight axis)
      const sq = 1 - .32 * Math.exp(-s * T * 16);
      shuttle.scale.set(SH / Math.sqrt(sq), SH * sq, SH / Math.sqrt(sq));
    }
  };
}

/* ---------- shared impact effects ---------- */
// one knob for how punchy every impact shockwave is (size / brightness)
const IMPACT = 1.7;
function makeShock(parent, { color = C.lavender, r0 = .05, r1 = .5, life = .5, flat = true, width = .14 } = {}) {
  r1 *= 1 + (IMPACT - 1) * .5; width *= 1 + (IMPACT - 1) * .6; life *= 1 + (IMPACT - 1) * .2;
  const m = glowMat(color, 1.2 * IMPACT, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const o = mesh(new THREE.RingGeometry(1 - width, 1, 64), m); if (flat) o.rotation.x = -Math.PI / 2; o.visible = false; parent.add(o);
  return {
    update(rel, x, y, z) {
      if (!(rel >= 0 && rel < life)) { o.visible = false; return; }
      const u = rel / life; o.scale.setScalar(lerp(r0, r1, easeOut(u))); o.position.set(x, y, z);
      m.opacity = Math.min(1, .8 * IMPACT) * Math.pow(1 - u, 1.4); o.visible = true;
    }
  };
}

/* ---------- Table tennis: tik-tok ---------- */
function makePaddle(rubber) {
  const p = new THREE.Group();
  const blade = cyl(.25, .25, .035, rubber, 40); blade.rotation.z = Math.PI / 2; p.add(blade);
  const edge = mesh(new THREE.TorusGeometry(.25, .012, 8, 48), M.pearl); edge.rotation.y = Math.PI / 2; p.add(edge);
  p.add(at(box(.05, .28, .08, M.pearl), 0, -.36, 0));
  return p;
}
function makeTableTennis() {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g); g.position.y = -.2;
  const top = .035;
  g.add(box(2.4, .07, 1.34, phys(0x0f4c5c, { roughness: .45 })));
  const ln = (w, d, x, z) => g.add(at(box(w, .004, d, M.white), x, top + .002, z));
  ln(2.4, .03, 0, .655); ln(2.4, .03, 0, -.655); ln(.03, 1.34, 1.185, 0); ln(.03, 1.34, -1.185, 0); ln(2.4, .012, 0, 0);
  g.add(at(box(.015, .17, 1.5, new THREE.MeshStandardMaterial({ color: C.lavender, transparent: true, opacity: .45, depthWrite: false })), 0, top + .085, 0));
  g.add(at(box(.02, .02, 1.5, M.white), 0, top + .17, 0));
  for (const x of [-.95, .95]) for (const z of [-.52, .52]) g.add(at(cyl(.03, .03, .7, M.ink), x, -.38, z));
  const pl = makePaddle(M.pink), pr = makePaddle(M.blue);
  at(pl, -1.55, .48, 0); at(pr, 1.55, .48, 0); g.add(pl, pr);
  const ball = sphere(.055, glowMat(0xffffff, .35)); g.add(ball);
  const ringM = glowMat(C.lavender, 1.5, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const ring = mesh(new THREE.RingGeometry(.05, .075, 32), ringM); ring.rotation.x = -Math.PI / 2; g.add(ring);
  const L = .85, ex = 1.42, xbF = .55, by = top + .055, hy = .48;
  const swing = rel => .35 * gauss(rel + .12, .09) - .55 * gauss(rel - .05, .08);
  return {
    root, anchor: new THREE.Vector3(0, 0, 0),
    update(t) {
      const c = t / L, k = Math.floor(c), s = c - k, dir = k % 2 === 0 ? 1 : -1;
      const x0 = -ex * dir, xb = xbF * dir, x1 = ex * dir;
      if (s < .6) { const u = s / .6; ball.position.set(lerp(x0, xb, u), lerp(hy, by, u) + .3 * Math.sin(Math.PI * u), .1 * Math.sin(Math.PI * u)); }
      else { const v = (s - .6) / .4; ball.position.set(lerp(xb, x1, v), lerp(by, hy, v) + .2 * Math.sin(Math.PI * v), -.06 * Math.sin(Math.PI * v)); }
      const age = (s - .6) * L;
      ring.position.set(xb, top + .003, 0);
      if (age >= 0) { ring.scale.setScalar(1 + age * 9); ringM.opacity = .9 * sat(1 - age / .4); } else ringM.opacity = 0;
      pl.rotation.z = -swing(mod(t + L, 2 * L) - L);
      pr.rotation.z = swing(mod(t, 2 * L) - L);
    }
  };
}

/* ---------- Billiards: cue → ball → pocket, then re-rack ---------- */
function makeBall(mat, spot = true) {
  const b = new THREE.Group(), r = .1;
  b.add(sphere(r, mat, 32));
  if (spot) {
    const dot = mesh(new THREE.CircleGeometry(.04, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3, transparent: true }));
    dot.position.z = r + .001; b.add(dot);
    const dot2 = dot.clone(); dot2.position.z = -r - .001; dot2.rotation.y = Math.PI; b.add(dot2);
  }
  return b;
}
function makeBilliards() {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g); g.position.y = -.1;
  const fy = .07, r = .1, by = fy + r;
  g.add(box(2.6, .14, 1.5, M.felt));
  const rail = phys(C.slate, { roughness: .4 });
  g.add(at(box(2.84, .16, .12, rail), 0, .03, .81), at(box(2.84, .16, .12, rail), 0, .03, -.81));
  g.add(at(box(.12, .16, 1.5, rail), 1.36, .03, 0), at(box(.12, .16, 1.5, rail), -1.36, .03, 0));
  const pocketM = new THREE.MeshBasicMaterial({ color: 0x050608 });
  for (const [x, z] of [[-1.24, -.69], [1.24, -.69], [-1.24, .69], [1.24, .69], [0, -.71], [0, .71]]) {
    const p = mesh(new THREE.CircleGeometry(.11, 32), pocketM); p.rotation.x = -Math.PI / 2; p.position.set(x, fy + .002, z); g.add(p);
  }
  // spots on the felt
  const sp = mesh(new THREE.CircleGeometry(.02, 16), new THREE.MeshBasicMaterial({ color: C.lavender })); sp.rotation.x = -Math.PI / 2; sp.position.set(.65, fy + .002, 0); g.add(sp);

  const T0 = new THREE.Vector2(.32, .14), P = new THREE.Vector2(1.24, .69);
  const d = P.clone().sub(T0); const travel = d.length(); d.normalize();
  const S = T0.clone().addScaledVector(d, -(2 * r + 1.0));
  const axis = new THREE.Vector3(d.y, 0, -d.x);

  const cue = makeBall(M.white, false); g.add(cue);
  const tMat = phys(C.violet, { transparent: true });
  const target = makeBall(tMat); g.add(target);
  const eight = makeBall(M.black); at(eight, -.38, by, .44); eight.rotation.set(.4, .8, 0); g.add(eight);
  const pink = makeBall(M.amber); at(pink, .78, by, -.36); pink.rotation.set(-.5, .3, .2); g.add(pink);
  const lil = makeBall(M.green); at(lil, -.98, by, .2); lil.rotation.set(1, 0, .4); g.add(lil);

  // cue stick (thin end toward the ball)
  const stickMat = phys(0xf5deb3, { transparent: true, roughness: .35 });
  const stick = new THREE.Group();
  const shaft = cyl(.014, .032, 1.9, stickMat, 16); shaft.position.y = -.95; stick.add(shaft);
  stick.add(at(cyl(.016, .016, .05, glowMat(C.violetSoft, .8, { transparent: true })), 0, -.02, 0));
  stick.add(at(cyl(.034, .034, .5, M.violet, 16), 0, -1.65, 0));
  stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d.x, .12, d.y).normalize());
  g.add(stick);
  const stickMats = [];
  stick.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; stickMats.push(o.material); } });

  const Tb = 6.6, q = new THREE.Quaternion();
  const contact = T0.clone().addScaledVector(d, -r);
  const bShock = makeShock(g, { r0: .1, r1: .5, life: .45 });
  const bPocket = makeShock(g, { color: C.violetSoft, r0: .06, r1: .32, life: .6 });
  return {
    root, anchor: new THREE.Vector3(0, .1, 0),
    update(t) {
      const tl = mod(t, Tb);
      // stick
      let off;
      if (tl < .75) off = .32 * easeInOut(seg(tl, 0, .75));
      else if (tl < .86) off = .32 * (1 - easeIn(seg(tl, .75, .86)));
      else off = -.06 * easeOut(seg(tl, .86, 1.1));
      const sOp = tl < 1.2 ? 1 : tl < 1.8 ? 1 - seg(tl, 1.2, 1.8) : seg(tl, 5.6, 6.3);
      stickMats.forEach(m => m.opacity = sOp);
      stick.visible = sOp > .01;
      // cue ball distance along d
      let cd;
      if (tl < .86) cd = 0;
      else if (tl < 1.6) cd = 1.0 * (1 - Math.pow(1 - seg(tl, .86, 1.6), 1.25));
      else if (tl < 3.8) cd = 1.0 + .14 * easeOut(seg(tl, 1.6, 2.3));
      else cd = 1.14 * (1 - easeInOut(seg(tl, 3.8, 5.4)));
      const cp = S.clone().addScaledVector(d, cd);
      cue.position.set(cp.x, by, cp.y);
      q.setFromAxisAngle(axis, cd / r); cue.quaternion.copy(q);
      const cueTip = S.clone().addScaledVector(d, cd - r - .03 - off);
      stick.position.set(cueTip.x, by + .01, cueTip.y);
      // target ball
      let td = 0, drop = 0, sc = 1, op = 1;
      if (tl >= 1.6 && tl < 4.7) {
        td = travel * (1 - Math.pow(1 - seg(tl, 1.6, 2.8), 2.2));
        const dr = seg(tl, 2.75, 3.1); drop = easeIn(dr) * .28; sc = 1 - dr * .45; op = 1 - dr;
        if (tl > 3.1) op = 0;
      } else if (tl >= 4.7) { const u = seg(tl, 4.7, 5.25); sc = Math.max(.001, easeOutBack(u)); op = sat(u * 2); }
      const tp = T0.clone().addScaledVector(d, td);
      target.position.set(tp.x, by - drop, tp.y);
      target.scale.setScalar(sc);
      tMat.opacity = op; target.visible = op > .01;
      q.setFromAxisAngle(axis, td / r); target.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, -.6, 0)));
      bShock.update(tl - 1.6, contact.x, fy + .004, contact.y); bPocket.update(tl - 2.85, P.x, fy + .004, P.y);
    }
  };
}

/* ---------- Darts: dart lands, rings pulse ---------- */
function makeDart() {
  const d = new THREE.Group(), mats = [];
  const reg = m => { m = m.clone(); m.transparent = true; mats.push(m); return m; };
  const tip = mesh(new THREE.ConeGeometry(.014, .16, 12), reg(M.metal)); tip.rotation.x = -Math.PI / 2; tip.position.z = -.08; d.add(tip);
  const barrel = cyl(.028, .022, .24, reg(M.metal), 16); barrel.rotation.x = Math.PI / 2; barrel.position.z = .12; d.add(barrel);
  const shaft = cyl(.012, .012, .24, reg(M.violet), 12); shaft.rotation.x = Math.PI / 2; shaft.position.z = .36; d.add(shaft);
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(.13, .06); fs.lineTo(.13, .2); fs.lineTo(0, .16); fs.closePath();
  const fm = reg(new THREE.MeshPhysicalMaterial({ color: C.pink, side: THREE.DoubleSide, roughness: .4, emissive: C.pink, emissiveIntensity: .25 * GLOW }));
  for (let i = 0; i < 4; i++) {
    const f = mesh(new THREE.ShapeGeometry(fs), fm);
    const holder = new THREE.Group(); f.rotation.y = -Math.PI / 2; f.position.z = .3; holder.add(f); holder.rotation.z = i * Math.PI / 2; d.add(holder);
  }
  return { d, mats };
}
function makeDarts() {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g);
  const face = .062;
  const body = cyl(.98, .98, .12, M.ink, 64); body.rotation.x = Math.PI / 2; g.add(body);
  const back = mesh(new THREE.TorusGeometry(.98, .04, 12, 80), M.slate); g.add(back);
  // sectors
  const dark = new THREE.MeshStandardMaterial({ color: 0x0e2128, roughness: .7 });
  const lite = new THREE.MeshStandardMaterial({ color: 0x23404a, roughness: .7 });
  const accA = new THREE.MeshStandardMaterial({ color: C.violet, roughness: .5, emissive: C.violet, emissiveIntensity: .25 * GLOW });
  const accB = new THREE.MeshStandardMaterial({ color: C.lavender, roughness: .5 });
  const band = (r0, r1, mA, mB) => { for (let i = 0; i < 20; i++) { const m = mesh(new THREE.RingGeometry(r0, r1, 3, 1, i / 20 * TAU - TAU / 40, TAU / 20), i % 2 ? mA : mB); m.position.z = face; g.add(m); } };
  band(.07, .4, dark, lite); band(.4, .46, accA, accB); band(.46, .74, dark, lite); band(.74, .82, accA, accB);
  const bull = mesh(new THREE.CircleGeometry(.07, 32), glowMat(C.amber, .9)); bull.position.z = face + .001; g.add(bull);
  const bull2 = mesh(new THREE.CircleGeometry(.03, 24), glowMat(0xffffff, .8)); bull2.position.z = face + .002; g.add(bull2);
  // glowing wire rings that pulse on impact
  const ringRs = [.07, .4, .46, .74, .82, .92], rings = [];
  for (const rr of ringRs) {
    const m = glowMat(C.lavender, .25);
    const tor = mesh(new THREE.TorusGeometry(rr, .012, 8, 96), m); tor.position.z = face + .004; g.add(tor); rings.push(m);
  }
  const wires = [];
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU - TAU / 40; wires.push(Math.cos(a) * .07, Math.sin(a) * .07, face + .003, Math.cos(a) * .82, Math.sin(a) * .82, face + .003); }
  g.add(new THREE.LineSegments(geo(wires), lineMat(C.lavender, .35)));

  const { d: dart, mats } = makeDart(); g.add(dart);
  const spots = [[.03, .02], [.3, .42], [-.5, .18], [.22, -.55], [-.28, -.36], [.58, -.1]];
  const dShock = makeShock(g, { color: C.white, r0: .03, r1: .38, life: .42, flat: false });
  const Td = 3.8;
  return {
    root, anchor: new THREE.Vector3(0, 0, 0),
    update(t) {
      const k = Math.floor(t / Td), tl = mod(t, Td), [sx, sy] = spots[k % spots.length];
      const tipZ = face + .01;
      const ox = sx + .9, oy = sy + .5, oz = 3.4;
      const u = seg(tl, .0, .5);
      let x, y, z, rx = 0, ry = 0;
      if (tl < .5) {
        const e = u * (1.15 - .15 * u);
        x = lerp(ox, sx, e); y = lerp(oy, sy, e) + .3 * Math.sin(Math.PI * e); z = lerp(oz, tipZ + .08, e);
        rx = -.35 * (1 - e) + .1; ry = .25 * (1 - e);
      } else {
        x = sx; y = sy; z = tipZ + .08;
        const w = tl - .5, damp = Math.exp(-w * 7);
        rx = .1 + .14 * damp * Math.sin(w * 38); ry = .1 * damp * Math.cos(w * 33);
      }
      if (tl > 2.9) { const b = seg(tl, 2.9, 3.6); z += easeIn(b) * 1.2; }
      dart.position.set(x, y, z); dart.rotation.set(rx, ry, 0);
      const op = tl > 2.9 ? 1 - seg(tl, 2.9, 3.5) : seg(tl, 0, .12);
      mats.forEach(m => m.opacity = op); dart.visible = op > .01;
      // rings pulse outward from the hit
      const hitR = Math.hypot(sx, sy);
      ringRs.forEach((rr, i) => {
        const delay = Math.abs(rr - hitR) * .35;
        rings[i].emissiveIntensity = (.25 + 2.6 * IMPACT * gauss(tl - .5 - delay, .1)) * GLOW;
      });
      dShock.update(tl - .5, sx, sy, face + .012);
      body.position.z = -.05 * Math.exp(-Math.max(0, tl - .5) * 9) * (tl > .5 ? 1 : 0);
    }
  };
}

/* ---------- Chess: knight hops, a pawn answers ---------- */
function makeKnight(mat) {
  const k = new THREE.Group();
  k.add(lathe([[0, 0], [.16, 0], [.16, .04], [.13, .065], [.1, .09], [.1, .11], [0, .11]], mat));
  const s = new THREE.Shape();
  const P = [[-.12, 0], [.14, 0], [.13, .1], [.09, .2], [.13, .3], [.16, .4], [.13, .48], [.06, .53], [.02, .6], [-.02, .54], [-.1, .5], [-.2, .42], [-.23, .36], [-.18, .32], [-.08, .33], [-.04, .28], [-.12, .18], [-.13, .08]];
  s.moveTo(...P[0]); s.splineThru(P.slice(1).map(([x, y]) => new THREE.Vector2(x, y))); s.closePath(); // smooth, sculpted silhouette
  const e = mesh(new THREE.ExtrudeGeometry(s, { depth: .14, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 6, curveSegments: 6 }), mat);
  e.position.set(0, .1, -.07); k.add(e);
  const eye = sphere(.018, glowMat(C.lavender, 1.2), 10); eye.position.set(-.06, .5, .1); k.add(eye);
  const eye2 = eye.clone(); eye2.position.z = -.1; k.add(eye2);
  return k;
}
const makePawn = mat => { const p = new THREE.Group(); p.add(lathe([[0, 0], [.15, 0], [.15, .04], [.12, .065], [.075, .1], [.05, .25], [.095, .27], [.05, .295], [0, .3]], mat)); p.add(at(sphere(.08, mat), 0, .36, 0)); return p; };
const makeRook = mat => {
  const r = new THREE.Group(); r.add(lathe([[0, 0], [.16, 0], [.16, .04], [.13, .065], [.095, .1], [.085, .32], [.125, .34], [.125, .44], [0, .44]], mat));
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + TAU / 8; r.add(at(box(.06, .06, .06, mat), Math.cos(a) * .09, .47, Math.sin(a) * .09)); }
  return r;
};
function makeChess() {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g); g.position.y = -.15;
  const N = 4, sq = .4, half = (N * sq) / 2, top = .07;
  g.add(at(box(N * sq + .22, .09, N * sq + .22, M.ink), 0, -.01, 0));
  g.add(at(mesh(new THREE.TorusGeometry(1, .01, 6, 4), M.violetGlow), 0, .036, 0)).children;
  const squares = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const light = (i + j) % 2 === 0;
    const m = phys(light ? 0xd5e5e1 : C.navyDeep, { roughness: .4, emissive: C.violetSoft, emissiveIntensity: 0 });
    const b = at(box(sq - .012, .06, sq - .012, m), (i - 1.5) * sq, .04, (j - 1.5) * sq); g.add(b); squares.push(m);
  }
  g.children[1].visible = false;
  const pos = (i, j) => new THREE.Vector3((i - 1.5) * sq, top, (j - 1.5) * sq);
  const knight = makeKnight(M.violet); g.add(knight);
  const pawn = makePawn(M.pearl); g.add(pawn);
  const rook = makeRook(M.pearl); g.add(rook); rook.position.copy(pos(0, 3));
  const pawn2 = makePawn(M.violet); g.add(pawn2); pawn2.position.copy(pos(3, 0));
  const kA = pos(0, 1), kB = pos(1, 3)  /* L-shape */, pA = pos(2, 3), pB = pos(2, 2);
  const Tc = 9;
  const cKn = makeShock(g, { color: C.violetSoft, r0: .1, r1: .48, life: .5 }), cPw = makeShock(g, { r0: .06, r1: .3, life: .45 });
  const hop = (a, b, u, h) => { const e = easeInOut(u); const v = a.clone().lerp(b, e); v.y += h * Math.sin(Math.PI * e); return v; };
  const flash = (i, j, w) => { squares[i * N + j].emissiveIntensity = Math.max(squares[i * N + j].emissiveIntensity, w * GLOW); };
  return {
    root, anchor: new THREE.Vector3(0, .2, 0),
    update(t) {
      const tl = mod(t, Tc), back = tl >= Tc / 2, lt = back ? tl - Tc / 2 : tl;
      const [k0, k1, p0, p1] = back ? [kB, kA, pB, pA] : [kA, kB, pA, pB];
      squares.forEach(m => m.emissiveIntensity = 0);
      // knight
      const ku = seg(lt, .5, 1.4);
      knight.position.copy(hop(k0, k1, ku, .55));
      const land = lt - 1.4;
      const squash = land > 0 ? 1 - .14 * Math.exp(-land * 10) * Math.cos(land * 25) : 1 + .06 * Math.sin(Math.PI * ku);
      knight.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      knight.rotation.y = (back ? Math.PI * .65 : Math.PI * .35) + (back ? -1 : 1) * Math.PI * .3 * easeInOut(ku) - Math.PI / 2;
      const kTo = back ? [0, 1] : [1, 3];
      if (land > 0) flash(kTo[0], kTo[1], 1.6 * Math.exp(-land * 2.5));
      // pawn answers
      const pu = seg(lt, 2.4, 2.95);
      pawn.position.copy(hop(p0, p1, pu, .14));
      const pl = lt - 2.95, pTo = back ? [2, 3] : [2, 2];
      if (pl > 0) flash(pTo[0], pTo[1], 1.2 * Math.exp(-pl * 2.5));
      cKn.update(land, k1.x, top + .036, k1.z);
      cPw.update(pl, p1.x, top + .036, p1.z);
    }
  };
}

/* ---------- Carrom: flick, scatter, settle back ---------- */
function makeCarrom() {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g); g.position.y = -.05;
  const S = 1.9, top = .04;
  g.add(box(S, .08, S, phys(0xe6d9bf, { roughness: .55, clearcoat: .6 }) /* warm sand board */));
  const fr = phys(C.slate);
  g.add(at(box(S + .28, .16, .14, fr), 0, .04, S / 2 + .07), at(box(S + .28, .16, .14, fr), 0, .04, -S / 2 - .07));
  g.add(at(box(.14, .16, S, fr), S / 2 + .07, .04, 0), at(box(.14, .16, S, fr), -S / 2 - .07, .04, 0));
  const pk = new THREE.MeshBasicMaterial({ color: 0x07080c });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = mesh(new THREE.CircleGeometry(.085, 32), pk); p.rotation.x = -Math.PI / 2; p.position.set(sx * (S / 2 - .1), top + .002, sz * (S / 2 - .1)); g.add(p); }
  const lineM = new THREE.MeshBasicMaterial({ color: C.violet });
  const ringAt = (r, w) => { const m = mesh(new THREE.RingGeometry(r - w, r, 64), lineM); m.rotation.x = -Math.PI / 2; m.position.y = top + .002; g.add(m); };
  ringAt(.3, .012); ringAt(.08, .01);
  for (const s of [-1, 1]) { g.add(at(box(1.2, .002, .012, lineM), 0, top + .002, s * .66), at(box(.012, .002, 1.2, lineM), s * .66, top + .002, 0)); }
  // coins
  const wM = phys(C.white, { roughness: .35 }), bM = phys(0x173038, { roughness: .35 }), qM = glowMat(C.pink, .5);
  const coin = m => { const c = new THREE.Group(); c.add(cyl(.068, .068, .03, m, 28)); const r = mesh(new THREE.TorusGeometry(.045, .005, 6, 24), m === wM ? M.slate : M.lavender); r.rotation.x = Math.PI / 2; r.position.y = .016; c.add(r); return c; };
  const homes = [[0, 0, qM]];
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; homes.push([Math.cos(a) * .14, Math.sin(a) * .14, i % 2 ? wM : bM]); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + TAU / 12; homes.push([Math.cos(a) * .27, Math.sin(a) * .27, i % 2 ? bM : wM]); }
  const R = rng(7), hitZ = .55;
  const coins = homes.map(([x, z, m]) => {
    const c = coin(m); g.add(c);
    let dx = x + (R() - .5) * .25, dz = z - hitZ - .2; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    if (x === 0 && z === 0) { dx = (R() - .5) * .3; dz = -1; }
    const dist = .3 + R() * .45;
    const tx = clamp(x + dx * dist, -.78, .78), tz = clamp(z + dz * dist, -.78, .78);
    return { c, x, z, tx, tz, delay: (z + .3) * -.06 + .04, spin: (R() - .5) * 6 };
  });
  const striker = new THREE.Group();
  striker.add(cyl(.1, .1, .035, M.violet, 40));
  const sr = mesh(new THREE.TorusGeometry(.07, .008, 8, 32), M.lavGlow); sr.rotation.x = Math.PI / 2; sr.position.y = .019; striker.add(sr);
  g.add(striker);
  const Tk = 7.4, cy = top + .016;
  const kShock = makeShock(g, { color: C.violetSoft, r0: .08, r1: .6, life: .55 });
  const kSettle = makeShock(g, { r0: .34, r1: .16, life: .5 });
  return {
    root, anchor: new THREE.Vector3(0, .1, 0),
    update(t) {
      const tl = mod(t, Tk);
      // striker
      let sx = 0, sz = .66;
      if (tl < .3) sz = .66 + .05 * easeInOut(seg(tl, 0, .3));
      else if (tl < .58) sz = lerp(.71, .37, easeIn(seg(tl, .3, .58)));
      else if (tl < 4.3) { const u = easeOut(seg(tl, .58, 1.8)); sz = lerp(.37, .58, u); sx = .14 * u; }
      else { const u = easeInOut(seg(tl, 4.3, 6.3)); sz = lerp(.58, .66, u); sx = .14 * (1 - u); }
      striker.position.set(sx, top + .018, sz);
      // coins
      coins.forEach(o => {
        let u;
        if (tl < .58) u = 0;
        else if (tl < 4.3) u = 1 - Math.exp(-Math.max(0, tl - .58 - o.delay) * 3.2);
        else u = 1 - easeInOut(seg(tl, 4.3, 6.4));
        u = Math.min(1, u * 1.04);
        o.c.position.set(lerp(o.x, o.tx, u), cy, lerp(o.z, o.tz, u));
        o.c.rotation.y = o.spin * u;
      });
      kShock.update(tl - .58, 0, top + .004, .3); kSettle.update(tl - 6.25, 0, top + .004, 0);
    }
  };
}

/* ---------- Gym + Zumba: dumbbell lifting in rhythm, floor pulse on the beat ---------- */
function makeGym() {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g);
  const db = new THREE.Group();
  const bar = cyl(.032, .032, 1.3, M.metal); bar.rotation.z = Math.PI / 2; db.add(bar);
  const grip = cyl(.045, .045, .4, M.ink, 16); grip.rotation.z = Math.PI / 2; db.add(grip);
  for (const s of [-1, 1]) {
    const p1 = cyl(.26, .26, .13, M.violet); p1.rotation.z = Math.PI / 2; p1.position.x = s * .5; db.add(p1);
    const p2 = cyl(.2, .2, .09, M.lavender); p2.rotation.z = Math.PI / 2; p2.position.x = s * .38; db.add(p2);
    const col = cyl(.06, .06, .05, M.metal); col.rotation.z = Math.PI / 2; col.position.x = s * .3; db.add(col);
    const cap = cyl(.05, .05, .06, M.amber); cap.rotation.z = Math.PI / 2; cap.position.x = s * .6; db.add(cap);
  }
  g.add(db);
  // beat ring (Zumba floor pulse)
  const beatM = glowMat(C.violetSoft, 1.2, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const beat = mesh(new THREE.RingGeometry(.62, .66, 72), beatM); beat.rotation.x = -Math.PI / 2; beat.position.y = -.7; g.add(beat);
  const floor = mesh(new THREE.RingGeometry(.0, .7, 64), new THREE.MeshBasicMaterial({ color: C.navyDeep, transparent: true, opacity: .25, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.71; g.add(floor);
  const P = 2.2;
  return {
    root, anchor: new THREE.Vector3(0, 0, 0),
    update(t) {
      const c = mod(t, P) / P;
      const lift = c < .45 ? easeInOut(c / .45) : c < .55 ? 1 : 1 - easeInOut((c - .55) / .45);
      db.position.y = -.25 + lift * .55;
      db.rotation.x = -lift * .5;
      db.rotation.z = Math.sin(t * TAU / P) * .05;
      const bt = mod(t, P) - P * .5;
      const ba = bt >= 0 ? bt : 99;
      beat.scale.setScalar(1 + Math.min(ba, 2) * 1.1); beatM.opacity = .9 * sat(1 - ba / .9);
    }
  };
}

/* =====================================================================
   SCENE
   ===================================================================== */
function mountHeroScene(container, opts = {}) {
  const reduce = opts.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  let forced = null, halted = false; // forced = { w, h } while recording a video
  const isSmall = () => forced ? forced.w / forced.h < .9 : container.clientWidth < 768;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall() ? 2 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.navy);
  scene.fog = new THREE.Fog(C.navy, 16, 34);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

  // tight depth range (nearest object ~10 away, backdrop ~40): far more depth precision,
  // so thin layers (court lines, pockets, rings) don't shimmer on phone GPUs / Safari
  const camera = new THREE.PerspectiveCamera(35, 1, 2, 60);
  camera.position.set(0, 0, 14);

  // lights
  const hemi = new THREE.HemisphereLight(0xccfbf1, 0x0a1a20, .9); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 8, 10); scene.add(key);
  const rim = new THREE.PointLight(0x2dd4bf, 110, 50, 2); rim.position.set(9, 4, -6); scene.add(rim);
  const rim2 = new THREE.PointLight(0xf59e0b, 60, 40, 2); rim2.position.set(-6, 6, -4); scene.add(rim2);
  const fill = new THREE.PointLight(0xfb7185, 18, 40, 2); fill.position.set(2, -6, 6); scene.add(fill);

  // gradient backdrop (violet glow behind the activities)
  const bgCanvas = document.createElement('canvas');
  const bgTex = new THREE.CanvasTexture(bgCanvas); bgTex.colorSpace = THREE.SRGBColorSpace;
  const backdrop = mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: bgTex, fog: false, depthWrite: false }));
  backdrop.position.z = -26; scene.add(backdrop);
  function paintBackdrop(aspect, small) {
    if (!(aspect > 0 && isFinite(aspect))) { aspect = 1; }
    const w = 1024, h = clamp(Math.round(1024 / aspect), 256, 4096); bgCanvas.width = w; bgCanvas.height = h;
    const x = bgCanvas.getContext('2d');
    const light = THEME === 'light', k = 1;
    const glow = (cx, cy, r, rgb, a) => { const g = x.createRadialGradient(cx * w, cy * h, 0, cx * w, cy * h, r * Math.max(w, h)); g.addColorStop(0, `rgba(${rgb},${a * k})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, w, h); };
    if (light) {
      // daylight with atmosphere: a luminous mint-to-teal gradient (not flat white), a bright
      // highlight behind the card so the glass has something to frost, and teal + warm glows
      const lg = x.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, '#f3faf8'); lg.addColorStop(.42, '#dcefeb'); lg.addColorStop(.72, '#e3eeee'); lg.addColorStop(1, '#f3f2f9'); // ends on the page colour, so the hero melts into the next section
      x.fillStyle = lg; x.fillRect(0, 0, w, h);
      glow(small ? .5 : .28, small ? .3 : .35, .5, '255,255,255', .85);
      if (small) { glow(.5, .7, .6, '20,184,166', .36); glow(.85, .15, .45, '245,158,11', .12); }
      else { glow(.76, .48, .5, '20,184,166', .42); glow(.9, .3, .3, '45,212,191', .22); glow(.96, .9, .32, '245,158,11', .16); glow(.55, .05, .3, '251,113,133', .07); glow(.1, .62, .35, '16,185,129', .08); }
    } else {
      x.fillStyle = '#0a1a20'; x.fillRect(0, 0, w, h);
      if (small) { glow(.5, .85, .75, '13,148,136', .24); glow(.85, .1, .5, '245,158,11', .10); }
      else { glow(.72, .42, .55, '13,148,136', .22); glow(.95, .95, .35, '245,158,11', .10); glow(.55, .08, .3, '251,113,133', .05); glow(.1, 1.0, .4, '16,185,129', .04); }
    }
    // canvas size changed → texture must be rebuilt (WebGL can't resize it in place)
    const old = backdrop.material.map; const tex = new THREE.CanvasTexture(bgCanvas); tex.colorSpace = THREE.SRGBColorSpace;
    backdrop.material.map = tex; backdrop.material.needsUpdate = true; if (old) old.dispose();
  }

  // dust / bokeh
  const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  const mkDust = (n, size, opacity, color, zr, seed) => {
    const R = rng(seed), base = new Float32Array(n * 3), pos = new Float32Array(n * 3), sp = new Float32Array(n);
    for (let i = 0; i < n; i++) { base[i * 3] = (R() - .5) * 30; base[i * 3 + 1] = (R() - .5) * 18; base[i * 3 + 2] = zr[0] + R() * (zr[1] - zr[0]); sp[i] = .08 + R() * .2; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: dotTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.userData = { base, pos, sp, n }; scene.add(p); return p;
  };
  const small0 = isSmall();
  const dust = [mkDust(small0 ? 150 : 320, .07, .45, C.lavender, [-12, 6], 3), mkDust(small0 ? 16 : 32, .5, .1, C.violetSoft, [-18, -6], 11)];

  // stations
  const defs = {
    badminton: makeBadminton(), tableTennis: makeTableTennis(), chess: makeChess(),
    darts: makeDarts(), billiards: makeBilliards(), carrom: makeCarrom(), gym: makeGym(),
  };
  // [nx, ny, z, scale, tiltX, yaw]
  const LAYOUT = {
    wide: {
      badminton:   [ .50,  .50, -2,   .66, .42, -.38],
      tableTennis: [ .84,  .74, -6,   .62, .55,  .5 ],
      chess:       [ .40, -.12, -4,   .9,  .6,   .62],
      darts:       [ .86,  .06, -3,   .85, .02, -.42],
      billiards:   [ .52, -.58, -.5,  .78, .55, -.22],
      carrom:      [ .90, -.72, -4,   .82, .62,  .38],
      gym:         [-.84, -.78, -3,   .78, .2,   .42],
    },
    medium: {
      tableTennis: [ .80,  .70, -6,   .5,  .55,  .5 ],
      darts:       [ .86,  .20, -3,   .66, .02, -.42],
      badminton:   [ .50, -.52, -2,   .55, .45, -.3 ],
      chess:       [ .02, -.66, -4,   .72, .62,  .55],
      billiards:   [-.50, -.74, -.5,  .58, .55, -.22],
      carrom:      [ .90, -.62, -4,   .6,  .62,  .38],
      gym:         [-.88, -.82, -3,   .6,  .2,   .42],
    },
    // phone: the card fills the middle of the screen. Below it, a row of three
    // (billiards · badminton · carrom) sits fully on screen; the thin strip under
    // the header holds two small pieces; the dumbbell sits off the card's lower-right
    // corner. The card is clear glass (no frost), so nothing is placed behind the
    // text — chess is left out on phones (null = hidden).
    narrow: {
      tableTennis: [-.5,   .75, -6,   .34, .62,  .4 ],
      darts:       [ .52,  .75, -6,   .36, .05, -.25],
      chess:       null,
      gym:         null, // phones: no room beside the card without overlapping its buttons
      badminton:   [ .0,  -.62, -1,   .44, .55, -.08],
      billiards:   [-.62, -.78, -1.5, .36, .6,  -.35],
      carrom:      [ .62, -.78, -2,   .36, .65,  .35],
    },
  };
  const stations = Object.entries(defs).map(([name, s], i) => {
    const holder = new THREE.Group(); holder.add(s.root); scene.add(holder);
    return { name, ...s, holder, ph: i * 1.7, base: new THREE.Vector3(), tilt: new THREE.Vector2(), sc: 1 };
  });
  let isPhone = false, lastBgKey = '';
  function layout() {
    const w = forced ? forced.w : Math.max(1, container.clientWidth), h = forced ? forced.h : Math.max(1, container.clientHeight), aspect = w / h, small = aspect < .9;
    isPhone = small;
    const L = small ? LAYOUT.narrow : aspect < 1.45 ? LAYOUT.medium : LAYOUT.wide;
    const solo = new URLSearchParams(location.search).get('solo'); // e.g. ?solo=badminton for a close-up
    const fit = small ? clamp(aspect / .5, .8, 1.25) : clamp(aspect / 1.6, .85, 1.15);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    stations.forEach(st => {
      const entry = L[st.name];
      st.holder.visible = solo ? st.name === solo : !!entry;
      if (!st.holder.visible) return;
      let [nx, ny, z, s, rx, ry] = entry || LAYOUT.wide[st.name];
      if (solo) [nx, ny, z, s] = [0, -.05, 3, small ? .5 : 1.25];
      const d = camera.position.z - z, hh = d * tan, hw = hh * aspect;
      st.base.set(nx * hw, ny * hh, z); st.tilt.set(rx, ry); st.sc = s * fit;
      st.holder.scale.setScalar(st.sc);
    });
    const bd = camera.position.z - backdrop.position.z, bh = 2 * bd * tan * 1.15;
    backdrop.scale.set(bh * aspect, bh, 1);
    const bgKey = Math.round(aspect * 25) + '|' + small;
    if (bgKey !== lastBgKey) { lastBgKey = bgKey; paintBackdrop(aspect, small); }
  }

  // twinkling motes drifting through the background
  const ptsVS = `attribute vec3 aColor; attribute float aAlpha; attribute float aSize; attribute float aPhase;
    uniform float uScale; uniform float uTime; uniform float uTw; uniform float uLight; varying vec3 vC; varying float vA;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      float tw = 0.5 + 0.5 * sin(uTime * 1.7 + aPhase * 6.2832);
      gl_PointSize = aSize * uScale * (1.0 + 0.5 * uLight) * (1.0 - uTw * 0.35 + uTw * 0.6 * tw) / max(0.1, -mv.z); // a bit bigger on light backgrounds
      vC = aColor; vA = aAlpha * (1.0 - uTw + uTw * tw); }`;
  const ptsFS = `uniform sampler2D uMap; uniform float uLight; varying vec3 vC; varying float vA;
    void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA * (1.0 + 0.35 * uLight); a = min(a, 1.0); if (a < 0.01) discard;
      gl_FragColor = vec4(mix(vC, vec3(1.0, 1.0, 1.0), uLight), a); }`;
  const ptsMats = [];
  const mkPts = (n, twinkle) => {
    const g = new THREE.BufferGeometry(), f = k => new THREE.BufferAttribute(new Float32Array(n * k), k);
    g.setAttribute('position', f(3)); g.setAttribute('aColor', f(3)); g.setAttribute('aAlpha', f(1)); g.setAttribute('aSize', f(1)); g.setAttribute('aPhase', f(1));
    const m = new THREE.ShaderMaterial({ vertexShader: ptsVS, fragmentShader: ptsFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uMap: { value: dotTex }, uScale: { value: 400 }, uTime: { value: 0 }, uTw: { value: twinkle ? 1 : 0 }, uLight: { value: 0 } } });
    ptsMats.push(m);
    const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return p;
  };
  const moteCols = [C.lavender, C.violetSoft, C.white, C.lavender, C.violetSoft].map(c => new THREE.Color(c));
  const MN = small0 ? 45 : 110, motes = mkPts(MN, true), moteBase = new Float32Array(MN * 3), moteSp = new Float32Array(MN);
  { const R = rng(19), a = motes.geometry.attributes;
    for (let i = 0; i < MN; i++) {
      moteBase.set([(R() - .5) * 28, (R() - .5) * 17, -14 + R() * 17], i * 3); moteSp[i] = .05 + R() * .12;
      const c = moteCols[i % moteCols.length]; a.aColor.array.set([c.r, c.g, c.b], i * 3);
      a.aAlpha.array[i] = .45 + R() * .5; a.aSize.array[i] = .07 + R() * .1; a.aPhase.array[i] = R();
    } }
  function updateParticles(t) {
    ptsMats.forEach(m => m.uniforms.uTime.value = t);
    const mp = motes.geometry.attributes.position.array;
    for (let i = 0; i < MN; i++) {
      mp[i * 3] = moteBase[i * 3] + Math.sin(t * .15 + i * 1.3) * .5;
      mp[i * 3 + 1] = mod(moteBase[i * 3 + 1] + 8.5 + t * moteSp[i], 17) - 8.5;
      mp[i * 3 + 2] = moteBase[i * 3 + 2];
    }
    motes.geometry.attributes.position.needsUpdate = true;
  }

  // connection web — move, create, belong
  const EDGES = [['badminton', 'tableTennis'], ['badminton', 'chess'], ['badminton', 'darts'], ['chess', 'billiards'], ['darts', 'carrom'],
                 ['billiards', 'carrom'], ['chess', 'darts'], ['billiards', 'gym'], ['tableTennis', 'darts'], ['chess', 'gym']];
  const PHONE_EDGES = new Set(['tableTennis|darts', 'badminton|chess', 'chess|darts', 'chess|billiards', 'billiards|carrom', 'chess|gym']);
  const SEGS = 56, byName = Object.fromEntries(stations.map(s => [s.name, s]));
  const edgeVS = `attribute float aU; varying float vU; void main(){ vU=aU; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const edgeFS = `uniform float uHead; uniform float uOn; uniform float uBase; uniform vec3 uColor; uniform float uBoost; varying float vU;
    void main(){ float d=vU-uHead; float head=exp(-d*d*260.0); float trail=d<0.0 ? exp(d*7.0)*0.5 : 0.0;
      float a=min(1.0, uBase + uOn*(head*1.8 + trail*0.7)); gl_FragColor=vec4(uColor*(1.0+head*1.6*uBoost), a); }`; // uBoost 0 in light mode: no over-white pulse. Alpha is clamped: above 1 it breaks normal blending on light backgrounds
  const edges = EDGES.map(([a, b], i) => {
    const g = new THREE.BufferGeometry(), pos = new Float32Array((SEGS + 1) * 3), u = new Float32Array(SEGS + 1);
    for (let k = 0; k <= SEGS; k++) u[k] = k / SEGS;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aU', new THREE.BufferAttribute(u, 1));
    const m = new THREE.ShaderMaterial({ vertexShader: edgeVS, fragmentShader: edgeFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uHead: { value: -1 }, uOn: { value: 0 }, uBase: { value: .1 }, uBoost: { value: 1 }, uColor: { value: new THREE.Color(i % 3 === 0 ? C.lavender : C.violetSoft) } } });
    const line = new THREE.Line(g, m); line.frustumCulled = false; scene.add(line);
    // on phones only short links between neighbours are drawn, so lines don't criss-cross the screen
    const phone = PHONE_EDGES.has(a + '|' + b);
    return { a: byName[a], b: byName[b], line, pos, m, period: 7 + (i * 2.3) % 5, off: i * 1.37, i, phone };
  });
  const nodeGeo = new THREE.SphereGeometry(.05, 12, 8);
  const nodes = stations.map(s => { const m = mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: C.pearl, transparent: true, opacity: .7, fog: false })); scene.add(m); return m; });
  const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), tmp = new THREE.Vector3();
  let edgeGain = 1; // light mode: lines need more presence on a white background
  function updateEdges(t) {
    const wave = mod(t, 16); // every 16s the whole web lights up in sequence
    edges.forEach(e => {
      e.line.visible = (!isPhone || e.phone) && e.a.holder.visible && e.b.holder.visible;
      if (!e.line.visible) return;
      e.a.holder.localToWorld(A.copy(e.a.anchor)); e.b.holder.localToWorld(B.copy(e.b.anchor));
      Cc.copy(A).add(B).multiplyScalar(.5); Cc.z += 1.2; Cc.y += A.distanceTo(B) * .12;
      for (let k = 0; k <= SEGS; k++) {
        const u = k / SEGS, iu = 1 - u;
        tmp.set(iu * iu * A.x + 2 * iu * u * Cc.x + u * u * B.x, iu * iu * A.y + 2 * iu * u * Cc.y + u * u * B.y, iu * iu * A.z + 2 * iu * u * Cc.z + u * u * B.z);
        e.pos[k * 3] = tmp.x; e.pos[k * 3 + 1] = tmp.y; e.pos[k * 3 + 2] = tmp.z;
      }
      e.line.geometry.attributes.position.needsUpdate = true;
      const own = mod(t + e.off, e.period) / 1.9;           // individual pulses
      const seq = (wave - 1 - e.i * .28) / 1.6;              // the "everyone connected" wave
      let head = -1, on = 0;
      if (own <= 1) { head = lerp(-.1, 1.1, own); on = .8; }
      if (seq >= 0 && seq <= 1) { head = lerp(-.1, 1.1, seq); on = 1.2; }
      if (e.i % 2) head = 1 - head;
      e.m.uniforms.uHead.value = head; e.m.uniforms.uOn.value = on * edgeGain;
      e.m.uniforms.uBase.value = (.1 + .05 * Math.sin(t * .6 + e.i) + (wave < 6 && wave > 1 ? .06 * Math.sin(Math.PI * (wave - 1) / 5) : 0)) * edgeGain;
    });
    stations.forEach((s, i) => { s.holder.localToWorld(nodes[i].position.copy(s.anchor)); nodes[i].material.opacity = .45 + .3 * Math.sin(t * 1.3 + i); nodes[i].visible = s.holder.visible; });
  }

  /* ---------- light / dark ----------
     Dark navy/slate surfaces are swapped for soft lavender-greys in light mode; saturated
     colours (violet, pink, amber…) and pure blacks (pockets, 8-ball) stay as they are.
     Additive glows don't show on white, so dust / motes / web switch to normal blending
     in a violet ink, and bloom is skipped. */
  const themedMats = [], hsl = {}, LIGHT_SURFACE = new THREE.Color(0xeceaf6);
  // surfaces that need a mid tone in light mode so their patterns keep contrast
  const LIGHT_TONES = {
    0x131c2e: 0x5f53a6, // chess dark squares
    0x24304a: 0x8f88bf, // slate: dart sectors, carrom frame, billiard rails
    0x1d3264: 0x3047a0, // billiard felt stays blue
    0x121a2b: 0xe2dff0, // dart dark sectors
  };
  const near = (h1, h2) => [16, 8, 0].every(sh => Math.abs(((h1 >> sh) & 255) - ((h2 >> sh) & 255)) <= 2); // colours round-trip through linear space
  stations.forEach(st => st.root.traverse(o => {
    [].concat(o.material || []).forEach(m => {
      if (!m.color || m.isShaderMaterial || m.userData.darkColor) return;
      m.userData.darkColor = m.color.clone();
      m.color.getHSL(hsl, THREE.SRGBColorSpace); // judge by how the colour looks on screen
      const hx = m.color.getHex(), tone = Object.entries(LIGHT_TONES).find(([k]) => near(hx, +k))?.[1];
      m.userData.lightColor = tone !== undefined ? new THREE.Color(tone)
        : hsl.l > .07 && hsl.l < .32 && hsl.s < .65 ? m.color.clone().lerp(LIGHT_SURFACE, .8) : m.color.clone();
      themedMats.push(m);
    });
  }));
  // soft contact shadows under every object (light mode only)
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const shadows = stations.map(st => {
    const bx = new THREE.Box3().setFromObject(st.root), size = bx.getSize(new THREE.Vector3()), c = bx.getCenter(new THREE.Vector3());
    const m = new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x0f3d38, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const sh = mesh(new THREE.PlaneGeometry(1, 1), m);
    sh.rotation.x = -Math.PI / 2; sh.scale.set(size.x * 1.1, Math.max(size.z, .9) * 1.1, 1);
    sh.position.set(c.x, bx.min.y - .3 - size.y * .15, c.z); sh.renderOrder = -1;
    st.holder.add(sh); return m;
  });
  const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const halos = stations.map((st, i) => {
    const m = new THREE.SpriteMaterial({ map: haloTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const sp = new THREE.Sprite(m); sp.renderOrder = -2; scene.add(sp); return { sp, m, st };
  });
  function updateHalos(t) {
    if (THEME !== 'light') return;
    halos.forEach(({ sp, m, st }, i) => {
      sp.visible = st.holder.visible;
      st.holder.localToWorld(sp.position.copy(st.anchor)); sp.position.z -= 6; // well behind the object: it lights the background and never veils the object
      sp.scale.setScalar(st.sc * 10); m.opacity = .6 + .1 * Math.sin(t * .8 + i);
    });
  }
  const THEMES = {
    dark: { bg: 0x0a1a20, fog: [16, 34], hemi: [0xccfbf1, 0x0a1a20, .9], key: 1.6, rim: 120, rim2: 70, fill: 22, exposure: 1.05, ink: null },
    light: { bg: 0xd6ece7, fog: [36, 70], hemi: [0xe6fffa, 0x5b9e93, .8], key: 2.1, rim: 150, rim2: 80, fill: 14, exposure: .98, ink: new THREE.Color(0x0f766e) },
  };
  const edgeDark = edges.map(e => e.m.uniforms.uColor.value.clone());
  function setTheme(th) {
    THEME = th; const T = THEMES[th], light = th === 'light';
    scene.background.set(T.bg); scene.fog.color.set(T.bg); scene.fog.near = T.fog[0]; scene.fog.far = T.fog[1];
    shadows.forEach(m => { m.opacity = light ? .28 : 0; });
    halos.forEach(h => { h.sp.visible = light; }); // light mode: soft contact shadows ground the objects
    hemi.color.set(T.hemi[0]); hemi.groundColor.set(T.hemi[1]); hemi.intensity = T.hemi[2];
    key.intensity = T.key; rim.intensity = T.rim; rim2.intensity = T.rim2; fill.intensity = T.fill;
    renderer.toneMappingExposure = T.exposure;
    themedMats.forEach(m => m.color.copy(m.userData.darkColor)); // boards & pieces: identical colours in both themes
    themedTexs.forEach(paint => paint());
    paintBackdrop(camera.aspect, isSmall());
    const blend = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    dust.forEach((p, i) => { p.material.blending = blend; p.material.color.set(light ? (i ? 0x2dd4bf : 0xffffff) : (i ? C.violetSoft : C.lavender)); p.material.opacity = light ? (i ? .28 : 1) : (i ? .14 : .6); p.material.size = (i ? .5 : .07) * (light ? 1.9 : 1); p.material.fog = !light; /* light mode: particles skip the depth haze so they stay visible */ p.material.needsUpdate = true; });
    ptsMats.forEach(m => { m.uniforms.uLight.value = light ? 1 : 0; m.blending = blend; m.needsUpdate = true; });
    edgeGain = light ? 3 : 1;
    edges.forEach((e, i) => { e.m.uniforms.uColor.value.copy(light ? T.ink : edgeDark[i]); e.m.uniforms.uBoost.value = light ? 0 : 1; e.m.blending = blend; e.m.needsUpdate = true; });
    nodes.forEach(n => n.material.color.set(light ? C.violet : C.pearl));
  }
  setTheme(THEME);

  let composer = null, bloomPass = null;
  function buildComposer(w, h) {
    // multisampled target: keeps edges anti-aliased with the glow on (the default target has none)
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType }));
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), BLOOM.strength, BLOOM.radius, BLOOM.threshold));
    composer.addPass(new OutputPass());
  }

  function resize() {
    const w = forced ? forced.w : Math.max(1, container.clientWidth), h = forced ? forced.h : Math.max(1, container.clientHeight);
    // invisible saving: above ~1.5x density extra pixels can't be seen at phone size
    renderer.setPixelRatio(forced ? 1 : Math.min(devicePixelRatio, isSmall() ? 1.5 : 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    ptsMats?.forEach(m => m.uniforms.uScale.value = h * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
    layout();
    if (isSmall() && !forced) { composer?.dispose(); composer = null; } // recordings always get the glow
    else { if (!composer) buildComposer(w, h); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
      const pr = renderer.getPixelRatio(); bloomPass.setSize(w * pr / 2, h * pr / 2); } // glow at half res: looks the same, far cheaper
  }

  // pointer parallax
  const mouse = new THREE.Vector2(), camT = new THREE.Vector2();
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; mouse.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, { passive: true });

  let time = opts.startTime ?? 0, last = performance.now(), running = false, still = reduce, paused = false;
  const STILL_T = 1.05;
  function frame(t, dt) {
    stations.forEach(st => {
      st.holder.position.set(st.base.x + Math.sin(t * .31 + st.ph) * .06 * st.sc, st.base.y + Math.sin(t * .47 + st.ph) * .13 * st.sc, st.base.z);
      st.holder.rotation.set(st.tilt.x + Math.sin(t * .27 + st.ph) * .035, st.tilt.y + Math.sin(t * .19 + st.ph) * .09, Math.sin(t * .23 + st.ph) * .02);
      st.update(t);
    });
    updateEdges(t);
    updateParticles(t);
    updateHalos(t);
    dust.forEach(p => {
      const { base, pos, sp, n } = p.userData;
      for (let i = 0; i < n; i++) {
        pos[i * 3] = base[i * 3] + Math.sin(t * .2 + i) * .3;
        pos[i * 3 + 1] = mod(base[i * 3 + 1] + 9 + t * sp[i], 18) - 9;
        pos[i * 3 + 2] = base[i * 3 + 2];
      }
      p.geometry.attributes.position.needsUpdate = true;
    });
    const k = still ? 1 : 1 - Math.pow(.02, dt);
    camT.lerp(mouse, k);
    camera.position.x = camT.x * .45; camera.position.y = -camT.y * .28;
    camera.lookAt(0, 0, 0);
    // glow only in dark mode: on a light background the whole backdrop passes the glow threshold
    // and lays a milky veil over everything
    if (composer && THEME === 'dark') composer.render(); else renderer.render(scene, camera);
  }
  function loop() {
    if (!running) return;
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!paused) time += dt;
    frame(time, dt);
    requestAnimationFrame(loop);
  }
  function start() { if (running || still) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
  function stop() { running = false; }
  function renderStill() { stop(); frame(STILL_T, 0); }

  // resizing a canvas clears it — redraw immediately so Safari never shows an empty frame
  // touch screens: a height-only change of a few % is the address bar — don't re-lay-out for it
  const touch = matchMedia('(pointer: coarse)').matches;
  let lastW = 0, lastH = 0;
  new ResizeObserver(() => {
    if (halted || forced) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (touch && w === lastW && lastH && Math.abs(h - lastH) / lastH < .25) return;
    lastW = w; lastH = h;
    resize(); frame(still ? STILL_T : time, 0);
  }).observe(container);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : (!still && start()));
  new IntersectionObserver(([en]) => en.isIntersecting ? (!still && start()) : stop()).observe(container);

  resize();
  still ? renderStill() : start();

  return {
    setPaused(v) { paused = v; },
    setStill(v) { still = v; if (v) renderStill(); else start(); },
    setTheme(th) { setTheme(th); if (still || paused) frame(still ? STILL_T : time, 0); },
    // recording: render exact frames at a fixed size, independent of the window
    beginCapture(w, h, th) { stop(); still = true; forced = { w, h }; resize(); setTheme(th); },
    renderAt(t) { frame(t, 0); return renderer.domElement; },
    endCapture() { forced = null; still = reduce; resize(); still ? renderStill() : start(); },
    // hand over to the video: stop for good and free the GPU
    halt() { halted = true; still = true; stop(); renderer.domElement.remove(); composer?.dispose(); renderer.dispose(); },
  };
}


export { mountHeroScene };
