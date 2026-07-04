// DOM HUD: objective, prompts, toasts, chat log/input (with per-NPC target),
// character indicator, mash-the-grate bar, modals (keypad, note, settings),
// fade, title screen.
import * as audio from './audio.js';
import * as brains from './brains.js';

const $ = (id) => document.getElementById(id);

export const els = {
  objective: $('objective-text'),
  prompt: $('prompt'),
  toast: $('toast'),
  chatlog: $('chatlog'),
  chatbar: $('chatbar'),
  chatinput: $('chatinput'),
  chathint: $('chathint'),
  charhud: $('charhud'),
  modal: $('modal'),
  modalBox: $('modal-box'),
  fade: $('fade'),
  title: $('title'),
  play: $('play'),
  resume: $('resume'),
  gear: $('gear'),
};

export let modalOpen = false;
export let chatOpen = false;

let toastTimer = null;

export function setObjective(text) { els.objective.textContent = text; }

export function setCharacter(name) {
  els.charhud.innerHTML = `<span class="k">PLAYING AS</span>${name.toUpperCase()} <span class="swap">[Q] swap</span>`;
}

export function prompt(html) {
  if (!html) { els.prompt.classList.add('hidden'); return; }
  els.prompt.innerHTML = html;
  els.prompt.classList.remove('hidden');
}

export function toast(text, ms = 2600) {
  els.toast.textContent = text;
  els.toast.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.style.opacity = 0), ms);
}

// ---------------------------------------------------------------- chat log
const MAX_MSGS = 6;
export function say(who, text, { you = false } = {}) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.innerHTML = `<span class="who${you ? ' you' : ''}">${who}:</span><span class="txt"></span>`;
  div.querySelector('.txt').textContent = text;
  els.chatlog.appendChild(div);
  [...els.chatlog.children].slice(0, -2).forEach((c) => c.classList.add('old'));
  while (els.chatlog.children.length > MAX_MSGS) els.chatlog.firstChild.remove();
  return { update(t) { div.querySelector('.txt').textContent = t; } };
}

export function openChat(targetName) {
  chatOpen = true;
  els.chatbar.classList.remove('hidden');
  els.chathint.classList.add('hidden');
  els.chatinput.value = '';
  els.chatinput.placeholder = `Say something to ${targetName}… (Enter to send, Esc to close)`;
  setTimeout(() => els.chatinput.focus(), 0);
}

export function closeChat() {
  chatOpen = false;
  els.chatbar.classList.add('hidden');
  els.chathint.classList.remove('hidden');
  els.chatinput.blur();
}

// -------------------------------------------------------------------- modals
export function openModal(html) {
  modalOpen = true;
  els.modalBox.innerHTML = html;
  els.modal.classList.remove('hidden');
  document.exitPointerLock?.();
}

export function closeModal() {
  modalOpen = false;
  els.modal.classList.add('hidden');
}

export function openNote(html) {
  openModal(`
    <h3>NOTE</h3>
    <div class="paper">${html}</div>
    <div class="close-hint">[Esc] or click anywhere to close</div>
  `);
}

export function openKeypad(onCode) {
  openModal(`
    <h3>KEYPAD — STAIRWELL B</h3>
    <div class="kp-display" id="kp-display">····</div>
    <div class="keypad" id="kp-grid"></div>
    <div class="close-hint">[Esc] to step away</div>
  `);
  const display = $('kp-display');
  let code = '';
  const grid = $('kp-grid');
  ['1','2','3','4','5','6','7','8','9','CLR','0','OK'].forEach((k) => {
    const b = document.createElement('button');
    b.textContent = k;
    b.onclick = () => {
      audio.keypadPress();
      if (k === 'CLR') code = '';
      else if (k === 'OK') { onCode(code); code = ''; }
      else if (code.length < 4) code += k;
      display.textContent = code.padEnd(4, '·');
      display.classList.remove('err');
    };
    grid.appendChild(b);
  });
  display.textContent = '····';
  return {
    flashError() {
      display.classList.add('err');
      display.textContent = 'ERR!';
      audio.keypadFail();
    },
  };
}

export function openSettings() {
  const existing = brains.getKey();
  openModal(`
    <h3>PAV LINK — SETTINGS</h3>
    <p>Free-form conversation with Pav, Chase and A runs on Claude
    (<code>claude-opus-4-8</code>) via the Anthropic API. Paste an API key to enable
    it. The key is stored <b>only in your browser's localStorage</b> and is sent only
    to <code>api.anthropic.com</code>.</p>
    <p>No key? They still talk — just from a script.</p>
    <input type="password" id="apikey" placeholder="sk-ant-…" value="${existing ? existing : ''}" />
    <div>
      <button id="savekey">SAVE</button>
      <button id="clearkey">CLEAR KEY</button>
      <button id="closesettings">CLOSE</button>
    </div>
    <p class="close-hint" id="keystatus">${existing ? 'Key present — full conversation enabled.' : 'No key — scripted mode.'}</p>
  `);
  $('savekey').onclick = () => {
    brains.setKey($('apikey').value);
    $('keystatus').textContent = brains.hasKey()
      ? 'Saved. Full conversation enabled.' : 'No key — scripted mode.';
  };
  $('clearkey').onclick = () => {
    brains.setKey('');
    $('apikey').value = '';
    $('keystatus').textContent = 'Key cleared — scripted mode.';
  };
  $('closesettings').onclick = () => closeModal();
}

// ---------------------------------------------------------------------- fade
export function fadeOut(cb, ms = 600) {
  els.fade.style.opacity = 1;
  setTimeout(() => { cb?.(); }, ms + 50);
}
export function fadeIn() { els.fade.style.opacity = 0; }

export function hideTitle() { els.title.classList.add('hidden'); }
export function showResume(v) { els.resume.classList.toggle('hidden', !v); }
