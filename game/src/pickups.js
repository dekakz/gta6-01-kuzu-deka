// Pickups scattered around Solmar Bay: cash bags for missions, health
// packs on the street, and money dropped by beaten enemies.
import * as THREE from 'three';

export function createPickups(scene, random) {
  const items = [];

  function spawnPickup(x, z, kind) {
    const color = kind === 'cash' ? 0x2fae4e : kind === 'health' ? 0xff5544 : 0xffd23c;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.7, 1.1),
      new THREE.MeshLambertMaterial({ color }),
    );
    mesh.position.set(x, 0.5, z);
    scene.add(mesh);
    const item = { mesh, x, z, kind, taken: false, bob: random.range(0, Math.PI * 2) };
    items.push(item);
    return item;
  }

  function spawnStreetPickups() {
    for (let i = 0; i < 10; i += 1) {
      const x = random.range(-260, 260);
      const z = random.range(-260, 260);
      spawnPickup(x, z, random.chance(0.5) ? 'health' : 'money');
    }
  }

  function update(dt, player, onTake) {
    for (const item of items) {
      if (item.taken) continue;
      item.bob += dt * 2;
      item.mesh.position.y = 0.5 + Math.sin(item.bob) * 0.15;
      item.mesh.rotation.y += dt;
      const d = Math.hypot(item.x - player.x, item.z - player.z);
      if (d < 2.2) {
        item.taken = true;
        scene.remove(item.mesh);
        if (onTake) onTake(item);
      }
    }
  }

  return { items, spawnPickup, spawnStreetPickups, update };
}
