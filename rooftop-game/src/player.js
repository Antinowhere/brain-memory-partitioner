// First-person controller: pointer-lock look, WASD, run, jump, crouch,
// AABB collision against world colliders, floor regions, ladder climbing.
import * as THREE from 'three';

const GRAVITY = 20;
const EYE_STAND = 1.7;
const EYE_CROUCH = 1.12;
const HEIGHT_STAND = 1.82;
const HEIGHT_CROUCH = 1.24;
const RADIUS = 0.34;

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, EYE_STAND, 2.5);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI; // face -z? camera default -z at yaw 0; PI faces +z. Start looking at the desk (+z), then turn.
    this.pitch = 0;
    this.crouched = false;
    this.grounded = true;
    this.onLadder = false;
    this.enabled = false;
    this.keys = {};
    this.headBob = 0;

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
    if (!this.enabled) {
      this.syncCamera(0);
      return;
    }
    dt = Math.min(dt, 0.05);
    const k = this.keys;

    // crouch (hold C)
    const wantCrouch = !!k['KeyC'];
    if (wantCrouch !== this.crouched) {
      if (wantCrouch) this.crouched = true;
      else {
        // only stand if there is headroom
        const test = this.aabbAt(this.pos.x, this.pos.y + (EYE_STAND - EYE_CROUCH), this.pos.z);
        // temporarily use standing dims
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
    // camera forward on ground plane: (-sin(yaw), -cos(yaw)) for three.js yaw convention
    const dirX = (-sin * fwd) + (cos * strafe);
    const dirZ = (-cos * fwd) + (-sin * strafe);
    const len = Math.hypot(dirX, dirZ) || 1;
    const tx = (dirX / len) * speed * (fwd || strafe ? 1 : 0);
    const tz = (dirZ / len) * speed * (fwd || strafe ? 1 : 0);
    // snappy accel
    const accel = this.grounded || this.onLadder ? 14 : 4;
    this.vel.x = THREE.MathUtils.damp(this.vel.x, tx, accel, dt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, tz, accel, dt);

    // ladder check
    this.onLadder = world.ladderZone &&
      world.ladderZone.containsPoint(new THREE.Vector3(this.pos.x, this.pos.y - 0.5, this.pos.z));

    if (this.onLadder) {
      this.vel.y = fwd > 0 ? 3.0 : (k['KeyS'] ? -3.0 : (k['Space'] ? 3.0 : 0));
      // damp horizontal drift on the ladder
      this.vel.x *= 0.6; this.vel.z *= 0.6;
    } else {
      this.vel.y -= GRAVITY * dt;
      if (k['Space'] && this.grounded) {
        this.vel.y = 7.0;
        this.grounded = false;
      }
    }

    // integrate + resolve per axis
    this.moveAxis(world, 'x', this.vel.x * dt);
    this.moveAxis(world, 'z', this.vel.z * dt);
    this.moveVertical(world, dt);

    // head bob
    const planar = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && planar > 0.5) this.headBob += dt * planar * 1.6;
    this.syncCamera(planar);
  }

  moveAxis(world, axis, delta) {
    if (delta === 0) return;
    const next = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
    next[axis] += delta;
    const box = this.aabbAt(next.x, next.y, next.z);
    for (const c of world.colliders) {
      if (!this.overlaps(box, c.box)) continue;
      // allow stepping over very low obstacles is skipped; simple push-back:
      if (delta > 0) next[axis] = (axis === 'x' ? c.box.min.x : c.box.min.z) - RADIUS - 0.001;
      else next[axis] = (axis === 'x' ? c.box.max.x : c.box.max.z) + RADIUS + 0.001;
      // recompute box for subsequent colliders
      box.minX = next.x - RADIUS; box.maxX = next.x + RADIUS;
      box.minZ = next.z - RADIUS; box.maxZ = next.z + RADIUS;
      if (axis === 'x') this.vel.x = 0; else this.vel.z = 0;
    }
    this.pos.x = next.x; this.pos.z = next.z;
  }

  moveVertical(world, dt) {
    const dy = this.vel.y * dt;
    const prevFeet = this.feet;
    let newY = this.pos.y + dy;
    let newFeet = newY - this.eyeHeight;
    let landed = false;

    // floor regions
    const ground = world.groundHeightAt(this.pos.x, this.pos.z, prevFeet);
    if (this.vel.y <= 0 && newFeet <= ground && prevFeet >= ground - 0.35) {
      newY = ground + this.eyeHeight;
      this.vel.y = 0;
      landed = true;
    }

    // collider tops (land) and bottoms (head bump)
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
