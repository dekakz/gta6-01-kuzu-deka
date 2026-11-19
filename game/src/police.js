// The Solmar Police Department: wanted heat, named dispatch units with
// roles (Pursuit, Ramming, Spotlight, Roadblock, Firing), a helicopter
// from 3 stars, roadblocks from 4 stars, and busted/wasted outcomes.
// Units announce themselves in the police panel the HUD draws.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { buildCarMesh } from './vehicles.js';

export const UNIT_ROLES = ['Pursuit', 'Ramming', 'Spotlight', 'Roadblock', 'Firing'];
const UNIT_NAMES = ['Unit 7', 'Unit 12', 'Unit 23', 'Unit 31', 'Unit 44', 'Unit 58', 'Unit 66', 'Unit 71'];

export function createPolice(scene, world, random) {
  const units = [];
  let heli = null;
  let heat = 0;
  let wanted = 0;
  let lastSeen = 0;
  let decayTimer = 0;
  let spawnTimer = 0;
  let roadblocks = [];

  function policeCarMesh() {
    const model = { id: 'police', name: 'Interceptor', color: 0x111111, topSpeed: 50, accel: 28 };
    const mesh = buildCarMesh(model, 0x111111);
    // White doors + light bar.
    const doorMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.4, 1.6), doorMat);
    door.position.set(0, 0.62, -0.1);
    mesh.add(door);
    const barMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), barMat);
    bar.position.set(0, 1.45, -0.2);
    mesh.add(bar);
    mesh.userData.lightBar = bar;
    return mesh;
  }

  function spawnUnit(role, x, z) {
    const mesh = policeCarMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const unit = {
      kind: 'car',
      role,
      name: random.pick(UNIT_NAMES),
      mesh, x, z,
      heading: random.range(0, Math.PI * 2),
      speed: 0,
      topSpeed: 46 + wanted * 2,
      health: 60,
      ramCooldown: 0,
    };
    units.push(unit);
    return unit;
  }

  function spawnHeli() {
    if (heli) return;
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.4, 5),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }),
    );
    group.add(body);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    rotor.position.y = 1.1;
    group.add(rotor);
    const light = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    light.position.y = -7;
    group.add(light);
    group.userData.rotor = rotor;
    group.userData.spot = light;
    scene.add(group);
    heli = { kind: 'heli', role: 'Spotlight', name: 'Air-1', mesh: group, x: 0, z: 0, y: 42, heading: 0, speed: 0 };
    units.push(heli);
  }

  function removeHeli() {
    if (!heli) return;
    scene.remove(heli.mesh);
    const i = units.indexOf(heli);
    if (i >= 0) units.splice(i, 1);
    heli = null;
  }

  function spawnRoadblock(x, z) {
    const group = new THREE.Group();
    for (const off of [-4, 0, 4]) {
      const car = policeCarMesh();
      car.position.set(x + off, 0, z);
      car.rotation.y = Math.PI / 2;
      group.add(car);
    }
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(12, 1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xff8800 }),
    );
    barrier.position.set(x, 0.6, z + 3);
    group.add(barrier);
    scene.add(group);
    const block = { kind: 'roadblock', role: 'Roadblock', name: 'Roadblock', mesh: group, x, z, heading: 0, speed: 0 };
    roadblocks.push(block);
    units.push(block);
    return block;
  }

  function clearRoadblocks() {
    for (const b of roadblocks) {
      scene.remove(b.mesh);
      const i = units.indexOf(b);
      if (i >= 0) units.splice(i, 1);
    }
    roadblocks = [];
  }

  function addHeat(amount) {
    heat = Math.min(WANTED.max, heat + amount);
    const level = Math.floor(heat + 0.001);
    if (level > wanted) {
      wanted = level;
      return true; // wanted level rose
    }
    return false;
  }

  function setWanted(level) {
    wanted = Math.max(0, Math.min(WANTED.max, level));
    heat = wanted;
  }

  function update(dt, player, time) {
    // Wanted decays only while no unit can see the player.
    const anyNear = units.some((u) => Math.hypot(u.x - player.x, u.z - player.z) < 55);
    if (wanted > 0) {
      if (anyNear) {
        lastSeen = time;
        decayTimer = 0;
      } else {
        decayTimer += dt;
        if (decayTimer > WANTED.decaySeconds) {
          decayTimer = 0;
          wanted = Math.max(0, wanted - 1);
          heat = wanted;
        }
      }
    }

    // Spawn / despawn units to match the wanted level.
    spawnTimer -= dt;
    const wantCars = WANTED.copsPerLevel[wanted] || 0;
    const cars = units.filter((u) => u.kind === 'car').length;
    if (spawnTimer <= 0) {
      spawnTimer = 1.2;
      if (cars < wantCars) {
        const angle = random.range(0, Math.PI * 2);
        const role = UNIT_ROLES[Math.min(UNIT_ROLES.length - 1, cars)];
        spawnUnit(role, player.x + Math.sin(angle) * 55, player.z + Math.cos(angle) * 55);
      } else if (cars > wantCars) {
        const far = units.filter((u) => u.kind === 'car').sort((a, b) => Math.hypot(b.x - player.x, b.z - player.z) - Math.hypot(a.x - player.x, a.z - player.z))[0];
        if (far) {
          scene.remove(far.mesh);
          units.splice(units.indexOf(far), 1);
        }
      }
      if (wanted >= WANTED.heliFromLevel) spawnHeli();
      else removeHeli();
      if (wanted >= WANTED.roadblockFromLevel && roadblocks.length === 0) {
        spawnRoadblock(player.x + 40, player.z);
      } else if (wanted < WANTED.roadblockFromLevel) {
        clearRoadblocks();
      }
    }

    // Chase behaviour per role.
    for (const u of units) {
      if (u.kind === 'heli') {
        const dx = player.x - u.x;
        const dz = player.z - u.z;
        const d = Math.hypot(dx, dz);
        u.heading = Math.atan2(dx, dz);
        const speed = 16;
        if (d > 12) {
          u.x += Math.sin(u.heading) * speed * dt;
          u.z += Math.cos(u.heading) * speed * dt;
        }
        u.y = 30 + Math.sin(time * 0.8) * 1.5;
        u.mesh.position.set(u.x, u.y, u.z);
        u.mesh.rotation.y = u.heading;
        u.mesh.userData.rotor.rotation.y += dt * 22;
        u.mesh.userData.spot.lookAt(player.x, 0, player.z);
        u.mesh.userData.spot.rotateX(-Math.PI / 2);
        continue;
      }
      if (u.kind === 'roadblock') continue;
      const dx = player.x - u.x;
      const dz = player.z - u.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - u.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = u.role === 'Ramming' ? 2.6 : 1.9;
      u.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
      let targetSpeed = u.topSpeed;
      if (u.role === 'Ramming' && d < 25) targetSpeed = u.topSpeed + 6;
      if (u.role === 'Spotlight') targetSpeed = u.topSpeed * 0.8;
      if (d < 4 && u.role === 'Ramming') {
        u.ramCooldown -= dt;
        if (u.ramCooldown <= 0) {
          u.ramCooldown = 1.2;
          u.didRam = true;
        }
      }
      u.speed += (targetSpeed - u.speed) * Math.min(1, dt * 1.2);
      u.x += Math.sin(u.heading) * u.speed * dt;
      u.z += Math.cos(u.heading) * u.speed * dt;
      const hit = world.collide(u.x, u.z, 1.8);
      u.x = hit.x;
      u.z = hit.z;
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = u.heading;
      // Flashing light bar.
      const bar = u.mesh.userData.lightBar;
      if (bar) bar.material.color.setHex(Math.floor(time * 4) % 2 === 0 ? 0xff2222 : 0x2244ff);
    }
    return { wanted, lastSeen };
  }

  function clearAll() {
    for (const u of units) scene.remove(u.mesh);
    units.length = 0;
    roadblocks = [];
    heli = null;
    heat = 0;
    wanted = 0;
  }

  return {
    units,
    get wanted() { return wanted; },
    get heat() { return heat; },
    get heli() { return heli; },
    addHeat, setWanted, update, clearAll,
  };
}
