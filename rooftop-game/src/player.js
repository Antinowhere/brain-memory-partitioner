// First-person controller: pointer-lock look, WASD, run, jump, crouch,
// AABB collision + angled wall segments (star room), step-up (stairs),
// ladder volumes, floor regions, and a rappel mode for the finale.
import * as THREE from 'three';

const GRAVITY = 20;
const EYE_STAND = 1.7;
const EYE_CROUCH = 1.12;
const HEIGHT_STAND = 1.82;
const HEIGHT_CROUCH = 1.24;
const RADIUS = 0.34;
const STEP_UP = 0.45;

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, EYE_STAND, 20);
    this.vel = new THREE.Vector3();
    this.yaw = 0; // facing -z, toward the tower
    this.pitch = 0;
    this.crouched = false;
    this.grounded = true;
    this.onLadder = false;
    this.enabled = false;
    this.keys = {};
    this.headBob = 0;
    this.rappel = null; // { x, z, t }

    document.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.52, 1.52);
    });
  }

  get eyeHeight() { return this.crouched ? EYE_CROUCH : EYE_STAND; }
  get height() { return this.crouched ? HEIGHT_CROUCH : HEIGHT_STAND; }
  get feet() { return this.pos.y - this.eyeHeight; }

  clearKeys() { this.keys = {}; }

  teleport(x, y, z, yaw = null) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    if (yaw !== null) this.yaw = yaw;
  }

  startRappel(x, z) {
    this.rappel = { x, z, t: 0 };
    this.crouched = false;
    this.pos.x = x; this.pos.z = z;
    this.vel.set(0, 0, 0);
  }

  stopRappel() { this.rappel = null; }

  aabbAt(px, py, pz) {
    const feet = py - this.eyeHeight;
    return {
      minX: px - RADIUS, maxX: px + RADIUS,
      minY: feet, maxY: feet + this.height,
      minZ: pz - RADIUS, maxZ: pz + RADIUS,
    };
  }

  overlaps(a, b) {
    return a.minX < b.max.x && a.maxX > b.min.x &&
           a.minY < b.max.y && a.maxY > b.min.y &&
           a.minZ < b.max.z && a.maxZ > b.min.z;
  }

  update(dt, world) {
    if (!this.enabled) { this.syncCamera(0); return; }
    dt = Math.min(dt, 0.05);
    const k = this.keys;

    // ---- rappel mode: locked to the line, W brakes, S drops faster ----
    if (this.rappel) {
      this.rappel.t += dt;
      const base = -3.2;
      let vy = base;
      if (k['KeyW']) vy = -0.6;
      if (k['KeyS']) vy = -7.5;
      this.pos.y += vy * dt;
      this.pos.x = this.rappel.x + Math.sin(this.rappel.t * 0.9) * 0.22;
      this.pos.z = this.rappel.z + Math.cos(this.rappel.t * 0.7) * 0.18;
      this.grounded = false;
      this.syncCamera(0);
      return;
    }

    // crouch (hold C)
    const wantCrouch = !!k['KeyC'];
    if (wantCrouch !== this.crouched) {
      if (wantCrouch) this.crouched = true;
      else {
        const test = this.aabbAt(this.pos.x, this.pos.y + (EYE_STAND - EYE_CROUCH), this.pos.z);
        test.maxY = test.minY + HEIGHT_STAND;
        let blocked = false;
        for (const c of world.colliders) if (this.overlaps(test, c.box)) { blocked = true; break; }
        if (!blocked) this.crouched = false;
      }
    }

    // movement intent
    const fwd = (k['KeyW'] ? 1 : 0) - (k['KeyS'] ? 1 : 0);
    const strafe = (k['KeyD'] ? 1 : 0) - (k['KeyA'] ? 1 : 0);
    const running = !!k['ShiftLeft'] || !!k['ShiftRight'];
    const speed = this.crouched ? 2.0 : running ? 7.0 : 4.3;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dirX = (-sin * fwd) + (cos * strafe);
    const dirZ = (-cos * fwd) + (-sin * strafe);
    const len = Math.hypot(dirX, dirZ) || 1;
    const tx = (dirX / len) * speed * (fwd || strafe ? 1 : 0);
    const tz = (dirZ / len) * speed * (fwd || strafe ? 1 : 0);
    const accel = this.grounded || this.onLadder ? 14 : 4;
    this.vel.x = THREE.MathUtils.damp(this.vel.x, tx, accel, dt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, tz, accel, dt);

    this.onLadder = world.inLadder(this.pos.x, this.pos.y - 0.5, this.pos.z);

    if (this.onLadder) {
      this.vel.y = fwd > 0 || k['Space'] ? 3.0 : (k['KeyS'] ? -3.0 : 0);
      this.vel.x *= 0.6; this.vel.z *= 0.6;
    } else {
      this.vel.y -= GRAVITY * dt;
      if (k['Space'] && this.grounded) {
        this.vel.y = 7.0;
        this.grounded = false;
      }
    }

    this.moveAxis(world, 'x', this.vel.x * dt);
    this.moveAxis(world, 'z', this.vel.z * dt);
    this.resolveWallSegs(world);
    this.moveVertical(world, dt);

    const planar = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && planar > 0.5) this.headBob += dt * planar * 1.6;
    this.syncCamera(planar);
  }

  tryStepUp(world, next, top) {
    // step onto low obstacles (stairs, curbs) when there's headroom
    const rise = top - (next.y - this.eyeHeight);
    if (rise <= 0 || rise > STEP_UP || (!this.grounded && !this.onLadder)) return false;
    const test = this.aabbAt(next.x, next.y + rise + 0.02, next.z);
    for (const c of world.colliders) if (this.overlaps(test, c.box)) return false;
    next.y += rise + 0.02;
    return true;
  }

  moveAxis(world, axis, delta) {
    if (delta === 0) return;
    const next = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
    next[axis] += delta;
    let box = this.aabbAt(next.x, next.y, next.z);
    for (const c of world.colliders) {
      if (!this.overlaps(box, c.box)) continue;
      if (this.tryStepUp(world, next, c.box.max.y)) {
        box = this.aabbAt(next.x, next.y, next.z);
        continue;
      }
      if (delta > 0) next[axis] = (axis === 'x' ? c.box.min.x : c.box.min.z) - RADIUS - 0.001;
      else next[axis] = (axis === 'x' ? c.box.max.x : c.box.max.z) + RADIUS + 0.001;
      box = this.aabbAt(next.x, next.y, next.z);
      if (axis === 'x') this.vel.x = 0; else this.vel.z = 0;
    }
    this.pos.x = next.x; this.pos.y = next.y; this.pos.z = next.z;
  }

  resolveWallSegs(world) {
    const feet = this.feet, head = feet + this.height;
    for (const s of world.wallSegs) {
      if (head < s.ymin || feet > s.ymax) continue;
      // closest point on segment to player (2D)
      const abx = s.bx - s.ax, abz = s.bz - s.az;
      const l2 = abx * abx + abz * abz || 1;
      let t = ((this.pos.x - s.ax) * abx + (this.pos.z - s.az) * abz) / l2;
      t = THREE.MathUtils.clamp(t, 0, 1);
      const cx = s.ax + abx * t, cz = s.az + abz * t;
      let dx = this.pos.x - cx, dz = this.pos.z - cz;
      const d = Math.hypot(dx, dz);
      const min = RADIUS + 0.18; // half wall thickness
      if (d >= min || d === 0) continue;
      dx /= d; dz /= d;
      this.pos.x = cx + dx * min;
      this.pos.z = cz + dz * min;
      const vn = this.vel.x * dx + this.vel.z * dz;
      if (vn < 0) { this.vel.x -= vn * dx; this.vel.z -= vn * dz; }
    }
  }

  moveVertical(world, dt) {
    const dy = this.vel.y * dt;
    const prevFeet = this.feet;
    let newY = this.pos.y + dy;
    let newFeet = newY - this.eyeHeight;
    let landed = false;

    const ground = world.groundHeightAt(this.pos.x, this.pos.z, prevFeet);
    if (this.vel.y <= 0 && newFeet <= ground && prevFeet >= ground - 0.35) {
      newY = ground + this.eyeHeight;
      this.vel.y = 0;
      landed = true;
    }

    if (!landed) {
      const box = this.aabbAt(this.pos.x, newY, this.pos.z);
      for (const c of world.colliders) {
        const horiz = box.minX < c.box.max.x && box.maxX > c.box.min.x &&
                      box.minZ < c.box.max.z && box.maxZ > c.box.min.z;
        if (!horiz) continue;
        if (this.vel.y <= 0 && prevFeet >= c.box.max.y - 0.05 && newFeet < c.box.max.y) {
          newY = c.box.max.y + this.eyeHeight;
          this.vel.y = 0;
          landed = true;
          break;
        }
        const prevHead = prevFeet + this.height;
        const newHead = newFeet + this.height;
        if (this.vel.y > 0 && prevHead <= c.box.min.y + 0.05 && newHead > c.box.min.y) {
          newY = c.box.min.y - this.height + this.eyeHeight - 0.001;
          this.vel.y = 0;
          break;
        }
      }
    }

    this.pos.y = newY;
    this.grounded = landed || this.onLadder;
  }

  syncCamera(planarSpeed) {
    const bobY = this.grounded && planarSpeed > 0.5 ? Math.sin(this.headBob) * 0.045 : 0;
    const bobX = this.grounded && planarSpeed > 0.5 ? Math.cos(this.headBob * 0.5) * 0.02 : 0;
    this.camera.position.set(this.pos.x + bobX, this.pos.y + bobY, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
