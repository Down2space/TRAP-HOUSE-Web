/* TRAP HOUSE — Tim's mousetraps. He only sets one when a noise brings him somewhere and he doesn't find you there:
   before he moves on he kneels and leaves a trap on the spot, in case you come back.
   Step on one: SNAP, you yelp (he hears that anywhere in the house) and limp for a few seconds.
   Spot one first and you can crouch down and disarm it. */
(function () {
  'use strict';
  const TH = window.TH;
  const COUNT = { practice: [0, 2], easy: [0, 4], normal: [0, 6], hard: [0, 8], nightmare: [0, 10] }; // [at dawn, most at once]

  TH.Traps = {
    list: [], mats: null,

    model() {
      if (!this.mats) {
        const wood = new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.7, emissive: 0x4a3e28 }); // pale pine, catches the eye on dark floors
        const steel = new THREE.MeshStandardMaterial({ color: 0xe0e0dc, metalness: 0.7, roughness: 0.25 });
        const copper = new THREE.MeshStandardMaterial({ color: 0xb87a3a, metalness: 0.8, roughness: 0.4 });
        const cheese = new THREE.MeshStandardMaterial({ color: 0xf2c84a, roughness: 0.6, emissive: 0x6a4a08 });
        this.mats = { wood, steel, copper, cheese };
      }
      const M = this.mats, g = new THREE.Group(), add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
      // a classic wooden snap trap, ~1.3x real size so you can actually spot it in the dark
      add(new THREE.BoxGeometry(0.06, 0.012, 0.13), M.wood, 0, 0.006, 0);
      const bar = new THREE.Group(); bar.position.set(0, 0.016, 0.0); g.add(bar);
      [-1, 1].forEach((s) => add(new THREE.CylinderGeometry(0.006, 0.006, 0.014, 10), M.steel, s * 0.016, 0.018, 0.0).rotation.z = Math.PI / 2); // springs
      // the kill bar: a U of wire, hinged at the springs. Set = laid back; sprung = slammed forward
      const u = (len) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, len), M.steel); return m; };
      const a = u(0.055), b = u(0.055), c = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.003, 0.003), M.steel);
      a.position.set(-0.019, 0, -0.0275); b.position.set(0.019, 0, -0.0275); c.position.set(0, 0, -0.055); bar.add(a, b, c);
      add(new THREE.BoxGeometry(0.02, 0.003, 0.03), M.copper, 0, 0.0135, 0.04); // bait pedal
      const ch = add(new THREE.BoxGeometry(0.014, 0.01, 0.012), M.cheese, 0, 0.02, 0.042); ch.rotation.y = 0.4;
      add(new THREE.BoxGeometry(0.002, 0.002, 0.06), M.steel, 0, 0.016, 0.012); // hold-down arm
      g.scale.setScalar(1.8);
      // a faint pale glint around it, so you can pick it out on a dark floor in time to step around it
      if (!this.ringMat) this.ringMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.095, 32), this.ringMat.clone()); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; g.add(ring); g.userData.ring = ring;
      g.userData.dynamic = true;
      return { g, bar, ch };
    },

    clear() { this.list.forEach((t) => { TH.scene.remove(t.g); if (t.it) TH.Interact.remove(t.it); }); this.list = []; },

    okSpot(x, z, lv) {
      const C = TH.Col, Hs = TH.House;
      if (!Hs.roomAt(x, z, lv) || C.stairAt(x, z, lv * TH.House.H)) return false;
      for (const b of C.boxes[lv]) if (!b.off && x > b.x0 - 0.35 && x < b.x1 + 0.35 && z > b.z0 - 0.35 && z < b.z1 + 0.35) return false;
      if (this.list.some((t) => !t.sprung && t.level === lv && Math.hypot(t.x - x, t.z - z) < 2.5)) return false;
      const P = TH.Player; if (P && P.level() === lv && Math.hypot(P.pos.x - x, P.pos.z - z) < 2) return false;
      return true;
    },

    place(x, z, lv, silent) {
      const m = this.model(), t = { x, z, level: lv, g: m.g, bar: m.bar, cheese: m.ch, sprung: false };
      m.g.position.set(x, lv * TH.House.H + 0.002, z); m.g.rotation.y = Math.random() * Math.PI * 2;
      m.bar.rotation.x = 0; // cocked back, lying flat behind the springs
      TH.scene.add(m.g); TH.Linear.fix(m.g); TH._dirty = true;
      t.it = TH.Interact.add({ x, z, level: lv, y: lv * TH.House.H + 0.05, r: 1.3, hold: 1.4,
        prompt: () => (t.sprung ? null : 'DISARM THE MOUSETRAP'), short: 'DISARM',
        check: () => (TH.Player.crouch ? null : 'CROUCH DOWN TO DISARM IT'),
        use: () => { this.spring(t, true); TH.UI.toast('Trap disarmed.'); } });
      this.list.push(t);
      if (!silent) TH.Audio.play('trapSet', { x, y: lv * TH.House.H + 0.1, z }, 10);
      return t;
    },

    // a new day: fresh traps scattered around the house
    reset() {
      this.clear();
      const n = (COUNT[TH.state.diff] || COUNT.normal)[0], nodes = Object.values(TH.House.nav.nodes).filter((k) => k.id[0] === 'r');
      for (let tries = 0, made = 0; made < n && tries < 400; tries++) {
        const k = TH.util.pick(nodes), x = k.x + (Math.random() - 0.5) * 2.4, z = k.z + (Math.random() - 0.5) * 2.4;
        if (this.okSpot(x, z, k.level)) { this.place(x, z, k.level, true); made++; }
      }
    },

    // Tim kneels and sets one where he's standing (a little ahead of him)
    setBy(E) {
      const max = (COUNT[TH.state.diff] || COUNT.normal)[1];
      if (this.list.filter((t) => !t.sprung).length >= max) return;
      const lv = E.level();
      for (const [d, a] of [[0.6, 0], [0.7, 0.8], [0.7, -0.8], [0.9, 1.6], [0.9, -1.6], [0.6, Math.PI]]) { // just ahead of him if there's room, else beside him
        const x = E.pos.x + Math.sin(E.face + a) * d, z = E.pos.z + Math.cos(E.face + a) * d;
        if (this.okSpot(x, z, lv)) { this.place(x, z, lv); TH.Audio.play('grunt', E.mouth(), 18); return true; } // kneeling down to set it
      }
      return false;
    },

    spring(t, quiet) {
      if (t.sprung) return; t.sprung = true; t.snapT = 0; if (t.it) { TH.Interact.remove(t.it); t.it = null; }
      const pos = { x: t.x, y: t.level * TH.House.H + 0.1, z: t.z };
      TH.Audio.play('trapSnap', pos, quiet ? 8 : 30);
      if (quiet) { TH.Noise.emit(t.x, t.z, t.level, 2, 'a mousetrap snapping'); return; }
      // you stepped on it
      setTimeout(() => TH.Audio.play('yelp'), 60);
      TH.Noise.emit(t.x, t.z, t.level, 60, 'a mousetrap snapping and a yelp');
      TH.UI.noisePulse(3); TH.UI.toast('A mousetrap!');
      TH.state.limpT = 3.5; TH.Bus.emit('trapped', t);
      const fl = document.getElementById('hurt'); if (fl) { fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); }
    },

    update(dt) {
      const P = TH.Player;
      if (TH.state.limpT > 0) TH.state.limpT -= dt;
      for (const t of this.list) {
        const ring = t.g.userData.ring;
        if (ring) { // the glint shows within a few metres (brighter the closer you are), and fades once it's sprung
          const d = P.level() === t.level ? Math.hypot(P.pos.x - t.x, P.pos.z - t.z) : 99;
          const want = t.sprung ? 0 : d < 6 ? (0.18 + 0.32 * (1 - d / 6)) * (0.75 + 0.25 * Math.sin(performance.now() / 260 + t.x)) : 0;
          ring.material.opacity += (want - ring.material.opacity) * Math.min(1, dt * 6);
        }
        if (t.sprung) { if (t.snapT < 1) { t.snapT = Math.min(1, t.snapT + dt * 14); t.bar.rotation.x = Math.PI * t.snapT; if (t.snapT === 1) t.cheese.visible = Math.random() < 0.5; } continue; }
        if (TH.state.mode === 'play' && P.active && !TH.state.travel && !TH.state.hidden && P.level() === t.level && Math.hypot(P.pos.x - t.x, P.pos.z - t.z) < 0.24 && P.speed > 0.2) this.spring(t, false);
      }
    },
  };
})();
