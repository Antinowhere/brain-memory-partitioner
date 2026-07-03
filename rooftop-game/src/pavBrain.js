// Pav's brain. With an Anthropic API key: Claude Opus 4.8 via the official
// SDK (browser build, key stays in localStorage). Without one: a scripted
// fallback keyed to game progress, so the game always works.
import Anthropic from '@anthropic-ai/sdk';
import { state, currentObjective } from './state.js';

const KEY_STORAGE = 'pav_anthropic_key';
const MODEL = 'claude-opus-4-8';

const SYSTEM = `You are Pav, a 28-year-old urban-exploration buddy inside a first-person exploration game. You and the player (your friend) have snuck into the sub-basement of the old Northpoint Utility Tower during a snowstorm, trying to reach the roof. You walk beside them the whole way.

Personality: dry wit, loyal, streetwise, unflappable on the surface but a little superstitious about this tower. You love grates, ducts, and "the janitor always writes the code down somewhere" wisdom. You tease the player but always have their back.

Rules:
- Stay in character at all times. Never mention being an AI, a language model, a game, or Anthropic.
- Keep replies SHORT: one to three sentences, spoken dialogue only. No stage directions, no asterisks, no emoji.
- A [GAME STATE] block precedes each player message. Treat it as what you can both currently see and know. Ground your answers in it.
- If the player asks for help or seems stuck, give a nudge based on the current objective — hint first, full answer only if they push.
- The route, if asked: office keypad (code = the year on the anniversary poster, 1987) → mechanical room → flip all three breakers on the east-wall panel → keycard in the crew lockers on the west wall → card reader at the north security door → pull the FAN OVERRIDE lever → pry the grate behind the stopped fan → crawl the duct, climb the ladder, open the roof hatch.
- What's on the roof (only discuss once you're both outside): a thunder-blizzard, a massive circular hole punched through the roof, and a white spire rising out of the hole with a flat green neon sign reading SPIRE. You have never seen anything like it and it quietly scares you.`;

let history = [];

export function getKey() { return localStorage.getItem(KEY_STORAGE) || ''; }
export function setKey(k) {
  if (k) localStorage.setItem(KEY_STORAGE, k.trim());
  else localStorage.removeItem(KEY_STORAGE);
}
export function hasKey() { return !!getKey(); }

export async function ask(text, contextBlock, onDelta) {
  if (!hasKey()) {
    const reply = canned(text);
    onDelta?.(reply);
    return reply;
  }
  const client = new Anthropic({ apiKey: getKey(), dangerouslyAllowBrowser: true });
  history.push({
    role: 'user',
    content: `[GAME STATE]\n${contextBlock}\n[/GAME STATE]\n\n${text}`,
  });
  trimHistory();
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 300,
      system: SYSTEM,
      messages: history,
    });
    let acc = '';
    stream.on('text', (delta) => {
      acc += delta;
      onDelta?.(acc);
    });
    const msg = await stream.finalMessage();
    const full = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    history.push({ role: 'assistant', content: full || '…' });
    return full || '…';
  } catch (err) {
    history.pop(); // drop the failed user turn
    let line;
    if (err instanceof Anthropic.AuthenticationError) {
      line = '(radio static) …key\'s no good, boss. Check the PAV LINK settings — that API key got rejected.';
    } else if (err instanceof Anthropic.RateLimitError) {
      line = '(radio static) …too much chatter on this channel. Give it a second and try me again.';
    } else if (err instanceof Anthropic.APIConnectionError) {
      line = '(radio static) …signal\'s dead in here. Network problem — can\'t reach the outside.';
    } else if (err instanceof Anthropic.APIError) {
      line = `(radio static) …something's jammed (${err.status || 'API error'}). Try me again in a bit.`;
    } else {
      line = '(radio static) …lost you for a second there. Say again?';
    }
    onDelta?.(line);
    return line;
  }
}

export function resetHistory() { history = []; }

function trimHistory() {
  if (history.length > 24) history = history.slice(-24);
  while (history.length && history[0].role !== 'user') history.shift();
}

// ------------------------------------------------------------ scripted mode
const QUIPS = [
  "Keep moving. This place gives me the creeps in a way I almost respect.",
  "You know what this building needs? Fewer locked doors. And a vending machine.",
  "I've broken into nicer places. I've also broken into worse. This is mid.",
  "Stay sharp. Old towers like this always save one surprise for the roof.",
  "If we find a janitor down here I'm asking for his autograph. Guy runs a tight ship.",
  "My grandmother said never trust a building taller than a church. Starting to get it.",
];

function hint() {
  if (!state.d1Open) {
    if (!state.readDeskNote) return "Check the desk. Maintenance guys always leave the code lying around somewhere.";
    return "The note says the code's the year this place opened. That fancy anniversary poster on the wall — read it. Then punch it into the keypad.";
  }
  if (!state.power) return "No juice, no card readers. Big breaker panel, east wall of the mech room — there's a little lamp over it. Flip all three.";
  if (!state.hasKeycard) return "Crew lockers, west wall. One of them's got a contractor card in it. Don't judge me for knowing that.";
  if (!state.d2Open) return "Take that card to the reader by the north door. Should be green now the power's up.";
  if (!state.fanStopped) return "That fan will turn us into soup. There's an override lever on the east wall — big red handle, can't miss it.";
  if (!state.grateOpen) return "Wait for the blades to stop, then pry the grate behind them. Told you there's always a grate.";
  if (!state.outside) return "Crawl through — hold C to get low. Ladder's at the end. Pop the hatch at the top. I'll meet you up there.";
  if (!state.nearSpire) return "Go look at it. I'll be right here, questioning every decision that led me to this roof.";
  return "Careful around that hole. It doesn't have a bottom I'm willing to vouch for.";
}

function canned(text) {
  const q = text.toLowerCase();
  const wantsHelp = /help|stuck|where|how|what (do|should)|hint|next|code|key|open|door|fan|power|breaker|card|grate|roof|hatch/.test(q);
  if (wantsHelp) return hint();
  if (/who are you|your name/.test(q)) return "Pav. Professional door-ignorer, amateur philosopher, your ride home. Now keep moving.";
  if (/spire|sign|neon|hole/.test(q) && state.outside) return "A white spire in a hole in a roof, wearing a neon sign like a name tag. I don't have a theory. I have a headache.";
  if (/scared|afraid|creepy/.test(q)) return "Scared? Me? …Okay, slightly. Mostly of the paperwork if we get caught.";
  return QUIPS[Math.floor(Math.random() * QUIPS.length)];
}

// Scripted event barks — always used regardless of API key, so the story
// beats land consistently.
export const BARKS = {
  intro: "Cozy. Real cozy. That door's code-locked — but a place like this? The code's written down somewhere. Check the desk.",
  note: "'The year the plant opened.' Seriously? There's got to be a plaque or a poster around here. Places like this love bragging.",
  poster: "1987. There it is. Punch it in.",
  d1: "There we go. Mech level next — watch your step, it's darker than my sense of humor down here.",
  mech: "Power's out. Card readers won't read squat without juice — find the breaker panel. East wall, probably.",
  breaker1: "That's one.",
  power: "And there was light. Okay — that north door wants a keycard. Crew lockers, maybe? West wall.",
  keycard: "Contractor card. Laminated and everything. North door — let's move.",
  reader_dead: "Dead reader. Power first, then plastic.",
  d2: "You hear that? That fan's moving more air than a subway tunnel. There'll be an override lever somewhere.",
  fanoff: "It's winding down… wait for the blades. Never race a fan. Learned that one for you already.",
  fanstill: "Look at that — grate behind the blades. That's our way up. Told you: there's ALWAYS a grate.",
  grate: "Yeah, I'm not fitting through there — that's a you-sized hole. Go. I'll find my own way up. Meet you on the roof.",
  hatch: "…",
  outside: "Don't ask how I beat you up here. And—okay. Okay. I have questions. Starting with THAT.",
  hole: "Careful. That hole goes down further than this building does. That's not architecture, that's an appetite.",
  spire: "A white spire. Green neon. Growing out of a hole in a roof, in a blizzard. Nobody back home is going to believe a word of this. Get a good look.",
  fell: "HEY. You good?! Do NOT do that again — my heart can't take it, and I am not explaining this to your mother.",
  vent: "Bolted. Six ways. Whoever runs maintenance here doesn't trust vents. Smart, honestly.",
};
