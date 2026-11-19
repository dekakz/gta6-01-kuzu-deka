// Pedestrians: low-poly walkers who stroll the sidewalks, cross roads,
// flee from gunfire and panic when a car barrels at them.
import * as THREE from 'three';

const SHIRTS = [0xe85d75, 0x4a90d9, 0x50b27a, 0xf2a541, 0x9b59b6, 0xe8e8e8, 0x333333, 0xff8c42];

export function buildPersonMesh(random, shirtColor) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: random.pick([0xf2c9a0, 0xd9a066, 0x8a5a3b, 0xf7d7b5]) });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor ?? random.pick(SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: random.pick([0x2a3a4a, 0x444444, 0x6b4a2f, 0x1f4d2e]) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), shirt);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.72;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), new THREE.MeshLambertMaterial({ color: random.pick([0x1a1a1a, 0x5a3a1a, 0xd9d9d9, 0x8a2a1a]) }));
  hair.position.y = 1.96;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.24), pants);
  legL.position.set(-0.16, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.24), pants);
  legR.position.set(0.16, 0.33, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), shirt);
  armL.position.set(-0.4, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), shirt);
  armR.position.set(0.4, 1.05, 0);
  group.add(armR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armL = armL;
  group.userData.armR = armR;
  return group;
}

export function createPedestrianManager(scene, world, random) {
  const peds = [];

  function spawn(x, z) {
    const mesh = buildPersonMesh(random);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const ped = {
      mesh, x, z,
      heading: random.range(0, Math.PI * 2),
      speed: random.range(1.2, 2.4),
      panic: 0,
      walkPhase: random.range(0, Math.PI * 2),
      target: null,
      health: 30,
      hostile: false,
    };
    peds.push(ped);
    return ped;
  }

  function spawnCrowd(count) {
    for (let i = 0; i < count; i += 1) {
      const p = world.randomSidewalkPoint();
      spawn(p.x, p.z);
    }
  }

  // Hostile thugs / guards for fight stages: they chase and punch the player.
  function spawnHostile(x, z, count, opts = {}) {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const mesh = buildPersonMesh(random, opts.shirtColor ?? 0x1a1a1a);
      mesh.position.set(x + random.range(-6, 6), 0, z + random.range(-6, 6));
      scene.add(mesh);
      const ped = {
        mesh, x: mesh.position.x, z: mesh.position.z,
        heading: 0, speed: random.range(3.2, 4.2), panic: 0,
        walkPhase: 0, target: null, health: opts.health ?? 45, hostile: true,
        punchCooldown: 0, armed: !!opts.armed,
      };
      peds.push(ped);
      out.push(ped);
    }
    return out;
  }

  function update(dt, player, gunfireAt) {
    for (const ped of peds) {
      const dxp = ped.x - player.x;
      const dzp = ped.z - player.z;
      const distPlayer = Math.hypot(dxp, dzp);
      if (gunfireAt && Math.hypot(ped.x - gunfireAt.x, ped.z - gunfireAt.z) < 30) ped.panic = 3;
      if (ped.hostile) {
        // Chase the player and punch when close.
        ped.heading = Math.atan2(-dxp, -dzp);
        const step = Math.min(distPlayer, ped.speed * dt);
        ped.x += Math.sin(ped.heading) * step;
        ped.z += Math.cos(ped.heading) * step;
        ped.punchCooldown -= dt;
        if (distPlayer < 1.6 && ped.punchCooldown <= 0) {
          ped.punchCooldown = 0.9;
          ped.didPunch = true;
        }
        if (ped.health <= 0) {
          ped.dead = true;
        }
      } else if (ped.panic > 0 || distPlayer < 6) {
        ped.panic = Math.max(0.5, ped.panic - dt);
        ped.heading = Math.atan2(dxp, dzp);
        const step = 5.5 * dt;
        ped.x += Math.sin(ped.heading) * step;
        ped.z += Math.cos(ped.heading) * step;
      } else {
        // Wander: pick a new sidewalk target when the old one is reached.
        if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.z - ped.z) < 2) {
          ped.target = world.randomSidewalkPoint();
        }
        const dx = ped.target.x - ped.x;
        const dz = ped.target.z - ped.z;
        const want = Math.atan2(dx, dz);
        let diff = want - ped.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ped.heading += Math.max(-2 * dt, Math.min(2 * dt, diff));
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
      }
      const hit = world.collide(ped.x, ped.z, 0.5);
      ped.x = hit.x;
      ped.z = hit.z;
      ped.walkPhase += dt * (ped.hostile ? 9 : 6) * (ped.panic > 0 ? 1.8 : 1);
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.userData.armL.rotation.x = -swing * 0.8;
      ped.mesh.userData.armR.rotation.x = swing * 0.8;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
    // Remove the dead (fall over first: tip the mesh, then drop it).
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      if (peds[i].dead) {
        scene.remove(peds[i].mesh);
        peds.splice(i, 1);
      }
    }
    // Keep the streets populated near the player.
    if (peds.filter((p) => !p.hostile).length < 24) {
      const p = world.randomSidewalkPoint();
      if (Math.hypot(p.x - player.x, p.z - player.z) < 120) spawn(p.x, p.z);
    }
  }

  return { peds, spawn, spawnCrowd, spawnHostile, update };
}
