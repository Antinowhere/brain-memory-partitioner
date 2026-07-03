// WHITEOUT SPIRE — bootstrap and game loop.
import * as THREE from 'three';
import { World, ROOF_Y, HOLE } from './world.js';
import { Player } from './player.js';
import { Pav } from './pav.js';
import { Interact } from './interact.js';
import { Effects } from './effects.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as pavBrain from './pavBrain.js';
import { state, on, emit, currentObjective, describeStateForPav } from './state.js';

// ------------------------------------------------------------------- setup
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030405);
scene.fog = new THREE.FogExp2(0x04050a, 0.028);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 400);

const world = new World(scene);
const player = new Player(camera);
const pav = new Pav(scene, world);
const interact = new Interact(camera, world, ui);
const effects = new Effects(scene, world);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --------------------------------------------------------------- game flow
let started = false;
let debugMode = new URLSearchParams(location.search).has('debug');
let keypadUI = null;

function controlsActive() {
  return started && !ui.modalOpen && !ui.chatOpen &&
    (debugMode || document.pointerLockElement === renderer.domElement);
}

function requestLock() {
  if (!debugMode) renderer.domElement.requestPointerLock({ unadjustedMovement: true })?.catch?.(() => {
    renderer.domElement.requestPointerLock();
  });
}

ui.els.play.addEventListener('click', () => {
  audio.init();
  audio.resume();
  started = true;
  state.started = true;
  ui.hideTitle();
  requestLock();
  ui.setObjective(currentObjective());
  setTimeout(() => pavSay('intro'), 1600);
});

ui.els.resume.addEventListener('click', () => {
  audio.resume();
  ui.showResume(false);
  requestLock();
});

document.addEventListener('pointerlockchange', () => {
  if (debugMode) return;
  const locked = document.pointerLockElement === renderer.domElement;
  if (started && !locked && !ui.modalOpen && !ui.chatOpen) {
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

// Global keys: chat toggle, modal escape.
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
  if (ui.modalOpen) return;
  if (e.code === 'KeyT' && started) {
    e.preventDefault();
    document.exitPointerLock?.();
    ui.showResume(false);
    player.clearKeys();
    ui.openChat();
  }
});

// clicking the note/settings backdrop closes it
ui.els.modal.addEventListener('click', (e) => {
  if (e.target === ui.els.modal) { ui.closeModal(); keypadUI = null; if (started) requestLock(); }
});

// ------------------------------------------------------------------- chat
let chatBusy = false;
async function sendChat() {
  const text = ui.els.chatinput.value.trim();
  ui.closeChat();
  if (started) requestLock();
  if (!text || chatBusy) return;
  ui.say('YOU', text, { you: true });
  chatBusy = true;
  pav.bumpSpeaking();
  const bubble = ui.say('PAV', '…');
  const ctx = describeStateForPav(player.pos);
  const reply = await pavBrain.ask(text, ctx, (acc) => { bubble.update(acc); pav.bumpSpeaking(); });
  bubble.update(reply);
  chatBusy = false;
}

function pavSay(key) {
  const line = pavBrain.BARKS[key];
  if (!line) return;
  pav.bumpSpeaking();
  ui.say('PAV', line);
}

// --------------------------------------------------------------- reactions
function refreshObjective() { ui.setObjective(currentObjective()); }

on('ui:keypad', () => {
  if (state.d1Open) return;
  player.clearKeys();
  keypadUI = ui.openKeypad((code) => {
    if (code === '1987') {
      audio.keypadOk();
      state.d1Open = true;
      ui.closeModal(); keypadUI = null;
      audio.doorSlide();
      emit('d1');
      requestLock();
    } else {
      keypadUI.flashError();
      emit('keypad:fail');
    }
  });
});
on('ui:note', ({ html }) => { player.clearKeys(); ui.openNote(html); });

on('note', () => { pavSay('note'); refreshObjective(); });
on('poster', () => { if (state.readDeskNote && !state.d1Open) pavSay('poster'); });
on('d1', () => { pavSay('d1'); ui.toast('MAINTENANCE DOOR UNLOCKED'); refreshObjective(); });
on('breaker', (i) => { if (!state.power && state.breakers.filter(Boolean).length === 1) pavSay('breaker1'); });
on('power', () => { pavSay('power'); ui.toast('POWER RESTORED'); refreshObjective(); });
on('locker', () => refreshObjective());
on('keycard', () => { pavSay('keycard'); ui.toast('KEYCARD ACQUIRED'); refreshObjective(); });
on('reader:dead', () => pavSay('reader_dead'));
on('reader:nocard', () => ui.toast('A KEYCARD IS REQUIRED'));
on('d2', () => { pavSay('d2'); ui.toast('SECURITY DOOR OPEN'); refreshObjective(); });
on('fanoff', () => { pavSay('fanoff'); refreshObjective(); });
on('fanstill', () => { pavSay('fanstill'); refreshObjective(); });
on('grate', () => { ui.toast('GRATE OPEN'); refreshObjective(); });
on('vent:stuck', () => pavSay('vent'));
on('hatch', () => { audio.doorSlide(); ui.toast('ROOF HATCH OPEN'); refreshObjective(); });

// position-based one-shot triggers
const triggers = [
  { fired: false, test: (p) => p.z < -12.5, run: () => pavSay('mech') },
  {
    fired: false,
    test: (p) => p.z < -44.2 && p.x > 5.5 && p.y < 2.4,
    run: () => { pavSay('grate'); state.inDuct = true; setTimeout(() => pav.hide(), 2500); },
  },
  {
    fired: false,
    test: (p) => state.hatchOpen && p.y > ROOF_Y - 0.4 && p.z > -50,
    run: goOutside,
  },
  {
    fired: false,
    test: (p) => state.outside && p.y > ROOF_Y - 1 &&
      Math.hypot(p.x - HOLE.x, p.z - HOLE.z) < HOLE.r + 4,
    run: () => { state.sawHole = true; pavSay('hole'); refreshObjective(); },
  },
  {
    fired: false,
    test: (p) => state.outside && p.y > ROOF_Y - 1 &&
      Math.hypot(p.x - HOLE.x, p.z - HOLE.z) < HOLE.r + 1.2,
    run: () => { state.nearSpire = true; pavSay('spire'); refreshObjective(); },
  },
];

function goOutside() {
  if (state.outside) return;
  state.outside = true;
  emit('outside');
  world.setOutsideLook(scene);
  effects.setOutside(true);
  audio.setOutside(true);
  effects.strike(); // welcome flash
  pav.appearAt(new THREE.Vector3(4.2, ROOF_Y, -45.5));
  ui.toast('— THE ROOF —', 3500);
  refreshObjective();
  setTimeout(() => pavSay('outside'), 2200);
}

// fell into the hole
function checkFall() {
  const p = player.pos;
  const inHoleColumn = Math.hypot(p.x - HOLE.x, p.z - HOLE.z) < HOLE.r + 0.5;
  if (state.outside && inHoleColumn && p.y < ROOF_Y - 3) {
    state.falls++;
    emit('fell');
    player.enabled = false;
    ui.fadeOut(() => {
      player.teleport(7.2, ROOF_Y + 1.7, -46.5, Math.PI);
      player.crouched = false;
      ui.fadeIn();
      player.enabled = controlsActive();
      pavSay('fell');
    }, 700);
  }
  // generic safety net
  if (p.y < -30) player.teleport(0, 1.7, 2.5);
}

// ------------------------------------------------------------------- loop
const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.06);
  elapsed += dt;

  player.enabled = controlsActive();
  interact.enabled = controlsActive();

  player.update(dt, world);
  pav.update(dt, elapsed, player.pos, player.yaw);
  world.update(dt, elapsed);
  effects.update(dt, elapsed, camera);
  interact.update();

  if (started) {
    for (const tr of triggers) {
      if (!tr.fired && tr.test(player.pos)) { tr.fired = true; tr.run(); }
    }
    checkFall();
  }

  renderer.render(scene, camera);
}
ui.setObjective(currentObjective());
tick();

// -------------------------------------------------------- debug/test hooks
window.game = {
  state, player, world, pav,
  start() {
    debugMode = true;
    audio.init?.();
    started = true;
    state.started = true;
    ui.hideTitle();
    ui.setObjective(currentObjective());
  },
  goRoof() {
    state.d1Open = state.power = state.hasKeycard = state.d2Open = true;
    state.fanStopped = state.fanStill = state.grateOpen = state.hatchOpen = true;
    player.teleport(7.2, ROOF_Y + 1.7, -46.5, Math.PI * 0.9);
    goOutside();
  },
  lookAt(x, y, z) {
    const d = new THREE.Vector3(x - player.pos.x, y - player.pos.y, z - player.pos.z);
    player.yaw = Math.atan2(-d.x, -d.z);
    player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  },
};
