// Keyboard + mouse input. Keys are tracked as a live set; edge-triggered
// actions (enter car, punch, radio, map, pause) are consumed once per press.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RADIO = 16;
export const ACTION_MAP = 32;
export const ACTION_HORN = 64;
export const ACTION_WEAPON_NEXT = 128;
export const ACTION_WEAPON_PREV = 256;
export const ACTION_SHOOT = 512;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let mouseClicked = false;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let lookDX = 0;
  let lookDY = 0;
  let rightDrag = false;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(event.code)) event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseDown(event) {
    if (event.button === 2) { rightDrag = true; return; }
    mouseDown = true;
    mouseClicked = true;
  }
  function onMouseUp(event) {
    if (event.button === 2) { rightDrag = false; return; }
    mouseDown = false;
  }
  function onMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
    // Mouse-look: right-drag orbits the view (pointer-locked movement
    // also lands here). Deltas are consumed once per frame by takeLookDelta.
    if (rightDrag || document.pointerLockElement === canvas) {
      lookDX += event.movementX || 0;
      lookDY += event.movementY || 0;
    }
  }
  // Losing window focus clears every held key, so Alt-Tabbing away cannot
  // leave W, Tab or a mouse drag stuck down when the player comes back.
  function onBlur() { keys.clear(); rightDrag = false; }
  function onContextMenu(event) { event.preventDefault(); }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('contextmenu', onContextMenu);

  function was(code) {
    return pressed.has(code);
  }

  return {
    // -1..1 steering and throttle, from WASD or arrows.
    drive() {
      const steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? -1 : 0) + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
      const throttle = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + (keys.has('KeyS') || keys.has('ArrowDown') ? -1 : 0);
      return { steer, throttle, brake: keys.has('Space'), run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    },
    // On-foot movement in camera-relative space.
    move() {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return { forward: f, strafe: s, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    },
    takeActions() {
      let actions = 0;
      if (was('Enter')) actions |= ACTION_CONFIRM;
      if (was('Escape') || was('KeyP')) actions |= ACTION_PAUSE;
      if (was('KeyE')) actions |= ACTION_ENTER;
      if (was('KeyF')) actions |= ACTION_PUNCH;
      if (was('KeyR')) actions |= ACTION_RADIO;
      if (was('KeyM')) actions |= ACTION_MAP;
      if (was('KeyH')) actions |= ACTION_HORN;
      if (was('KeyQ')) actions |= ACTION_WEAPON_NEXT;
      // Number keys are NOT an action here: the loop reads them directly
      // as a weapon slot (input.weaponSlot) before taking actions.
      if (mouseClicked) actions |= ACTION_SHOOT;
      pressed.clear();
      mouseClicked = false;
      return actions;
    },
    weaponSlot() {
      for (let i = 1; i <= 5; i += 1) if (pressed.has(`Digit${i}`)) return i;
      return 0;
    },
    // Held while Tab is down — the weapon wheel stays open.
    wheelHeld() {
      return keys.has('Tab');
    },
    // Mouse position in window pixels (for wheel sector picking).
    mousePos() {
      return { x: mouseX, y: mouseY };
    },
    // Accumulated mouse-look deltas since the last call (consumed once).
    takeLookDelta() {
      const out = { dx: lookDX, dy: lookDY };
      lookDX = 0;
      lookDY = 0;
      return out;
    },
    isDown(code) {
      return keys.has(code);
    },
    mouseHeld() {
      return mouseDown;
    },
  };
}
