# WHITEOUT SPIRE

A first-person Three.js exploration game. You and your buddy **Pav** have snuck
into the sub-basement of the old Northpoint Utility Tower during a snowstorm.
Bypass the locks, restore the power, find the hidden grate behind the giant
exhaust fan, crawl the ducts — and climb out onto a roof you will not forget:
a thunder-blizzard, a massive hole punched through the rooftop, and a white
spire rising out of it wearing a flat green neon sign.

## Run it

```bash
cd rooftop-game
npm install
npm run dev
```

Open the printed URL (default http://localhost:5173) and click **CLICK TO START**.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| Shift | Run |
| Space | Jump |
| C (hold) | Crouch — needed for the crawl duct |
| E | Interact (keypads, breakers, lockers, levers, grates, hatches) |
| T | Talk to Pav |
| Esc | Close chat / modals, release the mouse |

## Pav, your companion

Pav walks the route with you, comments on what you find, and nudges you when
you're stuck (ask him: *"where do I go?"*).

His free-form conversation is powered by **Claude (`claude-opus-4-8`)** through
the official Anthropic SDK. Click **⚙ PAV LINK** in the top-right and paste an
Anthropic API key to enable it:

- The key is stored only in your browser's `localStorage`.
- It is sent only to `api.anthropic.com`.
- Without a key the game still fully works — Pav falls back to scripted lines
  and progress-aware hints.

Pav's LLM brain is grounded each turn with a compact game-state block
(location, current objective, discovered facts), so he answers about what you
are actually looking at.

## The route (spoilers)

1. **Maintenance office** — the desk note says the keypad code is "the year the
   plant opened"; the anniversary poster says **SINCE 1987**.
2. **Mechanical room** — the power is out. Flip all three breakers on the
   east-wall panel (there's a small lamp over it).
3. **Crew lockers** (west wall) — one holds a contractor keycard.
4. **Card reader** by the north security door — needs power + keycard.
5. **Fan room** — pull the red **FAN OVERRIDE** lever, wait for the blades.
6. **The hidden grate** behind the stopped fan. Pry it open, hold **C**, crawl.
7. **Ladder shaft** — climb, open the roof hatch.
8. **The roof.** Mind the hole.

## Tech notes

- Vite + Three.js, no build-time assets: every texture (posters, keypads,
  breaker panel, the neon sign) is generated on a canvas at load.
- All audio is procedural WebAudio (wind, thunder, fan, breaker snaps, keypad
  beeps) — no audio files.
- Custom first-person controller with AABB collision, crouch clearance checks,
  ladder volumes and floor regions (the roof's floor has a real hole in it —
  the game respawns you at the hatch if you find out how real).
- Blizzard: ~14k wrapped snow particles with gusting wind; lightning is a
  stuttered directional-light flash with distance-delayed procedural thunder.
