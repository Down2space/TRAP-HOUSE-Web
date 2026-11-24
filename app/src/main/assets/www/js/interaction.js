/* TRAP HOUSE — InteractionSystem. Look at something within reach, get a prompt, tap or hold to use it.
   TH.Interact.add({ x, z, level, r, prompt(), short?, check?(), hold?, cancelOnMove?, use(), inspect?() }) */
(function () {
  'use strict';
  const TH = window.TH;

  TH.Interact = {
    list: [], current: null, progress: 0, holding: false,
    add(o) { o.r = o.r || 1.8; this.list.push(o); return o; },
    remove(o) { if (!o) return; o.removed = true; this.list = this.list.filter((x) => x !== o); if (this.current === o) this.current = null; },
    clear() { this.list = []; this.current = null; },

    update(dt) {
      const P = TH.Player, I = TH.Input;
      if (!P.active || !P.canControl() || TH.state.hidden) { this.current = null; this.progress = 0; this.holding = false; TH.UI.setPrompt(null); return; }
      const f = P.forward(), lv = P.level();
      let best = null, bestScore = 1e9, bestLabel = null;
      for (const it of this.list) {
        if (it.removed || (it.level !== undefined && it.level !== lv)) continue;
        const dx = it.x - P.pos.x, dz = it.z - P.pos.z, d = Math.hypot(dx, dz);
        if (d > it.r) continue;
        const dot = d < 0.5 ? 1 : (dx * f.x + dz * f.z) / d;
        if (dot < 0.5) continue;
        let vert = 0;
        if (it.y !== undefined) { // vertical aim matters a little for wall/floor things (and picks the right drawer in a stack)
          const ang = Math.atan2(it.y - P.camPos().y, Math.max(0.3, d));
          vert = Math.abs(ang - P.pitch); if (vert > 0.95) continue;
        }
        const label = it.prompt(); if (!label) continue;
        const score = d * (1.7 - dot) + vert * 0.5 + (it.bias ? it.bias() : 0);
        if (score < bestScore) { bestScore = score; best = it; bestLabel = label; }
      }
      if (best !== this.current) { this.current = best; this.progress = 0; this.holding = false; }
      if (!best) { TH.UI.setPrompt(null); return; }

      const pressed = I.hit('KeyE') || I.hit('Interact');
      const held = I.interactDown;
      const blocked = best.check ? best.check() : null;
      if (blocked) {
        if (pressed) { TH.UI.toast(blocked); TH.Audio.play('deny'); if (best.onBlocked) best.onBlocked(); }
        this.progress = 0; this.holding = false;
      } else if (best.hold) {
        if (held && (this.holding || pressed)) {
          this.holding = true;
          if (best.cancelOnMove !== false && P.moveMag > 0.25) { if (this.progress > 0.08) TH.UI.toast('Interrupted'); this.progress = 0; this.holding = false; }
          else {
            this.progress += dt / best.hold;
            if (best.onTick) best.onTick(this.progress);
            if (this.progress >= 1) { this.progress = 0; this.holding = false; best.use(); }
          }
        } else { this.progress = 0; this.holding = false; }
      } else if (pressed) best.use();

      const short = typeof best.short === 'function' ? best.short() : best.short;
      TH.UI.setPrompt({ label: bestLabel, short: short || bestLabel, blocked, hold: !!best.hold, progress: this.progress });
    },
  };
})();
