// Snow + lightning. Snow is visible whenever the player is somewhere open to
// the sky (street, light-well, roof); the full thunder-blizzard only starts
// with the roof reveal.
import * as THREE from 'three';
import * as audio from './audio.js';
import { state } from './state.js';

const SNOW_COUNT = 14000;
const RANGE = { x: 90, y: 45, z: 90 };

export class Effects {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.buildSnow();
    this.nextStrike = 3;
    this.flash = 0;
    this.baseBg = new THREE.Color(0x0b1120);
    this.flashBg = new THREE.Color(0x2a3d5e);
    this.wind = new THREE.Vector3(6.5, 0, 1.5);
    this.windT = 0;
  }

  buildSnow() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(SNOW_COUNT * 3);
    const speed = new Float32Array(SNOW_COUNT);
    for (let i = 0; i < SNOW_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * RANGE.x;
      pos[i * 3 + 1] = Math.random() * RANGE.y;
      pos[i * 3 + 2] = (Math.random() - 0.5) * RANGE.z;
      speed[i] = 4 + Math.random() * 5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snowSpeed = speed;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    const sprite = new THREE.CanvasTexture(c);
    const mat = new THREE.PointsMaterial({
      color: 0xe8f0fa, size: 0.14, sizeAttenuation: true, map: sprite,
      transparent: true, opacity: 0.8, depthWrite: false,
    });
    this.snow = new THREE.Points(geo, mat);
    this.snow.visible = true;
    this.snow.frustumCulled = false;
    this.scene.add(this.snow);
  }

  update(dt, t, camera, zone) {
    const openSky = zone === 'street' || zone === 'lightwell' || zone === 'roof' || zone === 'spire';
    this.snow.visible = openSky;
    if (!openSky && this.flash <= 0) return;

    // gusting wind — gentler at street level, howling on the roof
    const gust = zone === 'street' ? 0.4 : 1;
    this.windT += dt;
    this.wind.x = (6.5 + Math.sin(this.windT * 0.35) * 3.5 + Math.sin(this.windT * 1.7) * 1.2) * gust;
    this.wind.z = (1.5 + Math.sin(this.windT * 0.23 + 2) * 2.2) * gust;

    if (this.snow.visible) {
      const pos = this.snow.geometry.attributes.position.array;
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      for (let i = 0; i < SNOW_COUNT; i++) {
        let x = pos[i * 3] + this.wind.x * dt * (0.5 + (i % 7) * 0.1);
        let y = pos[i * 3 + 1] - this.snowSpeed[i] * dt;
        let z = pos[i * 3 + 2] + this.wind.z * dt;
        if (y < cy - 12) y += RANGE.y;
        if (x < cx - RANGE.x / 2) x += RANGE.x; else if (x > cx + RANGE.x / 2) x -= RANGE.x;
        if (z < cz - RANGE.z / 2) z += RANGE.z; else if (z > cz + RANGE.z / 2) z -= RANGE.z;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }

    // lightning — only once the roof has been revealed
    if (state.outside && openSky) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.strike();
        this.nextStrike = 5 + Math.random() * 9;
      }
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      const f = this.flash * (0.6 + 0.4 * Math.sin(t * 60));
      this.world.stormLight.intensity = (state.outside ? 0.4 : 0.22) + f * 5.5;
      this.scene.background.lerpColors(this.baseBg, this.flashBg, Math.min(1, f));
    }
  }

  strike() {
    this.flash = 0.8 + Math.random() * 0.5;
    const dist = Math.random();
    this.world.stormLight.position.set(
      (Math.random() - 0.5) * 160, 140, (Math.random() - 0.5) * 160);
    setTimeout(() => audio.thunder(1.2 - dist * 0.7), 300 + dist * 2800);
  }
}
