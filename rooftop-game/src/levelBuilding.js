// The tower interior route: street plaza → service alley → lobby (sleeping
// guard, elevator card) → elevator → office floor 43 (stair code + maint
// card) → stairwell (patrol) → star-shaped two-story mechanical crown
// (patrol + CCTV) → vent box → crawl duct → outdoor light-well → stuck grate.
import * as THREE from 'three';
import { state, emit } from './state.js';
import * as audio from './audio.js';
import { canvasTex, LIGHTWELL, GRATE } from './world.js';

export const OFFICE_Y = 30;
export const MECH_Y = 38;
export const STAR = { cx: 0, cz: -34, R1: 20, R2: 12, points: 8, coreR: 9 };

export function starPolygon() {
  const pts = [];
  for (let k = 0; k < STAR.points; k++) {
    const a = (k / STAR.points) * Math.PI * 2;
    const b = a + Math.PI / STAR.points;
    pts.push([STAR.cx + Math.cos(a) * STAR.R1, STAR.cz + Math.sin(a) * STAR.R1]);
    pts.push([STAR.cx + Math.cos(b) * STAR.R2, STAR.cz + Math.sin(b) * STAR.R2]);
  }
  return pts;
}

export function buildBuilding(w) {
  const m = w.mats;
  buildStreet(w, m);
  buildLobby(w, m);
  buildOffice(w, m);
  buildStairs(w, m);
  buildMech(w, m);
  buildVentRoute(w, m);
}

// ------------------------------------------------------------------ street
function buildStreet(w, m) {
  // plaza + alley ground
  w.box(80, 0.3, 80, 0, -0.15, -4, m.street, { collide: false });
  w.addFloor({ y: 0, rect: [-40, -44, 40, 32] });

  // ------- tower facade, ground floor (z=-4 face) -------
  // solid flanks
  w.box(8, 7, 0.5, -18, 3.5, -4, m.concreteDark, { occlude: true });
  w.box(8, 7, 0.5, 18, 3.5, -4, m.concreteDark, { occlude: true });
  // glass curtain panels
  w.box(11, 7, 0.3, -8.5, 3.5, -4, m.glass, { occlude: false });
  w.box(11, 7, 0.3, 8.5, 3.5, -4, m.glass, { occlude: false });
  // revolving door (locked)
  const rev = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.4, 20, 1, true), m.glass);
  rev.add(drum);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 3.2, 0.06), m.glass);
    fin.rotation.y = i * Math.PI / 2;
    fin.position.y = 0;
    const holder = new THREE.Group(); holder.rotation.y = i * Math.PI / 2;
    const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.2, 1.45), m.metalDark);
    f2.position.z = 0.75; holder.add(f2);
    rev.add(holder);
  }
  rev.position.set(0, 1.7, -4);
  w.scene.add(rev);
  w.addCollider(rev, 'revolvingDoor');
  w.interactable(rev, () => (state.sideDoorOpen ? null : 'Revolving door (locked)'), () => {
    state.triedFrontDoor = true;
    audio.metalCreak();
    emit('frontdoor');
  });
  // entrance canopy + tower name
  w.box(8, 0.4, 3, 0, 6.6, -2.6, m.metalDark, { collide: false });
  const name = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.2),
    new THREE.MeshStandardMaterial({
      map: canvasTex(512, 64, (g, cw, ch) => {
        g.fillStyle = '#10151c'; g.fillRect(0, 0, cw, ch);
        g.fillStyle = '#cfe0d6'; g.font = 'bold 40px serif'; g.textAlign = 'center';
        g.fillText('N O R T H P O I N T', cw / 2, 46);
      }),
      emissive: 0x8fb8a0, emissiveIntensity: 0.6,
    }));
  name.position.set(0, 5.6, -3.7);
  w.scene.add(name);

  // facade sides at ground level
  w.box(0.5, 7, 60, -22, 3.5, -34, m.concreteDark, { occlude: true });
  // east side: alley wall with service door gap at z[-17,-15]
  w.box(0.5, 7, 11, 22, 3.5, -9.5, m.concreteDark, { occlude: true });
  w.box(0.5, 7, 47, 22, 3.5, -40.5, m.concreteDark, { occlude: true });
  w.box(0.5, 4, 2, 22, 5, -16, m.concreteDark, { occlude: true }); // header over door
  w.box(44.5, 7, 0.5, 0, 3.5, -64, m.concreteDark, { occlude: true });

  // the service door itself
  const svc = w.slidingDoor(2, 3, 22, 1.5, -16, { ry: Math.PI / 2 });
  w.dynamic.serviceDoor = svc;
  const svcLight = new THREE.PointLight(0xffd9a0, 14, 8, 1.8);
  svcLight.position.set(23, 3.6, -16);
  w.scene.add(svcLight);
  const svcSign = w.poster(22.3, 3.2, -16, Math.PI / 2, 1.5, 0.5, (g, cw, ch) => {
    g.fillStyle = '#233028'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#8fd8a8'; g.font = 'bold 26px monospace'; g.textAlign = 'center';
    g.fillText('SERVICE — B1', cw / 2, ch / 2 + 10);
  });
  w.interactable(svc.mesh, () => (state.sideDoorOpen ? null : 'Try the service door'), () => {
    state.sideDoorOpen = true;
    w.openDoor(svc);
    emit('sidedoor');
  });
  // dumpster + alley clutter
  const dump = w.box(2.6, 1.5, 1.4, 26, 0.75, -12, new THREE.MeshStandardMaterial({ color: 0x274d33, roughness: 0.8 }));
  w.box(1, 0.8, 1, 25.4, 0.4, -19, m.wood);
  w.box(0.8, 1.1, 0.8, 27, 0.55, -18.4, m.wood);
  // alley end wall + plaza fence
  w.box(8.5, 3, 0.4, 26.2, 1.5, -30, m.concreteDark);
  w.box(0.4, 1.2, 62, 30, 0.6, -3, m.concreteDark);
  w.box(60, 1.2, 0.4, 0, 0.6, 28, m.concreteDark);

  // ------- facade above ground: window grid into the fog -------
  const winTex = canvasTex(256, 512, (g, cw, ch) => {
    g.fillStyle = '#11151b'; g.fillRect(0, 0, cw, ch);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) {
      const lit = Math.random() < 0.28;
      g.fillStyle = lit ? '#5a6f8e' : '#1c222b';
      g.fillRect(8 + c * 31, 8 + r * 31, 23, 21);
    }
  });
  const facMat = new THREE.MeshStandardMaterial({ map: winTex, emissive: 0x42536b, emissiveMap: winTex, emissiveIntensity: 0.5, roughness: 0.7 });
  w.box(44, 31, 0.6, 0, 22.5, -4.2, facMat, { collide: false });
  w.box(44, 31, 0.6, 0, 22.5, -63.8, facMat, { collide: false });
  w.box(0.6, 31, 60, -21.8, 22.5, -34, facMat, { collide: false });
  w.box(0.6, 31, 60, 21.8, 22.5, -34, facMat, { collide: false });

  // street lamps + planters + benches
  const lamp = (x, z) => {
    const pole = w.cyl(0.07, 0.1, 5, x, 2.5, z, m.metalDark, { collide: true, seg: 8 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0xffd9a0, emissiveIntensity: 2 }));
    head.position.set(x, 5.1, z);
    w.scene.add(head);
    const l = new THREE.PointLight(0xffd9a0, 40, 18, 1.8);
    l.position.set(x, 5, z);
    w.scene.add(l);
  };
  lamp(-10, 8); lamp(10, 8); lamp(-24, -2); lamp(24, 2); lamp(0, 20);
  [[-16, 12], [16, 12], [-6, 16], [6, 16]].forEach(([x, z]) => {
    w.box(2.4, 0.6, 2.4, x, 0.3, z, m.concreteDark);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x1d3a26, roughness: 1 }));
    bush.scale.y = 0.7; bush.position.set(x, 0.95, z);
    w.scene.add(bush);
  });

  // distant city silhouettes (visual only, mostly fog-hidden)
  [[-52, -20, 14, 40], [56, -30, 18, 55], [-60, -50, 20, 34], [50, 15, 12, 28], [-45, 22, 10, 24]].forEach(([x, z, s, h]) => {
    w.box(s, h, s, x, h / 2, z, facMat, { collide: false });
  });
}

// ------------------------------------------------------------------- lobby
function buildLobby(w, m) {
  // floor finish + ceiling
  w.box(28, 0.12, 20, 0, 0.06, -14, m.floorLobby, { collide: false });
  w.addFloor({ y: 0.12, rect: [-14, -24, 14, -4] });
  w.box(28.6, 0.3, 20.6, 0, 7.15, -14, m.concreteDark, { collide: false });

  // walls
  w.box(0.4, 7, 20.6, -14, 3.5, -14, m.concrete, { occlude: true });
  // east wall with corridor gap z[-18,-14]
  w.box(0.4, 7, 10, 14, 3.5, -9, m.concrete, { occlude: true });
  w.box(0.4, 7, 6, 14, 3.5, -21, m.concrete, { occlude: true });
  w.box(0.4, 3.8, 4, 14, 5.1, -16, m.concrete, { occlude: true });
  // back wall with elevator openings at x±4 (openings x ±[2.7, 5.3], h 2.8)
  w.box(8.7, 7, 0.4, -9.65, 3.5, -24, m.concrete, { occlude: true });
  w.box(5.4, 7, 0.4, 0, 3.5, -24, m.concrete, { occlude: true });
  w.box(8.7, 7, 0.4, 9.65, 3.5, -24, m.concrete, { occlude: true });
  w.box(2.6, 4.2, 0.4, -4, 4.9, -24, m.concrete, { occlude: true });
  w.box(2.6, 4.2, 0.4, 4, 4.9, -24, m.concrete, { occlude: true });

  // service corridor (alley door → lobby)
  w.box(8, 0.12, 4.6, 18, 0.06, -16, m.floorInt, { collide: false });
  w.box(8, 3.2, 0.3, 18, 1.6, -14, m.concreteDark, { occlude: true });
  w.box(8, 3.2, 0.3, 18, 1.6, -18, m.concreteDark, { occlude: true });
  w.box(8.6, 0.2, 4.6, 18, 3.3, -16, m.concreteDark, { collide: false });
  w.lampFixture(18, 3.1, -16, 1.4, true, 0xffe6c0, 0.6, 9);

  // reception desk + NORTHPOINT letters
  w.box(5, 1.15, 0.6, 0, 0.6, -13, m.wood);
  w.box(0.6, 1.15, 2.2, -2.3, 0.6, -14.2, m.wood);
  w.box(0.6, 1.15, 2.2, 2.3, 0.6, -14.2, m.wood);
  const brand = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6),
    new THREE.MeshStandardMaterial({
      map: canvasTex(512, 92, (g, cw, ch) => {
        g.fillStyle = '#141a22'; g.fillRect(0, 0, cw, ch);
        g.fillStyle = '#a9d8bc'; g.font = 'bold 46px serif'; g.textAlign = 'center';
        g.fillText('NORTHPOINT UTILITY', cw / 2, 62);
      }),
      emissive: 0x77a888, emissiveIntensity: 0.7,
    }));
  brand.position.set(0, 4.2, -23.7);
  w.scene.add(brand);

  // the elevator card, on the desk beside the sleeping guard
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x2266aa, emissiveIntensity: 0.6 }));
  card.position.set(1.4, 1.22, -13.3);
  w.scene.add(card);
  w.interactable(card, () => (state.hasLobbyCard ? null : 'Take elevator card (quietly)'), () => {
    state.hasLobbyCard = true;
    card.visible = false;
    audio.pickup();
    emit('lobbycard');
  });
  // guard's coffee + monitor
  w.cyl(0.05, 0.045, 0.11, -0.8, 1.22, -13.4, new THREE.MeshStandardMaterial({ color: 0x9a3333 }));
  const mon = w.box(0.6, 0.42, 0.05, -0.2, 1.5, -13.6,
    new THREE.MeshStandardMaterial({ color: 0x0c0f13, emissive: 0x14202c, emissiveIntensity: 1.2 }), { collide: false });
  mon.rotation.y = Math.PI;

  // turnstiles + the guard's chair
  for (const x of [-4.5, -1.5, 1.5, 4.5]) w.box(0.5, 1.0, 1.6, x, 0.5, -9, m.metal);
  w.box(0.7, 0.55, 0.7, 0, 0.28, -14.6, m.metalDark);

  // elevator: functional cab (east, x=4)
  w.box(0.3, 3.2, 3.4, 2.55, 1.6, -26, m.metal, { occlude: true });
  w.box(0.3, 3.2, 3.4, 5.45, 1.6, -26, m.metal, { occlude: true });
  w.box(3.2, 3.2, 0.3, 4, 1.6, -27.7, m.metal, { occlude: true });
  w.box(3.2, 0.2, 3.6, 4, 3.25, -26, m.metalDark, { collide: false });
  const cabLight = new THREE.PointLight(0xfff2dd, 10, 6, 1.8);
  cabLight.position.set(4, 3, -26);
  w.scene.add(cabLight);
  const doorL = w.slidingDoor(2.6, 2.8, 4, 1.5, -24.1, { ry: 0 });
  w.dynamic.elevatorDoor = doorL;
  const reader = w.cardReader(6.1, 1.5, -23.7);
  w.dynamic.elevatorReader = reader;
  w.interactable(reader.group, () => {
    if (state.elevatorUsed || doorL.open) return null;
    return state.hasLobbyCard ? 'Swipe elevator card' : 'Elevator (card required)';
  }, () => {
    if (!state.hasLobbyCard) { audio.keypadFail(); emit('reader:nocard'); return; }
    audio.keypadOk();
    reader.led.emissive.setHex(0x00ff44);
    w.openDoor(doorL);
    emit('elevatoropen');
  });
  // panel inside the cab
  const panel = w.box(0.3, 0.5, 0.08, 5.25, 1.5, -26.6,
    new THREE.MeshStandardMaterial({ color: 0x2a2f36, emissive: 0x223344, emissiveIntensity: 0.5 }), { collide: false });
  w.interactable(panel, () => (state.elevatorUsed ? null : 'Press 43 — MECHANICAL ACCESS'), () => {
    emit('elevator:ride');
  });
  // dummy elevator (west)
  const dummy = w.box(2.6, 2.8, 0.15, -4, 1.5, -24.05, m.doorMat, { occlude: true });
  const oos = w.poster(-4, 2.4, -23.8, 0, 1.6, 0.35, (g, cw, ch) => {
    g.fillStyle = '#4d4d20'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#ffe9a0'; g.font = 'bold 24px monospace'; g.textAlign = 'center';
    g.fillText('OUT OF SERVICE', cw / 2, ch / 2 + 9);
  });
  w.interactable(dummy, () => 'Elevator (out of service)', () => { audio.keypadFail(); });

  // lobby lighting — warm pendants
  w.lampFixture(-7, 6.8, -10, 2.2, true, 0xffe6c0, 1.2, 16);
  w.lampFixture(7, 6.8, -10, 2.2, true, 0xffe6c0, 1.2, 16);
  w.lampFixture(-7, 6.8, -19, 2.2, true, 0xffe6c0, 1.2, 16);
  w.lampFixture(7, 6.8, -19, 2.2, true, 0xffe6c0, 1.2, 16);
  w.lampFixture(0, 5.9, -14, 1.6, true, 0xffe6c0, 0.8, 10);
}

// ------------------------------------------------------------ office floor
function buildOffice(w, m) {
  const Y = OFFICE_Y;
  // slab + ceiling
  w.box(40.6, 0.3, 40, 0, Y - 0.15, -27.7, m.floorOffice, { collide: false });
  w.addFloor({ y: Y, rect: [-20, -47.6, 20, -8] });
  w.box(40.6, 0.25, 40, 0, Y + 3.5, -27.7, m.concreteDark, { collide: false });

  // perimeter walls
  w.box(0.4, 3.6, 40, -20, Y + 1.7, -27.7, m.concrete, { occlude: true });
  w.box(0.4, 3.6, 40, 20, Y + 1.7, -27.7, m.concrete, { occlude: true });
  // north wall z=-44 with elevator opening at x[2.7,5.3]
  w.box(22.7, 3.6, 0.4, -8.65, Y + 1.7, -44, m.concrete, { occlude: true });
  w.box(14.7, 3.6, 0.4, 12.65, Y + 1.7, -44, m.concrete, { occlude: true });
  w.box(2.6, 0.8, 0.4, 4, Y + 3.1, -44, m.concrete, { occlude: true });
  // south wall z=-8: window band over city fog
  w.box(41, 0.9, 0.4, 0, Y + 0.45, -8, m.concrete, { occlude: true });
  w.box(41, 0.5, 0.4, 0, Y + 3.35, -8, m.concrete, { occlude: true });
  const winBand = w.box(40, 2.2, 0.2, 0, Y + 2.0, -8.05, w.windowMat(0.35), { occlude: false });
  w.wallSegs.push({ ax: -20, az: -8, bx: 20, bz: -8, ymin: Y, ymax: Y + 3.6 });

  // elevator cab (arrival) — doorway stands open
  w.box(0.3, 3.2, 3.4, 2.55, Y + 1.6, -46, m.metal, { occlude: true });
  w.box(0.3, 3.2, 3.4, 5.45, Y + 1.6, -46, m.metal, { occlude: true });
  w.box(3.2, 3.2, 0.3, 4, Y + 1.6, -47.6, m.metal, { occlude: true });
  const cabLight = new THREE.PointLight(0xfff2dd, 10, 6, 1.8);
  cabLight.position.set(4, Y + 3, -46);
  w.scene.add(cabLight);
  const floorSign = w.poster(6.8, Y + 2.4, -43.8, 0, 1.4, 0.5, (g, cw, ch) => {
    g.fillStyle = '#233028'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#8fd8a8'; g.font = 'bold 30px monospace'; g.textAlign = 'center';
    g.fillText('43 — OPS', cw / 2, ch / 2 + 10);
  });

  // ---- cubicle pods ----
  const partMat = new THREE.MeshStandardMaterial({ color: 0x5b6570, roughness: 0.9 });
  const pod = (x, z) => {
    w.box(4.6, 1.5, 0.1, x, Y + 0.75, z, partMat);
    w.box(0.1, 1.5, 3.6, x, Y + 0.75, z, partMat);
    for (const [dx, dz] of [[-1.2, -0.95], [1.2, -0.95], [-1.2, 0.95], [1.2, 0.95]]) {
      w.box(1.7, 0.08, 0.8, x + dx, Y + 0.78, z + dz, m.wood, { collide: false });
      const mon = w.box(0.55, 0.38, 0.05, x + dx, Y + 1.2, z + dz - 0.2 * Math.sign(dz),
        new THREE.MeshStandardMaterial({ color: 0x0c0f13, emissive: 0x101820, emissiveIntensity: 0.8 }), { collide: false });
      mon.rotation.y = dz > 0 ? Math.PI : 0;
    }
  };
  pod(-10, -36); pod(0, -36); pod(10, -36);
  pod(-10, -26); pod(0, -26); pod(10, -26);
  pod(-4, -17); pod(8, -17);

  // the desk note (stair code hint)
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.28),
    new THREE.MeshStandardMaterial({
      map: canvasTex(128, 96, (g, cw, ch) => {
        g.fillStyle = '#d8d2c0'; g.fillRect(0, 0, cw, ch);
        g.fillStyle = '#333'; g.font = '11px cursive';
        g.fillText('stair code =', 12, 26);
        g.fillText('year the tower', 12, 44);
        g.fillText('opened. quit', 12, 62);
        g.fillText('forgetting it -M', 12, 80);
      }),
    }));
  note.rotation.x = -Math.PI / 2; note.rotation.z = 0.35;
  note.position.set(-1.2, Y + 0.83, -25.2);
  w.scene.add(note);
  w.interactable(note, () => 'Read note', () => {
    audio.paperRustle();
    state.readOfficeNote = true;
    emit('note');
    emit('ui:note', { html: `Stair code = <b>the year this tower opened</b>.<br><br>Quit forgetting it, people.<br><br>&nbsp;&nbsp;— M.` });
  });

  // ---- break room (NE) with the 1987 anniversary poster ----
  w.box(0.15, 3.6, 4.5, 12, Y + 1.7, -10.2, partMat, { occlude: true });
  w.box(0.15, 3.6, 2.0, 12, Y + 1.7, -15, partMat, { occlude: true });
  const fridge = w.box(1.0, 1.9, 0.9, 18.9, Y + 0.95, -9.2, m.metal);
  const vend = w.box(1.2, 2.0, 0.8, 16.8, Y + 1.0, -8.8,
    new THREE.MeshStandardMaterial({ color: 0x18222c, emissive: 0x2a5570, emissiveIntensity: 0.9 }));
  w.box(1.6, 0.75, 1.6, 15.5, Y + 0.37, -12.5, m.wood);
  const anniversary = w.poster(19.75, Y + 1.9, -12, -Math.PI / 2, 1.7, 2.1, (g, cw, ch) => {
    g.fillStyle = '#12303f'; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = '#e8c860'; g.lineWidth = 6; g.strokeRect(10, 10, cw - 20, ch - 20);
    g.fillStyle = '#e8c860'; g.textAlign = 'center'; g.font = 'bold 26px serif';
    g.fillText('NORTHPOINT', cw / 2, 66);
    g.fillText('UTILITY TOWER', cw / 2, 100);
    g.fillStyle = '#cfe6d8'; g.font = '15px serif';
    g.fillText('proudly serving the city', cw / 2, 152);
    g.fillStyle = '#fff'; g.font = 'bold 50px serif';
    g.fillText('SINCE', cw / 2, 208);
    g.fillStyle = '#e8c860'; g.font = 'bold 62px serif';
    g.fillText('1987', cw / 2, 272);
  });
  w.interactable(anniversary, () => '“…SINCE 1987”', () => { state.sawPoster = true; emit('poster'); });

  // ---- mail room (NW) with the maintenance keycard ----
  w.box(0.15, 3.6, 4.5, -12, Y + 1.7, -10.2, partMat, { occlude: true });
  w.box(0.15, 3.6, 2.0, -12, Y + 1.7, -15, partMat, { occlude: true });
  // pigeonholes
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    w.box(0.55, 0.4, 0.5, -19 + c * 0.62, Y + 1.0 + r * 0.46, -8.6, m.wood, { collide: false });
  }
  w.box(3.4, 0.9, 0.7, -16, Y + 0.45, -12.5, m.wood);
  const maint = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xaa5500, emissiveIntensity: 0.6 }));
  maint.position.set(-16, Y + 0.92, -12.4);
  w.scene.add(maint);
  w.interactable(maint, () => (state.hasMaintCard ? null : 'Take MAINTENANCE keycard'), () => {
    state.hasMaintCard = true;
    maint.visible = false;
    audio.pickup();
    emit('maintcard');
  });
  const mailSign = w.poster(-12.1, Y + 2.6, -12, Math.PI / 2, 1.2, 0.4, (g, cw, ch) => {
    g.fillStyle = '#233028'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#8fd8a8'; g.font = 'bold 24px monospace'; g.textAlign = 'center';
    g.fillText('MAIL / FACILITIES', cw / 2, ch / 2 + 8);
  });

  // office lighting grid + side rooms
  for (const x of [-12, 0, 12]) for (const z of [-38, -28, -17]) {
    w.lampFixture(x, Y + 3.4, z, 2.0, true, 0xdde8f5, 0.9, 13);
  }
  w.lampFixture(16, Y + 3.4, -12, 1.6, true, 0xffe6c0, 0.8, 11);
  w.lampFixture(-16, Y + 3.4, -12, 1.6, true, 0xffe6c0, 0.8, 11);
}

// -------------------------------------------------------------- stairwell
export const STAIRWELL = { x1: -18, x2: -11, z1: -37.5, z2: -30.5 };
function buildStairs(w, m) {
  const S = STAIRWELL;
  const Y = OFFICE_Y;
  // shaft walls, office level up to mech ceiling
  // south wall (office side) with keypad door gap x[-15.6,-13.4]
  w.box(2.4, 15.8, 0.35, -16.8, Y + 7.9, S.z2, m.concreteDark, { occlude: true });
  w.box(2.4, 15.8, 0.35, -12.2, Y + 7.9, S.z2, m.concreteDark, { occlude: true });
  w.box(2.2, 13.9, 0.35, -14.5, Y + 9.4, S.z2, m.concreteDark, { occlude: true }); // above door
  // west / north walls
  w.box(0.35, 15.8, 7.2, S.x1, Y + 7.9, -34, m.concreteDark, { occlude: true });
  w.box(7.2, 15.8, 0.35, -14.5, Y + 7.9, S.z1, m.concreteDark, { occlude: true });
  // east wall with mech-level door gap z[-33.4,-31.2] above y=MECH_Y
  w.box(0.35, 8, 7.2, S.x2, Y + 4, -34, m.concreteDark, { occlude: true });   // below mech floor
  w.box(0.35, 7.8, 4.1, S.x2, MECH_Y + 3.9, -35.45, m.concreteDark, { occlude: true });
  w.box(0.35, 7.8, 0.7, S.x2, MECH_Y + 3.9, -30.85, m.concreteDark, { occlude: true });
  w.box(0.35, 5.3, 2.2, S.x2, MECH_Y + 5.15, -32.3, m.concreteDark, { occlude: true }); // above mech door

  // keypad door office→stairs
  const stairDoor = w.slidingDoor(2.2, 2.5, -14.5, Y + 1.25, S.z2, { label: 'STAIRS — B' });
  w.dynamic.stairDoor = stairDoor;
  const kp = w.keypadMesh(-12.9, Y + 1.5, S.z2 + 0.25);
  w.interactable(kp, () => (state.stairsDoorOpen ? null : 'Use keypad'), () => emit('ui:keypad'));

  // mech door at top (maintenance card)
  const mechDoor = w.slidingDoor(2.2, 2.5, S.x2, MECH_Y + 1.25, -32.3, { ry: Math.PI / 2, label: 'MECHANICAL' });
  w.dynamic.mechDoor = mechDoor;
  const mReader = w.cardReader(S.x2 - 0.25, MECH_Y + 1.5, -30.9, -Math.PI / 2);
  w.interactable(mReader.group, () => {
    if (state.mechDoorOpen) return null;
    return state.hasMaintCard ? 'Swipe MAINT card' : 'Card reader (MAINT card required)';
  }, () => {
    if (!state.hasMaintCard) { audio.keypadFail(); emit('reader:nocard'); return; }
    audio.keypadOk();
    mReader.led.emissive.setHex(0x00ff44);
    state.mechDoorOpen = true;
    w.openDoor(mechDoor);
    emit('mechdoor');
  });

  // flights (step boxes — the controller steps up 0.45m)
  const stepMat = m.concreteDark;
  // flight 1: along west side, heading north, 30 → 33.72
  for (let i = 0; i < 12; i++) {
    const top = Y + (i + 1) * 0.31;
    w.box(2.8, 0.31, 0.6, -16.2, top - 0.155, -31.3 - i * 0.44, stepMat);
  }
  // mid landing at 33.72
  w.box(6.6, 0.3, 1.7, -14.5, Y + 3.72 - 0.15, -36.5, stepMat);
  w.addFloor({ y: Y + 3.72, rect: [-17.8, -37.4, -11.2, -35.65] });
  // flight 2: along east side, heading south, 33.72 → 37.65, then top landing at 38
  for (let i = 0; i < 11; i++) {
    const top = Y + 3.72 + (i + 1) * 0.357;
    w.box(2.8, 0.357, 0.6, -12.8, top - 0.178, -35.4 + i * 0.44, stepMat);
  }
  w.box(3.2, 0.35, 2.6, -12.8, 37.82, -31.9, stepMat);
  w.addFloor({ y: 38, rect: [-14.4, -33.2, -11.2, -30.6] });
  // stairwell lights
  w.lampFixture(-14.5, Y + 3.3, -32, 1.2, true, 0xcfe4ff, 0.6, 8);
  w.lampFixture(-14.5, Y + 7.4, -36, 1.2, true, 0xcfe4ff, 0.6, 8);
  w.lampFixture(-14.5, MECH_Y + 3.0, -32, 1.2, true, 0xcfe4ff, 0.6, 8);
}

// ------------------------------------------- star-shaped mechanical crown
function buildMech(w, m) {
  const Y = MECH_Y;
  const H = 7.8; // two-story
  const poly = starPolygon();

  // floor: star with the filled core punched out (the core is solid)
  const floorShape = new THREE.Shape();
  poly.forEach(([x, z], i) => (i ? floorShape.lineTo(x, z) : floorShape.moveTo(x, z)));
  floorShape.closePath();
  const corePath = new THREE.Path();
  corePath.absarc(STAR.cx, STAR.cz, STAR.coreR, 0, Math.PI * 2, true);
  floorShape.holes.push(corePath);
  const floorMesh = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), m.floorInt);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = Y;
  w.scene.add(floorMesh);
  const ceilMesh = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), m.concreteDark);
  ceilMesh.rotation.x = Math.PI / 2;
  ceilMesh.position.y = Y + H;
  w.scene.add(ceilMesh);
  w.addFloor({ y: Y, poly, holes: [{ circle: [STAR.cx, STAR.cz, STAR.coreR] }] });

  // outer star walls with window bands — the east tip is cut for the duct
  const winMat = w.windowMat(0.5);
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    // segments touching the east tip vertex (poly[0] = (20,-34)) get a gap
    let t0 = 0, t1 = 1;
    if ((i + 1) % poly.length === 0) t1 = 0.76;  // …→ tip
    if (i === 0) t0 = 0.24;                       // tip → …
    const sax = ax + (bx - ax) * t0, saz = az + (bz - az) * t0;
    const sbx = ax + (bx - ax) * t1, sbz = az + (bz - az) * t1;
    w.wall(sax, saz, sbx, sbz, Y, Y + H, m.concreteDark);
    // two window bands per segment
    const midx = (sax + sbx) / 2, midz = (saz + sbz) / 2;
    const len = Math.hypot(sbx - sax, sbz - saz);
    // inward normal (toward star center)
    const nx = STAR.cx - midx, nz = STAR.cz - midz;
    const nl = Math.hypot(nx, nz) || 1;
    for (const bandY of [Y + 2.2, Y + 5.6]) {
      const wm = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.82, 1.7), winMat);
      wm.position.set(midx + (nx / nl) * 0.22, bandY, midz + (nz / nl) * 0.22);
      wm.rotation.y = -Math.atan2(sbz - saz, sbx - sax) + (Math.PI / 2) * Math.sign((sbx - sax) * nz - (sbz - saz) * nx || 1);
      // orient plane to face inward
      wm.lookAt(STAR.cx, bandY, STAR.cz);
      w.scene.add(wm);
    }
  }

  // the filled middle: core drum (12-gon walls) + warning door sign
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x525a63, roughness: 0.6, metalness: 0.5 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, b = ((i + 1) / 12) * Math.PI * 2;
    w.wall(STAR.cx + Math.cos(a) * STAR.coreR, STAR.cz + Math.sin(a) * STAR.coreR,
           STAR.cx + Math.cos(b) * STAR.coreR, STAR.cz + Math.sin(b) * STAR.coreR,
           Y, Y + H, coreMat);
  }
  const coreSign = w.poster(STAR.cx - STAR.coreR - 0.05, Y + 1.9, STAR.cz, Math.PI * 1.5, 1.6, 0.9, (g, cw, ch) => {
    g.fillStyle = '#7a1d1d'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = 'bold 26px sans-serif'; g.fillText('⚠ CORE ACCESS', cw / 2, 52);
    g.font = '17px sans-serif'; g.fillText('SEALED — DO NOT ENTER', cw / 2, 92);
    g.fillText('structural anomaly', cw / 2, 120);
  });
  coreSign.lookAt(STAR.cx - STAR.coreR - 6, Y + 1.9, STAR.cz);
  // low thrum inside the core
  const coreGlow = new THREE.PointLight(0x39ff88, 8, 12, 2);
  coreGlow.position.set(STAR.cx, Y + 5, STAR.cz);
  w.scene.add(coreGlow);

  // decorative mezzanine catwalk ring around the core (second storey feel)
  const ringR = STAR.coreR + 1.4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, b = ((i + 1) / 12) * Math.PI * 2;
    const ax = STAR.cx + Math.cos(a) * ringR, az = STAR.cz + Math.sin(a) * ringR;
    const bx = STAR.cx + Math.cos(b) * ringR, bz = STAR.cz + Math.sin(b) * ringR;
    const len = Math.hypot(bx - ax, bz - az);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 1.2), m.metalDark);
    seg.position.set((ax + bx) / 2, Y + 4.1, (az + bz) / 2);
    seg.rotation.y = -Math.atan2(bz - az, bx - ax);
    w.scene.add(seg);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), m.pipeYellow);
    rail.position.set((ax + bx) / 2, Y + 5.1, (az + bz) / 2);
    rail.rotation.y = -Math.atan2(bz - az, bx - ax);
    w.scene.add(rail);
  }

  // machinery: pumps, tanks, pipes radiating from the core
  const pump = (x, z, ry = 0) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 1.6), m.metalDark); base.position.y = 0.25; g.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.8, 14), m.pipeGreen);
    body.rotation.z = Math.PI / 2; body.position.y = 1.0; g.add(body);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 12), m.rust);
    motor.rotation.z = Math.PI / 2; motor.position.set(1.4, 1.0, 0); g.add(motor);
    g.position.set(x, Y, z); g.rotation.y = ry;
    w.scene.add(g);
    w.addCollider(g, 'pump');
  };
  pump(-14, -26, 0.8); pump(-15, -40, -0.6); pump(8, -46, 0.2); pump(-4, -20.5, 0.1);
  const tank = (x, z, r = 1.6, h = 4.5) => {
    w.cyl(r, r, h, x, Y + h / 2, z, m.rust, { collide: true, seg: 18 });
    w.cyl(r * 0.3, r * 0.3, 2, x, Y + h + 1, z, m.pipeRed, { collide: false });
  };
  tank(6, -21); tank(10, -44, 1.3, 3.6); tank(-9, -46.5, 1.2, 5);
  w.pipe(m.pipeRed, 0.14, [STAR.cx - 9, -34], [-19, -34], Y + 6.4);
  w.pipe(m.pipeGreen, 0.11, [0, STAR.cz - 9], [0, -52], Y + 6.0);
  w.pipe(m.pipeYellow, 0.09, [0, STAR.cz + 9], [0, -16], Y + 6.2);
  w.pipe(m.pipeGreen, 0.11, [7, -27.6], [16, -21], Y + 5.7);

  // LOTS of light — ring of fixtures + high band
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    w.lampFixture(STAR.cx + Math.cos(a) * 14.2, Y + H - 0.4, STAR.cz + Math.sin(a) * 14.2, 2.2, true, 0xdde8f5, 1.1, 15);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    w.lampFixture(STAR.cx + Math.cos(a) * 6.5, Y + 3.6, STAR.cz + Math.sin(a) * 6.5, 1.4, true, 0xffe6c0, 0.7, 10);
  }
}

// ------------------------------------ vent box → crawl duct → light-well
function buildVentRoute(w, m) {
  const Y = MECH_Y;

  // the big vent box in the east star point, with a ladder up its west face
  const vb = w.box(3, 3, 3, 16, Y + 1.5, -34, m.duct, { name: 'ventbox', occlude: true });
  const grillTex = canvasTex(128, 96, (g, cw, ch) => {
    g.fillStyle = '#42484f'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#20242a';
    for (let i = 0; i < 6; i++) g.fillRect(10, 10 + i * 14, cw - 20, 7);
  });
  const grill = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.4), new THREE.MeshStandardMaterial({ map: grillTex }));
  grill.position.set(14.48, Y + 1.5, -34); grill.rotation.y = -Math.PI / 2;
  w.scene.add(grill);
  // ladder rungs on the west face
  for (let i = 0; i < 6; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), m.pipeYellow);
    rung.rotation.x = Math.PI / 2;
    rung.position.set(14.35, Y + 0.5 + i * 0.5, -34);
    w.scene.add(rung);
  }
  w.addLadder(13.95, Y, -34.6, 14.62, Y + 5.4, -33.4);
  const ventSign = w.poster(14.42, Y + 2.6, -33.2, -Math.PI / 2, 1.0, 0.35, (g, cw, ch) => {
    g.fillStyle = '#233028'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#8fd8a8'; g.font = 'bold 22px monospace'; g.textAlign = 'center';
    g.fillText('EXHAUST RUN 6', cw / 2, ch / 2 + 8);
  });

  // crawl duct across the star tip into the light-well (floor at Y+3 = 41)
  const ductY = Y + 3; // 41
  w.addFloor({ y: ductY, rect: [17.4, -35.0, 21.6, -33.0] });
  w.box(4.4, 0.16, 4.2, 19.55, ductY - 0.08, -34, m.duct, { collide: false });
  w.box(4.4, 3, 0.35, 19.55, Y + 1.5, -35.15, m.duct, { occlude: true });   // side seals below+at duct
  w.box(4.4, 3, 0.35, 19.55, Y + 1.5, -32.85, m.duct, { occlude: true });
  w.box(4.4, 1.55, 0.35, 19.55, ductY + 0.775, -35.15, m.duct, { occlude: true });
  w.box(4.4, 1.55, 0.35, 19.55, ductY + 0.775, -32.85, m.duct, { occlude: true });
  w.box(4.4, 0.2, 4.2, 19.55, ductY + 1.65, -34, m.duct, { name: 'ductceil' }); // crawl ceiling (bottom at 42.55)
  w.box(6.4, 3.3, 4.4, 17, 44.2, -34, m.concreteDark, { collide: true, occlude: true }); // mass above tip
  w.box(2.6, 3, 4.2, 20.3, Y + 1.5, -34, m.concreteDark, { occlude: true }); // seal under duct beyond tip

  // ---- the light-well: outdoors, one story of wall, grate overhead ----
  const L = LIGHTWELL;
  w.addFloor({ y: L.floor, rect: [L.x1, L.z1, L.x2, L.z2] });
  w.box(3.9, 0.16, 4.0, (L.x1 + L.x2) / 2, L.floor - 0.08, -34, m.concrete, { collide: false });
  // west wall (duct opening below, sealed above); side slots beside the duct
  w.box(0.35, 3.8, 4.2, L.x1, 44.45, -34, m.concrete, { occlude: true });
  w.box(0.35, 1.7, 1.0, L.x1, L.floor + 0.85, -35.45, m.concrete, { occlude: true });
  w.box(0.35, 1.7, 1.0, L.x1, L.floor + 0.85, -32.55, m.concrete, { occlude: true });
  // east / north / south walls up to the roof
  w.box(0.35, 5.4, 4.2, L.x2, L.floor + 2.7, -34, m.concrete, { occlude: true });
  w.box(4.1, 5.4, 0.35, (L.x1 + L.x2) / 2, L.floor + 2.7, L.z1, m.concrete, { occlude: true });
  w.box(4.1, 5.4, 0.35, (L.x1 + L.x2) / 2, L.floor + 2.7, L.z2, m.concrete, { occlude: true });
  // wall ladder up to the grate
  for (let i = 0; i < 10; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), m.pipeYellow);
    rung.rotation.x = Math.PI / 2;
    rung.position.set(L.x2 - 0.35, L.floor + 0.5 + i * 0.48, -34);
    w.scene.add(rung);
  }
  w.addLadder(L.x2 - 0.95, L.floor, -34.6, L.x2 - 0.2, L.floor + 8.5, -33.4);
  // drainage grate floor detail + drift of snow
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.95 });
  const drift = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), snowMat);
  drift.scale.set(1.6, 0.35, 1.4);
  drift.position.set(22.3, L.floor + 0.05, -35.2);
  w.scene.add(drift);
  // dim sky light down the well
  const wellLight = new THREE.PointLight(0x9db4d8, 16, 14, 1.8);
  wellLight.position.set((L.x1 + L.x2) / 2, L.floor + 4.6, -34);
  w.scene.add(wellLight);

  // ---- the stuck grate (mash E with your friends) ----
  const grate = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.6), m.rust);
  grate.add(frame);
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 1.5), m.metalDark);
    bar.position.x = -0.9 + i * 0.3;
    grate.add(bar);
  }
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.08), m.metalDark);
    bar.position.z = -0.6 + i * 0.4;
    grate.add(bar);
  }
  grate.position.set(24.0, 45.93, -34);
  w.scene.add(grate);
  const grateCollider = w.addCollider(grate, 'stuckGrate');
  w.dynamic.grate = { group: grate, collider: grateCollider, openT: 0 };
  w.interactable(grate, () => {
    if (state.grateOpen) return null;
    return 'Push the grate open — together';
  }, () => emit('mash'));
  w.updaters.push((dt) => {
    const g = w.dynamic.grate;
    if (state.grateOpen && g.openT < 1) {
      g.openT = Math.min(1, g.openT + dt * 1.6);
      g.group.rotation.z = -g.openT * 1.9;
      g.group.position.x = 24.0 - g.openT * 1.0;
      g.group.position.y = 45.93 + g.openT * 0.8;
    }
  });
}
