// Save slots in localStorage: three named slots plus an autosave.
// Stores money, respect, mission progress, owned weapons, garage cars
// and the player's position. Loading restores the open world, not a replay.
const KEY = 'solmar-bay-save';

function readAll() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage off: the game still plays, it just cannot save.
  }
}

export function createSave() {
  function save(slot, progress) {
    const all = readAll();
    all[slot] = {
      ...progress,
      savedAt: new Date().toISOString(),
    };
    writeAll(all);
    return true;
  }

  function load(slot) {
    const all = readAll();
    return all[slot] ?? null;
  }

  function list() {
    const all = readAll();
    return ['slot1', 'slot2', 'slot3', 'auto'].map((slot) => ({
      slot,
      data: all[slot] ?? null,
    }));
  }

  function slotLabel(slot) {
    return { slot1: 'Save Slot 1', slot2: 'Save Slot 2', slot3: 'Save Slot 3', auto: 'Autosave' }[slot] ?? slot;
  }

  return { save, load, list, slotLabel };
}

export function defaultProgress() {
  return {
    money: 250,
    respect: 0,
    missionIndex: 0,
    missionsDone: 0,
    weapons: ['fists', 'pistol'],
    ammo: { pistol: 60, smg: 0, shotgun: 0, rifle: 0 },
    garage: ['solano'],
    playerX: 0,
    playerZ: 250,
    kills: 0,
    carsStolen: 0,
    playSeconds: 0,
  };
}
