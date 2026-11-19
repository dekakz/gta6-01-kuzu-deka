// Rendering: the three.js scene, sun, sky and the third-person camera.
// The camera trails behind the player (or the car), smoothed, with a
// speed-based field of view kick. No game rules live here.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyTop);
  scene.fog = new THREE.Fog(0xffd9a0, 180, 620);

  // Sun: warm directional light + soft ambient fill.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(180, 260, 120);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffe0b8, 0.75));
  const hemi = new THREE.HemisphereLight(PALETTE.skyTop, 0x7fae62, 0.5);
  scene.add(hemi);

  // Gradient sky dome (big inverted sphere, vertex colours).
  const skyGeo = new THREE.SphereGeometry(900, 16, 12);
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
  const positions = skyGeo.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const top = new THREE.Color(PALETTE.skyTop);
  const bottom = new THREE.Color(PALETTE.skyBottom);
  for (let i = 0; i < positions.count; i += 1) {
    const t = Math.max(0, Math.min(1, (positions.getY(i) + 900) / 1800));
    const c = bottom.clone().lerp(top, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Low sun disc on the horizon, due west over the sea.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false }),
  );
  sunDisc.position.set(-620, 90, 420);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);

  // Drifting clouds: flat white blobs far above the city.
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 3; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(9 + j * 4, 8, 6), cloudMat);
      puff.position.set(j * 10 - 10, j * 1.5, 0);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set((i % 7) * 160 - 480, 120 + (i % 3) * 18, Math.floor(i / 7) * 300 - 350);
    scene.add(cloud);
    clouds.push(cloud);
  }

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 12, -18);

  const camState = { x: 0, y: 14, z: -20, heading: 0 };

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // Third-person follow: behind and above the heading, lerped; the camera
  // looks a little ahead of the player so the road stays in frame.
  function follow(player, dt, speedRatio) {
    const dist = player.inCar ? 13 : 8.5;
    const height = player.inCar ? 5.2 : 4.2;
    const tx = player.x - Math.sin(player.heading) * dist;
    const tz = player.z - Math.cos(player.heading) * dist;
    const k = Math.min(1, dt * 5);
    camState.x += (tx - camState.x) * k;
    camState.z += (tz - camState.z) * k;
    camState.y += (height - camState.y) * Math.min(1, dt * 4);
    camera.position.set(camState.x, camState.y, camState.z);
    camera.lookAt(player.x + Math.sin(player.heading) * 6, 1.6, player.z + Math.cos(player.heading) * 6);
    const targetFov = 62 + speedRatio * 14;
    if (Math.abs(camera.fov - targetFov) > 0.2) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
      camera.updateProjectionMatrix();
    }
  }

  function update(dt, time, world) {
    for (const cloud of clouds) {
      cloud.position.x += dt * 1.2;
      if (cloud.position.x > 560) cloud.position.x = -560;
    }
    if (world && world.beacon.visible) {
      world.beacon.material.opacity = 0.35 + Math.sin(time * 3) * 0.15;
      world.beaconRing.scale.setScalar(1 + Math.sin(time * 3) * 0.12);
      world.beacon.rotation.y += dt;
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { scene, camera, follow, update, render, resize };
}
