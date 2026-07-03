// Pav — your urbex buddy. Follows you on a breadcrumb trail, bobs while
// walking, faces you when idle, and talks (scripted barks + LLM chat).
import * as THREE from 'three';

export class Pav {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.group = this.buildMesh();
    this.group.position.set(1.6, 0, 3.6);
    scene.add(this.group);
    this.crumbs = [];
    this.lastCrumbTime = 0;
    this.walkPhase = 0;
    this.hidden = false;
    this.speaking = 0;
  }

  buildMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshStandardMaterial({ color: 0xc2571f, roughness: 0.8 }); // hi-vis-ish orange parka
    const dark = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.7 });
    const beanieMat = new THREE.MeshStandardMaterial({ color: 0x27423a, roughness: 0.95 });

    // legs
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 4, 8), dark);
    legL.position.set(-0.14, 0.45, 0);
    const legR = legL.clone(); legR.position.x = 0.14;
    g.add(legL, legR);
    this.legs = [legL, legR];
    // torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 4, 12), jacket);
    torso.position.y = 1.12;
    g.add(torso);
    // arms
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), jacket);
    armL.position.set(-0.38, 1.15, 0); armL.rotation.z = 0.15;
    const armR = armL.clone(); armR.position.x = 0.38; armR.rotation.z = -0.15;
    g.add(armL, armR);
    this.arms = [armL, armR];
    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skin);
    head.position.y = 1.72;
    g.add(head);
    this.head = head;
    // beanie
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), beanieMat);
    beanie.position.y = 1.78;
    g.add(beanie);
    // eyes (subtle emissive so he reads in the dark)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x668899, emissiveIntensity: 0.6 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), eyeMat);
    eyeL.position.set(-0.075, 1.74, 0.17);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.075;
    g.add(eyeL, eyeR);
    // scarf
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.06, 8, 16), new THREE.MeshStandardMaterial({ color: 0x7a2530, roughness: 1 }));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.52;
    g.add(scarf);
    // backpack
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.18), dark);
    pack.position.set(0, 1.16, -0.3);
    g.add(pack);
    // headlamp glow
    const lamp = new THREE.PointLight(0xffe0b0, 6, 5, 2);
    lamp.position.set(0, 1.8, 0.2);
    g.add(lamp);
    return g;
  }

  hide() {
    this.hidden = true;
    this.group.visible = false;
    this.crumbs.length = 0;
  }

  appearAt(pos) {
    this.hidden = false;
    this.group.visible = true;
    this.group.position.copy(pos);
    this.crumbs.length = 0;
  }

  bumpSpeaking() { this.speaking = 2.2; }

  update(dt, t, playerPos, playerYaw) {
    if (this.hidden) return;
    // breadcrumbs
    if (t - this.lastCrumbTime > 0.2) {
      const last = this.crumbs[this.crumbs.length - 1];
      if (!last || last.distanceToSquared(playerPos) > 0.35) {
        this.crumbs.push(playerPos.clone());
        if (this.crumbs.length > 120) this.crumbs.shift();
      }
      this.lastCrumbTime = t;
    }

    const myPos = this.group.position;
    const distToPlayer = Math.hypot(playerPos.x - myPos.x, playerPos.z - myPos.z);
    let moving = false;

    if (distToPlayer > 2.3 && this.crumbs.length) {
      // walk toward the oldest crumb; drop crumbs we've reached
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
    } else if (distToPlayer > 12) {
      // way behind (e.g. after teleports) — catch up
      myPos.x = THREE.MathUtils.damp(myPos.x, playerPos.x - 1.5, 2, dt);
      myPos.z = THREE.MathUtils.damp(myPos.z, playerPos.z - 1.5, 2, dt);
    }

    // stick to floor
    const ground = this.world.groundHeightAt(myPos.x, myPos.z, myPos.y + 0.5);
    if (ground > -Infinity) myPos.y = THREE.MathUtils.damp(myPos.y, ground, 12, dt);

    // face movement direction, or the player when idle
    if (!moving) {
      const dx = playerPos.x - myPos.x, dz = playerPos.z - myPos.z;
      this.facing = Math.atan2(dx, dz);
    }
    if (this.facing !== undefined) {
      let a = this.facing - this.group.rotation.y;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      this.group.rotation.y += a * Math.min(1, dt * 8);
    }

    // walk cycle / idle bob
    if (moving) {
      this.walkPhase += dt * 9;
      this.legs[0].rotation.x = Math.sin(this.walkPhase) * 0.55;
      this.legs[1].rotation.x = -Math.sin(this.walkPhase) * 0.55;
      this.arms[0].rotation.x = -Math.sin(this.walkPhase) * 0.4;
      this.arms[1].rotation.x = Math.sin(this.walkPhase) * 0.4;
      this.group.position.y += Math.abs(Math.sin(this.walkPhase)) * 0.02;
    } else {
      this.legs.forEach((l) => (l.rotation.x = THREE.MathUtils.damp(l.rotation.x, 0, 10, dt)));
      this.arms.forEach((a) => (a.rotation.x = THREE.MathUtils.damp(a.rotation.x, 0, 10, dt)));
      this.head.position.y = 1.72 + Math.sin(t * 1.7) * 0.012;
    }
    // talking head-nod
    if (this.speaking > 0) {
      this.speaking -= dt;
      this.head.rotation.x = Math.sin(t * 9) * 0.06;
    } else {
      this.head.rotation.x = THREE.MathUtils.damp(this.head.rotation.x, 0, 8, dt);
    }
  }
}
