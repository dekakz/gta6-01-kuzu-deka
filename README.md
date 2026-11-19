[![make.fun — Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/dekakz/gta6-01-kuzu-deka/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/dekakz/gta6-01-kuzu-deka/reward.svg)](https://make.fun/c/gta6-01)

# Solmar Bay — An Open-World Crime Story

An original open-world crime game for make.fun's **Make GTA 6** bounty
(`gta6-01`), built as a static browser game: no build step, no network,
three.js vendored under `game/vendor/`.

Dario Vega came home to Solmar Bay with nothing. Eight story missions,
a five-star police department that actually hunts you, cars to steal,
a garage to fill, shops, three synth radio stations and a whole
sun-soaked coastal city to drive and walk — all in your browser.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

- **WASD / arrows** — drive & walk, **Shift** run / turbo, **Space** brake
- **E** — enter / exit / steal a car, open a shop or the garage
- **F** — punch, **mouse click** — shoot, **1–5** — switch weapon
- **R** — next radio station, **M** — map, stats & saves, **Esc / P** — pause

## The city

Solmar Bay is an original coastal city: the Marina Hotel, the Solmar Grand
casino, the Bank of Solmar, Lena's Garage, the south pier and the west
docks, ringed by avenues, palm trees and the sea. Traffic follows the road
grid, pedestrians stroll the sidewalks and panic at gunfire, and the
Solmar PD answers wanted levels 1–5 with named dispatch units (Pursuit,
Ramming, Spotlight, Roadblock, Firing), a helicopter from 3 stars and
roadblocks from 4.

## Systems

- 8 story missions with stages, timers, dialog and rewards (money + respect ranks)
- Wanted 1–5 with police cars, helicopter, roadblocks, Busted / Wasted
- Combat: fists + 4 firearms, health, tracers, hostile thugs and guards
- Money, respect ranks, garage upgrades (engine / armor / turbo), 3 shops
- HUD with minimap, full-screen map, 3 save slots (localStorage), settings
- 3 synthesized radio stations + engine, siren and weapon sounds (WebAudio, no files)

## Layout

```
game/
  index.html            page + HUD + menus
  vendor/three.module.min.js   three.js r160 (vendored)
  src/
    config.js           city, balance, missions data
    main.js             boot, loop, screens, menus
    world.js            Solmar Bay: buildings, roads, beach, landmarks
    vehicles.js         cars, driving, traffic
    pedestrians.js      walkers + hostile thugs
    police.js           wanted, dispatch units, helicopter, roadblocks
    missions.js         8-mission story stage machine
    combat.js           weapons, shooting, tracers
    pickups.js          cash, health, money drops
    audio.js            WebAudio synth: radio, engine, sirens, SFX
    hud.js              HUD, minimap, map screen, menus
    render.js           three.js scene, sun, sky, follow camera
    save.js             save slots (localStorage)
    input.js            keyboard + mouse
    random.js           seeded RNG
    shots.js            deterministic screenshot staging (?shot=)
screenshots/           4 real renders: chase, combat, map, start
```

Screenshots are staged deterministically: `?shot=chase|combat|map|start&seed=1`
plays the real rules forward with an autopilot and paints the frame.

## License

MIT — see [LICENSE](LICENSE).
