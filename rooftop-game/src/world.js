// World core: materials, collision (AABBs + angled wall segments), polygon
// floor regions, interactables, shared helpers. Level geometry lives in
// levelBuilding.js (street→lobby→elevator→office→stairs→mech→vent route)
// and levelRoof.js (roof, hole, lattice spire, catwalk, top platform).
import * as THREE from 'three';
import { state } from './state.js';
import * as audio from './audio.js';
import { buildBuilding } from './levelBuilding.js';
import { buildRoof } from './levelRoof.js';

export const ROOF_Y = 46;
export const PLAT_Y = 94;                         // top platform under the sign
export const HOLE = { x: 0, z: -34, r: 8.4 };     // massive hole, bored into the core
export const LIGHTWELL = { x1: 21.4, x2: 25.1, z1: -35.9, z2: -32.1, floor: 41.0 };
export const GRATE = { x1: 23.85, x2: 24.95, z1: -34.65, z2: -33.35 }; // opening in the roof

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];    // { box: THREE.Box3, name }
    this.wallSegs = [];     // { ax, az, bx, bz, ymin, ymax } — angled walls
    this.floors = [];       // { y, rect|poly, holes:[{circle|rect}] }
    this.interactables = [];
    this.occluders = [];    // meshes that block guard/CCTV line of sight
    this.dynamic = {};
    this.updaters = [];
    this.ladderZones = [];  // THREE.Box3 — gravity-off climb volumes
    this.roofY = ROOF_Y;
    this.hole = HOLE;
    this.mats = this.makeMaterials();
    this.buildLighting();
    buildBuilding(this);
    buildRoof(this);
  }

  makeMaterials() {
    const M = (o) => new THREE.MeshStandardMaterial(o);
    return {
      concrete: M({ color: 0x6d7176, roughness: 0.95 }),
      concreteDark: M({ color: 0x484c52, roughness: 0.97 }),
      floorInt: M({ color: 0x3c4046, roughness: 0.9 }),
      floorLobby: M({ color: 0x54514a, roughness: 0.35, metalness: 0.1 }),
      floorOffice: M({ color: 0x4a5058, roughness: 0.9 }),
      floorRoof: M({ color: 0x585f6b, roughness: 0.92 }),
      street: M({ color: 0x33363c, roughness: 0.95 }),
      metal: M({ color: 0x8b9299, roughness: 0.45, metalness: 0.75 }),
      metalDark: M({ color: 0x3a3f45, roughness: 0.5, metalness: 0.7 }),
      rust: M({ color: 0x6e4326, roughness: 0.85, metalness: 0.25 }),
      pipeGreen: M({ color: 0x2f6b4f, roughness: 0.6, metalness: 0.4 }),
      pipeRed: M({ color: 0x8a3030, roughness: 0.6, metalness: 0.4 }),
      pipeYellow: M({ color: 0xa8862a, roughness: 0.6, metalness: 0.4 }),
      panel: M({ color: 0x59616a, roughness: 0.5, metalness: 0.6 }),
      doorMat: M({ color: 0x50606e, roughness: 0.5, metalness: 0.7 }),
      wood: M({ color: 0x6b4f33, roughness: 0.9 }),
      glass: M({ color: 0x1c2733, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.55 }),
      spireWhite: M({ color: 0xe9edf2, roughness: 0.35, metalness: 0.15, emissive: 0x232a33, emissiveIntensity: 0.3 }),
      shaftDark: M({ color: 0x07090c, roughness: 1, side: THREE.DoubleSide }),
      blackout: M({ color: 0x000000 }),
      duct: M({ color: 0x565e66, roughness: 0.4, metalness: 0.8 }),
    };
  }

  // ------------------------------------------------------------ primitives
  box(w, h, d, x, y, z, mat, { collide = true, name = '', occlude = false, ry = 0 } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    this.scene.add(m);
    if (collide && !ry) this.addCollider(m, name);
    if (occlude) this.occluders.push(m);
    return m;
  }

  addCollider(mesh, name = '') {
    mesh.updateMatrixWorld(true);
    const c = { box: new THREE.Box3().setFromObject(mesh), name, mesh };
    this.colliders.push(c);
    return c;
  }

  removeCollider(c) {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  cyl(rt, rb, h, x, y, z, mat, { collide = false, seg = 16 } = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    this.scene.add(m);
    if (collide) this.addCollider(m);
    return m;
  }

  pipe(mat, r, from, to, y) {
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const len = Math.hypot(dx, dz);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
    m.position.set((from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2);
    m.rotation.order = 'YZX';
    m.rotation.y = -Math.atan2(dz, dx);
    m.rotation.z = Math.PI / 2;
    this.scene.add(m);
    return m;
  }

  // Angled wall: mesh + 2D segment collider + occluder.
  wall(ax, az, bx, bz, ymin, ymax, mat, { thick = 0.35, collide = true, occlude = true } = {}) {
    const len = Math.hypot(bx - ax, bz - az);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, ymax - ymin, thick), mat);
    m.position.set((ax + bx) / 2, (ymin + ymax) / 2, (az + bz) / 2);
    m.rotation.y = -Math.atan2(bz - az, bx - ax);
    this.scene.add(m);
    if (collide) this.wallSegs.push({ ax, az, bx, bz, ymin, ymax });
    if (occlude) this.occluders.push(m);
    return m;
  }

  addFloor(f) { this.floors.push(f); return f; }

  addLadder(x1, y1, z1, x2, y2, z2) {
    const b = new THREE.Box3(new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2));
    this.ladderZones.push(b);
    return b;
  }

  interactable(mesh, label, action) {
    const it = { mesh, label, action };
    this.interactables.push(it);
    mesh.traverse((c) => { c.userData.interact = it; });
    mesh.userData.interact = it;
    return it;
  }

  lampFixture(x, y, z, w = 1.6, on = true, color = 0xcfe4ff, intensity = 0.9, dist = 12) {
    intensity *= 35; // physical lighting: candela
    const g = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.3), this.mats.metalDark);
    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.85, 0.05, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: on ? 1.6 : 0.02 })
    );
    tube.position.y = -0.05;
    const light = new THREE.PointLight(color, on ? intensity : 0, dist, 1.8);
    light.position.y = -0.4;
    g.add(housing, tube, light);
    g.position.set(x, y, z);
    this.scene.add(g);
    return { group: g, tube, light, baseIntensity: intensity, color };
  }

  poster(x, y, z, ry, w, h, draw) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: canvasTex(256, Math.round(256 * h / w), draw) }));
    p.position.set(x, y, z); p.rotation.y = ry;
    this.scene.add(p);
    return p;
  }

  slidingDoor(w, h, x, y, z, { ry = 0, label = null } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), this.mats.doorMat.clone());
    mesh.position.set(x, y, z);
    if (ry) mesh.rotation.y = ry;
    this.scene.add(mesh);
    this.occluders.push(mesh);
    const collider = ry
      ? null // angled doors use a wall segment instead
      : this.addCollider(mesh, 'door');
    let seg = null;
    if (ry) {
      const dx = Math.cos(ry) * w / 2, dz = -Math.sin(ry) * w / 2;
      seg = { ax: x - dx, az: z - dz, bx: x + dx, bz: z + dz, ymin: y - h / 2, ymax: y + h / 2 };
      this.wallSegs.push(seg);
    }
    if (label) {
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.4),
        new THREE.MeshBasicMaterial({
          map: canvasTex(256, 56, (g, cw, ch) => {
            g.fillStyle = '#5a2020'; g.fillRect(0, 0, cw, ch);
            g.fillStyle = '#ffd0d0'; g.font = 'bold 22px monospace'; g.textAlign = 'center';
            g.fillText(label, cw / 2, 36);
          }),
        }));
      tag.position.set(0, h * 0.22, 0.08);
      mesh.add(tag);
    }
    const d = { mesh, collider, seg, open: false, t: 0, baseX: x, baseZ: z, ry, w };
    this.updaters.push((dt) => {
      if (!d.open || d.t >= 1) return;
      d.t = Math.min(1, d.t + dt * 0.8);
      const ease = 1 - Math.pow(1 - d.t, 3);
      const off = (d.w + 0.1) * ease;
      d.mesh.position.x = d.baseX + Math.cos(d.ry) * off;
      d.mesh.position.z = d.baseZ - Math.sin(d.ry) * off;
      if (d.collider) d.collider.box.setFromObject(d.mesh);
      if (d.t >= 1) {
        if (d.collider) this.removeCollider(d.collider);
        if (d.seg) { const i = this.wallSegs.indexOf(d.seg); if (i >= 0) this.wallSegs.splice(i, 1); }
      }
    });
    return d;
  }

  openDoor(d) { if (!d.open) { d.open = true; audio.doorSlide(); } }

  keypadMesh(x, y, z, ry = 0) {
    const tex = canvasTex(128, 192, (g, w, h) => {
      g.fillStyle = '#20242a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#0a2016'; g.fillRect(14, 12, 100, 30);
      g.fillStyle = '#39ff88'; g.font = '20px monospace'; g.fillText('LOCKED', 24, 34);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        g.fillStyle = '#3a4048'; g.fillRect(18 + c * 34, 56 + r * 32, 26, 24);
        g.fillStyle = '#cfd6dd'; g.font = '14px monospace';
        g.fillText(r < 3 ? String(r * 3 + c + 1) : ['*', '0', '#'][c], 27 + c * 34, 73 + r * 32);
      }
    });
    const kp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.06),
      [this.mats.metalDark, this.mats.metalDark, this.mats.metalDark, this.mats.metalDark,
       new THREE.MeshStandardMaterial({ map: tex, emissive: 0x113322, emissiveIntensity: 0.4 }), this.mats.metalDark]);
    kp.position.set(x, y, z); kp.rotation.y = ry;
    this.scene.add(kp);
    return kp;
  }

  cardReader(x, y, z, ry = 0) {
    const led = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x992200, emissiveIntensity: 1.5 });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.07), this.mats.metalDark));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), led);
    dot.position.set(0, 0.09, 0.045);
    g.add(dot);
    g.position.set(x, y, z); g.rotation.y = ry;
    this.scene.add(g);
    return { group: g, led };
  }

  // window band texture (lit office grid seen from outside / fog glow from inside)
  windowMat(glow = 0.5) {
    return new THREE.MeshStandardMaterial({
      color: 0x0e131c,
      emissive: 0x6d84a8,
      emissiveIntensity: glow,
      roughness: 0.2,
      metalness: 0.3,
    });
  }

  // ---------------------------------------------------------------- lights
  buildLighting() {
    this.ambient = new THREE.AmbientLight(0x8090a8, 0.34);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0x33404f, 0x14100c, 0.42);
    this.scene.add(this.hemi);
    // storm key light — used by lightning flashes on the roof
    this.stormLight = new THREE.DirectionalLight(0x8899bb, 0.22);
    this.stormLight.position.set(30, 120, 20);
    this.scene.add(this.stormLight);
  }

  setRoofLook(scene) {
    scene.fog = new THREE.FogExp2(0x0d1422, 0.012);
    scene.background = new THREE.Color(0x0b1120);
    this.ambient.intensity = 0.38;
    this.ambient.color.setHex(0x9db4d8);
    this.hemi.intensity = 0.5;
    this.hemi.color.setHex(0x46586e);
    this.stormLight.intensity = 0.4;
    if (this.dynamic.signLights) {
      this.dynamic.signLights[0].intensity = 90;
      this.dynamic.signLights[1].intensity = 50;
    }
  }

  // ------------------------------------------------- floors / ground query
  pointInPoly(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }

  groundHeightAt(x, z, yFeet) {
    let best = -Infinity;
    for (const f of this.floors) {
      if (yFeet < f.y - 1.25) continue;      // only floors at/below the feet
      if (f.y <= best) continue;
      let onIt = false;
      if (f.rect) onIt = x > f.rect[0] && x < f.rect[2] && z > f.rect[1] && z < f.rect[3];
      else if (f.poly) onIt = this.pointInPoly(x, z, f.poly);
      if (!onIt) continue;
      let inHole = false;
      for (const h of f.holes || []) {
        if (h.circle && Math.hypot(x - h.circle[0], z - h.circle[1]) < h.circle[2]) { inHole = true; break; }
        if (h.rect && x > h.rect[0] && x < h.rect[2] && z > h.rect[1] && z < h.rect[3]) { inHole = true; break; }
      }
      if (!inHole) best = f.y;
    }
    return best;
  }

  inLadder(x, y, z) {
    for (const b of this.ladderZones) {
      if (x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z) return true;
    }
    return false;
  }

  update(dt, t) {
    for (const u of this.updaters) u(dt, t);
    // neon sign flicker
    if (this.dynamic.signMats) {
      const flick = Math.random() < 0.015 ? 0.35 : 1;
      const base = 1.5 + Math.sin(t * 2.1) * 0.22;
      for (const sm of this.dynamic.signMats) sm.emissiveIntensity = base * flick;
      if (state.outside && this.dynamic.signLights) {
        this.dynamic.signLights[0].intensity = 90 * flick;
        this.dynamic.signLights[1].intensity = 50 * flick;
      }
    }
    // beacons
    const blink = (Math.sin(t * 2.4) > 0.7) ? 3.5 : 0.15;
    if (this.dynamic.spireBeacon) this.dynamic.spireBeacon.material.emissiveIntensity = blink;
    // hole glow breathes
    if (this.dynamic.holeGlow) this.dynamic.holeGlow.intensity = 40 + Math.sin(t * 0.7) * 16;
  }
}
