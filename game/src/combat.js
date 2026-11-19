// Combat: fists and firearms for the player, enemy health, tracers and
// hit feedback. Shooting is a hitscan ray from the camera through the
// crosshair; punches are a short-range arc in front of the player.
import * as THREE from 'three';
import { WEAPONS } from './config.js';

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

export function createCombat(scene) {
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  let cooldown = 0;
  let muzzleFlash = 0;

  function fireTracer(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const tracer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), tracerMat);
    tracer.position.copy(from).addScaledVector(dir, 0.5);
    tracer.lookAt(to);
    scene.add(tracer);
    tracers.push({ mesh: tracer, life: 0.08 });
  }

  // Shoot from `origin` along `direction`. Returns the thing hit, if any.
  // The caller picks the origin height: main.js fires from torso height
  // (y 1.05), because a horizontal ray at head height threads the gap
  // between a ped's torso top and head and can never hit anything.
  function shoot(origin, direction, weaponKey, targets, policeUnits) {
    const weapon = WEAPONS[weaponKey];
    if (cooldown > 0 || !weapon) return null;
    cooldown = weapon.rate;
    muzzleFlash = 0.06;
    const ray = new THREE.Raycaster(origin, direction, 0.1, weapon.range);
    const meshes = [];
    for (const t of targets) {
      if (t.dead) continue;
      meshes.push({ mesh: t.mesh, ref: t, kind: 'ped' });
    }
    for (const u of policeUnits) {
      if (u.kind !== 'car' || u.health <= 0) continue;
      meshes.push({ mesh: u.mesh, ref: u, kind: 'police' });
    }
    const hits = ray.intersectObjects(meshes.map((m) => m.mesh), true);
    let end = new THREE.Vector3().copy(origin).addScaledVector(direction, weapon.range);
    let hitRef = null;
    if (hits.length > 0) {
      end = hits[0].point;
      let obj = hits[0].object;
      while (obj && !meshes.some((m) => m.mesh === obj)) obj = obj.parent;
      const entry = meshes.find((m) => m.mesh === obj);
      if (entry) {
        hitRef = entry;
        entry.ref.health -= weapon.damage;
        if (entry.kind === 'ped' && entry.ref.health <= 0) entry.ref.dead = true;
      }
    }
    fireTracer(origin, end);
    return { hit: hitRef, point: end };
  }

  // Punch: everything hostile within range and in front takes damage.
  function punch(playerPos, heading, targets) {
    if (cooldown > 0) return [];
    cooldown = WEAPONS.fists.rate;
    const hitList = [];
    for (const t of targets) {
      if (t.dead) continue;
      const dx = t.x - playerPos.x;
      const dz = t.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > WEAPONS.fists.range) continue;
      const angle = Math.atan2(dx, dz);
      let diff = Math.abs(angle - heading);
      while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
      if (diff > 1.1) continue;
      t.health -= WEAPONS.fists.damage;
      if (t.health <= 0) t.dead = true;
      hitList.push(t);
    }
    return hitList;
  }

  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);
    muzzleFlash = Math.max(0, muzzleFlash - dt);
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) {
        scene.remove(tracers[i].mesh);
        tracers.splice(i, 1);
      }
    }
  }

  return {
    shoot, punch, update,
    get ready() { return cooldown <= 0; },
    get flash() { return muzzleFlash > 0; },
    weaponName(key) { return WEAPONS[key]?.name ?? key; },
    order: WEAPON_ORDER,
  };
}
