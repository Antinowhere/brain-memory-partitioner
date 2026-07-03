// Central game state + tiny event bus.
export const state = {
  started: false,
  readDeskNote: false,   // learned that the code is "the year the plant opened"
  sawPoster: false,      // decorative flag, used for Pav context
  d1Open: false,         // keypad door office -> corridor
  breakers: [false, false, false],
  power: false,
  lockerOpen: false,
  hasKeycard: false,
  d2Open: false,         // card reader door mech -> fan room
  fanStopped: false,     // lever pulled, fan winding down
  fanStill: false,       // fan actually stopped (grate reachable)
  grateOpen: false,
  inDuct: false,
  hatchOpen: false,
  outside: false,
  sawHole: false,
  nearSpire: false,
  falls: 0,
};

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(fn);
}

export function emit(event, data) {
  (listeners.get(event) || []).forEach((fn) => fn(data));
  (listeners.get('*') || []).forEach((fn) => fn(event, data));
}

// Rolling log of recent events, fed to Pav's brain as grounding.
export const recentEvents = [];
on('*', (event) => {
  recentEvents.push(event);
  if (recentEvents.length > 8) recentEvents.shift();
});

export function currentObjective() {
  if (!state.d1Open) {
    if (!state.readDeskNote) return 'Find a way out of the maintenance office.';
    return 'The keypad code is the year the plant opened. Find it, then punch it in.';
  }
  if (!state.power) return 'Restore power — find the breaker panel in the mechanical room.';
  if (!state.hasKeycard) return 'Find a keycard for the north security door. Try the crew lockers.';
  if (!state.d2Open) return 'Swipe the keycard at the north security door.';
  if (!state.fanStopped) return 'A giant fan is blocking the ductwork. Find the override.';
  if (!state.grateOpen) return 'Pry open the grate behind the fan blades.';
  if (!state.outside) {
    if (!state.hatchOpen) return 'Crawl through the duct (C to crouch), climb the ladder, open the roof hatch.';
    return 'Climb out onto the roof.';
  }
  if (!state.nearSpire) return '…What is this place? Get closer to the spire.';
  return 'Explore the rooftop. Mind the hole.';
}

// Compact textual snapshot for the LLM.
export function describeStateForPav(playerPos) {
  const loc = locationName(playerPos);
  const flags = [];
  if (state.readDeskNote) flags.push('player read the desk note (code = year plant opened; posters say 1987)');
  if (state.d1Open) flags.push('office keypad door is open');
  flags.push(state.power ? 'power restored' : 'power is OUT (breaker panel on east wall of mech room, flip all 3)');
  if (state.hasKeycard) flags.push('player has the contractor keycard');
  else if (state.power) flags.push('keycard is inside a crew locker on the WEST wall of the mech room');
  if (state.d2Open) flags.push('north security door open');
  if (state.fanStopped) flags.push('big fan overridden' + (state.fanStill ? ' and fully stopped' : ' (still winding down)'));
  if (state.grateOpen) flags.push('grate behind the fan is open — duct leads to a ladder and roof hatch');
  if (state.outside) flags.push('YOU ARE BOTH ON THE ROOF: thunder-blizzard, massive circular hole in the roof, white spire rising out of the hole with a flat green neon sign reading SPIRE');
  if (state.falls > 0) flags.push(`player has fallen into the hole ${state.falls} time(s) (they respawn by the hatch)`);
  return [
    `location: ${loc}`,
    `objective: ${currentObjective()}`,
    `facts: ${flags.join('; ')}`,
    `recent events: ${recentEvents.slice(-5).join(', ') || 'none'}`,
  ].join('\n');
}

export function locationName(p) {
  if (!p) return 'unknown';
  if (state.outside && p.y > 7.5) return 'the rooftop';
  if (p.y > 2.5 && p.z < -46) return 'the ladder shaft';
  if (p.z < -44 && p.x > 5) return 'the crawl duct behind the fan';
  if (p.z < -32 && p.x > 3) return 'the fan room';
  if (p.z < -12) return 'the mechanical room';
  if (p.z < -4) return 'the connecting corridor';
  return 'the maintenance office (start room)';
}
