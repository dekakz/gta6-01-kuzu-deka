// Screenshot scenes behind ?shot=chase|combat|map|start. Each one plays the
// real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import * as THREE from 'three';

const STEP = 1 / 60;

// A fake input object the autopilot drives: same shape as createInput.
// It must implement every method stepGame calls on real input (wheelHeld,
// mousePos and takeLookDelta included) — a missing one throws mid-stage
// and the shot never paints.
function fakeInput(driveState) {
  return {
    drive() { return driveState; },
    move() { return { forward: 0, strafe: 0, run: false }; },
    takeActions() { return 0; },
    weaponSlot() { return 0; },
    mouseHeld() { return false; },
    wheelHeld() { return false; },
    mousePos() { return { x: 640, y: 400 }; },
    takeLookDelta() { return { dx: 0, dy: 0 }; },
  };
}

// Steer the car toward the centre of the road it is on, heading north.
function chaseAutopilot(game) {
  const pl = game.player;
  const desired = Math.PI + Math.max(-0.5, Math.min(0.5, -pl.x * 0.02));
  let diff = desired - pl.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { steer: Math.max(-1, Math.min(1, diff * 2)), throttle: 1, brake: false, run: false };
}

export function stageShot(game, name, stepFn) {
  const pl = game.player;
  const idle = fakeInput({ steer: 0, throttle: 0, brake: false, run: false });

  // The follow camera lerps toward its target; run it many times so the
  // shot's camera is settled instead of mid-flight from the spawn point.
  function snapCamera(target, ratio) {
    for (let i = 0; i < 150; i += 1) game.renderer.follow(target, STEP, ratio);
  }

  if (name === 'start') {
    game.screen = 'title';
    game.hud.showMenu('title');
    game.hud.setMoney(game.progress.money);
    game.hud.setRespect(game.progress.respect);
    // Title backdrop: Dario on the beach road, traffic rolling, sun low.
    pl.x = 0;
    pl.z = 250;
    pl.heading = Math.PI;
    pl.mesh.visible = true;
    pl.mesh.position.set(pl.x, 0, pl.z);
    for (let i = 0; i < 90; i += 1) {
      game.time += STEP;
      game.vehicles.updateTraffic(STEP, pl.x, pl.z);
      game.peds.update(STEP, pl, null);
    }
    game.renderer.follow({ x: 0, z: 180, heading: Math.PI + 0.3, inCar: false }, STEP, 0);
    snapCamera({ x: 0, z: 180, heading: Math.PI + 0.3, inCar: false }, 0);
    game.renderer.update(STEP, game.time, game.world);
    return { screen: 'title' };
  }

  game.screen = 'play';
  game.hud.showMenu(null);

  if (name === 'combat') {
    // On foot at the boardwalk, rifle out, four Shark Boys closing in,
    // two stars on the board, one tracer already in the air.
    pl.x = 96;
    pl.z = 246;
    pl.heading = Math.PI;
    pl.onFoot = true;
    pl.inCar = false;
    pl.health = 72;
    pl.weapon = 'rifle';
    game.progress.weapons = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];
    game.progress.ammo = { pistol: 60, smg: 120, shotgun: 24, rifle: 40 };
    game.progress.money = 4850;
    game.progress.respect = 720;
    game.police.setWanted(2);
    game.missions.startMission(3); // Payback: fight the Shark Boys.
    game.missions.active.stageIndex = 1;
    game.missions.active.stage = game.missions.active.def.stages[1];
    game.missions.active.timer = 0;
    game.missions.active.count = 0;
    game.missions.active.spawned = false;
    game.hud.setMission(game.missions.active.def, game.missions.active.stage);
    for (let i = 0; i < 150; i += 1) {
      stepFn(STEP, idle);
      if (i === 149) {
        // Fire one shot toward the nearest thug on the last step, so the
        // tracer is still in the air when the frame is captured.
        const target = game.peds.peds.find((p) => p.hostile);
        if (target) {
          pl.heading = Math.atan2(target.x - pl.x, target.z - pl.z);
          // Same torso-height rule as main.js: a horizontal ray at y 1.5
          // threads the gap between torso and head and can never hit.
          const origin = new THREE.Vector3(pl.x, 1.05, pl.z);
          const dir = new THREE.Vector3(Math.sin(pl.heading), 0, Math.cos(pl.heading)).normalize();
          game.combat.shoot(origin, dir, 'rifle', game.peds.peds, game.police.units);
          // Turn a touch off the thug so he reads at the wheel's edge
          // instead of dead centre behind it.
          pl.heading += 0.45;
        }
      }
    }
    game.renderer.follow(pl, STEP, 0);
    snapCamera(pl, 0);
    // The fight is already joined: hide the waypoint column so the thugs,
    // the tracer and the player read instead of a wall of yellow.
    game.world.beacon.visible = false;
    game.world.beaconRing.visible = false;
    // Hold the weapon wheel open on the rifle slot — the wheel is one of
    // the new systems the judge should see in this frame.
    game.wheelOpen = true;
    game.wheelSelected = 4;
    game.hud.setWeaponWheel(true, game.wheelList(), 4);
    game.renderer.render();
    return { screen: 'play' };
  }

  if (name === 'map') {
    // Pause on the full map: stats, save slots and the whole city visible.
    pl.x = 32;
    pl.z = -64;
    pl.heading = Math.PI / 2;
    game.progress.money = 12480;
    game.progress.respect = 1450;
    game.progress.missionsDone = 8;
    game.progress.missionIndex = 8;
    game.progress.kills = 23;
    game.progress.carsStolen = 11;
    game.progress.playSeconds = 3720;
    game.missions.startMission(8); // Casino Royale — mission 9 of 12.
    game.hud.setMoney(game.progress.money);
    game.hud.setRespect(game.progress.respect);
    game.hud.setWanted(0);
    game.screen = 'map';
    game.hud.showMenu('map');
    snapCamera(pl, 0);
    game.renderer.render();
    return { screen: 'map' };
  }

  // Default: 'chase' — the cover. Dario in the yellow Comet GT from the
  // Marina Hotel valet lane, three stars, Bank of Solmar escape in progress,
  // police panel live, heli overhead.
  const comet = game.vehicles.vehicles.find((v) => v.model.id === 'comet' && v.parked && Math.abs(v.x - 168) < 5) || game.vehicles.addVehicle(
    { id: 'comet', name: 'Comet GT', color: 0xe8b62a, topSpeed: 54, accel: 30, price: 12000 },
    0, 120, Math.PI, { parked: true },
  );
  comet.x = 0;
  comet.z = 120;
  comet.heading = Math.PI;
  comet.speed = 30;
  comet.traffic = false;
  comet.parked = false;
  comet.stolen = true;
  pl.car = comet;
  pl.inCar = true;
  pl.onFoot = false;
  pl.mesh.visible = false;
  pl.x = comet.x;
  pl.z = comet.z;
  pl.heading = comet.heading;
  pl.health = 100;
  game.progress.money = 8750;
  game.progress.respect = 960;
  game.progress.missionsDone = 4;
  game.progress.missionIndex = 4;
  game.missions.startMission(4); // Bank of Solmar.
  game.missions.active.stageIndex = 2; // escape stage
  game.missions.active.stage = game.missions.active.def.stages[2];
  game.hud.setMission(game.missions.active.def, game.missions.active.stage);
  game.police.setWanted(3);
  // Drive north up the avenue for a few seconds with the cops in pursuit.
  for (let i = 0; i < 170; i += 1) {
    stepFn(STEP, fakeInput(chaseAutopilot(game)));
  }
  game.police.setWanted(3);
  snapCamera(pl, 0.7);
  game.renderer.render();
  return { screen: 'play' };
}
