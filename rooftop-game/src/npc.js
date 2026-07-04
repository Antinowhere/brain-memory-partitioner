// Friendly NPCs: Pav (parka, beanie), Chase (dark hood, glitch skull mask —
// visible when you're playing as Pav), and A (the hooded figure at the top of
// the spire). Pav/Chase follow the player on a breadcrumb trail; A hovers.
import * as THREE from 'three';
import { canvasTex } from './world.js';

function skullTex(color = '#dfe8ee', glow = '#39ff88') {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
    // digital skull built from glyph noise
    g.font = '7px monospace';
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const d = Math.hypot(x - 64, y - 70);
      if (d > 46) continue;
      const inEye = (Math.hypot(x - 46, y - 60) < 11) || (Math.hypot(x - 82, y - 60) < 11);
      const inNose = Math.hypot(x - 64, y - 82) < 6;
      const inJaw = y > 98 && Math.abs(x - 64) < 22 && Math.floor(x / 6) % 2 === 0;
      if (inEye || inNose || inJaw) continue;
      g.fillStyle = Math.random() < 0.12 ? glow : color;
      g.fillText(String.fromCharCode(33 + Math.floor(Math.random() * 60)), x, y);
    }
  });
}

export class NPC {
  constructor(scene, world, kind) {
    this.scene = scene;
    this.world = world;
    this.kind = kind; // 'pav' | 'chase' | 'a'
    this.group = this.buildMesh(kind);
    scene.add(this.group);
    this.crumbs = [];
    this.lastCrumbTime = 0;
    this.walkPhase = 0;
    this.hidden = false;
    this.speaking = 0;
    this.static = kind === 'a';
    this.facing = 0;
  }

  buildMesh(kind) {
    if (kind === 'a') return this.buildA();
    const g = new THREE.Group();
    const isPav = kind === 'pav';
    const jacket = new THREE.MeshStandardMaterial({
      color: isPav ? 0xc2571f : 0x3d2026, roughness: isPav ? 0.8 : 0.95,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.9 });

    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 4, 8), dark);
    legL.position.set(-0.14, 0.45, 0);
    const legR = legL.clone(); legR.position.x = 0.14;
    g.add(legL, legR);
    this.legs = [legL, legR];

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 4, 12), jacket);
    torso.position.y = 1.12;
    g.add(torso);

    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), jacket);
    armL.position.set(-0.38, 1.15, 0); armL.rotation.z = 0.15;
    const armR = armL.clone(); armR.position.x = 0.38; armR.rotation.z = -0.15;
    g.add(armL, armR);
    this.arms = [armL, armR];

    if (isPav) {
      const skin = new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.7 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skin);
      head.position.y = 1.72;
      g.add(head);
      this.head = head;
      const beanie = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2),
        new THREE.MeshStandardMaterial({ color: 0x27423a, roughness: 0.95 }));
      beanie.position.y = 1.78;
      g.add(beanie);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x668899, emissiveIntensity: 0.6 });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), eyeMat);
      eyeL.position.set(-0.075, 1.74, 0.17);
      const eyeR = eyeL.clone(); eyeR.position.x = 0.075;
      g.add(eyeL, eyeR);
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.06, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x7a2530, roughness: 1 }));
      scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.52;
      g.add(scarf);
    } else {
      // Chase: deep hood + glitch skull mask
      const mask = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12),
        new THREE.MeshStandardMaterial({
          map: skullTex(), emissive: 0xbfd6de, emissiveMap: skullTex(), emissiveIntensity: 0.9,
          color: 0x0a0d10,
        }));
      mask.position.y = 1.72;
      g.add(mask);
      this.head = mask;
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.62, 12, 1, true), jacket);
      hood.position.y = 1.86;
      g.add(hood);
      const hoodBack = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 10, Math.PI * 0.8, Math.PI * 1.4), jacket);
      hoodBack.position.y = 1.74;
      g.add(hoodBack);
    }
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.18), dark);
    pack.position.set(0, 1.16, -0.3);
    g.add(pack);
    const lamp = new THREE.PointLight(isPav ? 0xffe0b0 : 0x9fd8c0, 6, 5, 2);
    lamp.position.set(0, 1.8, 0.2);
    g.add(lamp);
    return g;
  }

  buildA() {
    const g = new THREE.Group();
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x121017, roughness: 1 });
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.5, 1.75, 14), robeMat);
    robe.position.y = 0.95;
    g.add(robe);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 12, 1, true), robeMat);
    hood.position.y = 2.0;
    g.add(hood);
    const faceTex = skullTex('#7dffb0', '#eaffcf');
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12),
      new THREE.MeshStandardMaterial({
        map: faceTex, emissive: 0x9dffc4, emissiveMap: faceTex, emissiveIntensity: 1.6, color: 0x040608,
      }));
    face.position.y = 1.82;
    g.add(face);
    this.head = face;
    // the green heart on the chest
    const heart = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshStandardMaterial({
        map: canvasTex(64, 64, (c, w2, h2) => {
          c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w2, h2);
          c.fillStyle = '#39ff88'; c.font = 'bold 52px monospace'; c.textAlign = 'center';
          c.shadowColor = '#39ff88'; c.shadowBlur = 14;
          c.fillText('♥', 32, 50);
        }),
        transparent: true, emissive: 0x39ff88, emissiveIntensity: 2,
      }));
    heart.position.set(0, 1.3, 0.42);
    g.add(heart);
    const aura = new THREE.PointLight(0x39ff88, 10, 8, 2);
    aura.position.y = 1.6;
    g.add(aura);
    this.legs = []; this.arms = [];
    return g;
  }

  hide() {
    this.hidden = true;
    this.group.visible = false;
    this.crumbs.length = 0;
  }

  appearAt(pos, facing = 0) {
    this.hidden = false;
    this.group.visible = true;
    this.group.position.copy(pos);
    this.facing = facing;
    this.group.rotation.y = facing;
    this.crumbs.length = 0;
  }

  bumpSpeaking() { this.speaking = 2.2; }

  update(dt, t, playerPos) {
    if (this.hidden) return;
    const myPos = this.group.position;

    if (this.static) {
      // A: hover, face the player, breathe
      myPos.y += Math.sin(t * 1.1) * 0.0015;
      const dx = playerPos.x - myPos.x, dz = playerPos.z - myPos.z;
      if (Math.hypot(dx, dz) < 14) {
        const target = Math.atan2(dx, dz);
        let a = target - this.group.rotation.y;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        this.group.rotation.y += a * Math.min(1, dt * 3);
      }
      if (this.speaking > 0) {
        this.speaking -= dt;
        this.head.rotation.x = Math.sin(t * 7) * 0.05;
      }
      return;
    }

    // breadcrumb follow
    if (t - this.lastCrumbTime > 0.2) {
      const last = this.crumbs[this.crumbs.length - 1];
      if (!last || last.distanceToSquared(playerPos) > 0.35) {
        this.crumbs.push(playerPos.clone());
        if (this.crumbs.length > 140) this.crumbs.shift();
      }
      this.lastCrumbTime = t;
    }

    const distToPlayer = Math.hypot(playerPos.x - myPos.x, playerPos.z - myPos.z);
    const vertGap = Math.abs(playerPos.y - 1.7 - myPos.y);
    let moving = false;

    if (distToPlayer > 2.3 && this.crumbs.length) {
      let target = this.crumbs[0];
      while (target && Math.hypot(target.x - myPos.x, target.z - myPos.z) < 0.5) {
        this.crumbs.shift();
        target = this.crumbs[0];
      }
      if (target) {
        const dx = target.x - myPos.x, dz = target.z - myPos.z;
        const d = Math.hypot(dx, dz) || 1;
        const speed = distToPlayer > 7 ? 7.2 : 4.0;
        myPos.x += (dx / d) * speed * dt;
        myPos.z += (dz / d) * speed * dt;
        this.facing = Math.atan2(dx, dz);
        moving = true;
      }
    }
    // catch-up teleport if hopelessly far or on a different floor
    if (distToPlayer > 22 || vertGap > 6) {
      myPos.set(playerPos.x - 1.5, playerPos.y - 1.7, playerPos.z - 1.5);
      this.crumbs.length = 0;
    }

    const ground = this.world.groundHeightAt(myPos.x, myPos.z, myPos.y + 0.6);
    if (ground > -Infinity) myPos.y = THREE.MathUtils.damp(myPos.y, ground, 12, dt);

    if (!moving) {
      const dx = playerPos.x - myPos.x, dz = playerPos.z - myPos.z;
      this.facing = Math.atan2(dx, dz);
    }
    let a = this.facing - this.group.rotation.y;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    this.group.rotation.y += a * Math.min(1, dt * 8);

    if (moving) {
      this.walkPhase += dt * 9;
      this.legs[0].rotation.x = Math.sin(this.walkPhase) * 0.55;
      this.legs[1].rotation.x = -Math.sin(this.walkPhase) * 0.55;
      this.arms[0].rotation.x = -Math.sin(this.walkPhase) * 0.4;
      this.arms[1].rotation.x = Math.sin(this.walkPhase) * 0.4;
      this.group.position.y += Math.abs(Math.sin(this.walkPhase)) * 0.02;
    } else {
      this.legs.forEach((l) => (l.rotation.x = THREE.MathUtils.damp(l.rotation.x, 0, 10, dt)));
      this.arms.forEach((ar) => (ar.rotation.x = THREE.MathUtils.damp(ar.rotation.x, 0, 10, dt)));
      if (this.head) this.head.position.y = 1.72 + Math.sin(t * 1.7) * 0.012;
    }
    if (this.speaking > 0) {
      this.speaking -= dt;
      if (this.head) this.head.rotation.x = Math.sin(t * 9) * 0.06;
    } else if (this.head) {
      this.head.rotation.x = THREE.MathUtils.damp(this.head.rotation.x, 0, 8, dt);
    }
  }
}
