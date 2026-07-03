// Level construction: maintenance office -> corridor -> mechanical room ->
// fan room -> crawl duct -> ladder shaft -> roof hatch -> rooftop with the
// massive hole and the white spire (green neon sign).
import * as THREE from 'three';
import { state, emit } from './state.js';
import * as audio from './audio.js';

export const ROOF_Y = 8.4;
export const HOLE = { x: -4, z: -20, r: 8.4 };
const SHAFT = { x1: 6, x2: 8.4, z1: -49.6, z2: -47.6 }; // ladder shaft opening in the roof

function canvasTex(w, h, draw) {
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
    this.colliders = [];       // { box: THREE.Box3, name, solid:true }
    this.interactables = [];   // { mesh, label():string|null, action() }
    this.dynamic = {};
    this.roofY = ROOF_Y;
    this.hole = HOLE;
    this.updaters = [];
    this.mats = this.makeMaterials();
    this.build();
  }

  makeMaterials() {
    const M = (o) => new THREE.MeshStandardMaterial(o);
    return {
      concrete: M({ color: 0x6d7176, roughness: 0.95 }),
      concreteDark: M({ color: 0x484c52, roughness: 0.97 }),
      floorInt: M({ color: 0x3c4046, roughness: 0.9 }),
      floorRoof: M({ color: 0x585f6b, roughness: 0.92 }),
      metal: M({ color: 0x8b9299, roughness: 0.45, metalness: 0.75 }),
      metalDark: M({ color: 0x3a3f45, roughness: 0.5, metalness: 0.7 }),
      rust: M({ color: 0x6e4326, roughness: 0.85, metalness: 0.25 }),
      pipeGreen: M({ color: 0x2f6b4f, roughness: 0.6, metalness: 0.4 }),
      pipeRed: M({ color: 0x8a3030, roughness: 0.6, metalness: 0.4 }),
      pipeYellow: M({ color: 0xa8862a, roughness: 0.6, metalness: 0.4 }),
      panel: M({ color: 0x59616a, roughness: 0.5, metalness: 0.6 }),
      locker: M({ color: 0x35525e, roughness: 0.6, metalness: 0.5 }),
      doorMat: M({ color: 0x50606e, roughness: 0.5, metalness: 0.7 }),
      wood: M({ color: 0x6b4f33, roughness: 0.9 }),
      spireWhite: M({ color: 0xe9edf2, roughness: 0.35, metalness: 0.1, emissive: 0x232a33, emissiveIntensity: 0.25 }),
      shaftDark: M({ color: 0x07090c, roughness: 1, side: THREE.DoubleSide }),
      blackout: M({ color: 0x000000 }),
    };
  }

  box(w, h, d, x, y, z, mat, { collide = true, name = '', group = null, castShadow = false } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    (group || this.scene).add(m);
    if (collide) this.addCollider(m, name);
    return m;
  }

  addCollider(mesh, name = '') {
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const c = { box, name, mesh };
    this.colliders.push(c);
    return c;
  }

  removeCollider(c) {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  cyl(rt, rb, h, x, y, z, mat, { collide = false, seg = 16, group = null } = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    (group || this.scene).add(m);
    if (collide) this.addCollider(m);
    return m;
  }

  // Horizontal pipe run along x or z.
  pipe(mat, r, from, to, y) {
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const len = Math.hypot(dx, dz);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
    m.position.set((from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2);
    m.rotation.z = Math.PI / 2;
    m.rotation.y = -Math.atan2(dz, dx);
    m.rotation.order = 'YZX';
    this.scene.add(m);
    return m;
  }

  interactable(mesh, label, action) {
    const it = { mesh, label, action };
    this.interactables.push(it);
    mesh.traverse((c) => { c.userData.interact = it; });
    mesh.userData.interact = it;
    return it;
  }

  build() {
    this.buildLighting();
    this.buildOffice();
    this.buildCorridor();
    this.buildMechRoom();
    this.buildFanRoom();
    this.buildDuctAndShaft();
    this.buildRoof();
    this.buildSpire();
    this.buildCeilings();
  }

  // ---------------------------------------------------------------- lighting
  buildLighting() {
    this.ambient = new THREE.AmbientLight(0x8090a8, 0.32);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0x33404f, 0x14100c, 0.4);
    this.scene.add(this.hemi);
    // Storm key light — comes alive outside; also used for lightning flashes.
    this.stormLight = new THREE.DirectionalLight(0x8899bb, 0.0);
    this.stormLight.position.set(30, 80, 20);
    this.scene.add(this.stormLight);
  }

  lampFixture(x, y, z, w = 1.6, on = true, color = 0xcfe4ff, intensity = 0.9, dist = 12) {
    intensity *= 35; // three.js physical lighting: point light intensity is candela
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

  emergencyLight(x, y, z) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.14), this.mats.metalDark));
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2211, emissiveIntensity: 2.2 })
    );
    dome.position.y = 0.12;
    const light = new THREE.PointLight(0xff3322, 22, 11, 1.6);
    g.add(dome, light);
    g.position.set(x, y, z);
    this.scene.add(g);
    return { group: g, dome, light };
  }

  // ------------------------------------------------------------------ office
  buildOffice() {
    const m = this.mats;
    // floor visual
    this.box(10.6, 0.2, 10.6, 0, -0.1, 1, m.floorInt, { collide: false });
    // walls
    this.box(10.6, 3.4, 0.3, 0, 1.7, 6, m.concrete);
    this.box(0.3, 3.4, 10.3, 5, 1.7, 1, m.concrete);
    this.box(0.3, 3.4, 10.3, -5, 1.7, 1, m.concrete);
    // north wall with doorway x[-1.2,1.2]
    this.box(3.8, 3.4, 0.3, -3.1, 1.7, -4, m.concrete);
    this.box(3.8, 3.4, 0.3, 3.1, 1.7, -4, m.concrete);
    this.box(2.4, 0.9, 0.3, 0, 2.95, -4, m.concrete);
    // door frame trim
    this.box(0.15, 2.5, 0.4, -1.2, 1.25, -4, m.metalDark, { collide: false });
    this.box(0.15, 2.5, 0.4, 1.2, 1.25, -4, m.metalDark, { collide: false });

    // sliding door D1
    const d1 = this.box(2.4, 2.5, 0.15, 0, 1.25, -4, m.doorMat, { collide: false });
    d1.material = m.doorMat.clone();
    const d1c = this.addCollider(d1, 'door1');
    this.dynamic.d1 = { mesh: d1, collider: d1c, openX: -2.45, t: 0 };
    // caution stripes on the door
    const stripes = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.3),
      new THREE.MeshBasicMaterial({
        map: canvasTex(256, 32, (g, w, h) => {
          g.fillStyle = '#b89b26'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#222'; for (let i = -1; i < 10; i++) { g.save(); g.translate(i * 32, 0); g.rotate(0.5); g.fillRect(0, -10, 14, 60); g.restore(); }
        }),
      })
    );
    stripes.position.set(0, 0.15, 0.078);
    d1.add(stripes);

    // keypad next to door
    const keypadTex = canvasTex(128, 192, (g, w, h) => {
      g.fillStyle = '#20242a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#0a2016'; g.fillRect(14, 12, 100, 30);
      g.fillStyle = '#39ff88'; g.font = '20px monospace'; g.fillText('LOCKED', 24, 34);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        g.fillStyle = '#3a4048'; g.fillRect(18 + c * 34, 56 + r * 32, 26, 24);
        g.fillStyle = '#cfd6dd'; g.font = '14px monospace';
        const label = r < 3 ? String(r * 3 + c + 1) : ['*', '0', '#'][c];
        g.fillText(label, 27 + c * 34, 73 + r * 32);
      }
    });
    const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.06),
      [m.metalDark, m.metalDark, m.metalDark, m.metalDark, new THREE.MeshStandardMaterial({ map: keypadTex, emissive: 0x113322, emissiveIntensity: 0.4 }), m.metalDark]);
    keypad.position.set(1.75, 1.5, -3.8);
    this.scene.add(keypad);
    this.dynamic.keypad = keypad;
    this.interactable(keypad,
      () => (state.d1Open ? null : 'Use keypad'),
      () => emit('ui:keypad'));

    // desk with note
    const desk = new THREE.Group();
    desk.position.set(-3.2, 0, 4.2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1.4), m.wood); top.position.y = 0.95; desk.add(top);
    [[-1.4, 0.6], [1.4, 0.6], [-1.4, -0.6], [1.4, -0.6]].forEach(([dx, dz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), m.metalDark);
      leg.position.set(dx, 0.47, dz); desk.add(leg);
    });
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x111418, emissive: 0x0a141c, emissiveIntensity: 0.6 }));
    monitor.position.set(-0.6, 1.35, -0.2); monitor.rotation.y = 0.4; desk.add(monitor);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x9a3333 }));
    mug.position.set(0.8, 1.06, 0.3); desk.add(mug);
    this.scene.add(desk);
    this.addCollider(desk, 'desk');

    // the note
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.28),
      new THREE.MeshStandardMaterial({
        map: canvasTex(128, 96, (g, w, h) => {
          g.fillStyle = '#d8d2c0'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#333'; g.font = '11px cursive';
          g.fillText('keypad code =', 12, 30);
          g.fillText('year the plant', 12, 48);
          g.fillText('opened. -M', 12, 66);
        }),
      }));
    note.rotation.x = -Math.PI / 2; note.rotation.z = 0.4;
    note.position.set(-2.9, 1.01, 4.0);
    this.scene.add(note);
    this.interactable(note, () => 'Read note', () => {
      audio.paperRustle();
      state.readDeskNote = true;
      emit('note');
      emit('ui:note', {
        html: `New keypad code = <b>the year this plant opened</b>.<br><br>Quit forgetting it, people.<br><br>&nbsp;&nbsp;— M.`,
      });
    });

    // wall posters — one carries the answer
    const poster = (x, z, ry, draw, w = 1.6, h = 2.0) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: canvasTex(256, 320, draw) }));
      p.position.set(x, 1.8, z); p.rotation.y = ry;
      this.scene.add(p);
      return p;
    };
    const anniversary = poster(-4.83, 1.5, Math.PI / 2, (g, w, h) => {
      g.fillStyle = '#12303f'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e8c860'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = '#e8c860'; g.textAlign = 'center'; g.font = 'bold 26px serif';
      g.fillText('NORTHPOINT', w / 2, 70);
      g.fillText('UTILITY TOWER', w / 2, 104);
      g.fillStyle = '#cfe6d8'; g.font = '15px serif';
      g.fillText('proudly serving the city', w / 2, 160);
      g.fillStyle = '#fff'; g.font = 'bold 52px serif';
      g.fillText('SINCE', w / 2, 215);
      g.fillStyle = '#e8c860'; g.font = 'bold 64px serif';
      g.fillText('1987', w / 2, 280);
    });
    this.interactable(anniversary, () => '“…SINCE 1987”', () => {
      state.sawPoster = true; emit('poster');
    });
    poster(4.83, 2.5, -Math.PI / 2, (g, w, h) => {
      g.fillStyle = '#3f3512'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f2d54c'; g.textAlign = 'center'; g.font = 'bold 30px sans-serif';
      g.fillText('SAFETY', w / 2, 80); g.fillText('FIRST', w / 2, 120);
      g.fillStyle = '#ddd'; g.font = '14px sans-serif';
      g.fillText('hard hats beyond this point', w / 2, 180);
      g.fillText('report all incidents', w / 2, 210);
      g.fillText('(yes, that one too)', w / 2, 240);
    }, 1.3, 1.7);

    // filing cabinet + lockers for set dressing
    this.box(0.6, 1.4, 0.5, 4.4, 0.7, 5.4, m.metalDark);
    for (let i = 0; i < 3; i++) this.box(0.7, 2.0, 0.5, -4.5 + i * 0.75, 1.0, -3.5, m.locker);
    // office lamp (always on — separate circuit)
    this.lampFixture(0, 3.3, 1, 1.8, true, 0xffe6c0, 0.85, 11);
    this.lampFixture(-3, 3.3, 4, 1.4, true, 0xffe6c0, 0.6, 9);
  }

  // ---------------------------------------------------------------- corridor
  buildCorridor() {
    const m = this.mats;
    this.box(3.0, 0.2, 8.6, 0, -0.1, -8, m.floorInt, { collide: false });
    this.box(0.3, 3.4, 8, 1.35, 1.7, -8, m.concreteDark);
    this.box(0.3, 3.4, 8, -1.35, 1.7, -8, m.concreteDark);
    // conduit + valve wheel dressing
    this.pipe(m.pipeYellow, 0.05, [1.15, -4], [1.15, -12], 2.9);
    this.pipe(m.pipeGreen, 0.08, [-1.15, -4], [-1.15, -12], 2.7);
    this.lampFixture(0, 3.3, -6, 1.2, true, 0xcfe4ff, 0.5, 8);
    this.lampFixture(0, 3.3, -10, 1.2, true, 0xcfe4ff, 0.5, 8);
    // wall sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5),
      new THREE.MeshStandardMaterial({
        map: canvasTex(220, 100, (g, w, h) => {
          g.fillStyle = '#233028'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#8fd8a8'; g.font = 'bold 22px monospace'; g.textAlign = 'center';
          g.fillText('MECHANICAL →', w / 2, 42);
          g.font = '15px monospace'; g.fillText('SUB-LEVEL 2', w / 2, 72);
        }),
      }));
    sign.position.set(-1.19, 2.2, -8); sign.rotation.y = Math.PI / 2;
    this.scene.add(sign);
  }

  // --------------------------------------------------------------- mech room
  buildMechRoom() {
    const m = this.mats;
    this.box(26.6, 0.2, 20.6, 0, -0.1, -22, m.floorInt, { collide: false });
    // south wall, doorway x[-1.2,1.2]
    this.box(11.8, 3.4, 0.3, -7.1, 1.7, -12, m.concreteDark);
    this.box(11.8, 3.4, 0.3, 7.1, 1.7, -12, m.concreteDark);
    this.box(2.4, 0.9, 0.3, 0, 2.95, -12, m.concreteDark);
    // east / west walls
    this.box(0.3, 3.4, 20.3, 13, 1.7, -22, m.concreteDark);
    this.box(0.3, 3.4, 20.3, -13, 1.7, -22, m.concreteDark);
    // north wall, doorway x[6,8.4] for D2
    this.box(19, 3.4, 0.3, -3.5, 1.7, -32, m.concreteDark);
    this.box(4.6, 3.4, 0.3, 10.7, 1.7, -32, m.concreteDark);
    this.box(2.4, 0.9, 0.3, 7.2, 2.95, -32, m.concreteDark);

    // D2 sliding security door
    const d2 = this.box(2.4, 2.5, 0.15, 7.2, 1.25, -32, m.doorMat.clone(), { collide: false });
    const d2c = this.addCollider(d2, 'door2');
    this.dynamic.d2 = { mesh: d2, collider: d2c, openX: 7.2 - 2.45, t: 0 };
    const d2label = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4),
      new THREE.MeshBasicMaterial({
        map: canvasTex(256, 56, (g, w, h) => {
          g.fillStyle = '#5a2020'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#ffd0d0'; g.font = 'bold 22px monospace'; g.textAlign = 'center';
          g.fillText('AUTHORIZED ONLY', w / 2, 36);
        }),
      }));
    d2label.position.set(0, 0.6, 0.08); d2.add(d2label);

    // card reader by D2 — needs power
    const readerLED = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x330000, emissiveIntensity: 1.5 });
    const reader = new THREE.Group();
    const readerBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.07), m.metalDark);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), readerLED);
    led.position.set(0, 0.09, 0.045);
    reader.add(readerBody, led);
    reader.position.set(5.6, 1.5, -31.8);
    this.scene.add(reader);
    this.dynamic.readerLED = readerLED;
    this.interactable(reader, () => {
      if (state.d2Open) return null;
      if (!state.power) return 'Card reader (dead — no power)';
      return state.hasKeycard ? 'Swipe keycard' : 'Card reader (needs a keycard)';
    }, () => {
      if (!state.power) { audio.keypadFail(); emit('reader:dead'); return; }
      if (!state.hasKeycard) { audio.keypadFail(); emit('reader:nocard'); return; }
      audio.keypadOk();
      readerLED.emissive.setHex(0x00ff44);
      state.d2Open = true;
      audio.doorSlide();
      emit('d2');
    });

    // ---- boilers ----
    const boiler = (x, z, num) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.2, 20), m.rust);
      body.position.y = 1.7; g.add(body);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.rust);
      cap.position.y = 3.3; g.add(cap);
      const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16),
        new THREE.MeshStandardMaterial({ color: 0x241f19, emissive: 0xff5a1a, emissiveIntensity: 0.35 }));
      hatch.position.set(0, 1.2, 1.51); g.add(hatch);
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 8), m.pipeRed);
        p.position.set(Math.cos(i * 1.57) * 1.0, 4.4, Math.sin(i * 1.57) * 1.0);
        g.add(p);
      }
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4),
        new THREE.MeshStandardMaterial({
          map: canvasTex(128, 72, (g2, w, h) => {
            g2.fillStyle = '#8c8676'; g2.fillRect(0, 0, w, h);
            g2.fillStyle = '#222'; g2.font = 'bold 26px monospace'; g2.textAlign = 'center';
            g2.fillText(`BOILER ${num}`, w / 2, 45);
          }),
        }));
      plate.position.set(0, 2.3, 1.52); g.add(plate);
      g.position.set(x, 0, z);
      this.scene.add(g);
      this.addCollider(g, `boiler${num}`);
      return g;
    };
    boiler(-9, -17, 1);
    boiler(-9, -22.5, 2);
    boiler(-9, -28, 3);

    // pipes along walls
    this.pipe(m.pipeRed, 0.12, [-12.8, -13], [-12.8, -31], 2.9);
    this.pipe(m.pipeGreen, 0.1, [-12.6, -13], [-12.6, -31], 2.5);
    this.pipe(m.pipeYellow, 0.07, [-13, -12.2], [13, -12.2], 3.1);
    this.pipe(m.pipeRed, 0.1, [12.8, -13], [12.8, -31], 2.8);

    // generator block
    const gen = new THREE.Group();
    const genBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 1.8), m.metalDark);
    genBody.position.y = 0.9; gen.add(genBody);
    const genTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.2), m.metal);
    genTop.position.y = 1.9; gen.add(genTop);
    gen.position.set(3, 0, -27);
    this.scene.add(gen);
    this.addCollider(gen, 'generator');

    // shelving + clutter
    const shelf = (x, z, ry = 0) => {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.7), m.metal);
        s.position.y = 0.5 + i * 0.65; g.add(s);
      }
      [[-1.2, -0.32], [1.2, -0.32], [-1.2, 0.32], [1.2, 0.32]].forEach(([dx, dz]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, 0.05), m.metalDark);
        post.position.set(dx, 1.05, dz); g.add(post);
      });
      for (let i = 0; i < 6; i++) {
        const bx = new THREE.Mesh(
          new THREE.BoxGeometry(0.3 + Math.random() * 0.3, 0.25 + Math.random() * 0.2, 0.4),
          Math.random() > 0.5 ? m.wood : m.rust);
        bx.position.set(-0.9 + (i % 3) * 0.8, 0.66 + Math.floor(i / 3) * 0.65, (Math.random() - 0.5) * 0.2);
        g.add(bx);
      }
      g.position.set(x, 0, z); g.rotation.y = ry;
      this.scene.add(g);
      this.addCollider(g, 'shelf');
    };
    shelf(-3, -31.4);
    shelf(11.5, -20, Math.PI / 2);
    shelf(11.5, -25, Math.PI / 2);

    // barrels
    [[1.5, -30.8], [2.4, -30.4], [1.9, -29.6], [-11.8, -13.5]].forEach(([x, z], i) => {
      const b = this.cyl(0.42, 0.42, 1.0, x, 0.5, z, i % 2 ? m.pipeYellow : m.rust, { collide: true, seg: 12 });
    });

    // decorative wall vents (red herrings for the "hidden grate" hunt)
    const ventTex = canvasTex(128, 96, (g, w, h) => {
      g.fillStyle = '#42484f'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#20242a';
      for (let i = 0; i < 6; i++) g.fillRect(10, 10 + i * 14, w - 20, 7);
    });
    [[-12.83, 1.4, -19, Math.PI / 2], [-12.83, 1.4, -25, Math.PI / 2], [4, 2.8, -31.82, 0]].forEach(([x, y, z, ry]) => {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshStandardMaterial({ map: ventTex }));
      v.position.set(x, y, z); v.rotation.y = ry;
      this.scene.add(v);
      this.interactable(v, () => 'Vent (bolted shut)', () => { audio.metalCreak(); emit('vent:stuck'); });
    });

    // ---- crew lockers (west wall) — one holds the keycard ----
    const lockerRow = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.0, 0.55), m.locker);
      body.position.set(i * 0.78, 1.0, 0);
      lockerRow.add(body);
    }
    lockerRow.position.set(-12.4, 0, -18.5);
    lockerRow.rotation.y = Math.PI / 2;
    this.scene.add(lockerRow);
    this.addCollider(lockerRow, 'lockers');
    // the special locker door (hinged, index 2)
    const lockerDoor = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.9, 0.05), m.locker.clone());
    lockerDoor.material.color.setHex(0x3f6270);
    const hinge = new THREE.Group();
    hinge.position.set(2 * 0.78 - 0.33, 1.0, 0.3); // hinge at door's left edge
    lockerDoor.position.set(0.33, 0, 0);
    hinge.add(lockerDoor);
    lockerRow.add(hinge);
    this.dynamic.lockerHinge = hinge;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12),
      new THREE.MeshBasicMaterial({
        map: canvasTex(96, 40, (g, w, h) => {
          g.fillStyle = '#ddd'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#333'; g.font = 'bold 18px monospace'; g.textAlign = 'center';
          g.fillText('PAV ?', w / 2, 27);
        }),
      }));
    tag.position.set(0, 0.55, 0.03); lockerDoor.add(tag);
    this.interactable(lockerDoor, () => (state.lockerOpen ? null : 'Open locker'), () => {
      state.lockerOpen = true;
      audio.metalCreak();
      emit('locker');
    });
    // keycard inside
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x2266aa, emissiveIntensity: 0.5 }));
    card.position.set(2 * 0.78, 1.05, 0.05);
    lockerRow.add(card);
    this.dynamic.keycard = card;
    this.interactable(card, () => (state.lockerOpen && !state.hasKeycard ? 'Take contractor keycard' : null), () => {
      state.hasKeycard = true;
      card.visible = false;
      audio.pickup();
      emit('keycard');
    });

    // ---- breaker panel (east wall) ----
    const panel = new THREE.Group();
    const panelBody = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.8, 0.18), m.panel);
    panel.add(panelBody);
    const panelFace = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.7),
      new THREE.MeshStandardMaterial({
        map: canvasTex(192, 272, (g, w, h) => {
          g.fillStyle = '#454c55'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#c8ced6'; g.font = 'bold 17px monospace'; g.textAlign = 'center';
          g.fillText('MAIN BREAKERS', w / 2, 30);
          g.fillStyle = '#8a2222'; g.fillRect(20, 44, w - 40, 5);
          g.fillStyle = '#c8ced6'; g.font = '12px monospace';
          ['LIGHTING', 'SECURITY', 'HVAC'].forEach((s, i) => g.fillText(s, w / 2, 88 + i * 62));
        }),
      }));
    panelFace.position.z = -0.095; panelFace.rotation.y = Math.PI;
    panel.add(panelFace);
    this.dynamic.breakerSwitches = [];
    for (let i = 0; i < 3; i++) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x8a2222 }));
      sw.position.set(0, 0.52 - i * 0.44, -0.14);
      sw.rotation.x = 0.5; // down = off
      panel.add(sw);
      this.dynamic.breakerSwitches.push(sw);
      const idx = i;
      this.interactable(sw, () => (state.breakers[idx] ? null : 'Flip breaker'), () => {
        state.breakers[idx] = true;
        sw.rotation.x = -0.5;
        sw.material.color.setHex(0x1d7a45);
        audio.breakerSnap();
        emit('breaker', idx);
        if (state.breakers.every(Boolean) && !state.power) {
          state.power = true;
          this.setPower(true);
          audio.setPowerOn();
          emit('power');
        }
      });
    }
    panel.position.set(12.8, 1.6, -22);
    panel.rotation.y = -Math.PI / 2;
    this.scene.add(panel);
    this.addCollider(panel, 'breakerPanel');
    // small always-on lamp above the panel so it's findable in the dark
    this.lampFixture(12.4, 3.2, -22, 0.8, true, 0xffd9a0, 0.5, 6);

    // security camera prop
    const cam = new THREE.Group();
    const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.14), m.metalDark);
    const camLed = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x000, emissive: 0xff0000, emissiveIntensity: 3 }));
    camLed.position.set(0.16, 0, 0);
    cam.add(camBody, camLed);
    cam.position.set(12.6, 3.0, -13); cam.rotation.y = 2.4;
    this.scene.add(cam);
    this.dynamic.camera1 = cam;

    // hanging fluorescents — OFF until power; emergency reds ON until power
    this.mechLamps = [
      this.lampFixture(-6, 3.25, -16, 2.0, false), this.lampFixture(2, 3.25, -16, 2.0, false),
      this.lampFixture(-6, 3.25, -22, 2.0, false), this.lampFixture(2, 3.25, -22, 2.0, false),
      this.lampFixture(-6, 3.25, -28, 2.0, false), this.lampFixture(2, 3.25, -28, 2.0, false),
      this.lampFixture(9, 3.25, -25, 2.0, false),
    ];
    this.emLights = [
      this.emergencyLight(-2, 3.0, -13.5), this.emergencyLight(10, 3.0, -21),
      this.emergencyLight(-11, 3.0, -30), this.emergencyLight(0, 3.0, -26),
    ];
  }

  setPower(on) {
    this.mechLamps.forEach((l, i) => {
      setTimeout(() => {
        l.light.intensity = l.baseIntensity;
        l.tube.material.emissiveIntensity = 1.6;
      }, i * 120 + Math.random() * 150);
    });
    this.emLights.forEach((e) => {
      e.light.intensity = 2.5;
      e.dome.material.emissiveIntensity = 0.4;
    });
    this.fanLamps?.forEach((l) => {
      l.light.intensity = l.baseIntensity;
      l.tube.material.emissiveIntensity = 1.6;
    });
    if (this.dynamic.readerLED) this.dynamic.readerLED.emissive.setHex(0x992200);
  }

  // ---------------------------------------------------------------- fan room
  buildFanRoom() {
    const m = this.mats;
    this.box(10.6, 0.2, 12.6, 8, -0.1, -38, m.floorInt, { collide: false });
    this.box(0.3, 3.4, 12.3, 3, 1.7, -38, m.concreteDark);
    this.box(0.3, 3.4, 12.3, 13, 1.7, -38, m.concreteDark);
    // south wall with fan opening x[5,9.4], header above 2.4
    this.box(2.0, 3.4, 0.3, 4, 1.7, -44, m.concreteDark);
    this.box(3.6, 3.4, 0.3, 11.2, 1.7, -44, m.concreteDark);
    this.box(4.4, 1.0, 0.3, 7.2, 2.9, -44, m.concreteDark);

    // duct boxes on ceiling
    this.box(1.2, 0.8, 10, 5, 3.0, -38, m.metal, { collide: false });
    this.box(6, 0.8, 1.2, 8, 3.0, -35, m.metal, { collide: false });

    // ---- THE FAN ----
    const fanGroup = new THREE.Group();
    fanGroup.position.set(7.2, 1.45, -44);
    // housing ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.18, 12, 32), m.metalDark);
    fanGroup.add(ring);
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.5, 32, 1, true), m.metal);
    shroud.rotation.x = Math.PI / 2;
    fanGroup.add(shroud);
    // hub + blades
    const rotor = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 16), m.metalDark);
    hub.rotation.x = Math.PI / 2;
    rotor.add(hub);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.35, metalness: 0.8 });
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.55, 0.06), bladeMat);
      blade.position.y = 1.05;
      blade.rotation.y = 0.6;
      const arm = new THREE.Group();
      arm.rotation.z = (i / 5) * Math.PI * 2;
      arm.add(blade);
      rotor.add(arm);
    }
    fanGroup.add(rotor);
    this.scene.add(fanGroup);
    // fan blocks the opening while spinning
    const fanBlocker = { box: new THREE.Box3(
      new THREE.Vector3(5.0, 0, -44.3), new THREE.Vector3(9.4, 3.4, -43.7)), name: 'fanBlocker' };
    this.colliders.push(fanBlocker);
    this.dynamic.fan = { group: fanGroup, rotor, speed: 9, target: 9, blocker: fanBlocker };

    // warning sign next to the fan
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9),
      new THREE.MeshStandardMaterial({
        map: canvasTex(192, 144, (g, w, h) => {
          g.fillStyle = '#7a1d1d'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#fff'; g.textAlign = 'center';
          g.font = 'bold 26px sans-serif'; g.fillText('⚠ DANGER', w / 2, 44);
          g.font = '15px sans-serif';
          g.fillText('EXHAUST FAN 6', w / 2, 80);
          g.fillText('LOCK OUT BEFORE', w / 2, 104);
          g.fillText('SERVICE', w / 2, 124);
        }),
      }));
    warn.position.set(11.2, 1.9, -43.82);
    this.scene.add(warn);

    // ---- fan override lever ----
    const leverBase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.16), m.panel);
    leverBase.position.set(12.8, 1.5, -40);
    leverBase.rotation.y = -Math.PI / 2;
    this.scene.add(leverBase);
    const leverArm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.07),
      new THREE.MeshStandardMaterial({ color: 0xb02020 }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8 }));
    knob.position.y = 0.28;
    leverArm.add(knob);
    leverArm.position.set(12.68, 1.5, -40);
    leverArm.rotation.z = 0.9;
    this.scene.add(leverArm);
    this.dynamic.lever = leverArm;
    const leverLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.28),
      new THREE.MeshStandardMaterial({
        map: canvasTex(160, 56, (g, w, h) => {
          g.fillStyle = '#2c333b'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#f2d54c'; g.font = 'bold 17px monospace'; g.textAlign = 'center';
          g.fillText('FAN OVERRIDE', w / 2, 35);
        }),
      }));
    leverLabel.position.set(12.66, 2.05, -40);
    leverLabel.rotation.y = -Math.PI / 2;
    this.scene.add(leverLabel);
    this.interactable(leverArm, () => (state.fanStopped ? null : 'Pull fan override'), () => {
      state.fanStopped = true;
      this.dynamic.fan.target = 0;
      leverArm.rotation.z = -0.9;
      audio.leverClunk();
      emit('fanoff');
    });

    // ---- grate behind the fan (hidden until fan stops) ----
    const grateTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#3a4048'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#14171c';
      for (let i = 0; i < 7; i++) g.fillRect(8, 8 + i * 17, w - 16, 9);
    });
    const grate = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.35),
      new THREE.MeshStandardMaterial({ map: grateTex, side: THREE.DoubleSide }));
    const grateHinge = new THREE.Group();
    grateHinge.position.set(7.2 - 0.85, 0.72, -44.55); // hinge on left edge
    grate.position.set(0.85, 0, 0);
    grateHinge.add(grate);
    this.scene.add(grateHinge);
    this.dynamic.grateHinge = grateHinge;
    this.interactable(grate, () => {
      if (state.grateOpen) return null;
      if (!state.fanStill) return state.fanStopped ? 'Wait for the blades…' : null;
      return 'Pry open the grate';
    }, () => {
      if (!state.fanStill || state.grateOpen) return;
      state.grateOpen = true;
      audio.metalCreak();
      this.removeCollider(this.dynamic.fan.blocker);
      emit('grate');
    });

    // crates
    this.box(1.0, 1.0, 1.0, 4.2, 0.5, -34, m.wood);
    this.box(0.8, 0.8, 0.8, 5.3, 0.4, -33.6, m.wood);
    this.box(0.8, 0.8, 0.8, 4.5, 1.3, -33.9, m.wood);

    // fan room lights (need power)
    this.fanLamps = [
      this.lampFixture(8, 3.25, -35, 1.8, false),
      this.lampFixture(8, 3.25, -41, 1.8, false),
    ];
    this.emLights.push(this.emergencyLight(12.5, 3.0, -37));
  }

  // --------------------------------------------------------- duct and shaft
  buildDuctAndShaft() {
    const m = this.mats;
    const ductMat = new THREE.MeshStandardMaterial({ color: 0x565e66, roughness: 0.4, metalness: 0.8 });
    // duct floor
    this.box(2.4, 0.2, 3.9, 7.2, -0.08, -45.75, ductMat, { collide: false });
    // duct walls
    this.box(0.3, 3.4, 4.0, 6, 1.7, -45.8, ductMat);
    this.box(0.3, 3.4, 4.0, 8.4, 1.7, -45.8, ductMat);
    // duct low ceiling: crawl height 1.35 over z[-47.6,-44]
    this.box(2.7, 0.15, 3.7, 7.2, 1.43, -45.8, ductMat);
    // shaft walls z[-49.6,-47.6], up to roof
    this.box(0.3, 9.2, 2.3, 6, 4.4, -48.6, m.concreteDark);
    this.box(0.3, 9.2, 2.3, 8.4, 4.4, -48.6, m.concreteDark);
    this.box(2.7, 9.2, 0.3, 7.2, 4.4, -49.75, m.concreteDark);
    this.box(2.7, 7.4, 0.3, 7.2, 5.1, -47.6, m.concreteDark); // above duct ceiling
    // ladder
    const ladder = new THREE.Group();
    const railMat = this.mats.pipeYellow;
    const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 8.6, 8), railMat);
    r1.position.set(-0.35, 4.3, 0);
    const r2 = r1.clone(); r2.position.x = 0.35;
    ladder.add(r1, r2);
    for (let i = 0; i < 17; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), railMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.35 + i * 0.5, 0);
      ladder.add(rung);
    }
    ladder.position.set(7.2, 0, -49.35);
    this.scene.add(ladder);
    this.ladderZone = new THREE.Box3(
      new THREE.Vector3(6.2, 0, -49.6), new THREE.Vector3(8.2, 9.0, -48.4));
    // dim shaft light
    const shaftLight = new THREE.PointLight(0x99bbdd, 12, 10, 1.8);
    shaftLight.position.set(7.2, 7.5, -48.6);
    this.scene.add(shaftLight);

    // hatch lid
    const lid = this.box(2.2, 0.18, 1.9, 7.2, ROOF_Y - 0.15, -48.6, m.metal, { collide: false });
    lid.material = m.metal.clone();
    const lidCollider = this.addCollider(lid, 'hatchLid');
    this.dynamic.hatch = { mesh: lid, collider: lidCollider };
    this.interactable(lid, () => (state.hatchOpen ? null : 'Open roof hatch'), () => {
      state.hatchOpen = true;
      audio.metalCreak();
      this.removeCollider(lidCollider);
      emit('hatch');
    });
  }

  // -------------------------------------------------------------------- roof
  buildRoof() {
    const m = this.mats;
    // roof slab with circular hole + shaft opening (ExtrudeGeometry)
    const shape = new THREE.Shape();
    shape.moveTo(-30, -62); shape.lineTo(30, -62); shape.lineTo(30, 12); shape.lineTo(-30, 12); shape.closePath();
    const holePath = new THREE.Path();
    holePath.absarc(HOLE.x, HOLE.z, HOLE.r, 0, Math.PI * 2, true);
    shape.holes.push(holePath);
    const shaftPath = new THREE.Path();
    shaftPath.moveTo(SHAFT.x1, SHAFT.z1); shaftPath.lineTo(SHAFT.x2, SHAFT.z1);
    shaftPath.lineTo(SHAFT.x2, SHAFT.z2); shaftPath.lineTo(SHAFT.x1, SHAFT.z2); shaftPath.closePath();
    shape.holes.push(shaftPath);
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: false });
    const roof = new THREE.Mesh(roofGeo, m.floorRoof);
    roof.rotation.x = Math.PI / 2; // shape XY -> world XZ (y down after rot, so lift)
    roof.position.y = ROOF_Y;
    this.scene.add(roof);

    // hole rim ring + inner shaft down into darkness
    const rim = new THREE.Mesh(new THREE.TorusGeometry(HOLE.r, 0.12, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.5, metalness: 0.6 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(HOLE.x, ROOF_Y + 0.02, HOLE.z);
    this.scene.add(rim);
    // Shaft wall lining the hole, from the roof down to the blackout shell —
    // below that it's pure black, so the hole reads as bottomless.
    const innerShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(HOLE.r, HOLE.r * 0.96, 4.4, 48, 1, true), m.shaftDark);
    innerShaft.position.set(HOLE.x, ROOF_Y - 2.2, HOLE.z);
    this.scene.add(innerShaft);
    // faint green glow rising from the depths
    const glow = new THREE.PointLight(0x39ff88, 40, 22, 2);
    glow.position.set(HOLE.x, ROOF_Y - 2.5, HOLE.z);
    this.scene.add(glow);
    this.dynamic.holeGlow = glow;

    // parapet walls
    this.box(60.6, 1.3, 0.6, 0, ROOF_Y + 0.65, 12, m.concrete);
    this.box(60.6, 1.3, 0.6, 0, ROOF_Y + 0.65, -62, m.concrete);
    this.box(0.6, 1.3, 74.6, 30, ROOF_Y + 0.65, -25, m.concrete);
    this.box(0.6, 1.3, 74.6, -30, ROOF_Y + 0.65, -25, m.concrete);

    // hatch surround + railing
    this.box(2.6, 0.35, 0.12, 7.2, ROOF_Y + 0.18, -47.5, m.rust);
    this.box(2.6, 0.35, 0.12, 7.2, ROOF_Y + 0.18, -49.7, m.rust);
    this.box(0.12, 0.35, 2.3, 5.9, ROOF_Y + 0.18, -48.6, m.rust);

    // rooftop props: AC units, vents, antenna, pipes, crates
    const ac = (x, z, ry = 0) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 1.6), m.metal);
      body.position.y = 0.75; g.add(body);
      const grill = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20),
        new THREE.MeshStandardMaterial({ color: 0x22262c }));
      grill.rotation.x = -Math.PI / 2; grill.position.y = 1.51; g.add(grill);
      g.position.set(x, ROOF_Y, z); g.rotation.y = ry;
      this.scene.add(g);
      this.addCollider(g, 'ac');
    };
    ac(-18, -45, 0.3); ac(-21, -40, 0); ac(18, -14, 1.2); ac(22, -35, 0);
    ac(-16, 2, 0); ac(14, 4, 0.7);

    const roofVent = (x, z) => {
      const v = new THREE.Group();
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.4, 12), m.metal);
      p.position.y = 0.7; v.add(p);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.25, 12), m.metalDark);
      cap.position.y = 1.5; v.add(cap);
      v.position.set(x, ROOF_Y, z);
      this.scene.add(v);
      this.addCollider(v, 'vent');
    };
    roofVent(-24, -18); roofVent(-25, -52); roofVent(20, -50); roofVent(24, -8); roofVent(-10, 6);

    // antenna mast
    const mast = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 9, 10), m.metalDark);
    pole.position.y = 4.5; mast.add(pole);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.06), m.metalDark);
    cross.position.y = 7.4; mast.add(cross);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x200000, emissive: 0xff2020, emissiveIntensity: 3 }));
    beacon.position.y = 9.1; mast.add(beacon);
    mast.position.set(24, ROOF_Y, -58);
    this.scene.add(mast);
    this.addCollider(pole, 'mast');
    this.dynamic.mastBeacon = beacon;

    // roof pipes
    this.pipe(m.pipeGreen, 0.14, [-28, -10], [12, -10], ROOF_Y + 0.25);
    this.pipe(m.pipeRed, 0.1, [-28, -56], [-6, -56], ROOF_Y + 0.2);
    this.box(1.1, 1.1, 1.1, -12, ROOF_Y + 0.55, -50, m.wood);
    this.box(0.9, 0.9, 0.9, -13.2, ROOF_Y + 0.45, -49.2, m.wood);

    // snow drifts (soft white mounds against the parapets)
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.95 });
    const drift = (x, z, sx, sz) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), snowMat);
      d.scale.set(sx, 0.5, sz);
      d.position.set(x, ROOF_Y + 0.05, z);
      this.scene.add(d);
    };
    drift(-26, -58, 6, 3); drift(26, -58, 5, 2.5); drift(-27, 8, 5, 3);
    drift(26, 8, 4, 2.2); drift(-28, -30, 3, 8); drift(28, -22, 3, 7);
    drift(6, 10, 8, 2); drift(-14, -60, 7, 2);
  }

  // ------------------------------------------------------------------- spire
  buildSpire() {
    const m = this.mats;
    const spire = new THREE.Group();
    spire.position.set(HOLE.x, 0, HOLE.z);

    // main white column rising out of the hole. Its base is clipped to just
    // above the interior ceiling so it never pokes into the rooms below —
    // from the roof, the visible bottom vanishes into the hole's darkness.
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 4.6, 75.5, 24), m.spireWhite);
    column.position.y = 4.5 + 75.5 / 2;
    spire.add(column);
    // ring ledges
    [6, 16, 27, 39].forEach((h, i) => {
      const rr = 4.4 - i * 0.85;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.22, 10, 40), m.spireWhite);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = ROOF_Y + h;
      spire.add(ring);
    });
    // top beacon
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4, 12), m.spireWhite);
    tip.position.y = 4.5 + 75.5 + 2;
    spire.add(tip);
    const topBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x200000, emissive: 0xff2020, emissiveIntensity: 3.5 }));
    topBeacon.position.y = tip.position.y + 2.6;
    spire.add(topBeacon);
    this.dynamic.spireBeacon = topBeacon;

    // ---- the flat green neon sign ----
    // faces the hatch (from the spire toward +x / more-negative-z side)
    const signAngle = Math.atan2(7.2 - HOLE.x, -48.6 - HOLE.z); // direction spire -> hatch
    const signGroup = new THREE.Group();
    signGroup.rotation.y = signAngle;
    const signTex = canvasTex(256, 640, (g, w, h) => {
      g.fillStyle = '#04070a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#0d331f'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
      const word = 'SPIRE';
      g.textAlign = 'center';
      g.font = 'bold 96px monospace';
      for (let i = 0; i < word.length; i++) {
        const y = 116 + i * 108;
        g.shadowColor = '#39ff88'; g.shadowBlur = 34;
        g.fillStyle = '#b6ffd9';
        g.fillText(word[i], w / 2, y);
        g.shadowBlur = 0;
      }
    });
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex, emissive: 0x39ff88, emissiveMap: signTex, emissiveIntensity: 1.8,
      color: 0x0a0f0c,
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(5, 13, 0.5),
      [m.metalDark, m.metalDark, m.metalDark, m.metalDark, signMat, m.metalDark]);
    sign.position.set(0, ROOF_Y + 17, 3.4);
    signGroup.add(sign);
    // mounting brackets
    for (const dy of [-5, 0, 5]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 2.6), m.metalDark);
      bracket.position.set(0, ROOF_Y + 17 + dy, 1.9);
      signGroup.add(bracket);
    }
    spire.add(signGroup);
    this.dynamic.signMat = signMat;

    // green wash lights
    const g1 = new THREE.PointLight(0x39ff88, 0, 45, 1.9);
    g1.position.set(HOLE.x + Math.sin(signAngle) * 9, ROOF_Y + 15, HOLE.z + Math.cos(signAngle) * 9);
    this.scene.add(g1);
    const g2 = new THREE.PointLight(0x39ff88, 0, 30, 2.0);
    g2.position.set(HOLE.x, ROOF_Y + 32, HOLE.z);
    this.scene.add(g2);
    this.dynamic.signLights = [g1, g2];

    this.scene.add(spire);
    this.dynamic.spire = spire;
  }

  buildCeilings() {
    const m = this.mats;
    const ceil = new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.95 });
    // office / corridor / mech / fan ceilings at 3.4
    this.box(10.6, 0.2, 10.6, 0, 3.5, 1, ceil, { collide: false });
    this.box(3.0, 0.2, 8.6, 0, 3.5, -8, ceil, { collide: false });
    this.box(26.6, 0.2, 20.6, 0, 3.5, -22, ceil, { collide: false });
    this.box(10.6, 0.2, 12.6, 8, 3.5, -38, ceil, { collide: false });
    // building outer shell between interior ceiling and roof (so the hole shaft
    // doesn't visually open into rooms)
    this.box(60.6, 0.4, 74.6, 0, 4.0, -25, m.blackout, { collide: false });
  }

  // Highest walkable floor at (x,z) for feet height `yFeet`.
  groundHeightAt(x, z, yFeet) {
    let best = -Infinity;
    // interior floor
    if (x > -14 && x < 14 && z > -50.5 && z < 6.5 && yFeet < 6) best = Math.max(best, 0);
    // roof (with hole + shaft opening)
    if (x > -30 && x < 30 && z > -62 && z < 12 && yFeet > ROOF_Y - 1.2) {
      const inHole = Math.hypot(x - HOLE.x, z - HOLE.z) < HOLE.r - 0.15;
      const shaftOpen = x > SHAFT.x1 + 0.1 && x < SHAFT.x2 - 0.1 && z > SHAFT.z1 + 0.1 && z < SHAFT.z2 - 0.1;
      if (!inHole && !(shaftOpen && state.hatchOpen)) best = Math.max(best, ROOF_Y);
    }
    return best;
  }

  setOutsideLook(scene) {
    scene.fog = new THREE.FogExp2(0x0d1422, 0.012);
    scene.background = new THREE.Color(0x0b1120);
    this.ambient.intensity = 0.35;
    this.ambient.color.setHex(0x9db4d8);
    this.hemi.intensity = 0.5;
    this.hemi.color.setHex(0x46586e);
    this.stormLight.intensity = 0.4;
    this.dynamic.signLights[0].intensity = 90;
    this.dynamic.signLights[1].intensity = 50;
  }

  update(dt, t) {
    // doors
    for (const key of ['d1', 'd2']) {
      const d = this.dynamic[key];
      const open = key === 'd1' ? state.d1Open : state.d2Open;
      if (d && open && d.t < 1) {
        d.t = Math.min(1, d.t + dt * 0.7);
        const ease = 1 - Math.pow(1 - d.t, 3);
        d.mesh.position.x = THREE.MathUtils.lerp(key === 'd1' ? 0 : 7.2, d.openX, ease);
        d.collider.box.setFromObject(d.mesh);
        if (d.t >= 1) this.removeCollider(d.collider);
      }
    }
    // locker door swing
    if (state.lockerOpen && this.dynamic.lockerHinge.rotation.y > -1.9) {
      this.dynamic.lockerHinge.rotation.y -= dt * 3.2;
    }
    // grate swing
    if (state.grateOpen && this.dynamic.grateHinge.rotation.y < 2.2) {
      this.dynamic.grateHinge.rotation.y += dt * 2.4;
    }
    // hatch lid swing
    if (state.hatchOpen && this.dynamic.hatch.mesh.rotation.x > -1.9) {
      const lid = this.dynamic.hatch.mesh;
      lid.rotation.x -= dt * 2.2;
      lid.position.z = -48.6 - Math.sin(Math.min(1.9, -lid.rotation.x)) * 0.9;
      lid.position.y = ROOF_Y - 0.15 + (1 - Math.cos(-lid.rotation.x)) * 0.9;
    }
    // fan
    const fan = this.dynamic.fan;
    if (fan) {
      fan.speed = THREE.MathUtils.damp(fan.speed, fan.target, 0.55, dt);
      fan.rotor.rotation.z += fan.speed * dt;
      audio.setFan(fan.speed / 9);
      if (state.fanStopped && !state.fanStill && fan.speed < 0.25) {
        state.fanStill = true;
        fan.speed = 0; fan.target = 0;
        emit('fanstill');
      }
    }
    // neon flicker
    if (this.dynamic.signMat) {
      const flick = Math.random() < 0.015 ? 0.35 : 1;
      const base = 1.6 + Math.sin(t * 2.1) * 0.25;
      this.dynamic.signMat.emissiveIntensity = base * flick;
      if (state.outside) {
        this.dynamic.signLights[0].intensity = 90 * flick;
        this.dynamic.signLights[1].intensity = 50 * flick;
      }
    }
    // beacons blink
    const blink = (Math.sin(t * 2.4) > 0.7) ? 3.5 : 0.15;
    if (this.dynamic.mastBeacon) this.dynamic.mastBeacon.material.emissiveIntensity = blink;
    if (this.dynamic.spireBeacon) this.dynamic.spireBeacon.material.emissiveIntensity = blink;
    // hole glow breathes
    if (this.dynamic.holeGlow) this.dynamic.holeGlow.intensity = 40 + Math.sin(t * 0.7) * 16;
  }
}
