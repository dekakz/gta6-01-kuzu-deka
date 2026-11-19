// Boot and the one loop for Solmar Bay. Owns the game object every system
// reads: the player, the car they drive, progress, screens and menus.
// Input is read every frame, the world advances in fixed 1/60 s steps,
// and the renderer paints what is there.
//
// ?seed=N fixes the city. ?shot=chase|combat|map|start (with &seed=N)
// stages that scene instead of running the loop, paints it and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { CITY, PLAYER, WEAPONS, SHOPS, GARAGE, RADIO_STATIONS } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_RADIO, ACTION_MAP, ACTION_HORN, ACTION_WEAPON_NEXT, ACTION_WEAPON_PREV, ACTION_SHOOT } from './input.js';
import { createAudio } from './audio.js';
import { buildWorld, isOnRoad } from './world.js';
import { createVehicleManager, CAR_MODELS } from './vehicles.js';
import { createPedestrianManager, buildPersonMesh } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissionManager } from './missions.js';
import { createPickups } from './pickups.js';
import { createSave, defaultProgress } from './save.js';
import { createHud } from './hud.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const STEP = 1 / 60;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const audio = createAudio();
const renderer = createRenderer(canvas);
const scene = renderer.scene;

const world = buildWorld(scene, random);
const vehicles = createVehicleManager(scene, world, random);
const peds = createPedestrianManager(scene, world, random);
const police = createPolice(scene, world, random);
const combat = createCombat(scene);
const pickups = createPickups(scene, random);
const save = createSave();

// The one game object: every system reads and writes this.
const game = {
  progress: defaultProgress(),
  player: {
    x: 0, z: 250, heading: Math.PI, speed: 0,
    onFoot: true, inCar: false, car: null,
    health: PLAYER.healthMax, weapon: 'pistol', weaponIndex: 1,
    mesh: null, punchTimer: 0, bustedTimer: 0, invulnerable: 0,
  },
  screen: 'title',
  time: 0,
  world, vehicles, peds, police, combat, pickups, save, audio, renderer,
  vehicleModels: CAR_MODELS,
  nearShop: null,
  upgrades: { engine: 0, armor: 0, turbo: false },
  missions: null,
  hud: null,
  missionAutoTimer: 4,
  camYaw: 0,
  wheelOpen: false,
  wheelSelected: 0,
};

game.missions = createMissionManager(game);
game.hud = createHud(game);

// Dario Vega, on foot: teal shirt so he reads against the crowd.
const playerMesh = buildPersonMesh(random, 0x2a9d8f);
playerMesh.position.set(game.player.x, 0, game.player.z);
scene.add(playerMesh);
game.player.mesh = playerMesh;

vehicles.spawnTraffic(26);
vehicles.spawnParked(14);
peds.spawnCrowd(34);
pickups.spawnStreetPickups();

function announce(message) {
  status.textContent = message;
}

game.say = (text) => game.hud.say(text);
game.wheelList = () => game.progress.weapons.map((key) => ({
  key,
  name: WEAPONS[key].name,
  ammo: key === 'fists' ? '' : (game.progress.ammo[key] ?? 0),
}));
game.saveGame = (slot) => {
  const p = game.progress;
  p.playerX = game.player.x;
  p.playerZ = game.player.z;
  save.save(slot, p);
  game.hud.say(`Game saved — ${save.slotLabel(slot)}.`);
  audio.blip();
};
game.loadGame = (slot) => {
  const data = save.load(slot);
  if (!data) return;
  game.progress = { ...defaultProgress(), ...data };
  game.player.x = data.playerX ?? 0;
  game.player.z = data.playerZ ?? 250;
  game.player.health = PLAYER.healthMax;
  game.player.onFoot = true;
  game.player.inCar = false;
  game.player.car = null;
  game.missions = createMissionManager(game);
  police.clearAll();
  game.hud.showMenu(null);
  game.screen = 'play';
  game.hud.say(`Loaded ${save.slotLabel(slot)}. Welcome back to Solmar Bay.`);
};

game.menuAction = (action) => {
  if (action === 'start') {
    game.progress = defaultProgress();
    game.missions = createMissionManager(game);
    police.clearAll();
    resetPlayerToStart();
    game.hud.showMenu(null);
    game.screen = 'play';
    audio.unlock();
    game.missions.startMission(0);
    announce('Playing. Mission 1: Welcome to Solmar.');
  } else if (action === 'continue') {
    const latest = save.list().filter((s) => s.data).sort((a, b) => new Date(b.data.savedAt) - new Date(a.data.savedAt))[0];
    if (latest) game.loadGame(latest.slot);
  } else if (action === 'resume') {
    game.hud.showMenu(null);
    game.screen = 'play';
  } else if (action === 'map') {
    game.screen = 'map';
    game.hud.showMenu('map');
  } else if (action === 'garage') {
    game.screen = 'garage';
    game.hud.showMenu('garage');
  } else if (action === 'settings') {
    game.screen = 'settings';
    game.hud.showMenu('settings');
  } else if (action === 'quit-title') {
    game.screen = 'title';
    game.hud.showMenu('title');
  } else if (action === 'respawn') {
    game.progress.money = Math.max(0, game.progress.money - (game.screen === 'dead' ? 200 : 300));
    police.clearAll();
    resetPlayerToStart();
    game.player.health = PLAYER.healthMax;
    game.hud.showMenu(null);
    game.screen = 'play';
    game.hud.say('You are back on your feet. Solmar Bay is still yours to take.');
  }
};

game.buyItem = (kind, price) => {
  const p = game.progress;
  if (p.money < price) { game.hud.say('Not enough cash.'); return; }
  p.money -= price;
  if (kind === 'buy-weapon-pistol') { p.weapons.push('pistol'); p.ammo.pistol = (p.ammo.pistol || 0) + 60; }
  if (kind === 'buy-weapon-smg') { p.weapons.push('smg'); p.ammo.smg = (p.ammo.smg || 0) + 120; }
  if (kind === 'buy-weapon-shotgun') { p.weapons.push('shotgun'); p.ammo.shotgun = (p.ammo.shotgun || 0) + 24; }
  if (kind === 'buy-weapon-rifle') { p.weapons.push('rifle'); p.ammo.rifle = (p.ammo.rifle || 0) + 40; }
  if (kind === 'buy-ammo') {
    for (const key of ['pistol', 'smg', 'shotgun', 'rifle']) p.ammo[key] = (p.ammo[key] || 0) + 40;
  }
  if (kind === 'buy-food') game.player.health = Math.min(PLAYER.healthMax, game.player.health + 40);
  if (kind === 'buy-meal') game.player.health = PLAYER.healthMax;
  if (kind === 'buy-jacket') p.respect += 10;
  if (kind === 'buy-chain') p.respect += 25;
  p.weapons = [...new Set(p.weapons)];
  audio.cash();
  game.hud.say('Purchase complete. Pleasure doing business.');
};

game.buyUpgrade = (kind) => {
  const p = game.progress;
  const cost = { engine: 1500, armor: 1200, turbo: 2000 }[kind];
  if (p.money < cost) { game.hud.say('Not enough cash.'); return; }
  p.money -= cost;
  if (kind === 'engine') game.upgrades.engine += 1;
  if (kind === 'armor') game.upgrades.armor += 1;
  if (kind === 'turbo') game.upgrades.turbo = true;
  audio.cash();
  game.hud.say('Upgrade fitted. Lena does good work.');
};

game.spawnGarageCar = (modelId) => {
  const model = CAR_MODELS.find((m) => m.id === modelId);
  if (!model) return;
  const car = vehicles.addVehicle(model, game.player.x + 4, game.player.z + 4, game.player.heading, { parked: true });
  game.hud.showMenu(null);
  game.screen = 'play';
  enterCar(car);
  game.hud.say(`Your ${model.name} is out of the garage.`);
};

function resetPlayerToStart() {
  const pl = game.player;
  if (pl.car) { pl.car = null; }
  pl.x = 0;
  pl.z = 250;
  pl.heading = Math.PI;
  pl.onFoot = true;
  pl.inCar = false;
  pl.speed = 0;
  pl.mesh.visible = true;
  pl.mesh.position.set(pl.x, 0, pl.z);
}

function closeWheel() {
  // The weapon wheel is an on-foot overlay: entering or leaving a car
  // dismisses it instead of leaving it open over the driving view.
  if (!game.wheelOpen) return;
  game.wheelOpen = false;
  game.hud.setWeaponWheel(false);
}

function enterCar(car) {
  closeWheel();
  const pl = game.player;
  if (car.traffic || car.parked) {
    if (car.traffic) {
      car.traffic = false;
      car.stolen = true;
      game.progress.carsStolen += 1;
      police.addHeat(0.6);
      game.hud.say(`DARIO: ${car.name}? Mine now.`);
      audio.wantedUp();
    } else if (car.parked && !car.stolen) {
      car.stolen = true;
      car.parked = false;
      game.progress.carsStolen += 1;
      police.addHeat(0.6);
      game.hud.say(`DARIO: ${car.name}? Mine now.`);
      audio.wantedUp();
    }
    const i = vehicles.parked.indexOf(car);
    if (i >= 0) vehicles.parked.splice(i, 1);
  }
  pl.car = car;
  pl.inCar = true;
  pl.onFoot = false;
  pl.mesh.visible = false;
  pl.x = car.x;
  pl.z = car.z;
  pl.heading = car.heading;
  audio.blip();
}

function exitCar() {
  closeWheel();
  const pl = game.player;
  if (!pl.car) return;
  const car = pl.car;
  pl.x = car.x - Math.sin(car.heading + Math.PI / 2) * 2.5;
  pl.z = car.z - Math.cos(car.heading + Math.PI / 2) * 2.5;
  const hit = world.collide(pl.x, pl.z, 0.6);
  pl.x = hit.x;
  pl.z = hit.z;
  pl.heading = car.heading;
  pl.car = null;
  pl.inCar = false;
  pl.onFoot = true;
  pl.mesh.visible = true;
  pl.mesh.position.set(pl.x, 0, pl.z);
  // Parking a stolen car in the garage marker keeps it.
  if (car.stolen && Math.hypot(pl.x - GARAGE.x, pl.z - GARAGE.z) < 14) {
    if (!game.progress.garage.includes(car.model.id)) game.progress.garage.push(car.model.id);
    game.progress.money += 200;
    vehicles.removeVehicle(car);
    game.hud.say(`LENA: ${car.name} is in the garage now. $200 finder fee, on the house.`);
    audio.cash();
  }
}

function damagePlayer(amount) {
  const pl = game.player;
  if (pl.invulnerable > 0) return;
  pl.health -= amount;
  pl.invulnerable = 0.4;
  game.hud.flashDamage();
  audio.punch();
  if (pl.health <= 0) {
    pl.health = 0;
    if (game.screen === 'play') {
      game.screen = 'dead';
      game.hud.showMenu('dead');
      announce('Wasted.');
    }
  }
}

function shootWeapon() {
  const pl = game.player;
  const weaponKey = pl.weapon;
  const weapon = WEAPONS[weaponKey];
  if (weaponKey !== 'fists') {
    const ammo = game.progress.ammo[weaponKey] ?? 0;
    if (ammo <= 0) {
      game.hud.say('Out of ammo — buy more at Ammo-Nation Solmar.');
      return;
    }
    game.progress.ammo[weaponKey] = ammo - 1;
  }
  // The ray is horizontal, so its height must cross a target's solid mass:
  // a ped's torso spans y 0.625-1.475 and a car's cabin 0.775-1.325, while
  // y 1.5 threads the gap between the torso top and the head and clears
  // every cabin roof — at 1.5 no shot could ever hit anything.
  const origin = new THREE.Vector3(pl.x, 1.05, pl.z);
  const direction = new THREE.Vector3(Math.sin(pl.heading), 0, Math.cos(pl.heading)).normalize();
  const result = combat.shoot(origin, direction, weaponKey, peds.peds, police.units);
  audio.gunshot();
  if (result && result.hit) {
    const ref = result.hit.ref;
    if (result.hit.kind === 'ped' && ref.dead) {
      game.progress.kills += 1;
      game.progress.money += 40;
      game.progress.respect += 5;
      police.addHeat(0.55);
      game.hud.say('Target down. +$40.');
    }
    if (result.hit.kind === 'police') {
      police.addHeat(0.4);
      if (ref.health <= 0) {
        scene.remove(ref.mesh);
        const i = police.units.indexOf(ref);
        if (i >= 0) police.units.splice(i, 1);
        game.progress.respect += 20;
        game.hud.say('Cop car disabled. The department will remember that.');
      }
    }
  }
  peds.update(0, game.player, { x: pl.x, z: pl.z });
}

// One fixed step of the whole game. `input` is the live input, or a
// synthetic one the screenshot autopilot supplies.
function stepGame(dt, input) {
  game.time += dt;
  const pl = game.player;
  const drive = input.drive();
  const move = input.move();
  const slot = input.weaponSlot();
  const actions = input.takeActions();

  if (game.screen !== 'play') return;

  game.progress.playSeconds += dt;

  // Number keys pick a weapon slot directly.
  if (slot > 0 && slot <= game.progress.weapons.length) {
    const picked = game.progress.weapons[slot - 1];
    if (picked !== pl.weapon) {
      pl.weapon = picked;
      game.hud.say(`Weapon: ${WEAPONS[pl.weapon].name}`);
      audio.blip();
    }
  }

  // --- Actions
  if (actions & ACTION_PAUSE) {
    game.screen = 'pause';
    game.hud.showMenu('pause');
    return;
  }
  if (actions & ACTION_MAP) {
    game.screen = 'map';
    game.hud.showMenu('map');
    return;
  }
  if (actions & ACTION_RADIO) {
    const station = audio.nextStation();
    game.hud.setRadio(station.name);
    game.hud.say(`Radio: ${station.name}`);
  }
  if (actions & ACTION_HORN) audio.horn();
  if (actions & ACTION_WEAPON_NEXT) {
    const owned = game.progress.weapons;
    const idx = owned.indexOf(pl.weapon);
    pl.weapon = owned[(idx + 1) % owned.length];
    game.hud.say(`Weapon: ${WEAPONS[pl.weapon].name}`);
    audio.blip();
  }
  if (actions & ACTION_WEAPON_PREV) {
    const owned = game.progress.weapons;
    const idx = owned.indexOf(pl.weapon);
    pl.weapon = owned[(idx - 1 + owned.length) % owned.length];
    game.hud.say(`Weapon: ${WEAPONS[pl.weapon].name}`);
    audio.blip();
  }

  // --- Mouse-look (right-drag): turn on foot, orbit the camera in a car.
  const look = input.takeLookDelta();
  if (look.dx !== 0) {
    if (pl.onFoot) pl.heading += look.dx * 0.0032;
    else game.camYaw = Math.max(-1.4, Math.min(1.4, game.camYaw + look.dx * 0.0032));
  }
  // The camera orbit eases back to centre when the mouse is still.
  if (pl.inCar && look.dx === 0 && game.camYaw !== 0) {
    game.camYaw -= game.camYaw * Math.min(1, dt * 0.6);
    if (Math.abs(game.camYaw) < 0.01) game.camYaw = 0;
  }

  // --- Weapon wheel (hold Tab): mouse angle picks a slot, release equips.
  const ownedWeapons = game.progress.weapons;
  if (input.wheelHeld() && !game.wheelOpen && pl.onFoot) {
    game.wheelOpen = true;
    game.wheelSelected = Math.max(0, ownedWeapons.indexOf(pl.weapon));
    game.hud.setWeaponWheel(true, game.wheelList(), game.wheelSelected);
  }
  if (game.wheelOpen) {
    if (!input.wheelHeld()) {
      const picked = ownedWeapons[game.wheelSelected];
      if (picked && picked !== pl.weapon) {
        pl.weapon = picked;
        game.hud.say(`Weapon: ${WEAPONS[pl.weapon].name}`);
        audio.blip();
      }
      game.wheelOpen = false;
      game.hud.setWeaponWheel(false);
    } else {
      const mp = input.mousePos();
      const dx = mp.x - window.innerWidth / 2;
      const dy = mp.y - window.innerHeight / 2;
      if (Math.hypot(dx, dy) > 40) {
        let angle = Math.atan2(dy, dx) + Math.PI / 2;
        if (angle < 0) angle += Math.PI * 2;
        const sector = Math.floor((angle / (Math.PI * 2)) * ownedWeapons.length) % ownedWeapons.length;
        if (sector !== game.wheelSelected) {
          game.wheelSelected = sector;
          game.hud.setWeaponWheel(true, game.wheelList(), game.wheelSelected);
        }
      }
      const digit = slot > 0 ? slot - 1 : -1;
      if (digit >= 0 && digit < ownedWeapons.length && digit !== game.wheelSelected) {
        game.wheelSelected = digit;
        game.hud.setWeaponWheel(true, game.wheelList(), game.wheelSelected);
      }
    }
  }
  if (actions & ACTION_ENTER) {
    if (pl.inCar) {
      exitCar();
    } else {
      // Near a shop? Open it. Else near a car? Enter it.
      if (game.nearShop) {
        game.screen = 'shop';
        game.hud.showMenu('shop');
        return;
      }
      if (Math.hypot(pl.x - GARAGE.x, pl.z - GARAGE.z) < 12) {
        game.screen = 'garage';
        game.hud.showMenu('garage');
        return;
      }
      const car = vehicles.nearestVehicle(pl.x, pl.z, 4.5, true);
      if (car) enterCar(car);
    }
  }
  if (actions & ACTION_PUNCH && pl.onFoot) {
    const hitList = combat.punch({ x: pl.x, z: pl.z }, pl.heading, peds.peds);
    if (hitList.length > 0) {
      audio.punch();
      for (const h of hitList) {
        if (h.dead) {
          game.progress.kills += 1;
          game.progress.money += 40;
          game.progress.respect += 5;
          police.addHeat(0.55);
        }
      }
    }
  }
  // Semi-auto weapons fire once per click; auto weapons (SMG) fire while
  // the mouse is held.
  const weaponDef = WEAPONS[pl.weapon];
  const shootHeld = weaponDef.auto && input.mouseHeld();
  if (((actions & ACTION_SHOOT) || shootHeld) && pl.onFoot && pl.weapon !== 'fists' && !game.wheelOpen) {
    shootWeapon();
  }
  if (pl.onFoot && pl.weapon === 'fists' && (actions & ACTION_SHOOT)) {
    const hitList = combat.punch({ x: pl.x, z: pl.z }, pl.heading, peds.peds);
    if (hitList.length > 0) audio.punch();
  }

  // --- Movement
  if (pl.inCar && pl.car) {
    const car = pl.car;
    const boost = game.upgrades.turbo && drive.run ? 10 : 0;
    const engineBoost = game.upgrades.engine * 4;
    const savedTop = car.model.topSpeed;
    car.model = { ...car.model, topSpeed: savedTop + engineBoost + boost };
    vehicles.drivePlayer(car, drive, dt, (intensity) => {
      audio.crash(intensity);
      police.addHeat(0.05);
      car.health -= intensity * 12;
      if (car.health <= 0) {
        game.hud.say('Your car is wrecked!');
        exitCar();
        vehicles.removeVehicle(car);
      }
    });
    car.model = { ...car.model, topSpeed: savedTop };
    pl.x = car.x;
    pl.z = car.z;
    pl.heading = car.heading;
    pl.speed = car.speed;
    audio.setEngine(Math.abs(car.speed) / 50, true);
  } else {
    const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const fx = Math.sin(pl.heading);
    const fz = Math.cos(pl.heading);
    let mx = fx * move.forward + fz * move.strafe;
    let mz = fz * move.forward - fx * move.strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      let diff = targetHeading - pl.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      pl.heading += Math.max(-8 * dt, Math.min(8 * dt, diff));
      const nx = pl.x + mx * speed * dt;
      const nz = pl.z + mz * speed * dt;
      const hit = world.collide(nx, nz, 0.6);
      pl.x = hit.x;
      pl.z = hit.z;
      pl.speed = speed;
      pl.mesh.userData.legL.rotation.x = Math.sin(game.time * 10) * 0.6;
      pl.mesh.userData.legR.rotation.x = -Math.sin(game.time * 10) * 0.6;
    } else {
      pl.speed = 0;
      pl.mesh.userData.legL.rotation.x = 0;
      pl.mesh.userData.legR.rotation.x = 0;
    }
    pl.mesh.position.set(pl.x, 0, pl.z);
    pl.mesh.rotation.y = pl.heading;
    audio.setEngine(0, false);
  }

  // --- World life
  vehicles.updateTraffic(dt, pl.x, pl.z);
  peds.update(dt, pl, null);
  for (const ped of peds.peds) {
    if (ped.hostile && ped.didPunch) {
      ped.didPunch = false;
      damagePlayer(8);
    }
  }
  // Traffic cars that hit the player on foot hurt.
  if (pl.onFoot) {
    for (const v of vehicles.vehicles) {
      if (!v.traffic) continue;
      if (Math.hypot(v.x - pl.x, v.z - pl.z) < 2.2 && Math.abs(v.speed) > 4) damagePlayer(20);
    }
  }
  combat.update(dt);
  pickups.update(dt, pl, (item) => {
    if (item.kind === 'health') {
      pl.health = Math.min(PLAYER.healthMax, pl.health + 30);
      game.hud.say('Health +30.');
    } else {
      const amount = item.kind === 'cash' ? 500 : 100;
      game.progress.money += amount;
      game.hud.say(`+$${amount}.`);
    }
    audio.pickup();
  });

  // --- Police
  const policeResult = police.update(dt, pl, game.time);
  const wanted = police.wanted;
  if (pl.inCar) {
    for (const u of police.units) {
      if (u.kind === 'car' && u.didRam) {
        u.didRam = false;
        if (pl.car) {
          pl.car.health -= 10;
          audio.crash(0.6);
          damagePlayer(4);
          if (pl.car.health <= 0) {
            const wreck = pl.car;
            exitCar();
            vehicles.removeVehicle(wreck);
            game.hud.say('Your car is wrecked!');
          }
        }
      }
    }
  } else if (wanted > 0) {
    // On foot, a slow cop car beside you for a while means BUSTED.
    const near = police.units.some((u) => u.kind === 'car' && Math.hypot(u.x - pl.x, u.z - pl.z) < 3);
    if (near) {
      pl.bustedTimer += dt;
      if (pl.bustedTimer > 1.5) {
        game.screen = 'busted';
        game.hud.showMenu('busted');
        announce('Busted.');
        return;
      }
    } else {
      pl.bustedTimer = 0;
    }
  }
  audio.setSiren(wanted > 0, wanted);
  if (wanted > 0) audio.sirenWail();

  // --- Missions
  if (!game.missions.active && game.missions.hasMore()) {
    game.missionAutoTimer -= dt;
    if (game.missionAutoTimer <= 0) {
      game.missionAutoTimer = 8;
      game.missions.startMission(game.missions.nextIndex);
    }
  }
  game.missions.update(dt, pl);

  // --- Shops & garage proximity
  game.nearShop = null;
  for (const shop of SHOPS) {
    if (Math.hypot(shop.x - pl.x, shop.z - pl.z) < 7) game.nearShop = shop;
  }
  const nearGarage = Math.hypot(pl.x - GARAGE.x, pl.z - GARAGE.z) < 12;

  // --- HUD
  game.hud.setWanted(wanted);
  game.hud.setMoney(game.progress.money);
  game.hud.setRespect(game.progress.respect);
  game.hud.setHealth(pl.health);
  game.hud.setSpeed(pl.inCar && pl.car ? Math.abs(pl.car.speed) * 2.2 : Math.abs(pl.speed) * 2.2);
  const weapon = WEAPONS[pl.weapon];
  game.hud.setWeapon(weapon.name, pl.weapon === 'fists' ? '' : `• ${game.progress.ammo[pl.weapon] ?? 0} ammo • ♥ ${Math.round(pl.health)}`);
  game.hud.setPolicePanel(police.units, wanted);
  game.hud.setCrosshair(pl.onFoot && pl.weapon !== 'fists');
  game.hud.drawMinimap();
  const hint = document.getElementById('objective-hint');
  if (hint) {
    hint.textContent = game.nearShop ? `Press E — enter ${game.nearShop.name}` : nearGarage && pl.onFoot ? 'Press E — Lena\'s Garage' : '';
  }
  const beacon = world.beacon;
  if (beacon.visible) beacon.position.y = 7;

  // --- Camera + render
  const speedRatio = pl.inCar && pl.car ? Math.min(1, Math.abs(pl.car.speed) / 50) : Math.min(1, Math.abs(pl.speed) / 15);
  renderer.follow(pl, dt, speedRatio, game.camYaw);
  renderer.update(dt, game.time, world);
  renderer.render();

  if (pl.invulnerable > 0) pl.invulnerable -= dt;
  if (pl.health < PLAYER.healthMax) pl.health = Math.min(PLAYER.healthMax, pl.health + dt * 1.5);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  let policePanelTimer = 0;

  game.hud.showMenu('title');
  game.hud.setMoney(game.progress.money);
  game.hud.setRespect(game.progress.respect);
  game.hud.setRadio(audio.station().name);
  announce('Solmar Bay. Press Enter to start.');

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (game.screen === 'title') {
      // Title backdrop: the city idles, traffic rolls, camera orbits the beach.
      game.time += STEP;
      vehicles.updateTraffic(STEP, game.player.x, game.player.z);
      peds.update(STEP, game.player, null);
      renderer.follow({ x: 0, z: 180, heading: Math.PI + Math.sin(game.time * 0.05) * 0.4, inCar: false }, STEP, 0);
      renderer.update(STEP, game.time, world);
      renderer.render();
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) game.menuAction('start');
      return;
    }
    if (game.screen === 'pause' || game.screen === 'map' || game.screen === 'garage' || game.screen === 'shop' || game.screen === 'settings') {
      const actions = input.takeActions();
      // Esc or M closes any menu back to the streets.
      if (actions & (ACTION_PAUSE | ACTION_MAP)) game.menuAction('resume');
      renderer.render();
      return;
    }
    if (game.screen === 'dead' || game.screen === 'busted') {
      renderer.render();
      return;
    }
    while (accumulator >= STEP) {
      stepGame(STEP, input);
      accumulator -= STEP;
      if (game.screen !== 'play') { accumulator = 0; break; }
    }
    policePanelTimer += 1;
    if (policePanelTimer > 30) policePanelTimer = 0;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.screen = 'pause';
      game.hud.showMenu('pause');
    }
  });

  canvas.addEventListener('click', () => audio.unlock());
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  requestAnimationFrame(frame);
}

function runShot(name) {
  stageShot(game, name, stepGame);
  let painted = 0;
  function paint() {
    renderer.render();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else runGame();

// Debug handle for playtesting (read-only state inspection from the console).
window.__game = game;
window.__errors = [];
window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
