// Central game state + tiny event bus.
export const state = {
  started: false,
  // street / lobby
  triedFrontDoor: false,
  sideDoorOpen: false,
  hasLobbyCard: false,
  elevatorUsed: false,
  // office floor
  readOfficeNote: false,
  sawPoster: false,
  stairsDoorOpen: false,   // keypad, code 1987
  hasMaintCard: false,
  mechDoorOpen: false,
  // mech / vent route
  inDuct: false,
  grateProgress: 0,        // 0..1 mash progress
  grateOpen: false,
  // roof / spire
  outside: false,          // stepped onto the roof — the reveal
  sawHole: false,
  crossedCatwalk: false,
  atTop: false,
  aIntroDone: false,
  musicStarted: false,
  rappelling: false,
  descended: false,        // finished the rappel finale
  falls: 0,
  busts: 0,
  alarm: false,            // CCTV alert active
  zone: 'street',
  currentChar: 'chase',    // 'chase' | 'pav'
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

// Rolling log of recent events, fed to the NPC brains as grounding.
export const recentEvents = [];
on('*', (event) => {
  recentEvents.push(event);
  if (recentEvents.length > 8) recentEvents.shift();
});

export function currentObjective() {
  if (!state.sideDoorOpen) {
    return state.triedFrontDoor
      ? 'Front doors are locked. Find another way in — try the alley on the east side.'
      : 'Get inside Northpoint Tower.';
  }
  if (!state.elevatorUsed) {
    if (!state.hasLobbyCard) return 'You need an elevator card. Check reception — quietly, the guard is asleep.';
    return 'Swipe the card at the elevator and head up.';
  }
  if (!state.mechDoorOpen) {
    if (!state.stairsDoorOpen) {
      if (!state.readOfficeNote) return 'Cross floor 43 to the stairwell. The door is code-locked.';
      return 'The stair code is the year the tower opened. Someone here is proud of it — look around.';
    }
    if (!state.hasMaintCard) return 'The mech level needs a maintenance card. Try the mail room.';
    return 'Take the stairwell up to the mechanical crown. Watch the patrol.';
  }
  if (!state.grateOpen) {
    if (!state.inDuct) return 'Find a way up to the roof — check the ventilation in the star corners.';
    return 'That grate won\'t move alone. Get under it and PUSH — mash [E].';
  }
  if (!state.outside) return 'Climb out onto the roof.';
  if (!state.crossedCatwalk) return '…What is this? Cross the catwalk to the spire.';
  if (!state.atTop) return 'Climb the service ladder. All the way up.';
  if (!state.descended) {
    return state.aIntroDone
      ? 'Clip into the anchor line and rappel over the edge.'
      : 'Someone is up here with you. Talk to them. [T]';
  }
  return 'You saw it. The roof is yours — explore, or ride the line again.';
}

// Compact textual snapshot for the LLM brains.
export function describeState(playerPos) {
  const names = { chase: 'Chase', pav: 'Pav' };
  const flags = [];
  flags.push(`the player currently controls ${names[state.currentChar]}; the other one follows as a companion (Q swaps control)`);
  if (state.hasLobbyCard) flags.push('they lifted an elevator card from reception (guard slept through it)');
  if (state.elevatorUsed) flags.push('they rode the elevator to floor 43');
  if (state.readOfficeNote) flags.push('desk note read: stair code = year the tower opened (posters say 1987)');
  if (state.stairsDoorOpen) flags.push('stairwell door is open');
  if (state.hasMaintCard) flags.push('they have the maintenance keycard from the mail room');
  if (state.mechDoorOpen) flags.push('they reached the star-shaped mechanical crown (two stories, windows all around, guard patrol + CCTV)');
  if (state.inDuct) flags.push('they found the vent route in the east star corner');
  if (state.grateOpen) flags.push('the stuck light-well grate was forced open (everyone pushed together)');
  if (state.outside) flags.push('THE REVEAL: thunder-blizzard on the roof, a massive circular hole bored into the tower core, and a white lattice spire rising out of it carrying a huge green neon box sign high up');
  if (state.atTop) flags.push('they are at the top platform under the neon sign; the stranger called A is here; strange music on the wind');
  if (state.descended) flags.push('they rappelled off the platform down INTO the hole and came back changed');
  if (state.busts > 0) flags.push(`security caught them ${state.busts} time(s)`);
  if (state.falls > 0) flags.push(`they fell into the hole ${state.falls} time(s)`);
  return [
    `location: ${state.zone}`,
    `objective: ${currentObjective()}`,
    `facts: ${flags.join('; ')}`,
    `recent events: ${recentEvents.slice(-5).join(', ') || 'none'}`,
  ].join('\n');
}
