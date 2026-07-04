// The crown roof: massive hole bored into the core, white X-braced lattice
// spire rising out of it (TD-transmission-tower style) carrying a huge green
// neon box sign near the top, catwalk across the gap, caged service ladder,
// top platform with the rappel anchor.
import * as THREE from 'three';
import { canvasTex, ROOF_Y, PLAT_Y, HOLE, GRATE } from './world.js';

export function buildRoof(w) {
  const m = w.mats;
  buildSlab(w, m);
  buildProps(w, m);
  buildCatwalk(w, m);
  buildSpire(w, m);
}

// ------------------------------------------------------------------- slab
function buildSlab(w, m) {
  const shape = new THREE.Shape();
  shape.moveTo(-26, -62); shape.lineTo(26, -62); shape.lineTo(26, -6); shape.lineTo(-26, -6); shape.closePath();
  const holePath = new THREE.Path();
  holePath.absarc(HOLE.x, HOLE.z, HOLE.r, 0, Math.PI * 2, true);
  shape.holes.push(holePath);
  const gratePath = new THREE.Path();
  gratePath.moveTo(GRATE.x1, GRATE.z1); gratePath.lineTo(GRATE.x2, GRATE.z1);
  gratePath.lineTo(GRATE.x2, GRATE.z2); gratePath.lineTo(GRATE.x1, GRATE.z2); gratePath.closePath();
  shape.holes.push(gratePath);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: false }), m.floorRoof);
  roof.rotation.x = Math.PI / 2;
  roof.position.y = ROOF_Y;
  w.scene.add(roof);
  w.addFloor({
    y: ROOF_Y, rect: [-26, -62, 26, -6],
    holes: [
      { circle: [HOLE.x, HOLE.z, HOLE.r] },
      { rect: [GRATE.x1, GRATE.z1, GRATE.x2, GRATE.z2] },
    ],
  });

  // hole rim + shaft lining down into darkness
  const rim = new THREE.Mesh(new THREE.TorusGeometry(HOLE.r, 0.12, 8, 64),
    new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.5, metalness: 0.6 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(HOLE.x, ROOF_Y + 0.02, HOLE.z);
  w.scene.add(rim);
  const lining = new THREE.Mesh(new THREE.CylinderGeometry(HOLE.r, HOLE.r * 0.97, 7.2, 48, 1, true), m.shaftDark);
  lining.position.set(HOLE.x, ROOF_Y - 3.6, HOLE.z);
  w.scene.add(lining);
  const abyss = new THREE.Mesh(new THREE.CircleGeometry(HOLE.r, 48), m.blackout);
  abyss.rotation.x = -Math.PI / 2;
  abyss.position.set(HOLE.x, ROOF_Y - 7.1, HOLE.z);
  w.scene.add(abyss);
  const glow = new THREE.PointLight(0x39ff88, 40, 22, 2);
  glow.position.set(HOLE.x, ROOF_Y - 3, HOLE.z);
  w.scene.add(glow);
  w.dynamic.holeGlow = glow;

  // parapets
  w.box(52.6, 1.3, 0.6, 0, ROOF_Y + 0.65, -6, m.concrete);
  w.box(52.6, 1.3, 0.6, 0, ROOF_Y + 0.65, -62, m.concrete);
  w.box(0.6, 1.3, 56.6, 26, ROOF_Y + 0.65, -34, m.concrete);
  w.box(0.6, 1.3, 56.6, -26, ROOF_Y + 0.65, -34, m.concrete);
}

// ------------------------------------------------------------------ props
function buildProps(w, m) {
  const ac = (x, z, ry = 0) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 1.6), m.metal);
    body.position.y = 0.75; g.add(body);
    const grill = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20),
      new THREE.MeshStandardMaterial({ color: 0x22262c }));
    grill.rotation.x = -Math.PI / 2; grill.position.y = 1.51; g.add(grill);
    g.position.set(x, ROOF_Y, z); g.rotation.y = ry;
    w.scene.add(g);
    w.addCollider(g, 'ac');
  };
  ac(-19, -54, 0.3); ac(-22, -48, 0); ac(18, -56, 1.2); ac(-18, -12, 0.6); ac(14, -10, 0);

  const roofVent = (x, z) => {
    const v = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.4, 12), m.metal);
    p.position.y = 0.7; v.add(p);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.25, 12), m.metalDark);
    cap.position.y = 1.5; v.add(cap);
    v.position.set(x, ROOF_Y, z);
    w.scene.add(v);
    w.addCollider(v, 'vent');
  };
  roofVent(-21, -22); roofVent(-14, -55); roofVent(20, -20); roofVent(10, -58);

  // antenna mast
  const pole = w.cyl(0.08, 0.14, 9, 22, ROOF_Y + 4.5, -58, m.metalDark, { collide: true, seg: 10 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x200000, emissive: 0xff2020, emissiveIntensity: 3 }));
  beacon.position.set(22, ROOF_Y + 9.1, -58);
  w.scene.add(beacon);

  w.pipe(m.pipeGreen, 0.14, [-24, -14], [14, -14], ROOF_Y + 0.25);
  w.pipe(m.pipeRed, 0.1, [-24, -58], [-2, -58], ROOF_Y + 0.2);
  w.box(1.1, 1.1, 1.1, -10, ROOF_Y + 0.55, -52, m.wood);
  w.box(0.9, 0.9, 0.9, -11.2, ROOF_Y + 0.45, -51.2, m.wood);

  // snow drifts
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.95 });
  const drift = (x, z, sx, sz) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), snowMat);
    d.scale.set(sx, 0.5, sz);
    d.position.set(x, ROOF_Y + 0.05, z);
    w.scene.add(d);
  };
  drift(-22, -58, 6, 3); drift(22, -60, 5, 2.5); drift(-23, -10, 5, 3);
  drift(22, -8, 4, 2.2); drift(-24, -34, 3, 8); drift(25, -44, 2.5, 6);
  drift(0, -8.5, 8, 2); drift(-10, -60, 7, 2);
}

// --------------------------------------------------------------- catwalk
function buildCatwalk(w, m) {
  // deck plate from the hole rim to the tower base
  w.box(6.8, 0.25, 1.6, 5.6, ROOF_Y - 0.12, -34, m.metalDark, { collide: false });
  w.addFloor({ y: ROOF_Y, rect: [2.3, -34.8, 8.9, -33.2] });
  // railings
  w.box(6.8, 1.05, 0.08, 5.6, ROOF_Y + 0.52, -34.84, m.rust);
  w.box(6.8, 1.05, 0.08, 5.6, ROOF_Y + 0.52, -33.16, m.rust);
  // support struts into the hole
  w.cyl(0.06, 0.06, 4, 4.6, ROOF_Y - 2.1, -34.6, m.metalDark, { seg: 8 });
  w.cyl(0.06, 0.06, 4, 7.2, ROOF_Y - 2.1, -33.4, m.metalDark, { seg: 8 });
  // base deck wrapped around the tower feet
  w.box(5.4, 0.35, 5.4, HOLE.x, ROOF_Y - 0.17, HOLE.z, m.metalDark, { collide: false });
  w.addFloor({ y: ROOF_Y, rect: [HOLE.x - 2.7, HOLE.z - 2.7, HOLE.x + 2.7, HOLE.z + 2.7] });
  // warning sign at the catwalk mouth
  const sign = w.poster(8.6, ROOF_Y + 1.5, -33.1, Math.PI, 1.3, 0.6, (g, cw, ch) => {
    g.fillStyle = '#7a1d1d'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = 'bold 22px sans-serif'; g.fillText('⚠ SERVICE CLIMB', cw / 2, 46);
    g.font = '15px sans-serif'; g.fillText('AUTHORIZED RIGGERS ONLY', cw / 2, 80);
  });
}

// ------------------------------------------------- the lattice spire + sign
function buildSpire(w, m) {
  const cx = HOLE.x, cz = HOLE.z;
  const BASE_Y = ROOF_Y - 6;       // feet down inside the hole
  const TOP_Y = PLAT_Y;            // deck level
  const LEVELS = 13;
  const PANEL = (TOP_Y - BASE_Y) / LEVELS; // panels land exactly on the deck

  const halfAt = (y) => THREE.MathUtils.lerp(2.7, 1.35, (y - BASE_Y) / (TOP_Y - BASE_Y));

  // ---- instanced struts ----
  const struts = [];
  const addStrut = (a, b, r) => struts.push({ a, b, r });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const corner = (k, y) => {
    const h = halfAt(y);
    const sx = k === 0 || k === 3 ? -1 : 1;
    const sz = k < 2 ? -1 : 1;
    return V(cx + sx * h, y, cz + sz * h);
  };
  for (let i = 0; i < LEVELS; i++) {
    const y0 = BASE_Y + i * PANEL, y1 = y0 + PANEL;
    for (let k = 0; k < 4; k++) {
      addStrut(corner(k, y0), corner(k, y1), 0.13);                      // legs
      addStrut(corner(k, y1), corner((k + 1) % 4, y1), 0.08);            // horizontals
      // X-brace: alternate direction per level for the weave look
      const a = i % 2 ? corner(k, y0) : corner((k + 1) % 4, y0);
      const b = i % 2 ? corner((k + 1) % 4, y1) : corner(k, y1);
      addStrut(a, b, 0.07);
    }
  }
  const geo = new THREE.CylinderGeometry(1, 1, 1, 6);
  const lattice = new THREE.InstancedMesh(geo, m.spireWhite, struts.length);
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  struts.forEach((s, i) => {
    const mid = s.a.clone().add(s.b).multiplyScalar(0.5);
    const dir = s.b.clone().sub(s.a);
    const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    mtx.compose(mid, q, new THREE.Vector3(s.r, len, s.r));
    lattice.setMatrixAt(i, mtx);
  });
  lattice.instanceMatrix.needsUpdate = true;
  w.scene.add(lattice);
  // solid feet disappearing into the dark
  for (let k = 0; k < 4; k++) {
    const c = corner(k, BASE_Y);
    w.cyl(0.3, 0.4, 2, c.x, BASE_Y - 1, c.z, m.spireWhite, { seg: 10 });
  }
  // tower body blocks walking through at deck level
  w.wallSegs.push(
    { ax: cx - 1.6, az: cz - 1.6, bx: cx + 1.6, bz: cz - 1.6, ymin: ROOF_Y, ymax: ROOF_Y + 3 },
    { ax: cx + 1.6, az: cz - 1.6, bx: cx + 1.6, bz: cz + 1.6, ymin: ROOF_Y, ymax: ROOF_Y + 3 },
    { ax: cx + 1.6, az: cz + 1.6, bx: cx - 1.6, bz: cz + 1.6, ymin: ROOF_Y, ymax: ROOF_Y + 3 },
    { ax: cx - 1.6, az: cz + 1.6, bx: cx - 1.6, bz: cz - 1.6, ymin: ROOF_Y, ymax: ROOF_Y + 3 },
  );

  // ---- caged service ladder up the east face ----
  const ladderX = cx + 2.75;
  const railMat = m.pipeYellow;
  for (const dz of [-0.4, 0.4]) {
    w.cyl(0.035, 0.035, TOP_Y - ROOF_Y + 0.6, ladderX, (ROOF_Y + TOP_Y) / 2 + 0.3, cz + dz, railMat, { seg: 8 });
  }
  const rungCount = Math.floor((TOP_Y - ROOF_Y) / 0.5);
  const rungGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.8, 6);
  const rungs = new THREE.InstancedMesh(rungGeo, railMat, rungCount);
  const rq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  for (let i = 0; i < rungCount; i++) {
    mtx.compose(new THREE.Vector3(ladderX, ROOF_Y + 0.4 + i * 0.5, cz), rq, new THREE.Vector3(1, 1, 1));
    rungs.setMatrixAt(i, mtx);
  }
  rungs.instanceMatrix.needsUpdate = true;
  w.scene.add(rungs);
  // cage hoops
  for (let y = ROOF_Y + 3; y < TOP_Y - 1; y += 4) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 6, 18, Math.PI), m.metal);
    hoop.rotation.z = Math.PI / 2;
    hoop.rotation.y = Math.PI / 2;
    hoop.position.set(ladderX, y, cz);
    w.scene.add(hoop);
  }
  w.addLadder(ladderX - 0.65, ROOF_Y, cz - 0.55, ladderX + 0.3, TOP_Y + 0.6, cz + 0.55);

  // ---- top platform ----
  w.box(7, 0.3, 7, cx, TOP_Y - 0.15, cz, m.metalDark, { collide: false });
  w.addFloor({ y: TOP_Y, rect: [cx - 3.5, cz - 3.5, cx + 3.5, cz + 3.5] });
  // railings (gaps: east = ladder arrival, west = rappel anchor)
  const rail = (x, z, wd, dd) => w.box(wd, 1.05, dd, x, TOP_Y + 0.52, z, m.rust);
  rail(cx, cz - 3.5, 7, 0.09);
  rail(cx, cz + 3.5, 7, 0.09);
  rail(cx - 3.5, cz - 2.15, 0.09, 2.7);
  rail(cx - 3.5, cz + 2.15, 0.09, 2.7);
  rail(cx + 3.5, cz - 2.15, 0.09, 2.7);
  rail(cx + 3.5, cz + 2.15, 0.09, 2.7);

  // ---- the huge green neon box sign, above the platform ----
  const signTex = canvasTex(512, 512, (g, cw, ch) => {
    g.fillStyle = '#0d5e2c'; g.fillRect(0, 0, cw, ch);
    const grad = g.createRadialGradient(cw / 2, ch / 2, 60, cw / 2, ch / 2, 300);
    grad.addColorStop(0, 'rgba(120,255,170,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, cw, ch);
    // A's mark: a bold white lambda with a small heart
    g.strokeStyle = '#ffffff'; g.lineWidth = 52; g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = '#b6ffd9'; g.shadowBlur = 40;
    g.beginPath();
    g.moveTo(120, 420); g.lineTo(256, 96); g.lineTo(392, 420);
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.font = 'bold 74px monospace';
    g.textAlign = 'center';
    g.fillText('♥', 256, 400);
  });
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.5,
    color: 0x111111,
  });
  const dark = m.metalDark;
  // dim green underside so the box reads as the sign from directly below
  const bottomMat = new THREE.MeshStandardMaterial({ color: 0x0a2416, emissive: 0x39ff88, emissiveIntensity: 0.4, roughness: 0.8 });
  const signBox = new THREE.Mesh(new THREE.BoxGeometry(6.4, 6.4, 6.4),
    [signMat, signMat, dark, bottomMat, signMat, signMat]);
  signBox.position.set(cx, TOP_Y + 11.8, cz);
  w.scene.add(signBox);
  w.dynamic.signMats = [signMat];
  // slim support mast through the sign + crown
  w.cyl(0.22, 0.32, 26, cx, TOP_Y + 13, cz, m.spireWhite, { seg: 12 });
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 2.2, 12, 1, true), m.spireWhite);
  crown.position.set(cx, TOP_Y + 24.5, cz);
  w.scene.add(crown);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x200000, emissive: 0xff2020, emissiveIntensity: 3.5 }));
  beacon.position.set(cx, TOP_Y + 28.6, cz);
  w.scene.add(beacon);
  w.dynamic.spireBeacon = beacon;

  // green wash lights (lit on the roof reveal)
  const g1 = new THREE.PointLight(0x39ff88, 0, 60, 1.9);
  g1.position.set(cx + 10, TOP_Y + 10, cz);
  w.scene.add(g1);
  const g2 = new THREE.PointLight(0x39ff88, 0, 45, 2.0);
  g2.position.set(cx, ROOF_Y + 14, cz);
  w.scene.add(g2);
  w.dynamic.signLights = [g1, g2];
  // small warm work lights tucked at two platform corners
  for (const [dx, dz] of [[-3.1, -3.1], [3.1, 3.1]]) {
    const dl = new THREE.PointLight(0xffe0b0, 3.5, 6, 1.8);
    dl.position.set(cx + dx, TOP_Y + 0.6, cz + dz);
    w.scene.add(dl);
  }

  // ---- rappel anchor + line ----
  const anchor = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 10), m.rust);
  post.position.y = 0.55; anchor.add(post);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16), m.metal);
  ring.position.y = 1.0; anchor.add(ring);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 18), new THREE.MeshStandardMaterial({ color: 0x223a4f, roughness: 0.9 }));
  coil.rotation.x = Math.PI / 2; coil.position.y = 0.2; anchor.add(coil);
  anchor.position.set(cx - 3.15, TOP_Y, cz);
  w.scene.add(anchor);
  w.dynamic.anchor = anchor;
  // the hanging line — appears when you clip in
  const rope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, TOP_Y - (ROOF_Y - 8), 6),
    new THREE.MeshStandardMaterial({ color: 0x2b4a63, roughness: 0.9 }));
  rope.position.set(cx - 4.0, (TOP_Y + ROOF_Y - 8) / 2, cz);
  rope.visible = false;
  w.scene.add(rope);
  w.dynamic.rope = rope;
}
