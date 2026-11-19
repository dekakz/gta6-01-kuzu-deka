// Solmar Bay itself: the ground, roads, buildings, beach, sea, palms and
// landmarks, built from boxes and cylinders with a warm coastal palette.
// Also owns the collision boxes, so driving and walking can ask "is this
// spot inside a building?" without knowing anything about the meshes.
import * as THREE from 'three';
import { CITY, PALETTE, SHOPS, GARAGE } from './config.js';

const ROAD_COORDS = [];
for (let c = -256; c <= 256; c += CITY.roadSpacing) ROAD_COORDS.push(c);

export function isOnRoad(x, z) {
  for (const c of ROAD_COORDS) {
    if (Math.abs(x - c) < CITY.roadWidth / 2 + 1.5) return true;
    if (Math.abs(z - c) < CITY.roadWidth / 2 + 1.5) return true;
  }
  return false;
}

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildWorld(scene, random) {
  const colliders = [];
  const buildings = [];
  const palms = [];
  const landmarks = {};
  const group = new THREE.Group();
  group.name = 'solmar-bay';
  scene.add(group);

  // Ground: grass-green city slab, then the sand strip and the sea plane.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.halfSize * 2 + 400, CITY.halfSize * 2 + 400),
    new THREE.MeshLambertMaterial({ color: 0x7fae62 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.halfSize * 2 + 400, 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0, CITY.beachStart + 18);
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.halfSize * 2 + 600, 400),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, CITY.seaLevel, CITY.beachStart + 220);
  group.add(sea);

  // Asphalt: one long strip per road, plus a centre dashed line.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const lineMat = new THREE.MeshLambertMaterial({ color: 0xf5e9c8 });
  for (const c of ROAD_COORDS) {
    for (const horizontal of [true, false]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(CITY.halfSize * 2, CITY.roadWidth), roadMat);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = horizontal ? Math.PI / 2 : 0;
      strip.position.set(horizontal ? c : 0, 0.02, horizontal ? 0 : c);
      group.add(strip);
      for (let t = -CITY.halfSize; t < CITY.halfSize; t += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = horizontal ? Math.PI / 2 : 0;
        dash.position.set(horizontal ? c : t, 0.04, horizontal ? t : c);
        group.add(dash);
      }
    }
  }

  // Sidewalk slabs around each block.
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (let bx = -256; bx < 256; bx += CITY.roadSpacing) {
    for (let bz = -256; bz < 256; bz += CITY.roadSpacing) {
      if (bz + CITY.roadSpacing > CITY.beachStart - 10) continue;
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(CITY.blockSize + 8, CITY.blockSize + 8), walkMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(bx + CITY.roadSpacing / 2, 0.01, bz + CITY.roadSpacing / 2);
      group.add(slab);
    }
  }

  // Buildings: 1-3 per block, pastel stucco towers with lit windows.
  function addBuilding(cx, cz, w, d, h, color, label) {
    const mesh = box(w, h, d, color, cx, h / 2, cz);
    group.add(mesh);
    // Roof rim and a window grid on the street-facing sides.
    const rim = box(w + 0.6, 0.8, d + 0.6, 0xffffff, cx, h + 0.4, cz);
    group.add(rim);
    const floors = Math.max(1, Math.floor(h / 7));
    for (let f = 0; f < floors; f += 1) {
      for (let i = 0; i < Math.floor(w / 6); i += 1) {
        const win = box(2.2, 2.6, 0.2, random.chance(0.4) ? 0xffe9a8 : 0x2a3a4a, cx - w / 2 + 4 + i * 6, 4 + f * 7, cz + d / 2 + 0.1);
        group.add(win);
      }
    }
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    const building = { x: cx, z: cz, w, d, h, mesh, label: label || '' };
    buildings.push(building);
    return building;
  }

  for (let bx = -256; bx < 256; bx += CITY.roadSpacing) {
    for (let bz = -256; bz < 256; bz += CITY.roadSpacing) {
      if (bz + CITY.roadSpacing > CITY.beachStart - 10) continue;
      const cx = bx + CITY.roadSpacing / 2;
      const cz = bz + CITY.roadSpacing / 2;
      const kind = random.next();
      if (kind < 0.3) {
        // Park block: trees and benches instead of a tower.
        for (let i = 0; i < 4; i += 1) addPalm(cx + random.range(-16, 16), cz + random.range(-16, 16));
        continue;
      }
      const h = random.range(10, kind < 0.75 ? 30 : 52);
      const color = random.pick(PALETTE.building);
      addBuilding(cx + random.range(-6, 6), cz + random.range(-6, 6), random.range(20, 34), random.range(20, 34), h, color);
    }
  }

  // Landmarks with signs so the city reads at a glance.
  function addSign(text, x, y, z, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const c2d = canvas.getContext('2d');
    c2d.fillStyle = color;
    c2d.fillRect(0, 0, 512, 128);
    c2d.fillStyle = '#ffffff';
    c2d.font = 'bold 56px Arial, sans-serif';
    c2d.textAlign = 'center';
    c2d.textBaseline = 'middle';
    c2d.fillText(text, 256, 66);
    const texture = new THREE.CanvasTexture(canvas);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 4.5),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    sign.position.set(x, y, z);
    group.add(sign);
    return sign;
  }

  // Solmar Grand casino (tall gold tower on Casino Row).
  const casino = addBuilding(160, 96, 36, 30, 58, 0xd9a441, 'Solmar Grand');
  addSign('SOLMAR GRAND', 160, 62, 96 + 15.5, '#7a2ea8');
  landmarks.casino = casino;
  // Bank of Solmar.
  const bank = addBuilding(32, -96, 30, 26, 22, 0xe8e4da, 'Bank of Solmar');
  addSign('BANK OF SOLMAR', 32, 25, -96 + 13.5, '#1f4d2e');
  landmarks.bank = bank;
  // Marina Hotel.
  const hotel = addBuilding(160, -160, 32, 28, 46, 0x7fb8d9, 'Marina Hotel');
  addSign('MARINA HOTEL', 160, 50, -160 + 14.5, '#0e5f8a');
  landmarks.hotel = hotel;
  // Lena's garage: low workshop with a big door.
  const garage = addBuilding(GARAGE.x, GARAGE.z, 34, 24, 9, 0xc25b4a, "Lena's Garage");
  addSign("LENA'S GARAGE", GARAGE.x, 12, GARAGE.z + 12.5, '#c25b4a');
  landmarks.garage = garage;
  // Pier at the south beach.
  const pier = box(10, 1.2, 60, 0x8a6b4a, 224, 0.6, 300);
  group.add(pier);
  landmarks.pier = { x: 224, z: 300 };
  // West docks.
  const docks = box(60, 1.2, 12, 0x8a6b4a, -224, 0.6, 296);
  group.add(docks);
  landmarks.docks = { x: -224, z: 296 };

  // Palm trees along the beach and the avenues.
  function addPalm(x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6b4a }),
    );
    trunk.position.set(x, 3.5, z);
    group.add(trunk);
    const fronds = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 3.4, 7),
      new THREE.MeshLambertMaterial({ color: 0x2f8f4e }),
    );
    fronds.position.set(x, 8.2, z);
    group.add(fronds);
    palms.push({ x, z });
  }
  for (let x = -300; x <= 300; x += 24) addPalm(x + random.range(-4, 4), CITY.beachStart + 6 + random.range(0, 8));
  for (const c of [-192, 0, 192]) {
    for (let t = -240; t <= 240; t += 48) addPalm(c + 10, t);
  }

  // Streetlights along the avenues.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x44484e });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const c of ROAD_COORDS) {
    for (let t = -256; t <= 256; t += 64) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8, 6), lampMat);
      pole.position.set(c + 8, 4, t);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
      bulb.position.set(c + 8, 8.2, t);
      group.add(bulb);
    }
  }

  // Shops get a marker pole so the player can find them.
  for (const shop of SHOPS) {
    const pole = box(1, 10, 1, 0xffffff, shop.x, 5, shop.z);
    group.add(pole);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshBasicMaterial({ color: shop.kind === 'weapons' ? 0xff5544 : shop.kind === 'food' ? 0xffaa22 : 0x44ccff }));
    ball.position.set(shop.x, 11, shop.z);
    group.add(ball);
  }

  // Mission waypoint beacon: a glowing cylinder the game moves around.
  // It is built once here and repositioned per stage by missions.js
  // (moveBeacon) — never rebuilt, so the beacon never flickers between stages.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 14, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.visible = false;
  group.add(beacon);
  const beaconRing = new THREE.Mesh(
    new THREE.TorusGeometry(4, 0.35, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23c }),
  );
  beaconRing.rotation.x = Math.PI / 2;
  beaconRing.visible = false;
  group.add(beaconRing);

  // Collision: circle vs building boxes, clamped to the city edge.
  function collide(x, z, radius) {
    let nx = Math.max(-CITY.halfSize + 4, Math.min(CITY.halfSize - 4, x));
    let nz = Math.max(-CITY.halfSize + 4, Math.min(CITY.halfSize - 4, z));
    for (const b of colliders) {
      const cx = Math.max(b.minX, Math.min(nx, b.maxX));
      const cz = Math.max(b.minZ, Math.min(nz, b.maxZ));
      const dx = nx - cx;
      const dz = nz - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq) || 0.001;
        const push = radius - dist;
        nx += (dx / dist) * push;
        nz += (dz / dist) * push;
      }
    }
    return { x: nx, z: nz };
  }

  function randomRoadPoint() {
    const horizontal = random.chance(0.5);
    const road = random.pick(ROAD_COORDS);
    const along = random.range(-250, 250);
    return horizontal ? { x: along, z: road } : { x: road, z: along };
  }

  function randomSidewalkPoint() {
    const p = randomRoadPoint();
    return { x: p.x + random.range(-9, 9), z: p.z + random.range(-9, 9) };
  }

  return {
    group, colliders, buildings, palms, landmarks, beacon, beaconRing,
    collide, randomRoadPoint, randomSidewalkPoint,
  };
}
