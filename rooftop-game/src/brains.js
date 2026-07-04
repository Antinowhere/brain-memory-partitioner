// NPC brains. With an Anthropic API key: Claude Opus 4.8 via the official SDK
// (browser build; the key lives only in localStorage). Without one: scripted
// fallbacks per character, so the game always works.
import Anthropic from '@anthropic-ai/sdk';
import { state } from './state.js';

const KEY_STORAGE = 'pav_anthropic_key';
const MODEL = 'claude-opus-4-8';

const SHARED = `You are a character inside a first-person exploration game. Two friends — Chase (wears a glitching digital skull mask, quiet) and Pav (parka, beanie, talks a lot) — are breaking into the Northpoint Utility Tower during a snowstorm to reach the spire on its roof. The player can control either Chase or Pav (Q swaps); whoever they aren't controlling walks along as a companion.

The route, if someone asks for help (hint first, full answer only if pushed): front doors locked → service door in the east alley → lobby (elevator card on the reception desk, the guard is asleep — move quietly, don't run near him) → elevator to floor 43 → office floor (stair keypad code = the year on the anniversary poster, 1987; maintenance keycard in the mail room) → stairwell up, past a patrolling guard → the star-shaped two-story mechanical crown (guard + CCTV — crouch, use cover, don't linger in camera cones) → ladder up the big vent box in the east star point → crawl the duct (hold C) → outdoor light-well → everyone pushes the stuck grate open together (mash E) → the roof.

On the roof (only discuss once outside): a thunder-blizzard, a massive circular hole bored into the tower's core, and a white lattice spire rising out of it carrying a huge green neon box sign with a white Λ mark. A catwalk crosses to it; a caged ladder climbs to a platform under the sign, where a hooded figure called A waits. Strange music rides the wind up there. A offers a rappel line — the only way down that means anything is over the edge, into the hole.

Rules for every reply:
- Stay in character. Never mention being an AI, a language model, a game, or Anthropic.
- SHORT spoken dialogue only: one to three sentences. No stage directions, no asterisks, no emoji.
- A [GAME STATE] block precedes each message — treat it as what you can both currently see and know.`;

const PERSONAS = {
  pav: `${SHARED}

You are PAV, 28, urban-exploration lifer. Dry wit, loyal, streetwise, a little superstitious about this tower. You love grates, ducts, and "the janitor always writes the code down" wisdom. You tease Chase about the skull mask but you'd follow them anywhere.`,
  chase: `${SHARED}

You are CHASE, the one in the glitching skull mask. You speak rarely and briefly — one sentence is your natural length, two is a speech. Deadpan, precise, calm under pressure. You never explain the mask. You care about Pav more than you'd ever say.`,
  a: `${SHARED}

You are A, the hooded figure at the top of the spire. Green glitch-light where a face should be, a small green heart glowing on your chest. You have kept the sign lit for longer than you'll say. You speak in short, quiet, certain lines — gentle, uncanny, never threatening. You know what the hole is and won't name it directly: you call it "the door", and the sign is how you "keep its name lit". You believe the only honest way down is through. You sometimes end a line with "…♥" — spoken softly, however that sounds.`,
};

const histories = { pav: [], chase: [], a: [] };

export function getKey() { return localStorage.getItem(KEY_STORAGE) || ''; }
export function setKey(k) {
  if (k) localStorage.setItem(KEY_STORAGE, k.trim());
  else localStorage.removeItem(KEY_STORAGE);
}
export function hasKey() { return !!getKey(); }

export async function ask(npc, text, contextBlock, onDelta) {
  if (!hasKey()) {
    const reply = canned(npc, text);
    onDelta?.(reply);
    return reply;
  }
  const client = new Anthropic({ apiKey: getKey(), dangerouslyAllowBrowser: true });
  const history = histories[npc];
  history.push({ role: 'user', content: `[GAME STATE]\n${contextBlock}\n[/GAME STATE]\n\n${text}` });
  if (history.length > 24) histories[npc] = history.slice(-24);
  while (histories[npc].length && histories[npc][0].role !== 'user') histories[npc].shift();
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 300,
      system: PERSONAS[npc],
      messages: histories[npc],
    });
    let acc = '';
    stream.on('text', (delta) => { acc += delta; onDelta?.(acc); });
    const msg = await stream.finalMessage();
    const full = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    histories[npc].push({ role: 'assistant', content: full || '…' });
    return full || '…';
  } catch (err) {
    histories[npc].pop();
    let line;
    if (err instanceof Anthropic.AuthenticationError) {
      line = '(radio static) …that key\'s no good. Check the PAV LINK settings.';
    } else if (err instanceof Anthropic.RateLimitError) {
      line = '(radio static) …channel\'s jammed. Give it a second.';
    } else if (err instanceof Anthropic.APIConnectionError) {
      line = '(radio static) …no signal in here.';
    } else if (err instanceof Anthropic.APIError) {
      line = `(radio static) …something's broken (${err.status || 'API error'}).`;
    } else {
      line = '(radio static) …say again?';
    }
    onDelta?.(line);
    return line;
  }
}

// -------------------------------------------------------- scripted fallback
function hint() {
  if (!state.sideDoorOpen) return "Front's locked and lit up like a stage. Service door, east alley. There's always a service door.";
  if (!state.hasLobbyCard) return "Reception desk. Card's sitting right next to sleeping beauty. Walk — do not run — and lift it.";
  if (!state.elevatorUsed) return "Swipe the card at the east elevator and press 43. Try to look like we work here.";
  if (!state.stairsDoorOpen) {
    if (!state.readOfficeNote) return "Stairwell's code-locked, west side. Desk notes, Chase. Someone always writes it down.";
    return "Year the tower opened. There's a big proud anniversary poster in the break room. Read it, punch it in.";
  }
  if (!state.hasMaintCard) return "Mech level wants a MAINT card. Mail room, northwest corner — check the counter.";
  if (!state.mechDoorOpen) return "Up the stairs, swipe at the top. And there's a guard pacing the landing — wait for his back.";
  if (!state.grateOpen) {
    if (!state.inDuct) return "Star room, east point — big vent box with a ladder on it. Up, then get low and crawl. Hold C.";
    return "Get under the grate and PUSH. All of us. Mash E like it owes you money.";
  }
  if (!state.outside) return "Climb out. Roof's right there.";
  if (!state.crossedCatwalk) return "The catwalk. Across the gap, to the tower. Don't look down — actually no, definitely look down.";
  if (!state.atTop) return "Caged ladder, east face. It's a long way. Don't race it, just climb.";
  if (!state.descended) return "Talk to… whoever that is up there. Then I guess we're clipping into that line.";
  return "We did the thing. Now we live with it.";
}

const PAV_QUIPS = [
  "Keep moving. This place gives me the creeps in a way I almost respect.",
  "I've broken into nicer buildings. I've also broken into worse. This is top five though.",
  "Stay sharp. Towers like this always save one surprise for the roof.",
  "If we meet the janitor, I'm shaking his hand. Man runs a tight ship.",
  "My grandmother said never trust a building taller than a church. Starting to get it.",
];
const CHASE_QUIPS = ["Keep up.", "Quiet floor. Stay low.", "I've seen worse ways up.", "Later. Climb now.", "The mask stays on."];
const A_QUIPS = [
  "You hear it too. Good. …♥",
  "The sign is a name. I keep it lit so it remembers itself.",
  "Everyone who climbs asks the same question. The door answers better than I do.",
  "The storm isn't weather. It's breath.",
];

function canned(npc, text) {
  const q = text.toLowerCase();
  const wantsHelp = /help|stuck|where|how|what (do|should)|hint|next|code|key|card|open|door|guard|camera|vent|grate|roof|ladder|spire|elevator/.test(q);
  if (npc === 'a') {
    if (/hole|door|what is|below|down there/.test(q)) return "The door was here before the tower. They built around it and called it a core. I keep its name lit. …♥";
    if (/who are you|your name|what are you/.test(q)) return "A. Just A. The rest of the name is on the sign.";
    if (/rappel|rope|line|jump/.test(q)) return "Clip in when you're ready. The only honest way down is through.";
    return A_QUIPS[Math.floor(Math.random() * A_QUIPS.length)];
  }
  if (wantsHelp) return hint();
  if (npc === 'chase') {
    if (/mask|face|skull/.test(q)) return "The mask stays on.";
    return CHASE_QUIPS[Math.floor(Math.random() * CHASE_QUIPS.length)];
  }
  if (/who are you|your name/.test(q)) return "Pav. Professional door-ignorer, amateur philosopher, your ride home. Keep moving.";
  if (/mask|skull/.test(q)) return "Ask Chase about the mask. Actually don't — I tried once. Long week.";
  if (/spire|sign|neon|hole/.test(q) && state.outside) return "A lattice tower in a hole in a roof, wearing a giant green sign like a name tag. I don't have a theory. I have a headache.";
  return PAV_QUIPS[Math.floor(Math.random() * PAV_QUIPS.length)];
}

// Scripted story barks — used regardless of API key so the beats always land.
// Each entry: [speaker, line]
export const BARKS = {
  intro: ['PAV', "There she is. Northpoint. Roof or nothing, Chase. Front door first — humor me."],
  frontdoor: ['PAV', "Locked. Shocking. Okay — east alley, service door. There's ALWAYS a service door."],
  sidedoor: ['PAV', "See? Poetry. In we go."],
  lobby: ['PAV', "Guard's out cold at the desk. There's the card, right next to his coffee. Walk soft, don't run, don't sneeze."],
  lobbycard: ['CHASE', "Got it. He didn't even twitch."],
  elevatoropen: ['PAV', "43 — mechanical access. Going up. Act natural. You're wearing a skull, but act natural."],
  elevator_arrive: ['PAV', "Offices. Dead quiet. Stairwell's on the far west wall — it'll be code-locked, so eyes open for notes."],
  note: ['PAV', "'Year the tower opened.' There'll be a plaque or a poster — places like this love bragging. Try the break room."],
  poster: ['PAV', "1987. There it is. Punch it in."],
  stairsopen: ['PAV', "And we're in. Stairs next — I heard boots earlier, so there's a patrol somewhere above."],
  maintcard: ['CHASE', "MAINT card. Mail room delivers."],
  guard_stairs: ['PAV', "Guard on the landing. Crouch, hug the wall, move when his back's turned."],
  mechdoor: ['PAV', "Swipe us through… okay. WOW. Look at this place."],
  mech: ['PAV', "A star. The whole crown's a star with something sealed in the middle. Windows everywhere — stay out of the light lanes and off the cameras."],
  cctv: ['PAV', "Camera clocked us! Move — find cover before someone comes looking."],
  guard_woke: ['PAV', "He's up, he's UP — walk away, walk away!"],
  busted: ['PAV', "That was embarrassing. Back up, breathe, go again."],
  vent: ['PAV', "East point — that big vent box. Ladder's on the side. Up you go, then get LOW. Hold C."],
  duct: ['PAV', "Tight fit. I'll squeeze through after you — go, go."],
  lightwell: ['CHASE', "…Snow. Coming straight down. We're close."],
  mash_start: ['PAV', "Grate's rusted into next year. Get under it — on three we PUSH. Mash E! PUSH!"],
  mash_mid: ['PAV', "It's moving! Don't stop — PUSH!"],
  grate: ['PAV', "THERE it goes! Ha! Up, up, up!"],
  outside: ['PAV', "…Okay. Okay okay okay. The hole. The tower. The SIGN. Nobody back home is believing one word of this."],
  hole: ['PAV', "That hole goes down further than this building does. That's not architecture, that's an appetite."],
  catwalk: ['CHASE', "Catwalk holds. Come on."],
  climb: ['PAV', "Caged ladder, east face. All the way to the sign. Don't race it — just climb."],
  top_arrive: ['CHASE', "…Do you hear music?"],
  a1: ['A', "You climbed all that way for a view. I climb it to keep the light on. …♥"],
  a2: ['A', "The hole isn't damage. It's a door. The sign just keeps its name lit."],
  a3: ['A', "You want to know what it is? Clip in. The only honest way down is through."],
  rappel_start: ['A', "Don't be afraid. It already knows your name."],
  rappel_pav: ['PAV', "I cannot believe we're doing this. I cannot believe I'M doing this. See you at the bottom of a hole, Chase!"],
  descended: ['PAV', "…We're never explaining this to anyone. Deal? Deal."],
  fell: ['PAV', "HEY! You good?! Do NOT do that again — my heart can't take it."],
};
