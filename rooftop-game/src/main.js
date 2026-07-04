// WHITEOUT SPIRE — bootstrap and game loop.
import * as THREE from 'three';
import { World, ROOF_Y, PLAT_Y, HOLE, LIGHTWELL } from './world.js';
import { STAIRWELL } from './levelBuilding.js';
import { Player } from './player.js';
import { NPC } from './npc.js';
import { Guard, CCTV } from './guards.js';
import { Interact } from './interact.js';
import { Effects } from './effects.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as brains from './brains.js';
import { state, on, emit, currentObjective, describeState } from './state.js';

// ------------------------------------------------------------------- setup
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1120);
scene.fog = new THREE.FogExp2(0x06080d, 0.016);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 500);

const world = new World(scene);
const player = new Player(camera);
const interact = new Interact(camera, world, ui);
const effects = new Effects(scene, world);

// friendly NPCs
const npcs = {
  pav: new NPC(scene, world, 'pav'),
  chase: new NPC(scene, world, 'chase'),
};
npcs.pav.appearAt(new THREE.Vector3(1.8, 0, 21.5));
npcs.chase.hide(); // the player IS Chase at the start
const aNpc = new NPC(scene, world, 'a');
aNpc.appearAt(new THREE.Vector3(HOLE.x, PLAT_Y, HOLE.z - 2.3), Math.PI);

// security
const guards = [
  new Guard(scene, world, { name: 'lobby', sleeping: true, y: 0.12, waypoints: [{ x: 0, z: -14.9 }] }),
  new Guard(scene, world, {
    name: 'stairs', y: 33.72,
    waypoints: [{ x: -16.6, z: -36.5, wait: 2.5 }, { x: -12.4, z: -36.5, wait: 2.5 }],
  }),
  new Guard(scene, world, {
    name: 'mech', y: 38,
    waypoints: [45, 135, 200, 260, 315].map((deg) => ({
      x: HOLE.x + Math.cos(deg * Math.PI / 180) * 13.5,
      z: HOLE.z + Math.sin(deg * Math.PI / 180) * 13.5,
      wait: 2,
    })),
  }),
];
const cctvs = [
  new CCTV(scene, world, { x: -13.2, y: 6.0, z: -22.6, baseYaw: 0.95, sweep: 0.7, period: 7, zone: 'lobby' }),
  new CCTV(scene, world, { x: 8, y: 33.1, z: -28, baseYaw: -Math.PI / 2, sweep: 0.8, period: 6, zone: 'office' }),
  new CCTV(scene, world, { x: 6.6, y: 44, z: -27.4, baseYaw: 0.78, sweep: 1.0, period: 8, zone: 'mech' }),
];

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --------------------------------------------------------------- zones
const CHECKPOINTS = {
  street: [0, 1.7, 20, 0],
  lobby: [18, 1.85, -16, Math.PI / 2],
  office: [4, 31.7, -45.3, Math.PI],
  stairs: [-14.5, 31.7, -31.6, 0.4],
  mech: [-9.8, 39.7, -32.2, -Math.PI / 2],
  lightwell: [23.2, 42.7, -34, Math.PI / 2],
  roof: [10.5, 47.7, -34, Math.PI / 2],
  spire: [10.5, 47.7, -34, Math.PI / 2],
};

function inRect(p, x1, z1, x2, z2) { return p.x > x1 && p.x < x2 && p.z > z1 && p.z < z2; }

function zoneOf(p) {
  const y = p.y;
  if (y < 12) {
    if (inRect(p, -14.5, -28.2, 14.5, -3.8) || inRect(p, 13.5, -18.2, 22.3, -13.8)) return 'lobby';
    return 'street';
  }
  if (y < 36) {
    if (inRect(p, STAIRWELL.x1 - 0.4, STAIRWELL.z1 - 0.4, STAIRWELL.x2 + 0.4, STAIRWELL.z2 + 0.4)) return 'stairs';
    return 'office';
  }
  if (y < 45.3) {
    if (p.x > 14 && p.z > -36.6 && p.z < -31.4) return 'lightwell';
    if (inRect(p, STAIRWELL.x1 - 0.4, STAIRWELL.z1 - 0.4, STAIRWELL.x2 + 0.4, STAIRWELL.z2 + 0.4)) return 'stairs';
    return 'mech';
  }
  return y > 60 ? 'spire' : 'roof';
}

// --------------------------------------------------------------- game flow
let started = false;
let debugMode = new URLSearchParams(location.search).has('debug');
let keypadUI = null;
let riding = false;
let cinematic = false; // busted / fell / finale transitions
let mash = { active: false, progress: 0 };

const companion = () => (state.currentChar === 'chase' ? npcs.pav : npcs.chase);
const companionName = () => (state.currentChar === 'chase' ? 'Pav' : 'Chase');

function controlsActive() {
  return started && !riding && !cinematic && !ui.modalOpen && !ui.chatOpen &&
    (debugMode || document.pointerLockElement === renderer.domElement);
}

function requestLock() {
  if (debugMode) return;
  try { renderer.domElement.requestPointerLock({ unadjustedMovement: true })?.catch?.(() => renderer.domElement.requestPointerLock()); }
  catch { renderer.domElement.requestPointerLock(); }
}

ui.els.play.addEventListener('click', () => {
  audio.init();
  audio.resume();
  started = true;
  state.started = true;
  ui.hideTitle();
  requestLock();
  ui.setObjective(currentObjective());
  ui.setCharacter('Chase');
  setTimeout(() => bark('intro'), 1500);
});

ui.els.resume.addEventListener('click', () => {
  audio.resume();
  ui.showResume(false);
  requestLock();
});

document.addEventListener('pointerlockchange', () => {
  if (debugMode) return;
  const locked = document.pointerLockElement === renderer.domElement;
  if (started && !locked && !ui.modalOpen && !ui.chatOpen && !riding) {
    ui.showResume(true);
    player.clearKeys();
  } else if (locked) {
    ui.showResume(false);
  }
});

ui.els.gear.addEventListener('click', () => {
  audio.init();
  ui.openSettings();
  player.clearKeys();
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (ui.modalOpen) { ui.closeModal(); keypadUI = null; if (started) requestLock(); }
    else if (ui.chatOpen) { ui.closeChat(); if (started) requestLock(); }
    return;
  }
  if (ui.chatOpen) {
    if (e.code === 'Enter') sendChat();
    return;
  }
  if (ui.modalOpen || riding) return;
  if (e.code === 'KeyT' && started) {
    e.preventDefault();
    document.exitPointerLock?.();
    ui.showResume(false);
    player.clearKeys();
    ui.openChat(chatTargetName());
  }
  if (e.code === 'KeyQ' && started) trySwap();
});

ui.els.modal.addEventListener('click', (e) => {
  if (e.target === ui.els.modal) { ui.closeModal(); keypadUI = null; if (started) requestLock(); }
});

// -------------------------------------------------------------- swap (Q)
function trySwap() {
  if (!controlsActive()) return;
  if (player.onLadder || player.crouched || player.rappel) { ui.toast('CAN\'T SWAP RIGHT NOW'); return; }
  const other = companion();
  if (other.hidden) { ui.toast(`${companionName().toUpperCase()} ISN'T WITH YOU`); return; }
  const oldChar = state.currentChar;
  const newChar = oldChar === 'chase' ? 'pav' : 'chase';
  // the body you leave behind
  npcs[oldChar].appearAt(new THREE.Vector3(player.pos.x, player.pos.y - player.eyeHeight, player.pos.z), player.yaw);
  // take over the other body
  const dest = npcs[newChar].group.position;
  const yaw = npcs[newChar].group.rotation.y;
  player.teleport(dest.x, dest.y + 1.7, dest.z, yaw + Math.PI * (Math.random() < 0.5 ? 0 : 0));
  npcs[newChar].hide();
  state.currentChar = newChar;
  ui.setCharacter(newChar === 'chase' ? 'Chase' : 'Pav');
  audio.pickup();
  ui.els.fade.style.opacity = 0.6;
  setTimeout(() => ui.fadeIn(), 120);
}

// ------------------------------------------------------------------- chat
function chatTarget() {
  if (!aNpc.hidden) {
    const d = Math.hypot(player.pos.x - aNpc.group.position.x, player.pos.z - aNpc.group.position.z);
    if (d < 9 && Math.abs(player.pos.y - 1.7 - aNpc.group.position.y) < 3) return 'a';
  }
  return state.currentChar === 'chase' ? 'pav' : 'chase';
}
function chatTargetName() {
  const t = chatTarget();
  return t === 'a' ? 'A' : t === 'pav' ? 'Pav' : 'Chase';
}

let chatBusy = false;
async function sendChat() {
  const text = ui.els.chatinput.value.trim();
  const target = chatTarget();
  const name = chatTargetName();
  ui.closeChat();
  if (started) requestLock();
  if (!text || chatBusy) return;
  ui.say(state.currentChar === 'chase' ? 'CHASE' : 'PAV', text, { you: true });
  chatBusy = true;
  const npc = target === 'a' ? aNpc : npcs[target];
  npc.bumpSpeaking();
  const bubble = ui.say(name.toUpperCase(), '…');
  const reply = await brains.ask(target, text, describeState(player.pos), (acc) => {
    bubble.update(acc);
    npc.bumpSpeaking();
  });
  bubble.update(reply);
  chatBusy = false;
}

function bark(key) {
  const entry = brains.BARKS[key];
  if (!entry) return;
  const [who, line] = entry;
  const npc = who === 'A' ? aNpc : who === 'PAV' ? npcs.pav : npcs.chase;
  if (npc && !npc.hidden) npc.bumpSpeaking();
  ui.say(who, line);
}

// --------------------------------------------------------------- reactions
function refreshObjective() { ui.setObjective(currentObjective()); }

on('ui:keypad', () => {
  if (state.stairsDoorOpen) return;
  player.clearKeys();
  keypadUI = ui.openKeypad((code) => {
    if (state.alarm) { keypadUI.flashError(); ui.toast('SECURITY LOCKOUT — WAIT FOR THE ALERT TO CLEAR'); return; }
    if (code === '1987') {
      audio.keypadOk();
      state.stairsDoorOpen = true;
      ui.closeModal(); keypadUI = null;
      world.openDoor(world.dynamic.stairDoor);
      emit('stairsopen');
      requestLock();
    } else {
      keypadUI.flashError();
    }
  });
});
on('ui:note', ({ html }) => { player.clearKeys(); ui.openNote(html); });

on('frontdoor', () => { bark('frontdoor'); refreshObjective(); });
on('sidedoor', () => { bark('sidedoor'); ui.toast('SERVICE DOOR OPEN'); refreshObjective(); });
on('lobbycard', () => { bark('lobbycard'); ui.toast('ELEVATOR CARD ACQUIRED'); refreshObjective(); });
on('elevatoropen', () => refreshObjective());
on('note', () => { bark('note'); refreshObjective(); });
on('poster', () => { if (state.readOfficeNote && !state.stairsDoorOpen) bark('poster'); });
on('stairsopen', () => { bark('stairsopen'); ui.toast('STAIRWELL UNLOCKED'); refreshObjective(); });
on('maintcard', () => { bark('maintcard'); ui.toast('MAINT KEYCARD ACQUIRED'); refreshObjective(); });
on('reader:nocard', () => ui.toast('A KEYCARD IS REQUIRED'));
on('mechdoor', () => { bark('mechdoor'); ui.toast('MECHANICAL CROWN'); refreshObjective(); });
on('grate', () => { ui.toast('GRATE OPEN'); refreshObjective(); });

// security
on('cctv', (cam) => {
  audio.cctvChirp();
  state.alarm = true;
  setTimeout(() => { state.alarm = false; }, 12000);
  ui.toast('⚠ CCTV ALERT', 3000);
  bark('cctv');
  const g = guards.find((gd) => gd.name === cam.zone);
  if (g) g.goInvestigate(player.pos.clone().setY(g.y));
});
on('guard:woke', () => { audio.spottedSting(); bark('guard_woke'); });
on('busted', () => {
  if (cinematic) return;
  cinematic = true;
  audio.spottedSting();
  ui.toast('SPOTTED — FALL BACK', 3000);
  state.busts++;
  ui.fadeOut(() => {
    const cp = CHECKPOINTS[state.zone] || CHECKPOINTS.street;
    player.teleport(cp[0], cp[1], cp[2], cp[3]);
    const comp = companion();
    if (!comp.hidden) comp.appearAt(new THREE.Vector3(cp[0] - 1.2, cp[1] - 1.7, cp[2] + 1.2), cp[3]);
    guards.forEach((g) => { g.investigate = null; g.seenT = 0; if (g.wasSleeper) { g.sleeping = true; g.setSleepPose(true); } });
    ui.fadeIn();
    cinematic = false;
    bark('busted');
  }, 700);
});

// ------------------------------------------------------------ the elevator
on('elevator:ride', () => {
  if (riding || state.elevatorUsed) return;
  if (!inRect(player.pos, 2.6, -27.6, 5.4, -24)) { ui.toast('STEP INSIDE FIRST'); return; }
  riding = true;
  player.clearKeys();
  audio.doorSlide();
  ui.fadeOut(() => {
    audio.elevatorRumble(4.5);
    setTimeout(() => {
      player.teleport(4, 31.7, -46, Math.PI);
      const comp = companion();
      comp.appearAt(new THREE.Vector3(3, 30, -45), Math.PI);
      state.elevatorUsed = true;
      state.zone = 'office';
    }, 2200);
    setTimeout(() => {
      audio.elevatorDing();
      ui.fadeIn();
      riding = false;
      player.enabled = controlsActive();
      ui.toast('FLOOR 43 — OPERATIONS', 3200);
      bark('elevator_arrive');
      refreshObjective();
    }, 4600);
  }, 700);
});

// ------------------------------------------------------- mash the grate
on('mash', () => {
  if (state.grateOpen) return;
  if (!mash.active) {
    mash.active = true;
    ui.showMash();
    bark('mash_start');
  }
  mash.progress += 0.085;
  audio.mashThud();
  if (mash.progress > 0.5 && !mash.midSaid) { mash.midSaid = true; bark('mash_mid'); }
  if (mash.progress >= 1) {
    mash.active = false;
    ui.hideMash();
    state.grateOpen = true;
    world.removeCollider(world.dynamic.grate.collider);
    audio.grateBurst();
    emit('grate');
    bark('grate');
  }
  ui.setMash(mash.progress);
});

// ------------------------------------------------------- roof + spire story
function goOutside() {
  if (state.outside) return;
  state.outside = true;
  emit('outside');
  world.setRoofLook(scene);
  effects.baseBg = new THREE.Color(0x0b1120);
  effects.strike();
  const comp = companion();
  comp.appearAt(new THREE.Vector3(22.2, ROOF_Y, -36.8), Math.PI / 2);
  ui.toast('— THE ROOF —', 3500);
  refreshObjective();
  setTimeout(() => bark('outside'), 2000);
}

function reachTop() {
  if (state.atTop) return;
  state.atTop = true;
  refreshObjective();
  audio.playSpireTrack();          // the track that only plays up here
  state.musicStarted = true;
  bark('top_arrive');
  setTimeout(() => bark('a1'), 3500);
  setTimeout(() => bark('a2'), 8500);
  setTimeout(() => {
    bark('a3');
    state.aIntroDone = true;
    refreshObjective();
  }, 13000);
  const comp = companion();
  if (!comp.hidden) comp.appearAt(new THREE.Vector3(HOLE.x - 2.3, PLAT_Y, HOLE.z + 2.5), -2.4);
}

// the rappel anchor
world.interactable(world.dynamic.anchor, () => {
  if (!state.atTop || state.rappelling) return null;
  if (!state.aIntroDone) return 'Rappel anchor (hear A out first)';
  return state.descended ? 'Clip in and ride the line again' : 'Clip in and rappel';
}, () => {
  if (!state.aIntroDone || state.rappelling) return;
  state.rappelling = true;
  world.dynamic.rope.visible = true;
  player.startRappel(HOLE.x - 4.0, HOLE.z);
  bark('rappel_start');
  setTimeout(() => bark('rappel_pav'), 3000);
  refreshObjective();
});

function finishDescent() {
  if (cinematic) return;
  cinematic = true;
  state.rappelling = false;
  player.stopRappel();
  ui.fadeOut(() => {
    ui.toast('— W H I T E O U T   S P I R E —', 5000);
    setTimeout(() => {
      const cp = CHECKPOINTS.roof;
      player.teleport(cp[0], cp[1], cp[2], -Math.PI / 2);
      const comp = companion();
      comp.appearAt(new THREE.Vector3(cp[0] + 1.5, ROOF_Y, cp[2] + 1.5), -Math.PI / 2);
      state.descended = true;
      ui.fadeIn();
      cinematic = false;
      refreshObjective();
      setTimeout(() => bark('descended'), 1500);
    }, 1800);
  }, 1200);
}

// position triggers (one-shot)
const triggers = [
  { test: (p) => state.zone === 'lobby', run: () => bark('lobby') },
  { test: (p) => state.zone === 'stairs' && p.y > 32.5, run: () => bark('guard_stairs') },
  { test: (p) => state.zone === 'mech' && state.mechDoorOpen, run: () => bark('mech') },
  { test: (p) => state.zone === 'mech' && Math.hypot(p.x - 16, p.z + 34) < 6, run: () => { bark('vent'); refreshObjective(); } },
  {
    test: (p) => p.x > 17 && p.x < 21.5 && p.z > -35.2 && p.z < -32.8 && p.y < 43.6 && p.y > 41,
    run: () => {
      state.inDuct = true;
      bark('duct');
      const comp = companion();
      comp.hide();
      setTimeout(() => {
        comp.appearAt(new THREE.Vector3(22.4, LIGHTWELL.floor, -35), 0.8);
      }, 4000);
      refreshObjective();
    },
  },
  { test: (p) => state.zone === 'lightwell' && p.x > LIGHTWELL.x1 + 0.4, run: () => bark('lightwell') },
  { test: (p) => state.grateOpen && p.y > ROOF_Y + 1 && p.y < ROOF_Y + 3 && p.x > 20, run: goOutside },
  {
    test: (p) => state.outside && p.y > ROOF_Y &&
      Math.hypot(p.x - HOLE.x, p.z - HOLE.z) < HOLE.r + 4 && p.y < ROOF_Y + 4,
    run: () => { state.sawHole = true; bark('hole'); },
  },
  {
    test: (p) => state.outside && inRect(p, 2.3, -34.8, 8.9, -33.2) && Math.abs(p.y - ROOF_Y - 1.7) < 1,
    run: () => { state.crossedCatwalk = true; bark('catwalk'); refreshObjective(); },
  },
  { test: (p) => state.outside && p.y > ROOF_Y + 8 && p.y < ROOF_Y + 14, run: () => bark('climb') },
  { test: (p) => p.y > PLAT_Y + 1.4, run: reachTop },
].map((t) => ({ ...t, fired: false }));

// falling into the hole (outside of the rappel)
function checkFall() {
  if (cinematic) return;
  const p = player.pos;
  if (state.rappelling) {
    if (p.y < ROOF_Y - 4.2) finishDescent();
    return;
  }
  const inHoleColumn = Math.hypot(p.x - HOLE.x, p.z - HOLE.z) < HOLE.r + 0.5;
  if (state.outside && inHoleColumn && p.y < ROOF_Y - 3 && p.y > ROOF_Y - 8) {
    cinematic = true;
    state.falls++;
    emit('fell');
    ui.fadeOut(() => {
      const cp = CHECKPOINTS.roof;
      player.teleport(cp[0], cp[1], cp[2], -Math.PI / 2);
      player.crouched = false;
      ui.fadeIn();
      cinematic = false;
      bark('fell');
    }, 700);
  }
  if (p.y < -25) player.teleport(0, 1.7, 20, 0);
}

// ------------------------------------------------------------------- loop
const clock = new THREE.Clock();
let elapsed = 0;
let lastZone = '';

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.06);
  elapsed += dt;

  player.enabled = controlsActive();
  interact.enabled = controlsActive() && !mash.active;

  player.update(dt, world);
  const comp = companion();
  comp.update(dt, elapsed, player.pos);
  aNpc.update(dt, elapsed, player.pos);
  for (const g of guards) g.update(dt, elapsed, player, camera);
  for (const c of cctvs) c.update(dt, elapsed, player);
  world.update(dt, elapsed);

  state.zone = zoneOf(player.pos);
  if (state.zone !== lastZone) {
    lastZone = state.zone;
    audio.setZone(state.zone);
  }
  effects.update(dt, elapsed, camera, state.zone);
  interact.update();

  // mash decay + companion assist
  if (mash.active && !state.grateOpen) {
    mash.progress = Math.max(0, mash.progress - dt * 0.055 + dt * 0.02);
    ui.setMash(mash.progress);
  }

  if (started) {
    for (const tr of triggers) {
      if (!tr.fired && tr.test(player.pos)) { tr.fired = true; tr.run(); }
    }
    checkFall();
  }

  renderer.render(scene, camera);
}
ui.setObjective(currentObjective());
ui.setCharacter('Chase');
tick();

// -------------------------------------------------------- debug/test hooks
window.game = {
  state, player, world, npcs, aNpc, guards,
  start() {
    debugMode = true;
    audio.init?.();
    started = true;
    state.started = true;
    ui.hideTitle();
    ui.setObjective(currentObjective());
  },
  goLobby() { state.sideDoorOpen = true; player.teleport(18, 1.85, -16, Math.PI / 2); },
  goOffice() {
    Object.assign(state, { sideDoorOpen: true, hasLobbyCard: true, elevatorUsed: true });
    player.teleport(4, 31.7, -45, Math.PI);
  },
  goMech() {
    Object.assign(state, { sideDoorOpen: true, hasLobbyCard: true, elevatorUsed: true, readOfficeNote: true, stairsDoorOpen: true, hasMaintCard: true, mechDoorOpen: true });
    player.teleport(-9.5, 39.7, -32, -Math.PI / 2);
  },
  goRoof() {
    Object.assign(state, { sideDoorOpen: true, hasLobbyCard: true, elevatorUsed: true, readOfficeNote: true, stairsDoorOpen: true, hasMaintCard: true, mechDoorOpen: true, inDuct: true, grateOpen: true });
    world.removeCollider(world.dynamic.grate.collider);
    player.teleport(15, ROOF_Y + 1.7, -34, Math.PI / 2);
    goOutside();
  },
  goTop() {
    this.goRoof();
    player.teleport(HOLE.x, PLAT_Y + 1.7, HOLE.z + 1.5, Math.PI);
    reachTop();
  },
  lookAt(x, y, z) {
    const d = new THREE.Vector3(x - player.pos.x, y - player.pos.y, z - player.pos.z);
    player.yaw = Math.atan2(-d.x, -d.z);
    player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  },
};
