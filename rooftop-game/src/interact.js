// Center-screen raycast against interactable meshes; shows a prompt and
// fires the action on E.
import * as THREE from 'three';

export class Interact {
  constructor(camera, world, ui) {
    this.camera = camera;
    this.world = world;
    this.ui = ui;
    this.ray = new THREE.Raycaster();
    this.ray.far = 3.0;
    this.current = null;
    this.enabled = false;

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && this.enabled && this.current) {
        this.current.action();
      }
    });
  }

  update() {
    if (!this.enabled) {
      this.current = null;
      this.ui.prompt(null);
      return;
    }
    this.ray.setFromCamera({ x: 0, y: 0 }, this.camera);
    const meshes = [];
    for (const it of this.world.interactables) {
      if (it.mesh.visible !== false) meshes.push(it.mesh);
    }
    const hits = this.ray.intersectObjects(meshes, true);
    let found = null;
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.interact) o = o.parent;
      const it = o?.userData?.interact;
      if (!it) continue;
      const label = typeof it.label === 'function' ? it.label() : it.label;
      if (label) { found = { ...it, labelText: label }; break; }
    }
    this.current = found;
    this.ui.prompt(found ? `<b>[E]</b> ${found.labelText}` : null);
  }
}
