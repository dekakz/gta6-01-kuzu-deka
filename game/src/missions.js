// Story missions: an eight-mission arc for Dario Vega, run by a small
// stage machine. Each stage is one of goto / steal / deliver / fight /
// survive / escape / collect, with dialog, an optional timer and a
// waypoint beacon. The manager owns progress, rewards and failure.
import { MISSION_DEFS } from './config.js';

export function createMissionManager(game) {
  let currentIndex = game.progress.missionIndex; // next mission to play
  let active = null; // { def, stageIndex, stage, timer, count, spawned }
  let completedCount = game.progress.missionsDone;

  function startMission(index) {
    const def = MISSION_DEFS[index];
    if (!def) return null;
    active = { def, stageIndex: 0, stage: def.stages[0], timer: def.stages[0].timer ?? 0, count: 0, spawned: false, surviveLeft: def.stages[0].seconds ?? 0 };
    game.say(def.stages[0].dialog || `${def.giver}: ${def.brief}`);
    game.hud.setMission(def, active.stage);
    game.world.beacon.visible = true;
    game.world.beaconRing.visible = true;
    moveBeacon();
    return active;
  }

  function moveBeacon() {
    if (!active || !active.stage) return;
    const stage = active.stage;
    if (stage.x !== undefined) {
      game.world.beacon.position.set(stage.x, 7, stage.z);
      game.world.beaconRing.position.set(stage.x, 0.3, stage.z);
    }
  }

  function advanceStage() {
    active.stageIndex += 1;
    if (active.stageIndex >= active.def.stages.length) {
      completeMission();
      return;
    }
    active.stage = active.def.stages[active.stageIndex];
    active.timer = active.stage.timer ?? 0;
    active.count = 0;
    active.spawned = false;
    active.surviveLeft = active.stage.seconds ?? 0;
    game.say(active.stage.dialog || '');
    game.hud.setMission(active.def, active.stage);
    moveBeacon();
  }

  function failMission(reason) {
    game.say(`MISSION FAILED — ${reason}`);
    game.audio.wantedUp();
    active = null;
    game.world.beacon.visible = false;
    game.world.beaconRing.visible = false;
    game.hud.setMission(null, null);
    game.hud.showBanner('MISSION FAILED', reason, '#ff5544');
  }

  function completeMission() {
    const def = active.def;
    game.progress.money += def.rewardMoney;
    game.progress.respect += def.rewardRespect;
    game.progress.missionsDone += 1;
    completedCount += 1;
    currentIndex = Math.min(MISSION_DEFS.length, currentIndex + 1);
    game.progress.missionIndex = currentIndex;
    game.audio.missionComplete();
    game.audio.cash();
    game.hud.showBanner('MISSION PASSED', `${def.title}  •  +$${def.rewardMoney}  •  +${def.rewardRespect} respect`, '#ffd23c');
    game.say(`${def.giver}: Job done, Dario. $${def.rewardMoney} and a little respect, coming your way.`);
    active = null;
    game.world.beacon.visible = false;
    game.world.beaconRing.visible = false;
    game.hud.setMission(null, null);
    game.saveGame('auto');
  }

  function stageLabel() {
    if (!active) return '';
    const stage = active.stage;
    if (stage.type === 'fight' || stage.type === 'collect') {
      return stage.label.replace(/\(\d+\/\d+\)/, `(${active.count}/${stage.count})`);
    }
    return stage.label;
  }

  // Called every frame while a mission runs. Returns events for main.js.
  function update(dt, player) {
    if (!active) return;
    const stage = active.stage;
    const px = player.x;
    const pz = player.z;

    if (stage.timer) {
      active.timer -= dt;
      if (active.timer <= 0) {
        failMission('Out of time.');
        return;
      }
    }

    const dist = stage.x !== undefined ? Math.hypot(stage.x - px, stage.z - pz) : Infinity;

    if (stage.type === 'goto' || stage.type === 'deliver') {
      const needCar = stage.type === 'deliver';
      if (dist < stage.radius && (!needCar || !player.onFoot)) advanceStage();
    } else if (stage.type === 'steal') {
      if (dist < stage.radius && !player.onFoot) {
        // Stealing the target car: mark it stolen, raise heat.
        const car = game.vehicles.nearestVehicle(px, pz, 10, false);
        if (car) {
          car.stolen = true;
          game.police.addHeat(0.6);
          game.say('DARIO: This baby is mine now.');
          advanceStage();
        }
      }
    } else if (stage.type === 'fight') {
      if (!active.spawned) {
        active.spawned = true;
        active.hostiles = game.peds.spawnHostile(stage.x, stage.z, stage.count, { shirtColor: 0x1a1a1a });
      }
      active.count = active.hostiles.filter((h) => h.dead).length;
      game.hud.setMission(active.def, active.stage, stageLabel());
      if (active.count >= stage.count) advanceStage();
    } else if (stage.type === 'collect') {
      if (!active.spawned) {
        active.spawned = true;
        active.items = [];
        for (let i = 0; i < stage.count; i += 1) {
          const item = game.pickups.spawnPickup(stage.x + (i - 1) * 8, stage.z + (i % 2) * 8, 'cash');
          active.items.push(item);
        }
      }
      active.count = active.items.filter((it) => it.taken).length;
      // The bank job goes loud the moment the first bag is grabbed.
      if (active.def.id === 5 && active.count > 0 && game.police.wanted < 3) {
        game.police.setWanted(3);
        game.say('DISPATCH: Alarm at the Bank of Solmar! All units respond — three-star suspect!');
      }
      game.hud.setMission(active.def, active.stage, stageLabel());
      if (active.count >= stage.count) advanceStage();
    } else if (stage.type === 'survive') {
      if (!active.spawned) {
        active.spawned = true;
        game.police.setWanted(5);
        game.say('DISPATCH: All units, five-star suspect at the plaza. Bring him down!');
      }
      active.surviveLeft -= dt;
      game.hud.setMission(active.def, active.stage, `Survive the storm — ${Math.ceil(active.surviveLeft)}s`);
      if (active.surviveLeft <= 0) {
        game.police.setWanted(0);
        advanceStage();
      }
    } else if (stage.type === 'escape') {
      if (game.police.wanted === 0) advanceStage();
    }
  }

  return {
    defs: MISSION_DEFS,
    get active() { return active; },
    get nextIndex() { return currentIndex; },
    get completed() { return completedCount; },
    startMission, update, failMission, stageLabel,
    hasMore() { return currentIndex < MISSION_DEFS.length; },
  };
}
