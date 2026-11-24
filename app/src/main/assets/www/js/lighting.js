/* TRAP HOUSE — LightingSystem. A small pool of real lights follows you to the nearest bulbs,
   so phones only ever pay for 3–5 lights. Bulbs flicker; some die for a moment. */
(function () {
  'use strict';
  const TH = window.TH;

  TH.Lights = {
    pool: [],
    init(scene) {
      const n = TH.settings.quality === 'low' ? 4 : 6;
      for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffd8a0, 0, 13, 1.4); scene.add(l); this.pool.push(l); }
      // night: a cold moonlit sky fill, very little ambient; the bulbs, candles and moon shafts do the work
      this.hemi = new THREE.HemisphereLight(0x8a98c8, 0x2a2420, 0.6); scene.add(this.hemi);
      this.amb = new THREE.AmbientLight(0xc8d0ff, 0.15); scene.add(this.amb);
      // a faint fill that travels with you (your eyes adjusting), so you can still find your way in the dark
      this.fill = new THREE.PointLight(0xd8deff, 0.3, 7.5, 1.4); TH.camera.add(this.fill); this.fill.position.set(0, 0.3, 0.4);
      scene.fog = new THREE.FogExp2(0x0e1018, 0.03);
      scene.background = new THREE.Color(0x0a0d16);
      TH.House.fixtures.forEach((f) => { f.cur = f.power; f.dead = 0; });
    },
    applyDifficulty() {
      const dark = TH.DIFF[TH.state.diff].dark;
      const pbr = TH.tier && TH.tier.hi() ? 0.4 : 1; // reflections already add bounce light
      this.hemi.intensity = (0.2 + 0.26 * dark) * pbr; this.amb.intensity = (0.06 + 0.08 * dark) * pbr; this.fill.intensity = 0.3 + 0.22 * dark; this.k = TH.tier && TH.tier.hi() ? 1.5 : 1;
      TH.scene.fog.density = 0.016 + (1 - dark) * 0.045;
      this.base = { hemi: this.hemi.intensity, fog: TH.scene.fog.density };
      this.dark = dark;
    },
    update(dt, t) {
      const P = TH.Player, cp = P.camPos(), lv = P.level(), dark = this.dark || 1;
      // out on the deck or in the yard your eyes adjust to the moonlight: more sky light, less murk, you can see the neighbourhood
      if (this.base) { const r = TH.House.roomAt(P.pos.x, P.pos.z, lv), out = r && /deck|roof|yard|shed/.test(r.id) ? 1 : 0;
        this.out = (this.out || 0) + (out - (this.out || 0)) * Math.min(1, dt * 1.5);
        this.hemi.intensity = this.base.hemi * (1 + 1.6 * this.out); TH.scene.fog.density = this.base.fog * (1 - 0.55 * this.out); }
      const F = TH.House.fixtures;
      F.forEach((f) => {
        let k = f.power;
        if (f.candle) k *= 0.8 + Math.sin(t * 13 + f.x * 3) * 0.08 + Math.sin(t * 31 + f.z * 5) * 0.06 + Math.random() * 0.06; // candles gutter, they don't blink out
        else if (f.flicker) {
          if (f.dead > 0) { f.dead -= dt; k = 0.02; }
          else { k *= 0.85 + Math.sin(t * 23 + f.x) * 0.08 + Math.sin(t * 57 + f.z) * 0.07; if (Math.random() < dt * 0.35) f.dead = 0.08 + Math.random() * (Math.random() < 0.25 ? 1.8 : 0.3); }
        }
        f.cur = k * (f.moon ? 1 : 0.55 + 0.45 * dark);
        if (f.mat) { const q = Math.min(1, f.cur * (f.candle ? 1.6 : 1) + 0.12); if (f.candle) f.mat.color.setRGB(q, 0.62 * q, 0.28 * q); else f.mat.color.setRGB(q, 0.86 * q, 0.55 * q); }
        f.score = f.cur < 0.03 ? 999 : Math.hypot(f.x - cp.x, f.z - cp.z) + (f.level === lv ? 0 : 9) + (f.y - cp.y > 3.2 || cp.y - f.y > 3.2 ? 6 : 0);
      });
      const order = F.slice().sort((a, b) => a.score - b.score);
      this.pool.forEach((l, i) => {
        const f = order[i];
        if (!f || f.score >= 999) { l.intensity = 0; return; }
        l.position.set(f.x, f.y, f.z); l.distance = f.range || 13;
        if (l._c !== f.color) { l.color.setHex(f.color || 0xffd8a0); l._c = f.color; }
        l.intensity = 1.4 * f.cur * (this.k || 1);
      });
    },
  };
})();
