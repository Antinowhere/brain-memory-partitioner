// Security: patrolling guards with vision cones and CCTV cameras that alert.
// Guards patrol the stairs and the mech crown; the lobby guard is asleep at
// reception (running near him wakes him). Getting seen for long enough emits
// 'busted'; CCTV emits 'cctv' which sends the local guard to investigate.
import * as THREE from 'three';
import { emit } from './state.js';
import * as audio from './audio.js';

const raycaster = new THREE.Raycaster();

function hasLineOfSight(world, from, to) {
  const dir = to.clone().sub(from);
  const dist = dir.length();
  raycaster.set(from, dir.normalize());
  raycaster.far = dist - 0.2;
  const hits = raycaster.intersectObjects(world.occluders, false);
  return hits.length === 0;
}

export class Guard {
  constructor(scene, world, { waypoints, y, sleeping = false, name = 'guard' }) {
    this.scene = scene;
    this.world = world;
    this.name = name;
    this.waypoints = waypoints; // [{x,z,wait}]
    this.y = y;
    this.sleeping = sleeping;
    this.wpIndex = 0;
    this.waitT = 0;
    this.seenT = 0;
    this.scanT = 0;      // alerted scan timer (woken sleeper / cctv)
    this.investigate = null; // Vector3 target
    this.checkT = 0;
    this.walkPhase = 0;
    this.group = this.buildMesh();
    const p = waypoints[0];
    this.group.position.set(p.x, y, p.z);
    scene.add(this.group);
    this.exclaim = this.buildExclaim();
    this.group.add(this.exclaim);
    if (sleeping) this.setSleepPose(true);
  }

  buildMesh() {
    const g = new THREE.Group();
    const navy = new THREE.MeshStandardMaterial({ color: 0x1d2c45, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc79b78, roughness: 0.7 });
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 4, 8), dark);
    legL.position.set(-0.14, 0.45, 0);
    const legR = legL.clone(); legR.position.x = 0.14;
    g.add(legL, legR);
    this.legs = [legL, legR];
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.55, 4, 12), navy);
    torso.position.y = 1.12;
    g.add(torso);
    this.torso = torso;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 16), dark);
    belt.rotation.x = Math.PI / 2; belt.position.y = 0.88;
    g.add(belt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), skin);
    head.position.y = 1.7;
    g.add(head);
    this.head = head;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.14, 14), navy);
    cap.position.y = 1.86; g.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), navy);
    brim.position.set(0, 1.8, 0.22); g.add(brim);
    // shoulder radio LED
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x000, emissive: 0xff3333, emissiveIntensity: 2 }));
    led.position.set(-0.28, 1.45, 0.12);
    g.add(led);
    // flashlight glow
    const torch = new THREE.SpotLight(0xffe8c0, 30, 14, 0.42, 0.5, 1.6);
    torch.position.set(0.2, 1.4, 0.25);
    const tgt = new THREE.Object3D(); tgt.position.set(0.2, 1.0, 6);
    g.add(tgt); torch.target = tgt;
    g.add(torch);
    this.torch = torch;
    return g;
  }

  buildExclaim() {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4),
      new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false,
        map: (() => {
          const c = document.createElement('canvas'); c.width = c.height = 64;
          const g2 = c.getContext('2d');
          g2.fillStyle = '#ff4444'; g2.font = 'bold 56px monospace'; g2.textAlign = 'center';
          g2.fillText('!', 32, 52);
          const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
          return t;
        })(),
      }));
    s.position.y = 2.35;
    s.visible = false;
    return s;
  }

  setSleepPose(asleep) {
    this.torso.rotation.x = asleep ? 0.55 : 0;
    this.head.position.z = asleep ? 0.18 : 0;
    this.head.position.y = asleep ? 1.58 : 1.7;
    this.torch.intensity = asleep ? 0 : 30;
  }

  goInvestigate(pos) {
    if (this.sleeping) { this.wake(); return; }
    this.investigate = pos.clone();
    this.scanT = 0;
  }

  wake() {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.setSleepPose(false);
    this.scanT = 8; // stands and scans for a while, then dozes back off
    this.wasSleeper = true;
  }

  update(dt, t, player, camera) {
    const g = this.group;
    const playerPos = player.pos;

    // ---------- movement ----------
    let moving = false;
    if (!this.sleeping) {
      let target = null;
      if (this.investigate) {
        target = this.investigate;
        if (Math.hypot(target.x - g.position.x, target.z - g.position.z) < 1.6) {
          this.scanT = 6;
          this.investigate = null;
        }
      } else if (this.scanT > 0) {
        this.scanT -= dt;
        g.rotation.y += Math.sin(t * 0.8) * dt * 1.4;
        if (this.scanT <= 0 && this.wasSleeper) { this.sleeping = true; this.setSleepPose(true); }
      } else if (this.waypoints.length > 1) {
        const wp = this.waypoints[this.wpIndex];
        const d = Math.hypot(wp.x - g.position.x, wp.z - g.position.z);
        if (d < 0.4) {
          if (this.waitT <= 0) this.waitT = wp.wait ?? 1.5;
          this.waitT -= dt;
          if (this.waitT <= 0) this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
        } else {
          target = new THREE.Vector3(wp.x, this.y, wp.z);
        }
      }
      if (target) {
        const dx = target.x - g.position.x, dz = target.z - g.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const speed = this.investigate ? 3.2 : 1.6;
        g.position.x += (dx / d) * speed * dt;
        g.position.z += (dz / d) * speed * dt;
        const face = Math.atan2(dx, dz);
        let a = face - g.rotation.y;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        g.rotation.y += a * Math.min(1, dt * 6);
        moving = true;
      }
    }
    if (moving) {
      this.walkPhase += dt * 7;
      this.legs[0].rotation.x = Math.sin(this.walkPhase) * 0.5;
      this.legs[1].rotation.x = -Math.sin(this.walkPhase) * 0.5;
    } else {
      this.legs.forEach((l) => (l.rotation.x *= 0.9));
    }

    // ---------- perception ----------
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.15;
      this.spotting = this.canSee(player);
    }
    if (this.sleeping) {
      // running or jumping close to a sleeping guard wakes him
      const d = Math.hypot(playerPos.x - g.position.x, playerPos.z - g.position.z);
      const noisy = Math.hypot(player.vel.x, player.vel.z) > 5.2 || (!player.grounded && Math.abs(playerPos.y - 1.7 - this.y) < 2);
      if (d < 6.5 && noisy && Math.abs(playerPos.y - 1.7 - this.y) < 3) {
        this.wake();
        emit('guard:woke', this);
      }
      this.exclaim.visible = false;
      return;
    }
    if (this.spotting) {
      this.seenT += dt;
      this.exclaim.visible = true;
      this.exclaim.lookAt(camera.position);
      if (this.seenT > 0.85) {
        this.seenT = 0;
        emit('busted', this);
      }
    } else {
      this.seenT = Math.max(0, this.seenT - dt * 1.5);
      this.exclaim.visible = this.seenT > 0.1;
      if (this.exclaim.visible) this.exclaim.lookAt(camera.position);
    }
  }

  canSee(player) {
    const g = this.group;
    if (Math.abs(player.pos.y - 1.7 - this.y) > 3.2) return false;
    const dx = player.pos.x - g.position.x, dz = player.pos.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    const maxDist = player.crouched ? 7.5 : 12;
    if (dist > maxDist || dist < 0.001) return false;
    const fwd = new THREE.Vector2(Math.sin(g.rotation.y), Math.cos(g.rotation.y));
    const toP = new THREE.Vector2(dx, dz).normalize();
    if (fwd.dot(toP) < Math.cos(THREE.MathUtils.degToRad(42))) return false;
    const eye = g.position.clone(); eye.y += 1.7;
    return hasLineOfSight(this.world, eye, player.pos.clone());
  }
}

export class CCTV {
  constructor(scene, world, { x, y, z, baseYaw, sweep = 0.9, period = 6, zone }) {
    this.world = world;
    this.zone = zone;
    this.baseYaw = baseYaw;
    this.sweep = sweep;
    this.period = period;
    this.exposeT = 0;
    this.cooldown = 0;
    this.group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.5, metalness: 0.7 }));
    body.position.z = 0.1;
    this.led = new THREE.MeshStandardMaterial({ color: 0x000, emissive: 0xff2222, emissiveIntensity: 2.5 });
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), this.led);
    dot.position.set(0, -0.04, 0.28);
    // visible view cone
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }));
    cone.rotation.x = -Math.PI / 2 - 0.25;
    cone.position.set(0, -1.6, 4.2);
    this.cone = cone;
    this.group.add(body, dot, cone);
    this.group.position.set(x, y, z);
    scene.add(this.group);
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x3a3f45 }));
    mount.position.set(x, y + 0.25, z);
    scene.add(mount);
  }

  update(dt, t, player) {
    this.group.rotation.y = this.baseYaw + Math.sin(t * (Math.PI * 2 / this.period)) * this.sweep;
    if (this.cooldown > 0) { this.cooldown -= dt; this.led.emissive.setHex(0xffaa00); return; }
    this.led.emissive.setHex(0xff2222);
    // detection: within range, inside the sweep cone, line of sight
    const gp = this.group.position;
    const dx = player.pos.x - gp.x, dz = player.pos.z - gp.z, dy = player.pos.y - gp.y;
    const dist = Math.hypot(dx, dz);
    let seen = false;
    if (dist < 11 && dy < 1 && dy > -6) {
      const fwd = new THREE.Vector2(Math.sin(this.group.rotation.y), Math.cos(this.group.rotation.y));
      const toP = new THREE.Vector2(dx, dz).normalize();
      if (fwd.dot(toP) > Math.cos(0.42)) {
        seen = hasLineOfSight(this.world, gp.clone(), player.pos.clone());
      }
    }
    if (seen) {
      this.exposeT += dt * (player.crouched ? 0.6 : 1);
      if (this.exposeT > 1.1) {
        this.exposeT = 0;
        this.cooldown = 14;
        emit('cctv', this);
      }
    } else {
      this.exposeT = Math.max(0, this.exposeT - dt);
    }
  }
}
