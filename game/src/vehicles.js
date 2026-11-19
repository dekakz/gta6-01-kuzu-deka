// Vehicles: low-poly box-built cars, the player's arcade driving model,
// parked cars to steal, and traffic that follows the road grid.
import * as THREE from 'three';
import { CAR, PALETTE } from './config.js';

export const CAR_MODELS = [
  { id: 'comet', name: 'Comet GT', color: 0xe8b62a, topSpeed: 54, accel: 30, price: 12000 },
  { id: 'solano', name: 'Solano Cruiser', color: 0x2e6fd2, topSpeed: 44, accel: 24, price: 4000 },
  { id: 'bison', name: 'Bison Pickup', color: 0x3aa655, topSpeed: 42, accel: 22, price: 6000 },
  { id: 'vanta', name: 'Vanta Sedan', color: 0xe8e8e8, topSpeed: 46, accel: 25, price: 5500 },
  { id: 'dune', name: 'Dune Buggy', color: 0xd23c2e, topSpeed: 40, accel: 26, price: 7000 },
  { id: 'armored', name: 'Armored Van', color: 0x44484e, topSpeed: 38, accel: 18, price: 25000 },
];

export function buildCarMesh(model, colorOverride) {
  const color = colorOverride ?? model.color;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), darkMat);
  cabin.position.set(0, 1.05, -0.2);
  group.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 0.7), bodyMat);
  nose.position.set(0, 0.42, 2.4);
  group.add(nose);
  // Headlights and taillights.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const side of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    head.position.set(side, 0.55, 2.78);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tail.position.set(side, 0.55, -2.24);
    group.add(tail);
  }
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  return group;
}

export function createVehicleManager(scene, world, random) {
  const vehicles = [];
  const parked = [];

  function addVehicle(model, x, z, heading, opts = {}) {
    const mesh = buildCarMesh(model, opts.color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const vehicle = {
      id: vehicles.length,
      model,
      mesh,
      x, z, heading,
      speed: 0,
      traffic: !!opts.traffic,
      parked: !!opts.parked,
      stolen: false,
      police: !!opts.police,
      route: null,
      routeIndex: 0,
      targetSpeed: opts.traffic ? random.range(9, 15) : 0,
      health: 100,
      name: model.name,
    };
    if (opts.traffic) {
      vehicle.route = makeRoute(x, z);
      vehicle.routeIndex = 0;
    }
    vehicles.push(vehicle);
    if (opts.parked) parked.push(vehicle);
    return vehicle;
  }

  // A traffic route is a loop of road-grid corners.
  function makeRoute(x, z) {
    const points = [];
    let cx = x;
    let cz = z;
    for (let i = 0; i < 6; i += 1) {
      const horizontal = random.chance(0.5);
      if (horizontal) cx = random.range(-250, 250);
      else cz = random.range(-250, 250);
      // Snap to the nearest road.
      cx = Math.round(cx / 64) * 64 + (random.chance(0.5) ? 3.5 : -3.5);
      cz = Math.round(cz / 64) * 64 + (random.chance(0.5) ? 3.5 : -3.5);
      points.push({ x: cx, z: cz });
    }
    return points;
  }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i += 1) {
      const p = world.randomRoadPoint();
      const model = random.pick(CAR_MODELS.filter((m) => m.id !== 'armored'));
      addVehicle(model, p.x, p.z, random.range(0, Math.PI * 2), { traffic: true, color: random.pick(PALETTE.car) });
    }
  }

  function spawnParked(count) {
    for (let i = 0; i < count; i += 1) {
      const p = world.randomRoadPoint();
      const model = random.pick(CAR_MODELS.filter((m) => m.id !== 'armored'));
      addVehicle(model, p.x, p.z, random.range(0, Math.PI * 2), { parked: true, color: random.pick(PALETTE.car) });
    }
    // The mission Comet GT, always at the Marina Hotel valet lane.
    addVehicle(CAR_MODELS[0], 168, -150, Math.PI / 2, { parked: true, color: 0xe8b62a });
    // The armored van for the Big Score, on Casino Row.
    addVehicle(CAR_MODELS[5], 160, 110, 0, { parked: true, color: 0x44484e });
  }

  // Police cars are skipped here on purpose: E can steal parked and
  // traffic cars, but never a pursuing unit's car.
  function nearestVehicle(x, z, maxDist, includeTraffic) {
    let best = null;
    let bestDist = maxDist;
    for (const v of vehicles) {
      if (v.police) continue;
      if (!includeTraffic && v.traffic) continue;
      const dx = v.x - x;
      const dz = v.z - z;
      const d = Math.hypot(dx, dz);
      if (d < bestDist) { bestDist = d; best = v; }
    }
    return best;
  }

  // Arcade driving: throttle accelerates, steering scales with speed,
  // buildings push the car out, other cars bump it.
  function drivePlayer(vehicle, input, dt, onCrash) {
    const model = vehicle.model;
    const top = model.topSpeed || CAR.maxSpeed;
    const accel = model.accel || CAR.accel;
    if (input.throttle > 0) vehicle.speed += accel * dt;
    else if (input.throttle < 0) {
      if (vehicle.speed > 0.5) vehicle.speed -= CAR.brake * dt;
      else vehicle.speed -= CAR.reverseAccel * dt;
    } else {
      vehicle.speed -= Math.sign(vehicle.speed) * Math.min(Math.abs(vehicle.speed), 8 * dt);
    }
    if (input.brake) vehicle.speed -= Math.sign(vehicle.speed) * Math.min(Math.abs(vehicle.speed), CAR.brake * dt);
    vehicle.speed = Math.max(-CAR.maxReverse, Math.min(top, vehicle.speed));
    const steerAmount = input.steer * CAR.steer * Math.min(1, Math.abs(vehicle.speed) / 12) * Math.sign(vehicle.speed || 1);
    vehicle.heading -= steerAmount * dt;
    const nx = vehicle.x + Math.sin(vehicle.heading) * vehicle.speed * dt;
    const nz = vehicle.z + Math.cos(vehicle.heading) * vehicle.speed * dt;
    const hit = world.collide(nx, nz, 1.8);
    const crashed = Math.hypot(hit.x - nx, hit.z - nz) > 0.05;
    if (crashed && Math.abs(vehicle.speed) > 8) {
      vehicle.speed *= -0.25;
      if (onCrash) onCrash(Math.abs(vehicle.speed) / top);
    }
    vehicle.x = hit.x;
    vehicle.z = hit.z;
    // Bump off other vehicles.
    for (const other of vehicles) {
      if (other === vehicle) continue;
      const dx = vehicle.x - other.x;
      const dz = vehicle.z - other.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.6 && d > 0.01) {
        const push = (3.6 - d) / 2;
        vehicle.x += (dx / d) * push;
        vehicle.z += (dz / d) * push;
        if (!other.traffic && Math.abs(vehicle.speed) > 6 && onCrash) onCrash(0.3);
        if (other.traffic) {
          other.x -= (dx / d) * push;
          other.z -= (dz / d) * push;
        }
      }
    }
    vehicle.mesh.position.set(vehicle.x, 0, vehicle.z);
    vehicle.mesh.rotation.y = vehicle.heading;
    const spin = vehicle.speed * dt * 2;
    for (const wheel of vehicle.mesh.userData.wheels) wheel.rotation.x += spin;
  }

  function updateTraffic(dt, playerX, playerZ) {
    for (const v of vehicles) {
      if (!v.traffic) continue;
      const target = v.route[v.routeIndex];
      const dx = target.x - v.x;
      const dz = target.z - v.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        v.routeIndex = (v.routeIndex + 1) % v.route.length;
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      v.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      v.speed += (v.targetSpeed - v.speed) * Math.min(1, dt * 1.5);
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
      const hit = world.collide(v.x, v.z, 1.8);
      v.x = hit.x;
      v.z = hit.z;
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = v.heading;
      for (const wheel of v.mesh.userData.wheels) wheel.rotation.x += v.speed * dt * 2;
      // Far traffic respawns near the player so the streets stay busy.
      if (Math.hypot(v.x - playerX, v.z - playerZ) > 420) {
        const p = world.randomRoadPoint();
        v.x = p.x; v.z = p.z;
        v.route = makeRoute(p.x, p.z);
        v.routeIndex = 0;
      }
    }
  }

  function removeVehicle(vehicle) {
    scene.remove(vehicle.mesh);
    const i = vehicles.indexOf(vehicle);
    if (i >= 0) vehicles.splice(i, 1);
    const j = parked.indexOf(vehicle);
    if (j >= 0) parked.splice(j, 1);
  }

  return {
    vehicles, parked, addVehicle, spawnTraffic, spawnParked,
    nearestVehicle, drivePlayer, updateTraffic, removeVehicle,
  };
}
