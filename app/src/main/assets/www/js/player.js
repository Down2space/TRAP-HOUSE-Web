/* TRAP HOUSE — PlayerController + CameraController (first person).
   Walking is quiet on carpet, louder on wood; sprinting is loud; crouching is near-silent. */
(function () {
  'use strict';
  const TH = window.TH, U = TH.util;

  const P = (TH.Player = {
    pos: new THREE.Vector3(), y: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, eye: 1.6, crouch: false, active: false,
    moveMag: 0, speed: 0, bob: 0, stepAcc: 0, R: 0.35, hideSpot: null, lookYaw: 0, sprinting: false, _cp: new THREE.Vector3(),

    init(camera) {
      this.camera = camera; camera.rotation.order = 'YXZ';
      this.vm = new THREE.Group(); // legacy holder (hands.js draws the real view model) this.vm.position.set(0.3, -0.28, -0.5);
      this.hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.32), new THREE.MeshLambertMaterial({ color: 0x8a6a52 }));
      this.hand.position.set(0.04, -0.06, 0.18); this.hand.rotation.x = 0.3; this.vm.add(this.hand);
      this.heldMesh = null; this.heldId = null;
      TH.Bus.on('inv', () => this.refreshHeld());
    },
    refreshHeld() {
      if (TH.Hands && TH.Hands.ready) { TH.Hands.setHeld(TH.Inventory.heldId()); return; }
      const id = TH.Inventory.heldId();
      if (id === this.heldId) return;
      if (this.heldMesh) this.vm.remove(this.heldMesh);
      this.heldId = id; this.heldMesh = null;
      if (id) {
        const m = TH.Items.buildMesh(id); m.rotation.set(0.4, -0.8, 0.2);
        const s = id === 'pan' ? 0.55 : id === 'bottle' ? 0.9 : id === 'wire_cutters' ? 1.1 : id === 'radio' ? 0.7 : id === 'rocks' ? 1.1 : id === 'newspapers' ? 0.75 : id === 'oil_can' ? 1.2 : 1.4; m.scale.setScalar(s);
        this.vm.add(m); this.heldMesh = m; 
        m.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.userData = {}; } }); TH.Linear.fix(m);
      }
      this.hand.visible = !!id;
    },

    spawn(sp) {
      this.pos.set(sp.x, 0, sp.z); this.y = sp.level * TH.House.H; this.yaw = sp.yaw || 0; this.pitch = -0.05;
      this.vx = this.vz = 0; this.crouch = false; this.active = true; this.hideSpot = null; TH.state.hidden = false;
      TH.Bus.emit('crouch', false);
    },
    level() { return TH.Col.levelOf(this.y); },
    camPos() { return this.camera ? this.camera.position : this._cp; },
    forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; },
    canControl() { return TH.state.mode === 'play' && !TH.UI.modal && !TH.state.caught && !TH.state.travel && !TH.state.cinematic; },
    // scripted movement through a shortcut: pts = [{x, y, z, yaw, pitch}], camera follows a smooth path
    travel(pts, dur, end) { TH.state.travel = { pts, dur, t: 0, end, crouch: this.crouch }; this.vx = this.vz = 0; },

    /* ---------- hiding ---------- */
    hide(spot) {
      this.hideSpot = spot; TH.state.hidden = true; this.lookYaw = 0; this.crouch = false;
      const metal = /metal|locker|cabinet/i.test(spot.name || ''); TH.Audio.play(metal ? 'steelOpen' : 'cloth', null); if (metal) setTimeout(() => TH.Audio.play('steelClose', null), 450);
      TH.Bus.emit('hide', spot);
    },
    unhide() {
      const s = this.hideSpot; if (!s) return;
      this.hideSpot = null; TH.state.hidden = false;
      this.pos.set(s.enter.x, 0, s.enter.z); this.yaw = s.yaw; this.pitch = 0;
      TH.Noise.emit(s.x, s.z, s.level, 2.5, 'rustling'); TH.Audio.play(/metal|locker|cabinet/i.test(s.name || '') ? 'steelOpen' : 'cloth', null);
      TH.Bus.emit('hide', null);
    },

    update(dt, t) {
      if (TH.state.cinematic) return; // the car owns the camera
      if (TH.state.travel) {
        const tr = TH.state.travel; tr.t = Math.min(1, tr.t + dt / tr.dur);
        const n = tr.pts.length - 1, f = tr.t * n, i = Math.min(n - 1, Math.floor(f)), u = f - i, e = u * u * (3 - 2 * u), a = tr.pts[i], b = tr.pts[i + 1];
        const L = (p, q) => p + (q - p) * e, cam = this.camera;
        cam.position.set(L(a.x, b.x), L(a.y, b.y) + Math.sin(tr.t * 40) * 0.01 * (tr.end.wobble || 0), L(a.z, b.z));
        this.yaw = TH.util.angleLerp(a.yaw, b.yaw, e); this.pitch = L(a.pitch || 0, b.pitch || 0); cam.rotation.set(this.pitch, this.yaw, 0);
        if (tr.end.tick) tr.end.tick(tr.t);
        this.pos.x = cam.position.x; this.pos.z = cam.position.z; // your body follows the path (the Tenant tracks this)
        if (tr.t >= 1) { const z = tr.pts[n]; this.pos.set(z.x, 0, z.z); this.y = tr.end.y !== undefined ? tr.end.y : tr.end.level * TH.House.H; this.crouch = !!tr.crouch; this.eye = Math.max(0.4, Math.min(1.8, cam.position.y - this.y)); this._camY = cam.position.y; TH.Bus.emit('crouch', this.crouch); /* you stay standing (or crouched) the way you were, and the camera eases from where the move left it — no snapping */ TH.state.travel = null; if (tr.end.done) tr.end.done(); }
        return;
      }
      const I = TH.Input, S = TH.settings, ctl = this.canControl(), cam = this.camera;
      const k = 0.0024 * S.sens * (TH.util.isTouch ? 1.25 : 1);
      // touch look is smoothed a little so swipes glide instead of stepping; mouse stays 1:1
      const sm = TH.util.isTouch ? 1 - Math.exp(-28 * dt) : 1;
      this._ldx = (this._ldx || 0) + ((ctl ? I.look.dx : 0) - (this._ldx || 0)) * sm; this._ldy = (this._ldy || 0) + ((ctl ? I.look.dy : 0) - (this._ldy || 0)) * sm;
      const lookDx = TH.util.isTouch ? this._ldx : (ctl ? I.look.dx : 0), lookDy = TH.util.isTouch ? this._ldy : (ctl ? I.look.dy : 0);

      if (this.hideSpot) {
        // limited look-around while hidden
        const s = this.hideSpot;
        this.lookYaw = U.clamp(this.lookYaw - lookDx * k, -0.9, 0.9);
        this.pitch = U.clamp(this.pitch - lookDy * k * (S.invertY ? -1 : 1), s.type === 'bed' ? -0.15 : -0.5, s.type === 'bed' ? 0.25 : 0.4);
        cam.position.set(s.cam.x, s.cam.y, s.cam.z); this._camY = undefined;
        cam.rotation.set(this.pitch, s.yaw + this.lookYaw, 0);
        this.vm.visible = false; this.moveMag = 0; this.speed = 0;
        return;
      }

      this.yaw -= lookDx * k;
      this.pitch = U.clamp(this.pitch - lookDy * k * (S.invertY ? -1 : 1), -1.4, 1.4);

      const mv = ctl ? I.getMove() : { x: 0, y: 0 };
      this.moveMag = Math.hypot(mv.x, mv.y);
      if (ctl && (I.hit('ControlLeft') || I.hit('ControlRight') || I.hit('KeyC') || I.hit('Crouch'))) { this.crouch = !this.crouch; TH.Bus.emit('crouch', this.crouch); }
      this.sprinting = ctl && I.sprint && !this.crouch && this.moveMag > 0.2;
      const maxSp = (this.crouch ? 1.4 : this.sprinting ? 5.2 : 2.5) * (TH.state.limpT > 0 ? 0.5 : 1); // limping after a mousetrap
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      this.vx = U.damp(this.vx, (fx * mv.y + rx * mv.x) * maxSp, 11, dt);
      this.vz = U.damp(this.vz, (fz * mv.y + rz * mv.x) * maxSp, 11, dt);
      this.pos.x += this.vx * dt; this.pos.z += this.vz * dt;
      TH.Col.resolve(this.pos, this.R, this.y);
      this.y = U.damp(this.y, TH.Col.groundY(this.pos.x, this.pos.z, this.y), 18, dt);
      this.speed = Math.hypot(this.vx, this.vz);

      // footsteps, creaks and the noise they make
      const lv = this.level();
      if (this.speed > 0.4) {
        this.bob += dt * (4.5 + this.speed * 1.6);
        this.stepAcc += this.speed * dt;
        const stride = this.sprinting ? 1.9 : 1.35;
        if (this.stepAcc > stride) {
          this.stepAcc = 0;
          const floor = (TH.House.roomAt(this.pos.x, this.pos.z, lv) || {}).floor || 'wood';
          if (!this.crouch) TH.Audio.play(this.sprinting ? 'run' : 'step');
          if (this.sprinting) TH.Noise.emit(this.pos.x, this.pos.z, lv, floor === 'carpet' ? 9 : 13, 'running footsteps');
          else if (!this.crouch) TH.Noise.emit(this.pos.x, this.pos.z, lv, floor === 'carpet' ? 2.5 : 4.5, 'footsteps'); // walking: only if he's close
          const cr = TH.House.creaks.find((c) => c.level === lv && Math.hypot(c.x - this.pos.x, c.z - this.pos.z) < c.r);
          if (cr && !this.crouch) { TH.Audio.play('creakBoard'); TH.Noise.emit(this.pos.x, this.pos.z, lv, 9, 'a creaking floorboard'); /* loud nearby, but not the whole house */ TH.UI.noisePulse(1); }
        }
      } else this.bob = U.damp(this.bob, Math.round(this.bob / Math.PI) * Math.PI, 6, dt);

      this.eye = U.damp(this.eye, this.crouch ? 0.95 : 1.6, 7, dt);
      const ba = Math.min(1, this.speed / 4);
      this._camY = this._camY === undefined ? this.y + this.eye : U.damp(this._camY, this.y + this.eye, 14, dt); if (Math.abs(this._camY - (this.y + this.eye)) > 1.5) this._camY = this.y + this.eye; // smooth on stairs, never a sudden jump
      cam.position.set(this.pos.x, this._camY + Math.abs(Math.sin(this.bob)) * 0.012 * ba, this.pos.z);
      cam.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.008 * ba);

      this.vm.visible = !!this.heldMesh || false;
      this.vm.position.x = 0.3 + Math.sin(this.bob) * 0.015 * ba;
      this.vm.position.y = -0.28 - Math.abs(Math.cos(this.bob)) * 0.015 * ba;
    },
  });
})();
