/* TRAP HOUSE — fighting back. The slingshot (one piece) drops Tim for a few seconds from across a room;
   the taser (body + battery, found separately) drops him much longer but only up close, and has two charges.
   Slamming a door on him while he's in the doorway also knocks him down briefly. */
(function () {
  'use strict';
  const TH = window.TH;
  const SLING = { range: 13, stun: 4.5, cool: 7 }, TASER = { range: 3.6, stun: 9, cool: 2 };

  TH.Weapons = {
    cool: 0, fx: [],

    aimAt() { // how well you're aiming at his chest (1 = dead on)
      const P = TH.Player, E = TH.Enemy, cp = P.camPos(), tx = E.pos.x, ty = E.y + 1.25, tz = E.pos.z;
      const dx = tx - cp.x, dy = ty - cp.y, dz = tz - cp.z, d = Math.hypot(dx, dy, dz) || 1;
      const f = { x: -Math.sin(P.yaw) * Math.cos(P.pitch), y: Math.sin(P.pitch), z: -Math.cos(P.yaw) * Math.cos(P.pitch) };
      return { dot: (dx * f.x + dy * f.y + dz * f.z) / d, d };
    },
    canHit(range) {
      const P = TH.Player, E = TH.Enemy;
      if (!E.active || E.stunT > 0 || P.level() !== E.level() || TH.state.hidden) return false;
      const a = this.aimAt(); if (a.d > range || a.dot < 0.975 - 0.05 / Math.max(1, a.d)) return false; // a forgiving cone that tightens with range
      return TH.Col.los(P.pos.x, P.pos.z, E.pos.x, E.pos.z, P.level());
    },

    register() {
      this.cool = 0; TH.state.taserCharges = TH.state.taserCharges || 0;
      const I = TH.Interact, E = TH.Enemy, inv = TH.Inventory;
      I.add({
        get x() { return E.pos.x; }, get z() { return E.pos.z; }, get level() { return E.level(); }, get y() { return E.y + 1.25; },
        set r(v) {}, get r() { const h = inv.heldId(); return h === 'slingshot' ? SLING.range : h === 'taser' ? TASER.range : 0.01; },
        prompt: () => {
          const h = inv.heldId(); if (h !== 'slingshot' && h !== 'taser') return null;
          if (!this.canHit(h === 'slingshot' ? SLING.range : TASER.range)) return null;
          return h === 'slingshot' ? (this.cool > 0 ? 'RELOADING…' : 'FIRE THE SLINGSHOT') : (TH.state.taserCharges > 0 ? 'TASE HIM' : 'TASER IS DEAD');
        },
        short: () => (inv.heldId() === 'taser' ? 'TASE' : 'FIRE'),
        bias: () => -6, // when you're aiming a weapon at him, that wins over anything else in reach
        check: () => (inv.heldId() === 'slingshot' && this.cool > 0 ? 'STILL LOADING A STONE' : inv.heldId() === 'taser' && TH.state.taserCharges <= 0 ? 'NO CHARGE LEFT' : null),
        use: () => (inv.heldId() === 'taser' ? this.tase() : this.sling()),
      });
    },

    sling() {
      const P = TH.Player, E = TH.Enemy; this.cool = SLING.cool;
      TH.Audio.play('sling'); TH.Noise.emit(P.pos.x, P.pos.z, P.level(), 6, 'a rubber band snapping');
      // the stone: a little pebble flying to his head
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.018), new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.9 }));
      const a = P.camPos().clone(), b = new THREE.Vector3(E.pos.x, E.y + 1.7, E.pos.z); m.position.copy(a); TH.scene.add(m);
      this.fx.push({ t: 0, dur: Math.max(0.08, a.distanceTo(b) / 45), m, a, b, done: () => { E.stun(SLING.stun, 'sling'); TH.Audio.play('thwack', { x: b.x, y: b.y, z: b.z, level: E.level() }, 30); } });
    },

    tase() {
      const P = TH.Player, E = TH.Enemy; this.cool = TASER.cool; TH.state.taserCharges--;
      TH.Audio.play('zap'); TH.Noise.emit(P.pos.x, P.pos.z, P.level(), 10, 'crackling electricity');
      // two thin wires from your hand to his chest, crackling blue for a second
      const g = new THREE.Group(), mat = new THREE.LineBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.95 }); TH.scene.add(g);
      const from = P.camPos().clone().add(new THREE.Vector3(Math.cos(P.yaw) * 0.12, -0.25, -Math.sin(P.yaw) * 0.12));
      for (let k = 0; k < 2; k++) {
        const pts = []; const to = new THREE.Vector3(E.pos.x + (k - 0.5) * 0.12, E.y + 1.15 + k * 0.15, E.pos.z);
        for (let i = 0; i <= 8; i++) { const p = from.clone().lerp(to, i / 8); if (i && i < 8) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06)); pts.push(p); }
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
      }
      this.fx.push({ t: 0, dur: 1.1, m: g, wire: true });
      E.stun(TASER.stun, 'taser');
      TH.UI.toast(TH.state.taserCharges > 0 ? `He drops. ${TH.state.taserCharges} charge left. RUN.` : 'He drops. That was the last charge. RUN.');
    },

    update(dt) {
      if (this.cool > 0) this.cool -= dt;
      this.fx = this.fx.filter((f) => {
        f.t += dt;
        if (f.wire) { f.m.children.forEach((l) => (l.material.opacity = 0.5 + Math.random() * 0.5)); if (f.t >= f.dur) { TH.scene.remove(f.m); return false; } return true; }
        const k = Math.min(1, f.t / f.dur); f.m.position.lerpVectors(f.a, f.b, k); f.m.position.y += Math.sin(k * Math.PI) * 0.08;
        if (k >= 1) { TH.scene.remove(f.m); f.done(); return false; }
        return true;
      });
    },
  };
})();
