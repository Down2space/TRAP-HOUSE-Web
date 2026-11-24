/* TRAP HOUSE — InputManager + MobileControls
   Everything gameplay reads goes through TH.Input, so keyboard, mouse and touch are interchangeable. */
(function () {
  'use strict';
  const TH = window.TH;

  const I = (TH.Input = {
    keys: {}, pressed: new Set(), look: { dx: 0, dy: 0 },
    sprintToggle: false, interactHeld: false, locked: false, dragging: false,
    joy: { id: null, ox: 0, oy: 0, x: 0, y: 0, pushT: 0 },
    lookTouches: {}, canvas: null,

    init(canvas) {
      this.canvas = canvas;
      const gameKeys = ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
        if (TH.state.mode === 'play' && gameKeys.includes(e.code)) e.preventDefault();
        if (!e.repeat) this.pressed.add(e.code);
        this.keys[e.code] = true;
      });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
      window.addEventListener('blur', () => { this.keys = {}; this.interactHeld = false; });

      // Mouse look: pointer lock when allowed, click-drag as a fallback.
      canvas.addEventListener('mousedown', (e) => {
        if (TH.state.mode !== 'play' || TH.UI.modal) return;
        this.dragging = true;
        if (!this.locked && canvas.requestPointerLock && !TH.util.isTouch) {
          try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* not allowed here */ }
        }
      });
      window.addEventListener('mouseup', () => { this.dragging = false; });
      window.addEventListener('mousemove', (e) => {
        if (TH.state.mode !== 'play' || TH.UI.modal) return;
        if (this.locked || this.dragging) { this.look.dx += e.movementX || 0; this.look.dy += e.movementY || 0; }
      });
      document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      this.initTouch();
    },

    unlock() { if (document.exitPointerLock && this.locked) document.exitPointerLock(); this.dragging = false; },
    down(c) { return !!this.keys[c]; },
    hit(c) { return this.pressed.has(c); },
    press(c) { this.pressed.add(c); },
    endFrame() { this.pressed.clear(); this.look.dx = 0; this.look.dy = 0; },

    getMove() {
      if (this.joy.id !== null) return { x: this.joy.x, y: this.joy.y };
      let x = 0, y = 0;
      if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
      if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
      if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
      if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
      const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
      return { x, y };
    },
    get sprint() {
      return this.down('ShiftLeft') || this.down('ShiftRight') || this.sprintToggle ||
        this.joy.pushT > 0.3;
    },
    get interactDown() { return this.down('KeyE') || this.interactHeld; },

    /* ---------- MobileControls ---------- */
    initTouch() {
      const layer = document.getElementById('touch-layer');
      const base = document.getElementById('joy-base'), knob = document.getElementById('joy-knob');
      const R = () => 56 * TH.settings.joySize;
      const onLeft = (x) => (TH.settings.swapSides ? x > innerWidth * 0.58 : x < innerWidth * 0.42);
      const placeBase = (x, y) => { base.style.left = x + 'px'; base.style.top = y + 'px'; };
      this.resetJoy = () => {
        const r = R(); base.style.width = base.style.height = r * 2 + 'px';
        knob.style.width = knob.style.height = r * 0.9 + 'px';
        const x = TH.settings.swapSides ? innerWidth - (r + 44) : r + 44;
        placeBase(x, innerHeight - (r + 44)); knob.style.transform = 'translate(-50%,-50%)';
        base.classList.remove('active');
      };
      this.resetJoy();
      window.addEventListener('resize', () => this.resetJoy());
      TH.Bus.on('settings', () => this.resetJoy());

      layer.addEventListener('touchstart', (e) => {
        e.preventDefault(); TH.Audio.resume();
        for (const t of e.changedTouches) {
          if (this.joy.id === null && onLeft(t.clientX)) {
            this.joy.id = t.identifier; this.joy.ox = t.clientX; this.joy.oy = t.clientY;
            placeBase(t.clientX, t.clientY); base.classList.add('active');
          } else { this.lookTouches[t.identifier] = { x: t.clientX, y: t.clientY }; }
        }
      }, { passive: false });
      layer.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier === this.joy.id) {
            const r = R(); let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
            const m = Math.hypot(dx, dy); if (m > r) { dx *= r / m; dy *= r / m; }
            this.joy.x = dx / r; this.joy.y = -dy / r;
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          } else if (this.lookTouches[t.identifier]) {
            const lt = this.lookTouches[t.identifier];
            this.look.dx += (t.clientX - lt.x) * 1.6; this.look.dy += (t.clientY - lt.y) * 1.6;
            lt.x = t.clientX; lt.y = t.clientY;
          }
        }
      }, { passive: false });
      const end = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === this.joy.id) { this.joy.id = null; this.joy.x = this.joy.y = 0; this.joy.pushT = 0; this.resetJoy(); }
          delete this.lookTouches[t.identifier];
        }
      };
      layer.addEventListener('touchend', end); layer.addEventListener('touchcancel', end);

      // Action buttons
      document.querySelectorAll('#pad [data-btn]').forEach((b) => {
        const kind = b.dataset.btn;
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault(); e.stopPropagation(); TH.Audio.resume();
          b.classList.add('down');
          if (kind === 'interact') { this.interactHeld = true; this.press('Interact'); }
          else if (kind === 'sprint') { this.sprintToggle = !this.sprintToggle; b.classList.toggle('on', this.sprintToggle); }
          else if (kind === 'crouch') this.press('Crouch');
          else if (kind === 'drop') this.press('Drop');
          else if (kind === 'bag') this.press('Bag');
          else if (kind === 'hide') this.press('Hide');
        });
        const up = () => { b.classList.remove('down'); if (kind === 'interact') this.interactHeld = false; };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      });
    },

    update(dt) {
      const m = Math.hypot(this.joy.x, this.joy.y);
      this.joy.pushT = this.joy.id !== null && m > 0.93 ? this.joy.pushT + dt : 0;
    },
  });
})();
