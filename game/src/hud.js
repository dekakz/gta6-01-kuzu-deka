// HUD and menus: the in-game overlay (mission card, wanted stars, money,
// respect, minimap, speed, weapon, radio, dialog, police panel), the
// start / pause / map / garage / shop / settings screens, and banners.
// The minimap and the full map are 2D canvases drawn from live game state.
import { CITY, RESPECT_RANKS, respectRank, RADIO_STATIONS } from './config.js';

export function createHud(game) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-top-left">
      <div id="mission-card" class="hidden"><div id="mission-title"></div><div id="mission-label"></div><div id="mission-timer"></div></div>
      <div id="objective-hint"></div>
    </div>
    <div id="hud-top-right">
      <div id="wanted-stars"></div>
      <div id="money-line">$<span id="money">0</span></div>
      <div id="respect-line"><span id="respect-rank">Nobody</span> • <span id="respect">0</span> respect</div>
    </div>
    <div id="police-panel" class="hidden"><div class="panel-head">SOLMAR PD — DISPATCH</div><div id="police-units"></div></div>
    <div id="hud-bottom-left"><canvas id="minimap" width="190" height="190"></canvas><div id="minimap-label">SOLMAR BAY</div></div>
    <div id="hud-bottom-right">
      <div id="speed-line"><span id="speed">0</span> <span class="unit">mph</span></div>
      <div id="weapon-line"><span id="weapon-name">Fists</span> <span id="ammo"></span></div>
      <div id="radio-line">♪ <span id="radio-name">SOL FM 98.5</span></div>
    </div>
    <div id="dialog-bar" class="hidden"><span id="dialog-text"></span></div>
    <div id="banner" class="hidden"><div id="banner-title"></div><div id="banner-sub"></div></div>
    <div id="crosshair" class="hidden">+</div>
    <div id="vignette"></div>
    <div id="hint-bar">WASD drive / walk &nbsp;•&nbsp; E enter car &nbsp;•&nbsp; F punch &nbsp;•&nbsp; Click shoot &nbsp;•&nbsp; 1-5 weapons &nbsp;•&nbsp; R radio &nbsp;•&nbsp; M map &nbsp;•&nbsp; Esc pause</div>
    <div id="menu-screen" class="hidden"></div>
  `;

  const $ = (id) => document.getElementById(id);
  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');
  let dialogTimer = null;
  let bannerTimer = null;
  let menuKind = null;

  function starRow(n) {
    let out = '';
    for (let i = 0; i < 5; i += 1) out += `<span class="star ${i < n ? 'lit' : ''}">★</span>`;
    return out;
  }

  function setWanted(n) {
    $('wanted-stars').innerHTML = starRow(n);
    const panel = $('police-panel');
    if (n > 0) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  }

  function setMoney(value) { $('money').textContent = value.toLocaleString('en-US'); }
  function setRespect(value) {
    $('respect').textContent = value;
    $('respect-rank').textContent = respectRank(value);
  }
  function setHealth(value) {
    // Health shows as a bar inside the speed cluster via the vignette only;
    // keep a numeric readout in the weapon line area.
    const el = $('weapon-line');
    el.dataset.health = String(Math.round(value));
  }
  function setSpeed(mph) { $('speed').textContent = String(Math.round(mph)); }
  function setWeapon(name, ammoText) {
    $('weapon-name').textContent = name;
    $('ammo').textContent = ammoText ?? '';
  }
  function setRadio(name) { $('radio-name').textContent = name; }

  function setMission(def, stage, labelOverride) {
    const card = $('mission-card');
    if (!def || !stage) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    $('mission-title').textContent = `${def.id}. ${def.title} — ${def.giver}`;
    $('mission-label').textContent = labelOverride || stage.label;
    $('mission-timer').textContent = stage.timer ? `⏱ ${Math.ceil(stage.timer)}s` : '';
  }

  function setPolicePanel(units, wanted) {
    if (wanted <= 0) return;
    const rows = units.filter((u) => u.kind !== 'roadblock').slice(0, 5).map((u) => {
      const d = Math.round(Math.hypot(u.x - game.player.x, u.z - game.player.z));
      return `<div class="unit-row"><span class="unit-name">${u.name}</span><span class="unit-role">${u.role.toUpperCase()}</span><span class="unit-dist">${d}m</span></div>`;
    }).join('');
    $('police-units').innerHTML = rows || '<div class="unit-row">No units in range</div>';
  }

  function say(text, seconds = 5) {
    const bar = $('dialog-bar');
    $('dialog-text').textContent = text;
    bar.classList.remove('hidden');
    if (dialogTimer) window.clearTimeout(dialogTimer);
    dialogTimer = window.setTimeout(() => bar.classList.add('hidden'), seconds * 1000);
  }

  function showBanner(title, sub, color = '#ffd23c') {
    const banner = $('banner');
    $('banner-title').textContent = title;
    $('banner-title').style.color = color;
    $('banner-sub').textContent = sub || '';
    banner.classList.remove('hidden');
    if (bannerTimer) window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => banner.classList.add('hidden'), 3600);
  }

  function flashDamage() {
    const v = $('vignette');
    v.style.opacity = '0.55';
    window.setTimeout(() => { v.style.opacity = '0'; }, 180);
  }

  function setCrosshair(show) {
    $('crosshair').classList.toggle('hidden', !show);
  }

  // ---- Minimap: roads, blocks, sea, waypoint, police, player arrow.
  function drawMinimap() {
    const size = 190;
    const scale = size / (CITY.halfSize * 2 + 40);
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    mctx.clearRect(0, 0, size, size);
    mctx.fillStyle = '#1d3a2a';
    mctx.fillRect(0, 0, size, size);
    // Sea + beach along the south edge.
    mctx.fillStyle = '#1e8fa8';
    const [, seaY] = toMap(0, CITY.beachStart);
    mctx.fillRect(0, seaY, size, size - seaY);
    mctx.fillStyle = '#e8c98f';
    mctx.fillRect(0, seaY - 4, size, 5);
    // Roads.
    mctx.strokeStyle = '#3a3f46';
    mctx.lineWidth = 5;
    for (let c = -256; c <= 256; c += 64) {
      const [x1] = toMap(c, 0);
      mctx.beginPath(); mctx.moveTo(x1, 0); mctx.lineTo(x1, size); mctx.stroke();
      const [, z1] = toMap(0, c);
      mctx.beginPath(); mctx.moveTo(0, z1); mctx.lineTo(size, z1); mctx.stroke();
    }
    // Buildings as pale blocks.
    mctx.fillStyle = '#c9b8a0';
    for (const b of game.world.buildings) {
      const [x, z] = toMap(b.x, b.z);
      mctx.fillRect(x - b.w * scale / 2, z - b.d * scale / 2, Math.max(1.5, b.w * scale), Math.max(1.5, b.d * scale));
    }
    // Mission waypoint.
    const mission = game.missions.active;
    if (mission && mission.stage && mission.stage.x !== undefined) {
      const [x, z] = toMap(mission.stage.x, mission.stage.z);
      mctx.fillStyle = '#ffd23c';
      mctx.beginPath(); mctx.arc(x, z, 6, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#ffffff';
      mctx.lineWidth = 2;
      mctx.beginPath(); mctx.arc(x, z, 8, 0, Math.PI * 2); mctx.stroke();
    }
    // Police blips (blue/red), player arrow (white).
    for (const u of game.police.units) {
      if (u.kind === 'roadblock') continue;
      const [x, z] = toMap(u.x, u.z);
      mctx.fillStyle = u.kind === 'heli' ? '#ff4444' : '#4488ff';
      mctx.beginPath(); mctx.arc(x, z, u.kind === 'heli' ? 4 : 3, 0, Math.PI * 2); mctx.fill();
    }
    const [px, py] = toMap(game.player.x, game.player.z);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(-game.player.heading);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath();
    mctx.fill();
    mctx.restore();
    // North marker.
    mctx.fillStyle = '#ffffff';
    mctx.font = 'bold 11px Arial';
    mctx.fillText('N', size / 2 - 4, 12);
  }

  // ---- Full map screen: bigger map + stats + save slots.
  function drawFullMap(canvas) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const scale = size / (CITY.halfSize * 2 + 40);
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    ctx.fillStyle = '#16281c';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#1e8fa8';
    const [, seaY] = toMap(0, CITY.beachStart);
    ctx.fillRect(0, seaY, size, size - seaY);
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 10;
    for (let c = -256; c <= 256; c += 64) {
      const [x1] = toMap(c, 0);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, size); ctx.stroke();
      const [, z1] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(0, z1); ctx.lineTo(size, z1); ctx.stroke();
    }
    ctx.fillStyle = '#e8c98f';
    ctx.font = 'bold 13px Arial';
    for (const b of game.world.buildings) {
      if (!b.label) continue;
      const [x, z] = toMap(b.x, b.z);
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath(); ctx.arc(x, z, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(b.label, x + 10, z + 4);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Arial';
    ctx.fillText('SOLMAR BAY', 14, 24);
    const mission = game.missions.active;
    if (mission && mission.stage && mission.stage.x !== undefined) {
      const [x, z] = toMap(mission.stage.x, mission.stage.z);
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath(); ctx.arc(x, z, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, z, 13, 0, Math.PI * 2); ctx.stroke();
    }
    const [px, py] = toMap(game.player.x, game.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-game.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(-7, 8); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function statsHtml() {
    const p = game.progress;
    return `
      <div class="stat-grid">
        <div><span>Money</span><b>$${p.money.toLocaleString('en-US')}</b></div>
        <div><span>Respect</span><b>${p.respect} — ${respectRank(p.respect)}</b></div>
        <div><span>Missions done</span><b>${p.missionsDone} / 8</b></div>
        <div><span>Kills</span><b>${p.kills}</b></div>
        <div><span>Cars stolen</span><b>${p.carsStolen}</b></div>
        <div><span>Time played</span><b>${Math.floor(p.playSeconds / 60)}m ${Math.floor(p.playSeconds % 60)}s</b></div>
      </div>`;
  }

  function saveSlotsHtml() {
    return game.save.list().map(({ slot, data }) => {
      const label = game.save.slotLabel(slot);
      const info = data ? `$${data.money} • ${data.missionsDone}/8 missions • ${new Date(data.savedAt).toLocaleString()}` : 'Empty slot';
      return `<div class="slot-row"><span>${label}</span><span class="slot-info">${info}</span><button data-save="${slot}">Save here</button><button data-load="${slot}" ${data ? '' : 'disabled'}>Load</button></div>`;
    }).join('');
  }

  function menuHtml(kind) {
    if (kind === 'title') {
      return `
        <div class="menu-panel title-panel">
          <div class="game-logo">SOLMAR BAY</div>
          <div class="game-tag">An open-world crime story — sun, sea and five stars</div>
          <div class="game-sub">Dario Vega came home with nothing. Solmar Bay is about to pay.</div>
          <div class="menu-buttons">
            <button data-action="start">▶ &nbsp;NEW GAME</button>
            <button data-action="continue" ${game.save.list().some((s) => s.data) ? '' : 'disabled'}>CONTINUE</button>
            <button data-action="map">MAP &amp; STATS</button>
            <button data-action="settings">SETTINGS &amp; CONTROLS</button>
          </div>
          <div class="menu-foot">WASD drive &amp; walk • E enter / steal car • F punch • Click shoot • 1–5 weapons • R radio • M map • Esc pause<br>8 story missions • 5-star police • garage, shops &amp; radio • saves in 3 slots</div>
        </div>`;
    }
    if (kind === 'pause') {
      return `
        <div class="menu-panel">
          <div class="menu-title">PAUSED</div>
          <div class="menu-buttons">
            <button data-action="resume">RESUME</button>
            <button data-action="map">MAP &amp; STATS</button>
            <button data-action="garage">GARAGE</button>
            <button data-action="settings">SETTINGS &amp; CONTROLS</button>
            <button data-action="quit-title">QUIT TO TITLE</button>
          </div>
          ${statsHtml()}
        </div>`;
    }
    if (kind === 'map') {
      return `
        <div class="menu-panel wide-panel">
          <div class="menu-title">SOLMAR BAY — MAP &amp; STATS</div>
          <div class="map-row"><canvas id="fullmap" width="520" height="520"></canvas>
          <div class="map-side">${statsHtml()}
            <div class="menu-sub">SAVE SLOTS</div>
            <div id="save-slots">${saveSlotsHtml()}</div>
            <div class="menu-buttons"><button data-action="resume">CLOSE MAP</button></div>
          </div></div>
        </div>`;
    }
    if (kind === 'garage') {
      const cars = game.progress.garage.map((id) => {
        const model = game.vehicleModels.find((m) => m.id === id);
        return `<div class="slot-row"><span>${model ? model.name : id}</span><span class="slot-info">In your garage</span><button data-spawn-car="${id}">Take out</button></div>`;
      }).join('') || '<div class="slot-row">Garage is empty — steal a car and park it here.</div>';
      return `
        <div class="menu-panel">
          <div class="menu-title">LENA'S GARAGE</div>
          <div class="menu-sub">Upgrades — cash buys speed and armor. Park a stolen car in the garage marker to keep it.</div>
          <div class="slot-row"><span>Engine Tune (+8 mph top speed)</span><span class="slot-info">$1,500</span><button data-upgrade="engine" ${game.progress.money >= 1500 ? '' : 'disabled'}>Buy</button></div>
          <div class="slot-row"><span>Armor Plating (+50 car health)</span><span class="slot-info">$1,200</span><button data-upgrade="armor" ${game.progress.money >= 1200 ? '' : 'disabled'}>Buy</button></div>
          <div class="slot-row"><span>Turbo Boost (hold Shift for extra speed)</span><span class="slot-info">$2,000</span><button data-upgrade="turbo" ${game.progress.money >= 2000 ? '' : 'disabled'}>Buy</button></div>
          <div class="menu-sub">YOUR CARS</div>
          ${cars}
          <div class="menu-buttons"><button data-action="resume">BACK TO THE STREETS</button></div>
        </div>`;
    }
    if (kind === 'shop') {
      const shop = game.nearShop;
      const items = shop && shop.kind === 'weapons'
        ? [['P9 Pistol', 400, 'buy-weapon-pistol'], ['Kestrel SMG', 900, 'buy-weapon-smg'], ['Bulldog Shotgun', 1100, 'buy-weapon-shotgun'], ['Longshot Rifle', 1500, 'buy-weapon-rifle'], ['Ammo refill', 150, 'buy-ammo']]
        : shop && shop.kind === 'food'
          ? [['Burger &amp; shake (+40 health)', 25, 'buy-food'], ['Full meal (+100 health)', 60, 'buy-meal']]
          : [['Neon jacket (+10 respect)', 200, 'buy-jacket'], ['Gold chain (+25 respect)', 500, 'buy-chain']];
      return `
        <div class="menu-panel">
          <div class="menu-title">${shop ? shop.name.toUpperCase() : 'SHOP'}</div>
          <div class="menu-sub">Cash: $${game.progress.money.toLocaleString('en-US')}</div>
          ${items.map(([name, price, action]) => `<div class="slot-row"><span>${name}</span><span class="slot-info">$${price}</span><button data-buy="${action}" data-price="${price}" ${game.progress.money >= price ? '' : 'disabled'}>Buy</button></div>`).join('')}
          <div class="menu-buttons"><button data-action="resume">LEAVE SHOP</button></div>
        </div>`;
    }
    if (kind === 'settings') {
      return `
        <div class="menu-panel">
          <div class="menu-title">SETTINGS &amp; CONTROLS</div>
          <div class="controls-table">
            <div><b>W A S D / Arrows</b><span>Drive &amp; walk</span></div>
            <div><b>Shift</b><span>Run / turbo (with upgrade)</span></div>
            <div><b>Space</b><span>Brake</span></div>
            <div><b>E</b><span>Enter / exit / steal car</span></div>
            <div><b>F</b><span>Punch</span></div>
            <div><b>Mouse click</b><span>Shoot current weapon</span></div>
            <div><b>1 – 5</b><span>Switch weapon</span></div>
            <div><b>R</b><span>Next radio station</span></div>
            <div><b>M</b><span>Map, stats &amp; saves</span></div>
            <div><b>H</b><span>Horn</span></div>
            <div><b>Esc / P</b><span>Pause</span></div>
          </div>
          <div class="menu-sub">Radio: ${RADIO_STATIONS.map((s) => s.name).join(' • ')}</div>
          <div class="menu-buttons"><button data-action="resume">BACK</button></div>
        </div>`;
    }
    if (kind === 'dead') {
      return `
        <div class="menu-panel">
          <div class="menu-title red">WASTED</div>
          <div class="menu-sub">Dario got dropped on the streets of Solmar. The hospital bill is $200 — the crew still needs you.</div>
          <div class="menu-buttons"><button data-action="respawn">RESPAWN AT THE HOSPITAL</button></div>
        </div>`;
    }
    if (kind === 'busted') {
      return `
        <div class="menu-panel">
          <div class="menu-title red">BUSTED</div>
          <div class="menu-sub">Solmar PD took you in. Bail is $300 — and the heat is off, for now.</div>
          <div class="menu-buttons"><button data-action="respawn">POST BAIL &amp; WALK FREE</button></div>
        </div>`;
    }
    return '';
  }

  function showMenu(kind) {
    menuKind = kind;
    // On the title screen the in-game HUD stays out of the way.
    root.classList.toggle('title-mode', kind === 'title');
    root.classList.toggle('menu-open', !!kind);
    const screen = $('menu-screen');
    if (!kind) {
      screen.classList.add('hidden');
      screen.innerHTML = '';
      return;
    }
    screen.innerHTML = menuHtml(kind);
    screen.classList.remove('hidden');
    if (kind === 'map') {
      const canvas = document.getElementById('fullmap');
      if (canvas) drawFullMap(canvas);
    }
    screen.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => game.menuAction(btn.dataset.action));
    });
    screen.querySelectorAll('[data-save]').forEach((btn) => {
      btn.addEventListener('click', () => { game.saveGame(btn.dataset.save); showMenu('map'); });
    });
    screen.querySelectorAll('[data-load]').forEach((btn) => {
      btn.addEventListener('click', () => game.loadGame(btn.dataset.load));
    });
    screen.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => { game.buyItem(btn.dataset.buy, Number(btn.dataset.price)); showMenu('shop'); });
    });
    screen.querySelectorAll('[data-upgrade]').forEach((btn) => {
      btn.addEventListener('click', () => { game.buyUpgrade(btn.dataset.upgrade); showMenu('garage'); });
    });
    screen.querySelectorAll('[data-spawn-car]').forEach((btn) => {
      btn.addEventListener('click', () => game.spawnGarageCar(btn.dataset.spawnCar));
    });
  }

  function getMenuKind() { return menuKind; }

  return {
    setWanted, setMoney, setRespect, setHealth, setSpeed, setWeapon, setRadio,
    setMission, setPolicePanel, say, showBanner, flashDamage, setCrosshair,
    drawMinimap, showMenu, getMenuKind,
  };
}
