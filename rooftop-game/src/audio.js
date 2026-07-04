// Procedural WebAudio: hum, fan, wind, thunder, UI blips. No asset files.
let ctx = null;
let master = null;
let nodes = {};
let outside = false;

function noiseBuffer(seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);

  // --- interior electrical hum (60hz + harmonic) ---
  const humGain = ctx.createGain();
  humGain.gain.value = 0.012;
  const o1 = ctx.createOscillator(); o1.frequency.value = 60; o1.type = 'sawtooth';
  const o2 = ctx.createOscillator(); o2.frequency.value = 120; o2.type = 'sine';
  const humFilter = ctx.createBiquadFilter(); humFilter.type = 'lowpass'; humFilter.frequency.value = 220;
  o1.connect(humFilter); o2.connect(humFilter); humFilter.connect(humGain); humGain.connect(master);
  o1.start(); o2.start();
  nodes.hum = humGain;

  // --- fan loop: band-passed noise, gain follows fan speed ---
  const fanSrc = ctx.createBufferSource(); fanSrc.buffer = noiseBuffer(3); fanSrc.loop = true;
  const fanFilter = ctx.createBiquadFilter(); fanFilter.type = 'bandpass'; fanFilter.frequency.value = 180; fanFilter.Q.value = 0.8;
  const fanGain = ctx.createGain(); fanGain.gain.value = 0;
  fanSrc.connect(fanFilter); fanFilter.connect(fanGain); fanGain.connect(master);
  fanSrc.start();
  nodes.fanGain = fanGain; nodes.fanFilter = fanFilter;

  // --- wind: low-passed noise with slow gust LFO ---
  const windSrc = ctx.createBufferSource(); windSrc.buffer = noiseBuffer(4); windSrc.loop = true;
  const windFilter = ctx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 420;
  const windGain = ctx.createGain(); windGain.gain.value = 0;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 90;
  lfo.connect(lfoGain); lfoGain.connect(windFilter.frequency); lfo.start();
  windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
  windSrc.start();
  nodes.windGain = windGain;
}

export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

// Wind/hum blend per zone instead of a binary outside flag.
export function setZone(zone) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const wind = { street: 0.09, lightwell: 0.13, roof: 0.24, spire: 0.3 }[zone] ?? 0.0;
  const hum = { lobby: 0.02, office: 0.014, stairs: 0.018, mech: 0.034 }[zone] ?? 0.006;
  nodes.windGain.gain.setTargetAtTime(wind, t, 1.2);
  nodes.hum.gain.setTargetAtTime(hum, t, 0.8);
}

// ---- the track that plays only at the top of the spire ----
let music = null;
export function playSpireTrack() {
  if (music) return;
  music = new Audio('/audio/spire.mp3');
  music.volume = 0;
  music.play().catch(() => { music = null; });
  if (!music) return;
  const fade = setInterval(() => {
    if (!music) return clearInterval(fade);
    music.volume = Math.min(0.85, music.volume + 0.03);
    if (music.volume >= 0.85) clearInterval(fade);
  }, 120);
  // duck the wind a little under the music
  if (ctx) nodes.windGain.gain.setTargetAtTime(0.12, ctx.currentTime, 2);
}

// ---- security ----
export function cctvChirp() {
  blip(1900, 0.09, 'square', 0.07);
  setTimeout(() => blip(1900, 0.09, 'square', 0.07), 180);
  setTimeout(() => blip(2300, 0.14, 'square', 0.07), 380);
}

export function spottedSting() {
  if (!ctx) return;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(140, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ctx.currentTime + 0.6);
}

export function elevatorDing() { blip(1050, 0.35, 'sine', 0.1); setTimeout(() => blip(880, 0.4, 'sine', 0.08), 200); }

export function elevatorRumble(seconds = 7) {
  if (!ctx) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(seconds); src.loop = false;
  src.playbackRate.value = 0.25;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 90;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.8);
  g.gain.setValueAtTime(0.16, ctx.currentTime + seconds - 1);
  g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + seconds);
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}

export function mashThud() { thud(0.12, 200 + Math.random() * 80); }
export function grateBurst() { thud(0.4, 120); setTimeout(() => metalCreak(), 120); setTimeout(() => thud(0.3, 70), 350); }

export function setFan(speed01) { // 0..1
  if (!ctx) return;
  const t = ctx.currentTime;
  nodes.fanGain.gain.setTargetAtTime(speed01 * 0.16, t, 0.15);
  nodes.fanFilter.frequency.setTargetAtTime(90 + speed01 * 160, t, 0.2);
}

export function setFanProximity(dist) { // quieter far from the fan
  if (!ctx || !nodes.fanBase) return;
}

export function setOutside(v) {
  outside = v;
  if (!ctx) return;
  const t = ctx.currentTime;
  nodes.windGain.gain.setTargetAtTime(v ? 0.22 : 0.0, t, 1.5);
  nodes.hum.gain.setTargetAtTime(v ? 0.002 : 0.012, t, 1.0);
}

export function setPowerOn() {
  if (!ctx) return;
  nodes.hum.gain.setTargetAtTime(0.028, ctx.currentTime, 0.4);
  blip(180, 0.25, 'sine', 0.08);
  setTimeout(() => blip(240, 0.4, 'sine', 0.06), 180);
}

function blip(freq, dur, type = 'square', vol = 0.08) {
  if (!ctx) return;
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ctx.currentTime + dur);
}

export function keypadPress() { blip(1150, 0.06, 'square', 0.05); }
export function keypadOk() { blip(880, 0.12, 'sine', 0.09); setTimeout(() => blip(1320, 0.22, 'sine', 0.09), 110); }
export function keypadFail() { blip(160, 0.3, 'square', 0.1); }
export function pickup() { blip(660, 0.1, 'triangle', 0.09); setTimeout(() => blip(990, 0.14, 'triangle', 0.07), 90); }
export function leverClunk() { thud(0.25, 90); blip(70, 0.2, 'square', 0.12); }
export function breakerSnap() { thud(0.08, 400); blip(2200, 0.03, 'square', 0.05); }

export function doorSlide() {
  if (!ctx) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(1.2);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.15);
  g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
  setTimeout(() => thud(0.15, 150), 1050);
}

export function metalCreak() {
  if (!ctx) return;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(320, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.7);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.06, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
  o.connect(f); f.connect(g); g.connect(master);
  o.start(); o.stop(ctx.currentTime + 0.8);
}

function thud(dur, freq) {
  if (!ctx) return;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.25, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur + 0.05);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ctx.currentTime + dur + 0.1);
}

export function thunder(intensity = 1) {
  if (!ctx) return;
  const dur = 2.2 + Math.random() * 2.2;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur); src.playbackRate.value = 0.35;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(700 * intensity, ctx.currentTime);
  f.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.55 * intensity, ctx.currentTime + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}

export function paperRustle() {
  if (!ctx) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.3);
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.05, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}
