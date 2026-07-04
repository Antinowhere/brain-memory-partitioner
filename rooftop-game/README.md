# WHITEOUT SPIRE

A first-person Three.js infiltration game. You are **Chase** (the one in the
glitching skull mask); your buddy **Pav** walks the whole route with you, and
you can swap control between them at any time with **Q**. Start on the street
outside Northpoint Tower, find the service door, lift an elevator card off the
sleeping lobby guard, ride up to floor 43, cross the offices to the stairwell,
slip past the patrols and cameras in the star-shaped two-story mechanical
crown, climb the vent box, crawl the duct into an open-air light-well, and
force the stuck grate open together — out onto a roof you will not forget:
a thunder-blizzard, a massive hole bored into the tower's core, and a white
X-braced lattice spire rising out of it carrying a huge green neon box sign.
Cross the catwalk, climb the caged ladder to the platform under the sign —
where **A** is waiting, music rides the wind, and a rappel line goes down
into the hole.

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
| Shift | Run (careful — noise wakes the lobby guard) |
| Space | Jump |
| C (hold) | Crouch — the crawl ducts need it, and it shrinks guard/CCTV detection |
| E | Interact (doors, keypads, cards, readers, panels — and MASH it on the stuck grate) |
| Q | Swap control between Chase and Pav |
| T | Talk to your companion (or to A, when you're close to them) |
| Esc | Close chat / modals, release the mouse |

## Security

No lasers, nothing sci-fi: locked doors, an occasional patrol, and CCTV.

- **Lobby**: the desk guard is asleep. Walking is fine; running or jumping
  near him wakes him up.
- **Stairs & mech crown**: patrolling guards with flashlights. Stay behind
  them, crouch, break line of sight. Getting seen for about a second sends
  you back to the last checkpoint.
- **CCTV**: sweeping cameras with visible cones. Linger in one and it chirps
  an alert — the local guard comes to investigate and keypads lock out for a
  while.

## The companions

- **Chase** — skull mask, speaks in one-liners.
- **Pav** — parka, beanie, never stops talking, always knows where the
  janitor wrote the code down.
- **A** — waits at the top of the spire. Ask about the hole.

Free-form conversation with all three is powered by **Claude
(`claude-opus-4-8`)** through the official Anthropic SDK — each has their own
persona prompt and is grounded every turn with a live game-state block. Click
**⚙ PAV LINK** and paste an Anthropic API key to enable it:

- The key is stored only in your browser's `localStorage`.
- It is sent only to `api.anthropic.com`.
- Without a key the game still fully works — everyone falls back to scripted
  lines and progress-aware hints.

## The route (spoilers)

1. **Street** — front doors locked. Service door, east alley.
2. **Lobby** — elevator card on the reception desk, next to the sleeping
   guard. Quietly. Swipe the east elevator, press 43.
3. **Floor 43** — desk note: stair code = "the year the tower opened"; the
   break-room anniversary poster says **SINCE 1987**. Maintenance keycard in
   the mail room. Keypad the stairwell door.
4. **Stairwell** — a guard paces the mid landing. Time it. Swipe MAINT at the
   top.
5. **Mechanical crown** — two stories, star-shaped, windows all around, a
   sealed core in the middle. Patrol + CCTV. In the east star point: a big
   vent box with a ladder.
6. **The vent** — up the box, hold **C**, crawl the duct into an open-air
   light-well (snow falls straight in). Ladder up to the stuck grate — get
   under it and **mash E**: everyone pushes together.
7. **The roof.** Thunder-blizzard, the hole, the lattice spire, the green
   box sign. Cross the catwalk, climb the caged ladder — a long way up.
8. **The platform** — someone is waiting, and a track starts playing up here.
   When they're done talking: clip into the anchor and rappel off the edge,
   down into the hole.

## Tech notes

- Vite + Three.js. Textures (posters, keypads, the neon sign, skull masks,
  facade window grids) are canvas-generated at load; the spire is an
  InstancedMesh truss.
- Audio is procedural WebAudio (wind, thunder, elevator rumble, keypads,
  alarms) — plus one real track that plays only at the top of the spire.
- Custom first-person controller: AABB collision plus angled wall segments
  (for the star room), step-up for real staircases, crouch clearance, ladder
  volumes, polygon floor regions with real holes, and a rappel mode.
- Guards and CCTV do real line-of-sight checks (raycasts against wall
  occluders) with distance/FOV/crouch modifiers.
- Blizzard: ~14k wrapped snow particles with gusty wind, visible wherever the
  sky is open (street, light-well, roof); lightning only joins once you make
  the roof.
