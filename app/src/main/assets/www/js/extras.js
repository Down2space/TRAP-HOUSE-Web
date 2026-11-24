/* TRAP HOUSE — extras:
   - a randomised layout every run (key items move between surfaces, drawers and containers)
   - distractions: a pocket of rocks you can throw (they break windows), a wind-up radio that blares after a delay
     (the toilets already flush loud enough to pull him across the house)
   - the secret fourth way out: soak the front door in gas and put a match to it
   - an ending scene for every exit (the car keeps its own drive-out)
   - the death replay: when he catches you, watch the last few seconds from over his shoulder */
(function () {
  'use strict';
  const TH = window.TH, U = TH.util;
  const H = () => TH.House.H;
  const smooth = (u) => u * u * (3 - 2 * u);

  /* ---------- shared fire sprites ---------- */
  let flameTex = null, smokeTex = null;
  function texes() {
    if (flameTex) return;
    const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); return t; };
    flameTex = mk((g) => { const gr = g.createRadialGradient(32, 40, 2, 32, 34, 30); gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.25, 'rgba(255,190,70,.95)'); gr.addColorStop(0.6, 'rgba(230,80,20,.5)'); gr.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(32, 36, 20, 28, 0, 0, Math.PI * 2); g.fill(); });
    smokeTex = mk((g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(40,36,32,.7)'); gr.addColorStop(1, 'rgba(40,36,32,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  }
  // a burning patch: a cluster of flame sprites + rising smoke + a soft glow, sized by `size`
  function fireCluster(x, y, z, size, level) {
    texes();
    const g = new THREE.Group(); g.position.set(x, y, z); g.userData.dynamic = true; TH.scene.add(g);
    const n = Math.round(5 + size * 6), parts = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: flameTex, color: new THREE.Color().setHSL(0.05 + Math.random() * 0.05, 1, 0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 });
      m.userData.noPBR = true; const s = new THREE.Sprite(m);
      s.userData = { ox: (Math.random() - 0.5) * size, oz: (Math.random() - 0.5) * size * 0.5, ph: Math.random() * 6, sp: 1.5 + Math.random() * 2, sc: (0.35 + Math.random() * 0.45) * (0.6 + size * 0.5) };
      g.add(s); parts.push(s);
    }
    const smoke = [];
    for (let i = 0; i < Math.round(2 + size * 2); i++) { const m = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }); m.userData.noPBR = true; const s = new THREE.Sprite(m); s.userData = { ph: Math.random(), ox: (Math.random() - 0.5) * size }; g.add(s); smoke.push(s); }
    const gm = new THREE.SpriteMaterial({ map: flameTex, color: 0xff7a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }); gm.userData.noPBR = true;
    const glow = new THREE.Sprite(gm); glow.scale.set(size * 4 + 1.5, size * 3 + 1.2, 1); glow.position.y = 0.5; g.add(glow);
    return { g, parts, smoke, glow, size, level, x, y, z, t: 0, grow: 0 };
  }
  function animFire(f, dt) {
    f.t += dt; f.grow = Math.min(1, f.grow + dt * 0.6); const k = f.grow;
    f.parts.forEach((s) => { const u = s.userData, fl = 0.75 + 0.25 * Math.sin(f.t * u.sp * 6 + u.ph) + Math.random() * 0.1; s.position.set(u.ox, (0.15 + ((f.t * u.sp * 0.35 + u.ph) % 1) * 0.9) * (0.5 + f.size * 0.6) * k, u.oz); s.scale.set(u.sc * fl * k, u.sc * 1.6 * fl * k, 1); s.material.opacity = 0.9 * k * (1 - ((f.t * u.sp * 0.35 + u.ph) % 1) * 0.7); });
    f.smoke.forEach((s) => { const u = s.userData, q = (f.t * 0.18 + u.ph) % 1; s.position.set(u.ox + Math.sin(q * 4) * 0.2, 0.8 + q * (2 + f.size), 0); const sc = (0.6 + q * 1.8) * (0.5 + f.size * 0.4); s.scale.set(sc, sc, 1); s.material.opacity = 0.45 * k * Math.sin(q * Math.PI); });
    f.glow.material.opacity = (0.22 + Math.random() * 0.06) * k;
  }
  function killFire(f) { if (f && f.g.parent) f.g.parent.remove(f.g); }

  const X = (TH.Extras = {
    fires: [], fx: [], radio: null, burn: null,

    /* ===== called from Puzzles.setup after the standard placement: shuffle things further, add the new items ===== */
    // nudge every item spot onto the surface really under it (so nothing hovers or sinks into a tabletop)
    snapSpawns() {
      const Hs = TH.House; if (Hs._snapped) return; Hs._snapped = true;
      const solids = []; TH.scene.traverse((o) => { if (o.isMesh && o.visible && !(o.material && o.material.transparent)) solids.push(o); });
      const ray = new THREE.Raycaster(); ray.far = 0.3; let n = 0;
      Hs.spawnPoints.forEach((sp) => { ray.set(new THREE.Vector3(sp.x, sp.y + 0.1, sp.z), new THREE.Vector3(0, -1, 0)); const h = ray.intersectObjects(solids, false)[0]; if (h && h.point.y > sp.y - 0.13 && Math.abs(h.point.y - sp.y) > 0.004) { sp.y = h.point.y + 0.002; n++; } });
      return n;
    },
    setupRun() {
      const Hs = TH.House, I = TH.Items;
      // clean up last run
      this.fires.forEach(killFire); this.fires = []; this.fx.forEach((f) => f.m && f.m.parent && f.m.parent.remove(f.m)); this.fx = [];
      this.radio = null; this.burn = null; this.soaked = false; this.stuffed = false; if (this.paper) { this.paper.parent && this.paper.parent.remove(this.paper); this.paper = null; } TH.state.rocks = 0; this.throwCool = 0;
      (Hs.windows || []).forEach((w) => { w.broken = false; (w.panes || []).forEach((p) => (p.visible = true)); });
      (this.shards || []).forEach((s) => s.parent && s.parent.remove(s)); this.shards = [];
      const D = TH.Doors.front; if (D && D._leafMat) { D.leaf.material = D._leafMat; D._leafMat = null; }
      if (this.puddle) { this.puddle.parent && this.puddle.parent.remove(this.puddle); this.puddle = null; }

      const drawers = (TH.Openables ? TH.Openables.list : []).filter((o) => o.kind === 'drawer');
      const freeDrawer = (filter) => U.shuffle(drawers.filter((o) => !o.contents && (!filter || filter(o))))[0] || null;
      const lift = (id) => { const w = I.world.find((q) => q.id === id); if (!w) return false; TH.scene.remove(w.mesh); TH.Interact.remove(w.it); I.world = I.world.filter((q) => q !== w); return true; };
      const used = I.world.map((w) => ({ x: w.x, z: w.z, level: w.level }));
      const freeSpot = () => { const sp = U.shuffle(Hs.spawnPoints.slice()); return sp.find((s) => !used.some((u) => u.level === s.level && Math.hypot(u.x - s.x, u.z - s.z) < 0.5)) || sp[0]; };
      const layout = {};

      // car keys: on the desk, or tucked in a drawer in the office
      const inOffice = (o) => o.level === 1 && o.wx > 3 && o.wx < 9 && o.wz > 3 && o.wz < 12;
      const od = freeDrawer(inOffice);
      if (od && Math.random() < 0.5 && lift('car_keys')) { od.contents = { id: 'car_keys' }; layout.car_keys = 'office drawer'; } else layout.car_keys = 'office desk';
      // the screwdriver and spark plug sometimes hide in a drawer instead of sitting out
      ['screwdriver', 'spark_plug', 'crowbar'].forEach((id) => { if (Math.random() < 0.35) { const dr = freeDrawer(); if (dr && lift(id)) { dr.contents = { id }; layout[id] = 'drawer @' + dr.wx.toFixed(1) + ',' + dr.wz.toFixed(1) + ' L' + dr.level; } } });
      // matches: always in a drawer somewhere (the secret way out)
      const md = freeDrawer(); if (md) { md.contents = { id: 'matches' }; layout.matches = 'drawer @' + md.wx.toFixed(1) + ',' + md.wz.toFixed(1) + ' L' + md.level; } else { const s = freeSpot(); I.place('matches', s.x, s.y, s.z, s.level); used.push(s); layout.matches = s.where; }
      // the radio: out on a surface somewhere
      { const s = freeSpot(); I.place('radio', s.x, s.y, s.z, s.level); used.push(s); layout.radio = s.where; }
      // rocks: one handful out in the yard, one somewhere inside
      { const yard = U.pick([[-15.6, -24.2], [8.2, -25.4], [16.6, -25.2], [-6.5, -27.5], [12.5, -21.6], [-19.5, -15.2]]); I.place('rocks', yard[0], 0, yard[1], 0, { count: 3 }); layout.rocks1 = 'yard ' + yard; }
      { const s = freeSpot(); I.place('rocks', s.x, s.y, s.z, s.level, { count: 3 }); used.push(s); layout.rocks2 = s.where; }
      TH.state.layout = layout;
      this.register();
    },

    register() {
      const IS = TH.Interact, P = TH.Player, inv = TH.Inventory;
      // throwing a rock at whatever you're looking at
      IS.add({
        get x() { return P.pos.x; }, get z() { return P.pos.z; }, get level() { return P.level(); }, r: 1,
        prompt: () => { if (inv.heldId() !== 'rocks' || !(TH.state.rocks > 0) || this.throwCool > 0) return null; const h = this.aimRock(); return h && h.window && !h.window.broken ? 'THROW A ROCK AT THE WINDOW' : 'THROW A ROCK'; },
        short: 'THROW', bias: () => 0.45, use: () => this.throwRock(),
      });
      // winding the radio up and setting it down
      IS.add({
        get x() { return P.pos.x; }, get z() { return P.pos.z; }, get level() { return P.level(); }, r: 1, hold: 1.3,
        prompt: () => (inv.heldId() === 'radio' && !this.radio ? 'WIND THE RADIO AND SET IT DOWN' : null), short: 'WIND UP', bias: () => 0.5,
        onTick: () => { if (Math.random() < 0.12) TH.Audio.play('wind'); },
        use: () => this.setRadio(),
      });
      // the secret exit: gas on the front door, then a match
      const D = TH.Doors.front; if (!D) return;
      const fx = D.x, fz = D.z - 0.65; // just inside the door
      // 1) kindling: solid oak won't catch from gas alone
      IS.add({
        x: fx, z: fz, level: 0, y: 1.1, r: 2.0, hold: 1.5,
        prompt: () => (!this.burn && !this.stuffed && inv.heldId() === 'newspapers' ? 'STUFF NEWSPAPER UNDER THE DOOR' : null), short: 'STUFF', bias: () => -2,
        onTick: () => { if (Math.random() < 0.1) TH.Audio.play('dropSmall', { x: fx, y: 0.2, z: fz }, 5); },
        use: () => {
          inv.remove('newspapers'); this.stuffed = true; TH.Noise.emit(fx, fz, 0, 3, 'paper rustling');
          const pm = new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 1 }); pm.userData.noPBR = true; this.paper = new THREE.Group(); this.paper.userData.dynamic = true;
          for (let i = 0; i < 7; i++) { const w = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + Math.random() * 0.04, 0), pm); w.position.set((i - 3) * 0.13 + (Math.random() - 0.5) * 0.05, 0.05, (Math.random() - 0.5) * 0.08); w.scale.set(1.3, 0.6, 1); w.rotation.set(Math.random() * 3, Math.random() * 3, 0); this.paper.add(w); }
          this.paper.position.set(D.x, 0, D.z - 0.12); TH.scene.add(this.paper); TH.Linear.fix(this.paper);
          TH.UI.toast(this.soaked ? 'Paper under the door, soaked in gas. Light it.' : 'Paper stuffed under the door. It needs gasoline now.'); TH.Bus.emit('fire', 'stuffed');
        },
      });
      // 2) the gas
      IS.add({
        x: fx, z: fz, level: 0, y: 1.1, r: 2.0, hold: 2.2,
        prompt: () => (!this.burn && !this.soaked && inv.heldId() === 'gas_can' ? 'SOAK THE DOOR IN GASOLINE' : null), short: 'POUR', bias: () => -2,
        onTick: () => { if (Math.random() < 0.15) TH.Audio.play('dropWood', { x: fx, y: 0.3, z: fz }, 8); },
        use: () => {
          inv.remove('gas_can'); this.soaked = true; TH.Noise.emit(fx, fz, 0, 6, 'liquid splashing');
          const pm = new THREE.MeshBasicMaterial({ color: 0x1a140c, transparent: true, opacity: 0.55, depthWrite: false }); pm.userData.noPBR = true;
          this.puddle = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), pm); this.puddle.rotation.x = -Math.PI / 2; this.puddle.position.set(D.x, 0.012, D.z - 0.5); this.puddle.scale.set(1.2, 0.8, 1); TH.scene.add(this.puddle);
          TH.UI.toast(!this.stuffed ? 'The door reeks of gas. Solid oak, though: it needs kindling.' : inv.has('matches') ? 'The door reeks of gas. Light it.' : 'The door reeks of gas. Now you need a flame.'); TH.Bus.emit('fire', 'soaked');
        },
      });
      IS.add({
        x: fx, z: fz, level: 0, y: 1.1, r: 2.0,
        // 3) the match (paper and gas both, or it won't take)
        prompt: () => (this.soaked && !this.burn && !(inv.heldId() === 'newspapers' && !this.stuffed) ? (inv.has('matches') ? 'STRIKE A MATCH' : 'GAS-SOAKED DOOR') : null), short: 'LIGHT', bias: () => -2,
        check: () => (!inv.has('matches') ? 'YOU NEED SOMETHING TO LIGHT IT' : !this.stuffed ? 'IT WON’T CATCH · solid oak. Stuff something that burns under it first' : null),
        use: () => this.ignite(),
      });
      IS.add({
        x: fx, z: fz, level: 0, y: 1.1, r: 2.2,
        prompt: () => (this.burn && this.burn.through ? 'RUN THROUGH THE FLAMES' : null), short: 'RUN', bias: () => -3,
        use: () => TH.Game.escape('fire'),
      });
    },

    /* ---------- rocks ---------- */
    rayHit() {
      const P = TH.Player, cp = P.camPos(), f = { x: -Math.sin(P.yaw) * Math.cos(P.pitch), y: Math.sin(P.pitch), z: -Math.cos(P.yaw) * Math.cos(P.pitch) };
      const C = TH.Col, Hh = H(), lv0 = P.level(), wins = TH.House.windows || [];
      const inHouse = (x, z) => x > -16.2 && x < 16.2 && z > -12.2 && z < 12.2;
      let last = { x: cp.x, y: cp.y, z: cp.z };
      for (let d = 0.3; d <= 17; d += 0.08) {
        const p = { x: cp.x + f.x * d, y: cp.y + f.y * d - d * d * 0.004, z: cp.z + f.z * d }; // a gentle arc
        for (const w of wins) {
          const nx = Math.sin(w.ry), nz = Math.cos(w.ry), cx = w.x - nx * 0.1, cz = w.z - nz * 0.1, dx = p.x - cx, dz = p.z - cz;
          if (Math.abs(dx * nx + dz * nz) < 0.15 && Math.abs(dx * nz - dz * nx) < w.w / 2 && Math.abs(p.y - w.y) < w.h / 2) { if (!w.broken) return { x: p.x, y: p.y, z: p.z, window: w, d }; }
        }
        const floorY = lv0 * Hh;
        if (inHouse(p.x, p.z) && p.y < floorY + 0.02) return { x: p.x, y: floorY, z: p.z, level: lv0, d };
        if (p.y < (lv0 < 0 ? lv0 * Hh : 0) + 0.02 && !inHouse(p.x, p.z)) return { x: p.x, y: 0, z: p.z, level: 0, d };
        const lv = U.clamp(Math.floor((p.y + 0.01) / Hh), -1, 1);
        if (inHouse(p.x, p.z) && p.y > (lv0 + 1) * Hh - 0.15) return { x: last.x, y: lv0 * Hh, z: last.z, level: lv0, d }; // ceiling
        for (const b of C.boxes[lv] || []) if (!b.off && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && (Math.min(b.x1 - b.x0, b.z1 - b.z0) < 0.5 || p.y - lv * Hh < 1.0)) return { x: last.x, y: lv * Hh, z: last.z, level: lv, d };
        last = p;
      }
      const lv = U.clamp(Math.floor((last.y + 0.01) / Hh), -1, 1);
      return { x: last.x, y: inHouse(last.x, last.z) ? lv0 * Hh : 0, z: last.z, level: inHouse(last.x, last.z) ? lv0 : 0, d: 17 };
    },
    aimRock() { return this.rayHit(); },
    throwRock() {
      const P = TH.Player, hit = this.rayHit(); if (!hit) return;
      TH.state.rocks--; this.throwCool = 0.6; TH.Audio.play('rockThrow');
      if (TH.state.rocks <= 0) { TH.Inventory.remove('rocks'); TH.UI.toast('That was your last rock'); }
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.035), new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.9 }));
      const a = P.camPos().clone().add(new THREE.Vector3(Math.cos(P.yaw) * 0.15, -0.15, -Math.sin(P.yaw) * 0.15)), b = new THREE.Vector3(hit.x, hit.window ? hit.y : hit.y + 0.04, hit.z);
      m.position.copy(a); TH.scene.add(m);
      this.fx.push({ t: 0, dur: Math.max(0.12, a.distanceTo(b) / 16), m, a, b, arc: Math.min(0.6, a.distanceTo(b) * 0.04), done: () => this.rockLands(hit) });
    },
    rockLands(hit) {
      if (hit.window) { this.breakWindow(hit.window); return; }
      TH.Audio.play('dropSmall', { x: hit.x, y: hit.y + 0.1, z: hit.z, level: hit.level }, 26); TH.Audio.play('thwack', { x: hit.x, y: hit.y + 0.1, z: hit.z, level: hit.level }, 26);
      TH.Noise.emit(hit.x, hit.z, hit.level, 30, 'something clattering');
    },
    breakWindow(w) {
      w.broken = true; (w.panes || []).forEach((p) => (p.visible = false));
      const nx = Math.sin(w.ry), nz = Math.cos(w.ry), ix = w.x + nx * 0.6, iz = w.z + nz * 0.6, fy = w.level * H();
      TH.Audio.play('glass', { x: w.x, y: w.y, z: w.z, level: w.level }, 50);
      TH.Noise.emit(ix, iz, w.level, 72, 'a window shattering');
      const P = TH.Player; TH.UI.toast(P.level() === w.level && Math.hypot(P.pos.x - w.x, P.pos.z - w.z) < 8 ? 'The window explodes. He heard that.' : 'Glass shatters somewhere in the house.');
      // shards on the sill and the floor inside
      const gm = new THREE.MeshStandardMaterial({ color: 0xc8d8e0, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false });
      for (let i = 0; i < 16; i++) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(0.04 + Math.random() * 0.07, 0.03 + Math.random() * 0.05), gm);
        const r = Math.random() * 1.4, sp = (Math.random() - 0.5) * w.w * 1.4; s.rotation.set(-Math.PI / 2, 0, Math.random() * 6);
        s.position.set(w.x + nx * (0.15 + r) + nz * sp, fy + 0.008, w.z + nz * (0.15 + r) - nx * sp); s.userData.dynamic = true; TH.scene.add(s); this.shards.push(s);
      }
      TH._dirty = true; TH.Bus.emit('windowBroken', w);
    },

    /* ---------- the radio ---------- */
    setRadio() {
      const P = TH.Player, inv = TH.Inventory, f = P.forward(), lv = P.level();
      inv.remove('radio');
      const p = { x: P.pos.x + f.x * 0.6, z: P.pos.z + f.z * 0.6 }; TH.Col.resolve(p, 0.15, lv * H());
      const w = TH.Items.place('radio', p.x, TH.Col.groundY(p.x, p.z, lv * H()), p.z, lv);
      this.radio = { w, x: p.x, z: p.z, level: lv, t: -4.5, n: 0, beat: 0, pulse: 0 };
      TH.UI.toast('Wound up. It’ll start blaring in a few seconds. Move.');
    },
    TUNE: [392, 440, 494, 523, 494, 440, 392, 330, 349, 392, 440, 392, 349, 330, 294, 330],
    updateRadio(dt) {
      const r = this.radio; if (!r) return;
      if (!TH.Items.world.includes(r.w)) { if (r.t > 0) TH.UI.toast('Radio off'); this.radio = null; return; } // you picked it back up
      r.t += dt; if (r.t < 0) { if ((r.tick = (r.tick || 0) + dt) > 0.5) { r.tick = 0; TH.Audio.play('handle', { x: r.x, y: r.level * H() + 0.2, z: r.z, quiet: true }, 4); } return; }
      if (r.t > 22) { this.radio = null; TH.Audio.play('static', { x: r.x, y: r.level * H() + 0.2, z: r.z }, 20); return; } // wound down
      r.beat -= dt; if (r.beat <= 0) { r.beat = 0.24; TH.Audio.play('radio', { x: r.x, y: r.level * H() + 0.2, z: r.z, level: r.level, note: this.TUNE[r.n++ % this.TUNE.length] * (Math.random() < 0.1 ? 0.97 : 1) }, 40); }
      r.pulse -= dt; if (r.pulse <= 0) { r.pulse = 1.4; TH.Noise.emit(r.x, r.z, r.level, 52, 'a radio blaring'); }
      if (r.w.mesh) r.w.mesh.position.y += Math.sin(r.t * 40) * 0.0008; // rattles on the floor
      const E = TH.Enemy; // he finds it: one stomp and it's done
      if (E.active && !(E.stunT > 0) && E.level() === r.level && Math.hypot(E.pos.x - r.x, E.pos.z - r.z) < 1.3) {
        TH.scene.remove(r.w.mesh); TH.Interact.remove(r.w.it); TH.Items.world = TH.Items.world.filter((q) => q !== r.w);
        TH.Audio.play('thwack', { x: r.x, y: r.level * H() + 0.2, z: r.z, level: r.level }, 30); TH.Audio.play('dropMetal', { x: r.x, y: r.level * H() + 0.2, z: r.z, level: r.level }, 30);
        this.radio = null; TH.UI.toast('The music cuts off mid-note.'); TH.Bus.emit('radioSmashed');
      }
    },

    /* ---------- the fire ---------- */
    ignite() {
      const D = TH.Doors.front; this.soaked = false; if (this.paper) this.paper.visible = false; // the paper goes up first
      TH.Audio.play('whoosh', { x: D.x, y: 1, z: D.z }, 40); TH.Noise.emit(D.x, D.z, 0, 70, 'a roar of flames');
      this.burn = { t: 0, through: false, spread: 0, tick: 0 };
      this.fires.push(fireCluster(D.x, 0.05, D.z - 0.25, 1.2, 0), fireCluster(D.x - 0.3, 1.0, D.z - 0.1, 0.6, 0), fireCluster(D.x + 0.3, 1.3, D.z - 0.1, 0.6, 0));
      if (this.puddle) this.puddle.material.color.setHex(0x050302);
      TH.UI.toast('WHOOMPH. The door goes up. Stand back.'); TH.Bus.emit('fire', 'lit');
    },
    updateBurn(dt) {
      const b = this.burn; if (!b) return; b.t += dt; const D = TH.Doors.front;
      b.tick -= dt; if (b.tick <= 0) { b.tick = 0.14; TH.Audio.play('fire', { x: D.x, y: 1, z: D.z - 0.3 }, 30); }
      if ((b.noiseT = (b.noiseT || 0) - dt) <= 0) { b.noiseT = 2.5; TH.Noise.emit(D.x, D.z - 0.5, 0, 55, 'something burning'); }
      // the door chars black as it burns
      if (!D._leafMat) { D._leafMat = D.leaf.material; D.leaf.material = D._leafMat.clone(); }
      const k = Math.min(1, b.t / 7); D.leaf.material.color.setRGB(0.8 * (1 - k) + 0.05 * k, 0.75 * (1 - k) + 0.03 * k, 0.7 * (1 - k) + 0.02 * k);
      if (!b.through && b.t > 7) { // burnt through: every lock drops off, what's left of the door swings in
        b.through = true;
        Object.values(D.lockMeshes).forEach((m) => m && m.parent && TH.Doors.drop(m)); D.locks = [];
        TH.Doors.setOpen(D, true, { x: D.x, z: D.z + 2 }, true); TH.Audio.play('frame', { x: D.x, y: 1, z: D.z }, 30);
        TH.UI.toast('The door burns through. GO — through the flames!'); TH.Bus.emit('fire', 'through');
      }
      // and it spreads into the house
      if (b.t > 3 && (b.spread -= dt) <= 0 && this.fires.length < 9) {
        b.spread = 2.5;
        for (let k = 0; k < 8; k++) { const a = Math.random() * Math.PI - Math.PI, r = 1.2 + Math.random() * (1 + this.fires.length * 0.5);
          const p = { x: D.x + Math.cos(a) * r, z: D.z - 0.8 + Math.sin(a) * r * 0.8 }; if (TH.Col.walkable(D.x, D.z - 0.8, p.x, p.z, 0, 0.1)) { this.fires.push(fireCluster(p.x, 0.05, p.z, 0.5 + Math.random() * 0.5, 0)); break; } }
      }
    },

    update(dt, t) {
      if (this.throwCool > 0) this.throwCool -= dt;
      this.fx = this.fx.filter((f) => {
        f.t += dt; const k = Math.min(1, f.t / f.dur); f.m.position.lerpVectors(f.a, f.b, k); f.m.position.y += Math.sin(k * Math.PI) * f.arc; f.m.rotation.x += dt * 12;
        if (k >= 1) { TH.scene.remove(f.m); f.done(); return false; } return true;
      });
      if (TH.state.mode === 'play' && !TH.state.caught) { this.updateRadio(dt); this.updateBurn(dt); }
      this.fires.forEach((f) => animFire(f, dt));
      TH.Endings.update(dt, t);
      TH.Replay.update(dt, t);
    },
  });
  X.animFire = animFire;
  // the player's 3D scan for the cameras and the death replay; until it arrives (or if it can't) the hand-built figure stands in
  /* Your 3D scan for the kill cam and the security tapes. It loads in the background (it's about 1.7 MB); if the network drops it
     tries again, and the status shows at the bottom of Settings so a missing body can be traced. */
  TH.Avatar = { ready: false, mesh: null, status: 'loading', tries: 0 };
  const avStatus = (t) => { TH.Avatar.status = t; const el = document.getElementById('s-body'); if (el) el.textContent = 'Your body scan: ' + t; };
  const loadAvatar = () => {
    if (!THREE.GLTFLoader) { avStatus('loader missing'); return; }
    TH.Avatar.tries++; avStatus(TH.Avatar.tries > 1 ? 'loading (try ' + TH.Avatar.tries + ')' : 'loading');
    new THREE.GLTFLoader().load('models/dylan.json', (gl) => {
      gl.scene.traverse((o) => { if (o.isMesh && !TH.Avatar.mesh) TH.Avatar.mesh = o; });
      if (!TH.Avatar.mesh) { avStatus('file had no body in it'); return; }
      TH.Avatar.ready = true; avStatus('loaded');
      const R = TH.Replay; if (R.man && !R.man.rig && !R.man.g.visible) { TH.scene.remove(R.man.g); R.man = null; } // swap the stand-in out next time it's needed
    }, undefined, (e) => { avStatus('failed (' + ((e && (e.message || e.type)) || 'network') + ')'); if (TH.Avatar.tries < 4) setTimeout(loadAvatar, 3000 * TH.Avatar.tries); });
  };
  loadAvatar();

  // rocks come by the handful: picking up adds to your pocket, dropping puts the whole pocket down
  const take0 = TH.Items.take.bind(TH.Items);
  TH.Items.take = function (w) {
    if (w.id !== 'rocks') return take0(w);
    const had = TH.Inventory.has('rocks'); take0(w);
    if (had) { TH.Inventory.remove('rocks'); TH.Inventory.select(TH.Inventory.items.indexOf('rocks')); }
    TH.state.rocks = (TH.state.rocks || 0) + ((w.extra && w.extra.count) || 3);
    TH.UI.toast(`${TH.state.rocks} rocks · hold them and aim: they break windows`);
  };
  const drop0 = TH.Inventory.drop.bind(TH.Inventory);
  TH.Inventory.drop = function (silent) {
    if (this.heldId() !== 'rocks') return drop0(silent);
    const n = TH.state.rocks || 0; this.remove('rocks'); TH.state.rocks = 0;
    const P = TH.Player, f = P.forward(), lv = P.level(), p = { x: P.pos.x + f.x * 0.6, z: P.pos.z + f.z * 0.6 }; TH.Col.resolve(p, 0.15, lv * H());
    if (n > 0) TH.Items.place('rocks', p.x, TH.Col.groundY(p.x, p.z, lv * H()), p.z, lv, { count: n });
    if (!silent) { TH.Audio.play('dropSmall'); TH.Noise.emit(p.x, p.z, lv, 20, 'rocks rattling'); }
  };

  /* ======================= ENDING SCENES ======================= */
  TH.Endings = {
    cine: null,
    has(route) { return route === 'door' || route === 'gate' || route === 'fire'; },
    play(route, done) {
      const P = TH.Player, cam = TH.camera, D = TH.Doors.front, pi = Math.PI;
      TH.state.cinematic = true; TH.Input.unlock(); TH.Audio.setChase(false);
      ['hud', 'mobile', 'touch-layer', 'hidden-ov'].forEach((k) => { const e = document.getElementById(k); if (e) e.hidden = true; }); document.getElementById('chase').classList.remove('on');
      const k0 = { t: 0, x: cam.position.x, y: cam.position.y, z: cam.position.z, yaw: P.yaw, pitch: P.pitch };
      let keys, len;
      if (route === 'door') { keys = [k0, { t: 1.2, x: D.x, y: 1.62, z: D.z - 0.5, yaw: pi, pitch: 0 }, { t: 2.6, x: D.x, y: 1.62, z: D.z + 1.4, yaw: pi, pitch: 0.02 }, { t: 5.2, x: D.x + 0.2, y: 1.66, z: D.z + 6.5, yaw: pi + 0.08, pitch: 0.05 }, { t: 7.5, x: D.x + 0.6, y: 1.68, z: D.z + 10.5, yaw: pi + 0.2, pitch: 0.08 }]; len = 7.5; }
      else if (route === 'gate') { const g = TH.Grounds.gate; keys = [k0, { t: 1.3, x: g.x, y: 1.6, z: g.z + 0.6, yaw: 0, pitch: 0 }, { t: 2.6, x: g.x, y: 1.6, z: g.z - 1.0, yaw: 0, pitch: 0 }, { t: 3.6, x: g.x - 0.4, y: 1.6, z: g.z - 1.05, yaw: pi / 2, pitch: 0 }, { t: 7.5, x: g.x - 12, y: 1.62, z: g.z - 1.05, yaw: pi / 2 + 0.05, pitch: 0.04 }]; len = 7.5; }
      else { keys = [k0, { t: 1.0, x: D.x, y: 1.6, z: D.z - 0.4, yaw: pi, pitch: 0 }, { t: 2.0, x: D.x, y: 1.6, z: D.z + 1.2, yaw: pi, pitch: 0 }, { t: 4.0, x: D.x + 0.3, y: 1.62, z: D.z + 6.5, yaw: pi, pitch: 0 }, { t: 5.6, x: D.x + 0.6, y: 1.55, z: D.z + 9.5, yaw: 0.05, pitch: 0.16 }, { t: 11, x: D.x + 0.9, y: 1.5, z: D.z + 11, yaw: 0.06, pitch: 0.19 }]; len = 11; }
      this.cine = { route, t: 0, keys, len, done, lit: 0 };
      if (route === 'fire') { this.cine.winds = U.shuffle((TH.House.windows || []).filter((w) => w.z > 11 && w.level >= 0)); }
      TH.state.endingRoute = route;
    },
    update(dt, t) {
      const c = this.cine; if (!c) return; c.t += dt;
      const cam = TH.camera, ks = c.keys; let i = 0; while (i < ks.length - 2 && c.t > ks[i + 1].t) i++;
      const a = ks[i], b = ks[i + 1], u = smooth(U.clamp((c.t - a.t) / Math.max(0.01, b.t - a.t), 0, 1)), L = (p, q) => p + (q - p) * u;
      const bob = c.t < c.len - 1 ? Math.sin(c.t * 9) * 0.025 : 0;
      cam.position.set(L(a.x, b.x), L(a.y, b.y) + bob, L(a.z, b.z)); cam.rotation.set(L(a.pitch, b.pitch), U.angleLerp(a.yaw, b.yaw, u), 0);
      if (c.route !== 'fire' && (c.st = (c.st || 0) - dt) <= 0 && c.t < c.len - 1) { c.st = 0.42; TH.Audio.play('run'); }
      if (c.route === 'fire') {
        const D = TH.Doors.front, E = TH.Enemy;
        if ((c.ft = (c.ft || 0) - dt) <= 0) { c.ft = 0.1; TH.Audio.play('fire', null); }
        // the whole front of the house catches, window by window, then the roof
        while (c.lit < c.winds.length && c.t > 1.5 + c.lit * 0.45) { const w = c.winds[c.lit++]; X.fires.push(fireCluster(w.x, w.y - w.h * 0.4, w.z + 0.3, 0.9, w.level)); }
        if (c.t > 4.5 && !c.roof) { c.roof = true; for (let x = -14; x <= 14; x += 4) X.fires.push(fireCluster(x + Math.random(), 2 * H() + 0.6 + Math.random() * 0.8, 11 + Math.random(), 1.6, 1)); TH.Audio.play('whoosh', null); }
        if (c.t > 5.2 && !c.tim) { c.tim = true; E.pos.set(D.x, 0, D.z - 0.3); E.y = 0; E.face = 0; E.state = 'patrol'; E.model.root.visible = true; } // a shape in the burning doorway…
        if (c.t > 9.0 && !c.gone) { c.gone = true; E.pos.set(D.x, 0, D.z - 4); }                                      // …and then it's gone
      }
      if (c.t > c.len - 0.9 && !c.fade) { c.fade = true; document.getElementById('fade').classList.add('on'); }
      if (c.t >= c.len) { this.cine = null; const done = c.done; setTimeout(() => document.getElementById('fade').classList.remove('on'), 700); done(); }
    },
  };

  /* What your hands are doing, for the cameras: opening a door, picking something up, working at something. */
  TH.Act = {
    k: null, t0: 0, clock: () => performance.now() / 1000,
    set(k) { this.k = k; this.t0 = this.clock(); },
    now() {
      const I = TH.Interact, P = TH.Player;
      if (I && I.holding && I.progress > 0 && I.current) { const low = I.current.y != null && I.current.y - P.y < 0.85; return { k: low ? 'workLow' : 'work', t: I.progress * (I.current.hold || 1) }; }
      const t = this.clock() - this.t0, D = TH.Replay.ACT[this.k] || 0;
      return this.k && t < D ? { k: this.k, t } : { k: null, t: 0 };
    },
  };
  {
    const D = TH.Doors, so = D.setOpen.bind(D);
    D.setOpen = function (d, open, opener, silent) { if (opener && opener === TH.Player) TH.Act.set('door'); return so(d, open, opener, silent); };
    const IA = TH.Interact, add0 = IA.add.bind(IA);
    IA.add = function (o) { if (o && o.use && !o.hide) { const u = o.use; o.use = function () { const P = TH.Player; if (!o.hold) TH.Act.set(o.y != null && P && o.y - P.y < 0.7 ? 'pickLow' : 'use'); return u.apply(this, arguments); }; } return add0(o); };
    const tk = TH.Items.take; TH.Items.take = function (w) { const P = TH.Player; if (w && w.mesh && P && w.id !== 'note') TH.Act.set(w.mesh.position.y - P.y < 0.55 ? 'pickLow' : 'pick'); return tk.apply(this, arguments); };
    const dr = TH.Inventory.drop.bind(TH.Inventory); TH.Inventory.drop = function (silent) { if (!silent && TH.Inventory.heldId()) TH.Act.set('drop'); return dr(silent); };
  }

  /* ======================= DEATH REPLAY ======================= */
  TH.Replay = {
    buf: [], acc: 0, cur: null, man: null,
    record(dt) {
      const st = TH.state; if (st.mode !== 'play' || st.caught || st.cinematic || this.cur) return;
      this.gt = (this.gt || 0) + dt; this.acc += dt; if (this.acc < 1 / 15) return; this.acc = 0;
      const P = TH.Player, E = TH.Enemy, now = this.gt; // game time, so slow frames replay at the right speed
      const A = TH.Act.now(); this.buf.push({ t: now, px: P.pos.x, pz: P.pos.z, py: P.y, yaw: P.yaw, crouch: !!P.crouch, hid: !!st.hidden, pt: P.pitch, hd: TH.Inventory.heldId(), ak: A.k, aT: A.t, ex: E.pos.x, ez: E.pos.z, ey: E.y, face: E.face, sp: E.speed || 0, st: E.state, on: !!E.active });
      while (this.buf.length && now - this.buf[0].t > 5.5) this.buf.shift();
    },
    // a stand-in for you: hoodie, jeans, sneakers
    // You, as the cameras see you. Built from the player's photos: the curly brown mop with blonde ends and the little braid
    // by the left ear, blue-grey eyes, light stubble, nose ring and black ear studs, the iced-out chain with the spider
    // pendant, black pants and black creepers with the checkered strap. From the elbows down it matches the first-person
    // hands (same skin, the charcoal hoodie with the sleeves shoved up, the same bracelets and rings). Faces -z.
    build() { return TH.Avatar && TH.Avatar.ready ? this.buildScan() : this.buildBlocky(); },
    // The 3D scan of the player (models/dylan.json), rigged here on load. The scan is one solid mesh standing in a T-pose, so the
    // skeleton is measured off the mesh itself (where the knees, ankles, elbows and wrists actually are) and every vertex is
    // weighted to the bones nearest it inside its own body part, so joints bend smoothly instead of folding.
    // 21 bones: 0 hips, 1 spine, 2 chest, 3 neck, 4 head, 5/6 L/R collarbone, 7/8 upper arm, 9/10 forearm, 11/12 hand,
    //           13/14 thigh, 15/16 shin, 17/18 foot, 19/20 toes (tip markers only)
    buildScan() {
      const src = TH.Avatar.mesh, geo = src.geometry.clone(), P = geo.attributes.position, n = P.count;
      geo.computeBoundingBox(); const H = geo.boundingBox.max.y, span = geo.boundingBox.max.x, k = H / 1.78;
      const ys = (f) => { let lo = 1e9, hi = -1e9, sum = 0, c = 0; for (let i = 0; i < n; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (f(x, y, z)) { lo = Math.min(lo, y); hi = Math.max(hi, y); sum += y; c++; } } return { lo, hi, avg: c ? sum / c : 0, c }; };
      const cen = (f) => { let sx = 0, sy = 0, sz = 0, c = 0; for (let i = 0; i < n; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (f(x, y, z)) { sx += x; sy += y; sz += z; c++; } } return c ? { x: sx / c, y: sy / c, z: sz / c, c } : null; };
      const armY = ys((x) => Math.abs(x) > span * 0.7).avg;
      const crotch = ys((x, y) => Math.abs(x) < 0.02 && y > H * 0.3 && y < H * 0.62).lo;
      let tw = 0; for (let i = 0; i < n; i++) { const y = P.getY(i); if (Math.abs(y - (armY - 0.17)) < 0.02) tw = Math.max(tw, Math.abs(P.getX(i))); }
      const hipY = crotch + 0.06 * k, kneeY = 0.28 * H, ankY = 0.085 * H, waistY = crotch + 0.2 * k, chestY = armY - 0.2 * k, neckY = armY + 0.06 * k, headY = armY + 0.17 * k;
      const shX = tw + 0.015 * k, shY = armY - 0.015 * k, elX = tw + 0.26 * k /* the elbow is measured from the ribs, not the shoulder joint, so moving the shoulder out does not shorten the forearm */, wrX = span - 0.185 * k, clX = 0.06 * k;
      // measured joint centres (right side; the left is mirrored)
      const legBand = (y0, y1) => cen((x, y) => x > 0.03 * k && y > y0 && y < y1) || { x: 0.12 * k, z: 0 };
      const hipC = legBand(crotch - 0.2 * k, crotch - 0.1 * k), kneeC = legBand(kneeY - 0.03 * k, kneeY + 0.03 * k), ankC = legBand(ankY + 0.03 * k, ankY + 0.08 * k);
      let toeZ = 0; for (let i = 0; i < n; i++) if (P.getY(i) < 0.06 * k && P.getX(i) > 0.03 * k) toeZ = Math.min(toeZ, P.getZ(i));
      const armBand = (x0, x1) => cen((x, y) => x > x0 && x < x1 && y > armY - 0.2 * k) || { y: shY, z: 0 };
      const elC = armBand(elX - 0.03 * k, elX + 0.03 * k), wrC = armBand(wrX - 0.03 * k, wrX + 0.02 * k);
      const J = [ // [x, y, z] of each bone's joint (right side positive x)
        [0, hipY, 0], [0, waistY, 0], [0, chestY, 0], [0, neckY, 0], [0, headY, 0],
        [-clX, shY, 0], [clX, shY, 0], [-shX, shY, 0], [shX, shY, 0], [-elX, elC.y, elC.z], [elX, elC.y, elC.z], [-wrX, wrC.y, wrC.z], [wrX, wrC.y, wrC.z],
        [-hipC.x, hipY, hipC.z], [hipC.x, hipY, hipC.z], [-kneeC.x, kneeY, kneeC.z], [kneeC.x, kneeY, kneeC.z], [-ankC.x, ankY, ankC.z], [ankC.x, ankY, ankC.z],
        [-ankC.x, 0.03 * k, toeZ + 0.03 * k], [ankC.x, 0.03 * k, toeZ + 0.03 * k],
      ];
      const parent = [-1, 0, 1, 2, 3, 2, 2, 5, 6, 7, 8, 9, 10, 0, 0, 13, 14, 15, 16, 17, 18];
      // extra trunk and foot joints (bones 55+): a second spine joint, an upper chest the collarbones hang from, a second neck joint,
      // the balls of the feet (toes bend there), and a ribcage that breathes
      const sp2Y = (waistY + chestY) / 2, ucY = armY - 0.08 * k, nk2Y = (neckY + headY) / 2, ballZ = ankC.z + (toeZ - ankC.z) * 0.62;
      // ---- the hands: find each finger and the thumb on the scan (T-pose, palms down, thumbs hanging forward-down)
      const HAND = [-1, 1].map((sd) => {
        const mcpX = wrX + 0.1 * k, wv = [];
        for (let i = 0; i < n; i++) { const ax = P.getX(i) * sd; if (ax > wrX - 0.01 * k) wv.push([ax, P.getY(i), P.getZ(i)]); }
        const palm = wv.filter((v) => v[0] > wrX + 0.03 * k && v[0] < mcpX), palmY = palm.reduce((a, v) => a + v[1], 0) / Math.max(1, palm.length);
        // fingertips side by side across z: 4 groups (index at the front, next to the thumb, out to the pinky at the back)
        const tipz = wv.filter((v) => v[0] > mcpX + 0.025 * k && v[1] > palmY - 0.03 * k).map((v) => v[2]).sort((a, b) => a - b);
        let C = [0.125, 0.375, 0.625, 0.875].map((q) => tipz[Math.floor(q * (tipz.length - 1))] || 0);
        for (let it = 0; it < 12; it++) { const S = [0, 0, 0, 0], N = [0, 0, 0, 0]; tipz.forEach((z) => { let b = 0; C.forEach((c, j) => { if (Math.abs(z - c) < Math.abs(z - C[b])) b = j; }); S[b] += z; N[b]++; }); C = C.map((c, j) => (N[j] ? S[j] / N[j] : c)); }
        C.sort((a, b) => a - b);
        const zcut = [(C[0] + C[1]) / 2, (C[1] + C[2]) / 2, (C[2] + C[3]) / 2];
        const fingerOf = (z) => (z < zcut[0] ? 0 : z < zcut[1] ? 1 : z < zcut[2] ? 2 : 3);
        const fingers = C.map((cz, f) => { const mine = wv.filter((v) => v[0] > mcpX && fingerOf(v[2]) === f && v[1] > palmY - 0.03 * k); const tip = Math.max(mcpX + 0.05 * k, ...mine.map((v) => v[0])); const cy = mine.length ? mine.reduce((a, v) => a + v[1], 0) / mine.length : palmY; const L = tip - mcpX; return { z: cz, y: cy, mcp: mcpX, pip: mcpX + 0.45 * L, dip: mcpX + 0.74 * L, tip }; });
        // the thumb: below the palm, in front of the index finger
        const tv = wv.filter((v) => v[0] < mcpX + 0.01 * k && v[1] < palmY - 0.015 * k && v[2] < C[0] + 0.012 * k);
        const cmc = [wrX + 0.022 * k, palmY - 0.008 * k, C[0] + 0.03 * k]; let tip = [wrX + 0.07 * k, palmY - 0.05 * k, C[0] - 0.03 * k], best = 0;
        tv.forEach((v) => { const d = Math.hypot(v[0] - cmc[0], v[1] - cmc[1], v[2] - cmc[2]); if (d > best) { best = d; tip = v; } });
        const lerp3 = (a, b, u) => a.map((x, i) => x + (b[i] - x) * u);
        return { sd, mcpX, palmY, zcut, fingerOf, fingers, thumb: { cmc, mcp: lerp3(cmc, tip, 0.42), ip: lerp3(cmc, tip, 0.72), tip }, zIndex: C[0] };
      });
      // each bone's segment runs from its joint to where it ends (its child's joint, or the fingertips / top of the head)
      const END = { 0: J[1], 1: J[2], 2: J[3], 3: J[4], 4: [0, H, 0], 5: J[7], 6: J[8], 7: J[9], 8: J[10], 9: J[11], 10: J[12], 11: [-span, wrC.y, wrC.z], 12: [span, wrC.y, wrC.z], 13: J[15], 14: J[16], 15: J[17], 16: J[18], 17: J[19], 18: J[20] };
      const seg = (b) => [J[b], END[b]];
      const dSeg = (px, py, pz, b) => { const [a, e] = seg(b), ex = e[0] - a[0], ey = e[1] - a[1], ez = e[2] - a[2], L2 = ex * ex + ey * ey + ez * ez || 1e-6; let t = ((px - a[0]) * ex + (py - a[1]) * ey + (pz - a[2]) * ez) / L2; t = Math.max(0, Math.min(1, t)); const dx = px - a[0] - ex * t, dy = py - a[1] - ey * t, dz = pz - a[2] - ez * t; return Math.sqrt(dx * dx + dy * dy + dz * dz); };
      const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
      // his face, reshaped to match a photo of him (see below); the hair is left exactly as scanned
      { // the strip of skin just under each eye (scan heights 1.648-1.6615): its texture has eye-white smeared into it on the scan
        const Ix = geo.index, UVa = geo.attributes.uv, fix = []; const tY0 = 1.648 * k, tY1 = 1.6615 * k;
        if (Ix && UVa) for (let t = 0; t < Ix.count; t += 3) { const v = [Ix.getX(t), Ix.getX(t + 1), Ix.getX(t + 2)];
          if (v.every((q) => P.getY(q) > tY0 && P.getY(q) < tY1 && P.getZ(q) < -0.06 * k && Math.abs(P.getX(q)) > 0.012 * k && Math.abs(P.getX(q)) < 0.065 * k)) fix.push(v.map((q) => [UVa.getX(q), UVa.getY(q)])); }
        this._eyeFix = fix;
        // the skin under the eyes is scanned as a little upward-facing ledge that catches overhead light like a shelf: turn its
        // surface to face forward like the cheek around it
        const NN0 = geo.attributes.normal; if (NN0) { for (let i = 0; i < n; i++) { const y = P.getY(i), x = Math.abs(P.getX(i));
          if (y > 1.643 * k && y < 1.664 * k && x < 0.068 * k && P.getZ(i) < -0.05 * k) { const w = 0.75 * sm(1.643 * k, 1.65 * k, y) * (1 - sm(1.659 * k, 1.664 * k, y));
            const nx = NN0.getX(i) * (1 - w) + (P.getX(i) > 0 ? 0.25 : -0.25) * w, ny2 = NN0.getY(i) * (1 - w) - 0.05 * w, nz2 = NN0.getZ(i) * (1 - w) - 1 * w, L = Math.hypot(nx, ny2, nz2) || 1; NN0.setXYZ(i, nx / L, ny2 / L, nz2 / L); } }
          NN0.needsUpdate = true; } }
      { let ny = 0, nz = 9; for (let i = 0; i < n; i++) { const y = P.getY(i); if (y > H - 0.25 * k && y < H - 0.08 * k && Math.abs(P.getX(i)) < 0.04 * k && P.getZ(i) < nz) { nz = P.getZ(i); ny = y; } }
        // the stretch happens between the nostrils and the lower eyelids only, so the eyes themselves move up whole, undistorted
        // his face, matched to a photo of him (lined up at the pupils): the eyes and chin stay where the scan has them, the brows go
        // up 6 mm, the base of the nose comes down 5 mm and the mouth 8 mm. Only the face moves — the hair and the sides of the head
        // are left exactly as scanned.
        const NN = geo.attributes.normal, cutY = ny;
        const CP = [[1.535, 0], [1.544, 0], [1.597, -0.008], [1.622, -0.005], [1.652, 0], [1.668, 0], [1.678, 0.006], [1.700, 0]].map(([y, d]) => [y * k, d * k]);
        const off = (y) => { if (y <= CP[0][0] || y >= CP[CP.length - 1][0]) return [0, 0];
          for (let c = 0; c < CP.length - 1; c++) { const [ya, da] = CP[c], [yb, db] = CP[c + 1]; if (y < yb) { const u = (y - ya) / (yb - ya), e = u * u * (3 - 2 * u); return [da + (db - da) * e, (db - da) * 6 * u * (1 - u) / (yb - ya)]; } }
          return [0, 0]; };
        for (let i = 0; i < n; i++) { const y = P.getY(i); if (y <= CP[0][0] || y >= CP[CP.length - 1][0]) continue;
          const x = Math.abs(P.getX(i)), z = P.getZ(i), w = (1 - sm(0.062 * k, 0.08 * k, x)) * sm(0.0, -0.045 * k, z); if (w <= 0) continue; // the face only: not the hair at the sides, not the ears
          const [dy, dd] = off(y); P.setY(i, y + dy * w);
          if (NN && dd) { const st = 1 + dd * w, nx = NN.getX(i), nyv = NN.getY(i) / st, nzv = NN.getZ(i), L = Math.hypot(nx, nyv, nzv) || 1; NN.setXYZ(i, nx / L, nyv / L, nzv / L); } }
        // and narrower below the eyes, like the photo: slimmer cheeks, jaw and chin (the back of the head and the hair are left alone)
        const XS = [[1.52, 1], [1.545, 0.86], [1.56, 0.85], [1.59, 0.88], [1.62, 0.93], [1.66, 0.97], [1.685, 1]].map(([y, f]) => [y * k, f]);
        const xs = (y) => { if (y <= XS[0][0] || y >= XS[XS.length - 1][0]) return 1; for (let c = 0; c < XS.length - 1; c++) { const [ya, fa] = XS[c], [yb, fb] = XS[c + 1]; if (y < yb) { const u = (y - ya) / (yb - ya); return fa + (fb - fa) * u * u * (3 - 2 * u); } } return 1; };
        for (let i = 0; i < n; i++) { const y0 = P.getY(i), f = xs(y0); if (f === 1) continue; const wz = sm(0.05 * k, -0.005 * k, P.getZ(i)); P.setX(i, P.getX(i) * (1 - (1 - f) * wz)); }
        P.needsUpdate = true; if (NN) NN.needsUpdate = true; this.headCut = { noseY: ny, cutY }; }
      const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
      // weights: within each limb a vertex is shared between two bones only near the joint between them, blending linearly over a
      // few centimetres along the limb. That's what keeps elbows, knees and ankles from pinching or snapping.
      const lin = (a, b, v) => Math.min(1, Math.max(0, (v - a) / (b - a))), mix = (a, b, u) => a + (b - a) * u;
      const armMask = new Float32Array(n);
      // what each vertex near the collar is painted as: the striped shirt is grey/black/white, skin and hair are warm. The collar stays on
      // the body and the neck, hair and face go with the head, even where the hair hangs down over the back of the collar.
      const shirtV = new Float32Array(n), greyV = new Float32Array(n);
      { const img = src.material.map && src.material.map.image;
        const UVa = geo.attributes.uv; if (img && img.width && UVa) { const cw = 512, ch = 512, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cw, ch);
          const D = cx.getImageData(0, 0, cw, ch).data, flip = src.material.map.flipY !== false;
          for (let i = 0; i < n; i++) { const y = P.getY(i); if (y < neckY - 0.06 * k || y > neckY + 0.16 * k) continue;
            const u0 = UVa.getX(i), v0 = UVa.getY(i); let sat = 0, c = 0, hiL = 0;
            for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) { const px = Math.min(cw - 1, Math.max(0, Math.round(u0 * cw) + dx)), py = Math.min(ch - 1, Math.max(0, Math.round((flip ? 1 - v0 : v0) * ch) + dy)), o = (py * cw + px) * 4;
              const r = D[o], g = D[o + 1], b = D[o + 2]; sat += Math.max(r, g, b) - Math.min(r, g, b); hiL = Math.max(hiL, (r + g + b) / 3); c++; }
            greyV[i] = Math.min(1, Math.max(0, (14 - sat / c) / 6)); shirtV[i] = Math.min(1, Math.max(0, (22 - sat / c) / 12)) * Math.min(1, Math.max(0, (hiL - 120) / 50)); } // grey AND has white stripe nearby: the shirt (hair never gets that bright)
          // a single vertex can't decide it: averaged over its neighbours a few times, so stray dark hair isn't mistaken for a stripe
          const Ix = geo.index; if (Ix) { for (let it = 0; it < 4; it++) { const acc = new Float32Array(n), cnt = new Float32Array(n);
            for (let f = 0; f < Ix.count; f += 3) { const A = Ix.getX(f), B = Ix.getX(f + 1), C = Ix.getX(f + 2), m = (shirtV[A] + shirtV[B] + shirtV[C]) / 3; acc[A] += m; acc[B] += m; acc[C] += m; cnt[A]++; cnt[B]++; cnt[C]++; }
            for (let i = 0; i < n; i++) if (cnt[i]) shirtV[i] = acc[i] / cnt[i]; } }
          for (let i = 0; i < n; i++) { const v = Math.min(1, Math.max(0, (shirtV[i] - 0.35) / 0.3)); shirtV[i] = v * v * (3 - 2 * v); }
          // the shirt spreads into any plain grey next to it — the shadowed inside of the collar — but never into warm hair or skin
          if (Ix) for (let it = 0; it < 6; it++) { const nx = shirtV.slice(); for (let f = 0; f < Ix.count; f += 3) { const A = Ix.getX(f), B = Ix.getX(f + 1), C = Ix.getX(f + 2), m = Math.max(shirtV[A], shirtV[B], shirtV[C]); [A, B, C].forEach((q) => { const g = m * greyV[q]; if (g > nx[q]) nx[q] = g; }); } shirtV.set(nx); } } }
      for (let i = 0; i < n; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ax = Math.abs(x), R = x > 0 ? 1 : 0, w = {};
        const put = (b, v) => { if (v > 1e-4) w[b] = (w[b] || 0) + v; };
        // where the arm starts: under the arm it's cut off at the side of the ribcage; over the top it blends across the shoulder
        const ty = lin(armY - 0.04 * k, armY + 0.02 * k, y), c0 = mix(tw - 0.005 * k, shX - 0.11 * k, ty), c1 = mix(tw + 0.045 * k, shX + 0.08 * k, ty);
        const arm = sm(c0, c1, ax) * (1 - sm(armY + 0.06 * k, armY + 0.12 * k, y)) * sm(armY - 0.2 * k, armY - 0.14 * k, y); armMask[i] = arm;
        const leg = (1 - arm) * sm(hipY + 0.04 * k, crotch - 0.06 * k, y);
        const clav = (1 - arm - leg) * sm(0.05 * k, 0.16 * k, ax) * sm(armY - 0.14 * k, armY - 0.03 * k, y) * (y < neckY + 0.02 * k ? 1 : 0);
        const body = 1 - arm - leg - clav;
        if (arm > 0) { // collarbone -> upper arm -> forearm -> hand, by how far out along the arm
          // round the elbow through a helper bone that only turns half as far, so the inside of the bend doesn't collapse
          const r1 = lin(shX - 0.04 * k, shX + 0.04 * k, ax), ea = lin(elX - 0.035 * k, elX - 0.006 * k, ax), eb = lin(elX + 0.006 * k, elX + 0.035 * k, ax), r3 = lin(wrX - 0.03 * k, wrX + 0.03 * k, ax); // solid upper arm and forearm: they only bend right at the shoulder, elbow and wrist
          const tf = 0; // the forearm is one solid piece: the palm turns at the wrist, not along the forearm
          put(5 + R, arm * (1 - r1)); put(7 + R, arm * r1 * (1 - ea)); put(23 + R, arm * r1 * ea * (1 - eb)); put(9 + R, arm * eb * (1 - r3) * (1 - tf)); put(61 + R, arm * eb * (1 - r3) * tf);
          if (r3 > 0) { // the hand: palm, then three joints per finger and three for the thumb
            const Hd = HAND[R], base = 25 + R * 15, hw = arm * r3, T = Hd.thumb;
            const tdx = T.tip[0] - T.cmc[0], tdy = T.tip[1] - T.cmc[1], tdz = T.tip[2] - T.cmc[2], tL2 = tdx * tdx + tdy * tdy + tdz * tdz;
            const tt = ((ax - T.cmc[0]) * tdx + (y - T.cmc[1]) * tdy + (z - T.cmc[2]) * tdz) / tL2;
            const thumbM = (1 - sm(Hd.palmY - 0.026 * k, Hd.palmY - 0.012 * k, y)) * (1 - sm(Hd.zIndex + 0.004 * k, Hd.zIndex + 0.018 * k, z)) * (ax < Hd.mcpX + 0.012 * k ? 1 : 0) * lin(-0.05, 0.12, tt);
            if (thumbM > 0) { const a1 = lin(0.36, 0.48, tt), a2 = lin(0.66, 0.78, tt); put(base, hw * thumbM * (1 - a1)); put(base + 1, hw * thumbM * a1 * (1 - a2)); put(base + 2, hw * thumbM * a2); }
            const rest = hw * (1 - thumbM), f = Hd.fingerOf(z), F = Hd.fingers[f], fb = base + 3 + f * 3;
            const p0 = lin(F.mcp - 0.014 * k, F.mcp + 0.006 * k, ax) * (y > Hd.palmY - 0.035 * k ? 1 : 0), p1 = lin(F.pip - 0.007 * k, F.pip + 0.007 * k, ax), p2 = lin(F.dip - 0.006 * k, F.dip + 0.006 * k, ax);
            put(11 + R, rest * (1 - p0)); put(fb, rest * p0 * (1 - p1)); put(fb + 1, rest * p1 * (1 - p2)); put(fb + 2, rest * p2);
          }
        }
        if (leg > 0) { // hips -> thigh -> shin -> foot, by height; the whole foot below the ankle (heel included) goes with the foot
          // same at the knee: thigh -> half-turn knee helper -> shin
          const rt = lin(crotch + 0.015 * k, crotch - 0.06 * k, y), ka = lin(kneeY + 0.038 * k, kneeY + 0.008 * k, y), kb = lin(kneeY - 0.008 * k, kneeY - 0.038 * k, y) /* solid thigh and shin: the bend stays at the knee */, ra = lin(ankY + 0.035 * k, ankY - 0.02 * k, y);
          const rb = ra * lin(ballZ + 0.012 * k, ballZ - 0.012 * k, z) * (y < 0.08 * k ? 1 : 0); // toes: in front of the ball of the foot
          put(0, leg * (1 - rt)); put(13 + R, leg * rt * (1 - ka)); put(21 + R, leg * rt * ka * (1 - kb)); put(15 + R, leg * kb * (1 - ra)); put(17 + R, leg * ra * (1 - rb)); put(58 + R, leg * rb);
        }
        if (clav > 0) { put(5 + R, clav * 0.75); put(56, clav * 0.25); }
        if (body > 0) { // hips -> spine -> chest -> neck -> head, by height
          // hips -> spine -> spine2 -> chest -> upper chest -> neck -> neck2 -> head, each blending into the next across its joint
          const cut = [[waistY, 0.05], [sp2Y, 0.05], [chestY, 0.05], [ucY, 0.04], [neckY, 0.03], [nk2Y, 0.02], [headY, 0.025]], chain = [0, 1, 55, 2, 56, 3, 57, 4];
          let lo = 1; const own = new Array(8).fill(0);
          // the head takes the whole face down to the underside of the jaw: its boundary runs under the chin at the front and rises to
          // the base of the skull at the back, so turning or nodding bends the neck, never the face
          const yHead = neckY + 0.005 * k, shirtK = (1 - 0.7 * shirtV[i]) * (1 - 0.35 * lin(-0.01 * k, 0.03 * k, z) * (1 - lin(neckY, neckY + 0.07 * k, y))); // the collar gives a little with the neck (as a real one does), so the join never tears open // head and neck are one solid piece, joined to the body at the collar; the collar itself stays with the body
          for (let c = cut.length - 1; c >= 0; c--) { if (c === 4 || c === 5) { own[c + 1] = 0; continue; } /* the neck bones own no skin: the solid head piece joins straight onto the chest */ const isHead = c === cut.length - 1, cy0 = isHead ? yHead : cut[c][0], wd = isHead ? 0.02 : cut[c][1]; const tt = lin(cy0 - wd * k, cy0 + wd * k, y) * (isHead ? shirtK : 1); own[c + 1] = lo * tt; lo *= 1 - tt; }
          own[0] = lo;
          // the front of the ribcage rides on its own bone so it can swell with each breath
          const rib = 0.7 * lin(-0.01 * k, -0.07 * k, z) * lin(chestY - 0.14 * k, chestY - 0.06 * k, y) * (1 - lin(ucY - 0.02 * k, ucY + 0.04 * k, y));
          chain.forEach((b, c) => { let v = body * own[c]; if ((b === 2 || b === 55) && rib > 0) { const r = v * rib; put(60, r); v -= r; } put(b, v); });
        }
        const top = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((t, e) => t + e[1], 0) || 1;
        top.forEach(([b, v], j) => { SI[i * 4 + j] = +b; SW[i * 4 + j] = v / tot; });
      }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
      // Bring the arms down out of the T-pose before binding, so a relaxed pose is close to the bind pose and the skin barely has to
      // stretch. Each shoulder vertex turns by its own share of the angle around the shoulder joint, which rounds the top of the
      // shoulder over instead of crushing it.
      { // slimmer forearms: the scan's are thick and round all the way down; pull them in toward their centre line, most mid-forearm
        const fa = elX + 0.03 * k, fb = wrX + 0.005 * k;
        for (let i = 0; i < n; i++) { if (armMask[i] < 0.5) continue; const x = P.getX(i), ax = Math.abs(x); if (ax <= fa || ax >= fb) continue;
          const u = (ax - fa) / (fb - fa), cy = elC.y + (wrC.y - elC.y) * u, cz = elC.z + (wrC.z - elC.z) * u;
          // like his real forearm: full below the elbow where the muscle is, tapering steadily to a wrist about two-thirds as wide,
          // and the wrist flatter (thinner top-to-bottom than side-to-side; in the T-pose the palm faces down, so that's y)
          const f = 0.9 - 0.2 * u * u * (3 - 2 * u), fy = f * (1 - 0.14 * u); // slimmer from the elbow down: ~10% at the top, ~30% at the wrist
          P.setY(i, cy + (P.getY(i) - cy) * fy); P.setZ(i, cz + (P.getZ(i) - cz) * f); } }
      const TB = 0.95, Nn = geo.attributes.normal;
      for (let i = 0; i < n; i++) {
        const a = armMask[i]; if (a <= 0) continue;
        const x = P.getX(i), y = P.getY(i), sg = x < 0 ? 1 : -1, px = sg > 0 ? -shX : shX, ang = sg * TB * a, c = Math.cos(ang), sn = Math.sin(ang);
        const dx = x - px, dy = y - shY; P.setXY(i, px + dx * c - dy * sn, shY + dx * sn + dy * c);
        if (Nn) { const nx = Nn.getX(i), ny = Nn.getY(i); Nn.setXY(i, nx * c - ny * sn, nx * sn + ny * c); }
      }
      P.needsUpdate = true; if (Nn) Nn.needsUpdate = true;
      [9, 10, 11, 12].forEach((b) => { const sg = b % 2 ? 1 : -1, px = sg > 0 ? -shX : shX, ang = sg * TB, c = Math.cos(ang), sn = Math.sin(ang), dx = J[b][0] - px, dy = J[b][1] - shY; J[b] = [px + dx * c - dy * sn, shY + dx * sn + dy * c, J[b][2]]; });
      geo.computeBoundingSphere();
      const g = new THREE.Group(); g.userData.dynamic = true; g.visible = false; TH.scene.add(g);
      J.push(J[15], J[16], J[9], J[10]); parent.push(13, 14, 7, 8); // 21/22 knee helpers, 23/24 elbow helpers
      // 25..39 left hand, 40..54 right hand: thumb (3), then index, middle, ring, pinky (3 each), baked down with the arm
      const bakeP = (p, R) => { const sg = R ? -1 : 1, px = R ? shX : -shX, c = Math.cos(sg * TB), sn = Math.sin(sg * TB), dx = p[0] - px, dy = p[1] - shY; return [px + dx * c - dy * sn, shY + dx * sn + dy * c, p[2]]; };
      HAND.forEach((Hd, R) => {
        const sx = Hd.sd, T = Hd.thumb, w = (q) => bakeP([q[0] * sx, q[1], q[2]], R);
        J.push(w(T.cmc), w(T.mcp), w(T.ip)); parent.push(11 + R, J.length - 3, J.length - 2);
        Hd.fingers.forEach((F) => { J.push(w([F.mcp, F.y, F.z]), w([F.pip, F.y, F.z]), w([F.dip, F.y, F.z])); parent.push(11 + R, J.length - 3, J.length - 2); });
      });
      // 55 spine2, 56 upper chest, 57 neck2, 58/59 L/R balls of the feet, 60 ribs — and re-hang chest, neck, collarbones and head on them
      J.push([0, sp2Y, 0], [0, ucY, 0], [0, nk2Y, 0], [-ankC.x, 0.03 * k, ballZ], [ankC.x, 0.03 * k, ballZ], [0, chestY, -0.04 * k]); parent.push(1, 2, 3, 17, 18, 2);
      parent[2] = 55; parent[3] = 56; parent[5] = 56; parent[6] = 56; parent[4] = 57;
      // 61/62 L/R forearm twist, halfway between elbow and wrist
      J.push(J[9].map((v, q) => (v + J[11][q]) / 2), J[10].map((v, q) => (v + J[12][q]) / 2)); parent.push(9, 10);
      const bones = J.map(() => new THREE.Bone());
      bones.forEach((b, i) => { const p = parent[i], q = p < 0 ? [0, 0, 0] : J[p]; b.position.set(J[i][0] - q[0], J[i][1] - q[1], J[i][2] - q[2]); if (p >= 0) bones[p].add(b); });
      const mat = src.material.clone(); mat.userData.noPBR = true; mat.skinning = true; // three r128: skinned meshes need this on the material
      if (mat.map) mat.map = this.soften(mat.map, undefined, undefined, undefined, this._eyeFix);
      mat.metalness = 0; mat.roughness = 1; // skin and cloth, not metal: the scan came in fully metallic, which put glints in odd places (under the eyes)
      // a finish per pixel, from the texture's colours: skin a soft matte, hair a little less, the shirt, jeans and shoes dead-flat fabric
      // with a fine woven grain; and only as much of the house's reflections as the house's own materials get
      if (this._surf) { mat.roughnessMap = this._surf.rough; mat.bumpMap = this._surf.bump; mat.bumpScale = 0.35; }
      mat.envMapIntensity = 0.3; mat.needsUpdate = true;
      // final material: a soft, low sheen on the skin only (no mirror reflections of the house on him at all), the clothes dead matte
      const pmat = this._surf ? new THREE.MeshPhongMaterial({ map: mat.map, skinning: true, specular: 0x2a2622, shininess: 9, specularMap: this._surf.spec, bumpMap: this._surf.bump, bumpScale: 0.012 }) : null;
      if (pmat) { pmat.userData.noPBR = true; pmat.side = mat.side; } // a flatter, less contrasty copy of his skin and clothes so he sits in the house's light
      const mesh = new THREE.SkinnedMesh(geo, pmat || mat); mesh.frustumCulled = false; mesh.castShadow = true;
      g.add(bones[0]); g.add(mesh); g.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
      const B = (i) => bones[i];
      const M = { g, rig: true, bones, hip: B(0), spine: B(1), spine2: B(55), torso: B(2), upperChest: B(56), neck: B(3), neck2: B(57), head: B(4), toeL: B(58), toeR: B(59), ribs: B(60), twL: B(61), twR: B(62), clavL: B(5), clavR: B(6), armL: B(7), armR: B(8), elbowL: B(9), elbowR: B(10), handL: B(11), handR: B(12),
        legL: B(13), legR: B(14), kneeL: B(15), kneeR: B(16), kneeHL: B(21), kneeHR: B(22), elbowHL: B(23), elbowHR: B(24), footL: B(17), footR: B(18), fing: [0, 1].map((R) => Array.from({ length: 5 }, (_, f) => [0, 1, 2].map((s) => B(25 + R * 15 + f * 3 + s)))),
        thumbAxis: HAND.map((Hd) => { const T = Hd.thumb, d = new THREE.Vector3(T.tip[0] - T.cmc[0], T.tip[1] - T.cmc[1], T.tip[2] - T.cmc[2]).normalize(); d.x *= Hd.sd; const t = new THREE.Vector3(0.3 * Hd.sd, 0.5, 1).normalize(); return new THREE.Vector3().crossVectors(d, t).normalize(); }),
        fist: (() => { const Hd = HAND[1], F = Hd.fingers[1]; return new THREE.Vector3(Hd.mcpX - wrX - 0.012 * k, Hd.palmY - wrC.y - 0.03 * k, (Hd.fingers[1].z + Hd.fingers[2].z) / 2 - wrC.z); })(),
        pinch: (() => { const Hd = HAND[1], F = Hd.fingers[0]; return new THREE.Vector3(F.pip - wrX, Hd.palmY - wrC.y - 0.035 * k, F.z - wrC.z - 0.01 * k); })(),
        hipY, items: {}, held: null, phase: 0,
        Lt: hipY - kneeY, Ls: kneeY - ankY, ankY, qbL: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), TB), qbR: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -TB), splay: Math.atan2(ankC.x - hipC.x, hipY - ankY) * 0.75, k };
      this.posePlayer(M, {});
      return (this.man = M);
    },

    // Softened copy of a texture: contrast pulled in toward the middle and the colour eased toward grey, so the scan's studio-bright
    // photo texture doesn't pop out of the dim rooms
    soften(tex, contrast = 0.72, sat = 0.8, gain = 0.92, eyeFix) {
      try {
        const im = tex.image; if (!im || !im.width) return tex;
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0);
        const D = cx.getImageData(0, 0, cv.width, cv.height), a = D.data; let mean = 0; for (let i = 0; i < a.length; i += 4) mean += a[i] + a[i + 1] + a[i + 2]; mean /= (a.length / 4) * 3;
        for (let i = 0; i < a.length; i += 4) { const l = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2]; for (let c = 0; c < 3; c++) { let v = l + (a[i + c] - l) * sat; v = mean + (v - mean) * contrast; a[i + c] = Math.max(0, Math.min(255, v * gain)); } }
        // under the eyes: paint over the stray eye-white with the skin around it
        if (eyeFix && eyeFix.length) { const W = cv.width, Hh = cv.height, fy = tex.flipY;
          for (const T of eyeFix) { const p = T.map(([u, v]) => [u * W, (fy ? 1 - v : v) * Hh]);
            const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0]))), y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), y1 = Math.min(Hh - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
            if ((x1 - x0) * (y1 - y0) > 4000) continue;
            const inside = (x, y) => { const d = (a, b, c) => (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1]); const q = [x + 0.5, y + 0.5], d1 = d(q, p[0], p[1]), d2 = d(q, p[1], p[2]), d3 = d(q, p[2], p[0]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
            const skin = [], bad = [];
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (!inside(x, y)) continue; const i = (y * W + x) * 4, l = (a[i] + a[i + 1] + a[i + 2]) / 3, sp = Math.max(a[i], a[i + 1], a[i + 2]) - Math.min(a[i], a[i + 1], a[i + 2]); (l > mean * 1.15 && sp < 40 ? bad : skin).push(i); }
            if (!bad.length || skin.length < 4) continue;
            const m = [0, 1, 2].map((c) => { const v = skin.map((i) => a[i + c]).sort((q, r) => q - r); return v[v.length >> 1]; });
            bad.forEach((i) => { for (let c = 0; c < 3; c++) a[i + c] = m[c]; });
          } }
        cx.putImageData(D, 0, 0);
        if (eyeFix) { // (only for Dylan's scan) the surface maps: roughness (green channel) and a fabric-grain bump
          const W = cv.width, Hh = cv.height, src = cx.getImageData(0, 0, W, Hh).data, mask = document.createElement('canvas'); mask.width = W; mask.height = Hh;
          const mx = mask.getContext('2d'), MD = mx.createImageData(W, Hh), m = MD.data;
          for (let i = 0; i < src.length; i += 4) { const r = src[i], g = src[i + 1], b = src[i + 2], mxv = Math.max(r, g, b), mnv = Math.min(r, g, b), v = mxv / 255, sat = mxv ? (mxv - mnv) / mxv : 0;
            const skin = r >= g && g >= b - 4 && r - b > 14 && sat > 0.1 && sat < 0.62 && v > 0.33 ? 1 : 0, hair = !skin && r >= b && sat > 0.12 && v < 0.45 ? 1 : 0;
            const rough = skin ? 0.62 : hair ? 0.8 : 1.0; m[i] = m[i + 1] = m[i + 2] = Math.round(rough * 255); m[i + 3] = 255; }
          mx.putImageData(MD, 0, 0); const rc = document.createElement('canvas'); rc.width = W; rc.height = Hh; const rx = rc.getContext('2d'); rx.filter = 'blur(1.5px)'; rx.drawImage(mask, 0, 0);
          // fabric grain: fine random weave only where it's cloth (roughness 1)
          const R2 = rx.getImageData(0, 0, W, Hh).data, bc = document.createElement('canvas'); bc.width = W; bc.height = Hh; const bx = bc.getContext('2d'), BD = bx.createImageData(W, Hh), bd = BD.data;
          const sc2 = document.createElement('canvas'); sc2.width = W; sc2.height = Hh; const sx = sc2.getContext('2d'), SD = sx.createImageData(W, Hh), sdd = SD.data;
          for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, rr = R2[i] / 255, cloth = Math.max(0, (rr - 0.85) / 0.15), skinA = Math.max(0, Math.min(1, (0.8 - rr) / 0.18));
            const weave = (((x + y) & 1) ? 1 : -1) * 0.5 + (Math.random() - 0.5), pore = Math.random() - 0.5; const v = 128 + cloth * weave * 38 + skinA * pore * 14; bd[i] = bd[i + 1] = bd[i + 2] = v; bd[i + 3] = 255;
            const sp = Math.round(Math.max(0, Math.min(1, (1 - rr) / 0.38)) * 80); sdd[i] = sdd[i + 1] = sdd[i + 2] = sp; sdd[i + 3] = 255; } // shine: skin a little, hair less, cloth none
          bx.putImageData(BD, 0, 0); sx.putImageData(SD, 0, 0); { const bb = document.createElement('canvas'); bb.width = W; bb.height = Hh; const q = bb.getContext('2d'); q.filter = 'blur(0.8px)'; q.drawImage(bc, 0, 0); bx.clearRect(0, 0, W, Hh); bx.drawImage(bb, 0, 0); } // soften the grain so it never sparkles
          const mk = (c) => { const tt = new THREE.CanvasTexture(c); ['flipY', 'wrapS', 'wrapT'].forEach((k2) => { tt[k2] = tex[k2]; }); tt.needsUpdate = true; return tt; };
          this._surf = { rough: mk(rc), bump: mk(bc), spec: mk(sc2) };
        }
        const t = new THREE.CanvasTexture(cv); ['flipY', 'wrapS', 'wrapT', 'encoding', 'anisotropy', 'minFilter', 'magFilter'].forEach((k) => { t[k] = tex[k]; }); t.needsUpdate = true; return t;
      } catch (e) { return tex; }
    },

    // How far along the walk cycle to move for a given distance: one step is about 0.75 m walking, 1.3 m running, 0.5 m crouched.
    stepPhase(M, dist, sp, cr) { const step = cr ? 0.5 : 0.75 + 0.55 * U.clamp((sp - 3) / 1.2, 0, 1); M.phase += Math.min(1.2, (dist / step) * Math.PI); }, // stride lengthens smoothly into a run

    // The tapes only keep 5 samples a second. Played back straight, his path, facing and head tilt change direction 5 times a second,
    // so the body snaps round and the head jerks. This smooths the playback: a curve through the samples for his path (and his speed
    // from that curve), and a body that turns after the head the way a person does — the head looks first, the body follows.
    track(F, i, u, ok) {
      const a = F[i], b = F[Math.min(F.length - 1, i + 1)], p0 = i > 0 && ok(F[i - 1], a) ? F[i - 1] : a, p3 = i + 2 < F.length && ok(b, F[i + 2]) ? F[i + 2] : b;
      const h = Math.max(1e-3, b.t - a.t), u2 = u * u, u3 = u2 * u;
      const cr = (q0, q1, q2, q3) => 0.5 * (2 * q1 + (q2 - q0) * u + (2 * q0 - 5 * q1 + 4 * q2 - q3) * u2 + (3 * q1 - q0 - 3 * q2 + q3) * u3);
      const dcr = (q0, q1, q2, q3) => 0.5 * ((q2 - q0) + 2 * (2 * q0 - 5 * q1 + 4 * q2 - q3) * u + 3 * (3 * q1 - q0 - 3 * q2 + q3) * u2) / h;
      const vx = dcr(p0.px, a.px, b.px, p3.px), vz = dcr(p0.pz, a.pz, b.pz, p3.pz);
      return { px: cr(p0.px, a.px, b.px, p3.px), pz: cr(p0.pz, a.pz, b.pz, p3.pz), sp: Math.min(7, Math.hypot(vx, vz)) };
    },
    settle(M, yaw, pitch, sp, dt) {
      const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x)), k = (r) => 1 - Math.exp(-r * dt);
      if (M._by == null || dt > 0.5 || dt <= 0) { M._by = yaw; M._hl = 0; M._pt = pitch; M._ss = sp; }
      M._ss += (sp - M._ss) * k(5); const moving = U.clamp(M._ss / 1.2, 0, 1);
      const want = wrap(yaw - M._by); // where he's looking, relative to his body
      // the head swings round quickly; the body follows it — fast when walking, and only past a comfortable neck twist when standing
      M._hl += (U.clamp(want, -1.0, 1.0) - M._hl) * k(9);
      const lag = want - U.clamp(want, -0.55 * (1 - moving), 0.55 * (1 - moving));
      M._by = wrap(M._by + lag * k(3 + 5 * moving));
      M._pt += (pitch - M._pt) * k(7);
      return { yaw: M._by, look: M._hl, pitch: M._pt, sp: M._ss };
    },

    // One pose for the death replay and the security tapes.
    // o: { ph: walk-cycle phase, sp: speed m/s, cr: crouched 0..1, cg: being grabbed, flinch, pitch: where you're looking,
    //      held: item id in your right hand, ak/aT: what you're doing with your hands and for how long, t: clock }
    // how each item sits in the right fist: bars and handles run through the fist, the pan sticks out flat, cans hang at your side
    // How each item sits in the right hand. at: the point on the item that goes in the fist; A/S: two directions on the item,
    // D/T: where they point in the hand (hand frame as scanned: x out along the fingers, -y the palm side, -z the thumb side).
    // hand: how the fingers close (fist round a bar or handle, a pinch for small things). carry: hangs at your side.
    GRIP: {
      _: { hand: 'fist', at: [0, 0.015, 0], A: [1, 0, 0], D: [0, 0, -1], S: [0, 1, 0], T: [1, 0, 0] },
      crowbar: { carry: true, hand: 'fist', at: [0.22, 0.012, 0], A: [-1, 0, 0], D: [0.55, 0, -0.83], S: [0, 0, 1], T: [1, 0, 0] },
      pan: { hand: 'fist', at: [0.29, 0.015, 0], A: [-1, 0, 0], D: [0.7, 0, -0.7], S: [0, 1, 0], T: [0, 1, 0] },
      gas_can: { carry: true, hand: 'handle', at: [0, 0.345, -0.03], A: [0, 0, 1], D: [0, 0, 1], S: [0, 1, 0], T: [-1, 0, 0] },
      radio: { carry: true, hand: 'handle', at: [0, 0.168, 0], A: [1, 0, 0], D: [0, 0, 1], S: [0, 1, 0], T: [-1, 0, 0] },
      newspapers: { carry: true, hand: 'handle', at: [0, 0.078, 0.02], A: [1, 0, 0], D: [0, 0, 1], S: [0, 1, 0], T: [-1, 0, 0] },
      oil_can: { hand: 'fist', at: [0, 0.07, 0], A: [0, 1, 0], D: [0, 0, -1], S: [1, 0, 0], T: [1, 0, 0] },
      bottle: { hand: 'fist', at: [0, 0.09, 0], A: [0, 1, 0], D: [0, 0, -1], S: [1, 0, 0], T: [1, 0, 0] },
      screwdriver: { hand: 'fist', at: [-0.01, 0.017, 0], A: [1, 0, 0], D: [0, 0, -1], S: [0, 1, 0], T: [1, 0, 0] },
      wire_cutters: { hand: 'fist', at: [-0.12, 0.012, 0], A: [1, 0, 0], D: [0, 0, -1], S: [0, 1, 0], T: [1, 0, 0] },
      slingshot: { hand: 'fist', at: [-0.06, 0.012, 0], A: [1, 0, 0], D: [0, 0, -1], S: [0, 1, 0], T: [1, 0, 0] },
      taser: { hand: 'fist', at: [-0.035, 0, -0.055], A: [0, 0, -1], D: [0, 0, 1], S: [1, 0, 0], T: [1, 0, 0] }, // held like a pistol: grip in the fist, barrel forward over the knuckles
      taser_body: { hand: 'fist', at: [-0.035, 0, -0.055], A: [0, 0, -1], D: [0, 0, 1], S: [1, 0, 0], T: [1, 0, 0] },
      rocks: { hand: 'handle', at: [0.008, 0.02, -0.005], A: [1, 0, 0], D: [0, 0, -1], S: [0, 1, 0], T: [1, 0, 0] },
      SMALL: { hand: 'pinch', where: 'pinch', at: [0.03, 0.005, 0], A: [1, 0, 0], D: [0.6, -0.2, -0.77], S: [0, 1, 0], T: [0, 1, 0] },
    },
    SMALLS: ['front_key', 'padlock_key', 'rusty_key', 'spark_plug', 'car_keys', 'matches', 'taser_battery', 'note'],
    // per-item fine-tuning from a contact check: how far to slide the item in the hand and how tightly to close the fingers so they
    // wrap the surface without sinking into it (measured by testing every hand vertex against the item)
    FIT: { taser: { k: 0.9, off: [0, -0.008, 0] }, taser_body: { k: 0.9, off: [0, -0.008, 0] }, crowbar: { k: 0.9, off: [-0.01, -0.02, 0.01] }, gas_can: { k: 0.9, off: [-0.01, -0.02, -0.01] }, radio: { k: 1.1, off: [0, 0.01, -0.02] }, newspapers: { k: 1.1, off: [0.02, -0.02, 0.02] }, oil_can: { k: 1.1, off: [-0.02, -0.02, 0.02] }, bottle: { k: 0.6, off: [-0.02, -0.02, -0.02] }, screwdriver: { k: 0.7, off: [0, -0.02, 0.01] }, wire_cutters: { k: 0.7, off: [0.01, -0.01, -0.02] }, slingshot: { k: 0.7, off: [0.01, 0.02, 0] }, rocks: { k: 0.6, off: [-0.01, 0, -0.01] }, front_key: { k: 0.7, off: [-0.01, 0, -0.01] }, padlock_key: { k: 0.7, off: [-0.01, 0, -0.01] }, rusty_key: { k: 0.7, off: [-0.01, 0, -0.01] }, spark_plug: { k: 0.6, off: [0.01, 0, 0] }, car_keys: { k: 0.9, off: [-0.01, -0.01, 0.02] }, matches: { k: 1, off: [-0.02, -0.02, 0.01] }, taser_battery: { k: 1.1, off: [-0.02, -0.01, -0.01] } },
    grip(id) { const g = this.GRIP[id] || (this.SMALLS.includes(id) ? this.GRIP.SMALL : this.GRIP._), f = this.FIT[id]; if (!f) return g; const off = (g.off || [0, 0, 0]).map((v, i) => v + f.off[i]); return Object.assign({}, g, { k: f.k, off }); },
    // finger curls [knuckle, middle, tip] for index, middle, ring, pinky, then the thumb
    HANDS: {
      relax: [[0.2, 0.35, 0.25], [0.25, 0.4, 0.28], [0.3, 0.45, 0.3], [0.36, 0.5, 0.32], [0.12, 0.15, 0.15]],
      loose: [[0.45, 0.6, 0.35], [0.5, 0.65, 0.4], [0.55, 0.7, 0.42], [0.6, 0.75, 0.45], [0.2, 0.3, 0.2]],
      fist: [[1.4, 1.6, 1.0], [1.45, 1.65, 1.0], [1.5, 1.7, 1.05], [1.55, 1.7, 1.05], [0.55, 0.75, 0.6]],
      handle: [[1.25, 1.45, 0.9], [1.3, 1.5, 0.9], [1.35, 1.55, 0.95], [1.4, 1.55, 0.95], [0.45, 0.6, 0.5]],
      pinch: [[0.75, 0.95, 0.55], [1.0, 1.25, 0.8], [1.25, 1.45, 0.95], [1.35, 1.5, 1.0], [0.55, 0.45, 0.35]],
      cup: [[0.6, 0.75, 0.45], [0.65, 0.8, 0.5], [0.7, 0.85, 0.5], [0.75, 0.9, 0.55], [0.35, 0.3, 0.3]],
      open: [[0.04, 0.06, 0.04], [0.04, 0.06, 0.04], [0.05, 0.07, 0.05], [0.06, 0.08, 0.05], [0.02, 0.05, 0.05]],
      flat: [[-0.08, 0.0, 0.0], [-0.08, 0.0, 0.0], [-0.06, 0.0, 0.0], [-0.04, 0.02, 0.0], [0.05, 0.02, 0.02]],
    },
    ACT: { door: 0.9, use: 0.6, pick: 0.8, pickLow: 1.0, drop: 0.6, work: 99, workLow: 99 },
    posePlayer(M, o) {
      const ph = o.ph != null ? o.ph : M.phase || 0, t = o.t || 0, up = o.cg || o.flinch ? 1 : 0;
      let sp = o.sp || 0;
      if (M.rig && o.t != null) { const dtp = Math.min(0.25, Math.max(0, t - (M._lt == null ? t : M._lt))); M._lt = t; M._sv = M._sv == null ? sp : M._sv + (sp - M._sv) * Math.min(1, dtp * 6); sp = M._sv; } // eased speed
      if (!M.rig) {
        const s = o.s != null ? o.s : Math.sin(ph) * Math.min(1, sp / 3) * 0.8;
        M.hip.position.y = o.cr ? 0.74 : 0.92;
        M.legL.rotation.x = o.cr ? -0.62 + s * 0.25 : s; M.legR.rotation.x = o.cr ? 0.62 - s * 0.25 : -s;
        M.armL.rotation.x = up ? 2.1 : -s * 0.8; M.armR.rotation.x = up ? 2.0 : s * 0.8; // hands up in front of you
        M.torso.rotation.x = o.cr ? -0.4 : up ? 0.2 : -Math.min(0.3, sp * 0.05);
        return;
      }
      const cl = U.clamp, mix = (a, b, u) => a + (b - a) * u;
      // what the hands are doing, and how far into it (ramps in fast, eases out)
      const ak = up ? null : o.ak, D = ak ? this.ACT[ak] || 0.8 : 0, aT = o.aT || 0;
      const ss = (v) => { v = cl(v, 0, 1); return v * v * (3 - 2 * v); }, aw = ak ? ss(aT / 0.22) * (D > 50 ? 1 : ss((D - aT) / 0.32)) : 0, /* eased in and out, so the arm doesn't kick at either end */ prog = ak ? cl(aT / Math.min(D, 1), 0, 1) : 0;
      const low = ak === 'pickLow' || ak === 'workLow';
      const cr = Math.max(+o.cr || 0, low ? aw * (ak === 'pickLow' ? 1 : 0.9) : 0);
      const moving = cl(sp / 1.2, 0, 1), w = cl(sp / 2.5, 0, 1) * (1 - cr * 0.6), rf = cl((sp - 3.2) / 1.6, 0, 1) * (1 - cr);
      const hw = o.held && !up ? 1 : 0;
      const breathe = Math.sin(t * 1.7) * 0.012 * (1 - moving);
      // ---- legs: thigh swing, the knee folding through the swing, the foot kept flat on the ground and rolling off the toes
      const leg = (side) => {
        const f = ph + (side ? Math.PI : 0), sn = Math.sin(f), cs = Math.cos(f);
        const A = 0.4 * w + 0.28 * rf + 0.22 * cr * moving, Kw = 0.7 * w + 0.55 * rf + 0.35 * cr * moving;
        const bump = (c, wd) => { let dd = Math.abs(((f - c) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return Math.exp(-(dd * dd) / (wd * wd)); };
        const give = 0.12 * w * bump(Math.PI / 2 + 0.45, 0.5); // relaxed walk: the knee gives as the foot lands and takes his weight
        let th = A * sn + 0.12 * rf + cr * 0.78, kn = -(0.035 * w + 0.25 * rf + Kw * Math.pow(Math.max(0, cs), 1.6) + give + cr * 1.32); // a sneaking crouch, not a full squat: baggy jeans fold badly past ~75 degrees
        // on the ground the foot stays flat (and the heel peels up at push-off); in the air it just hangs relaxed off the shin,
        // so the ankle never folds flat when the leg kicks back on a run
        const og = U.clamp((0.2 + 0.1 * rf - cs) / (0.55 + 0.35 * rf), 0, 1), onGround = Math.max(1 - moving, og * og * (3 - 2 * og)); // eased, so the foot never snaps between planted and hanging
        const ft = onGround * (-(th + kn) - 0.35 * Math.max(0, -sn) * Math.max(0, -cs) * (w + rf)) + (1 - onGround) * (0.12 * cs * w - 0.12 - 0.15 * rf);
        const toe = onGround * 1.1 * Math.max(0, -sn) * Math.max(0, -cs) * (w + rf) + cr * 0.25; // the toes bend at push-off (and a little in a crouch)
        return { th, kn, ft, toe, h: M.ankY + M.Lt * Math.cos(th) + M.Ls * Math.cos(th + kn) };
      };
      const lL = leg(0), lR = leg(1);
      const smax = (a, b, r) => (a + b + Math.sqrt((a - b) * (a - b) + r * r)) / 2; // soft maximum: weight passes from foot to foot without a kink
      M.hip.position.y = Math.min(M.hipY, smax(lL.h, lR.h, 0.035)) + breathe * 0.2; // whichever foot is down carries you
      M.legL.rotation.set(lL.th, 0, M.splay); M.legR.rotation.set(lR.th, 0, -M.splay); // feet in under you, not planted wide like the scan stands
      M.kneeL.rotation.set(lL.kn, 0, 0); M.kneeR.rotation.set(lR.kn, 0, 0); if (M.kneeHL) { M.kneeHL.rotation.set(lL.kn / 2, 0, 0); M.kneeHR.rotation.set(lR.kn / 2, 0, 0); }
      M.footL.rotation.set(lL.ft, 0, -M.splay); M.footR.rotation.set(lR.ft, 0, M.splay);
      // ---- pelvis turns with the leading leg, the chest counter-turns, the head stays level
      const sL = Math.sin(ph);
      M.hip.rotation.set(0, -0.14 * w * sL, 0.07 * w * Math.cos(ph) * (1 - rf));
      if (M._hipX == null) M._hipX = M.hip.position.x; M.hip.position.x = M._hipX - Math.cos(ph) * 0.022 * w * (1 - rf) * Math.sign(M.legL.position.x || 1); // weight rolls over onto the planted foot
      let lean = -(0.08 * w + 0.22 * rf) - cr * 0.5;
      M.spine.rotation.set(lean * 0.55, 0.09 * w * sL, -0.045 * w * Math.cos(ph) * (1 - rf));
      M.torso.rotation.set(lean * 0.45 + breathe, 0.11 * w * sL, -0.015 * w * Math.cos(ph) * (1 - rf));
      // ---- arms: hang relaxed and swing against the legs, elbows bend more on the forward swing and when running
      const arm = (side) => {
        const sg = side ? -1 : 1, sLag = Math.sin(ph - 0.25 * w), f = side ? -sLag : sLag; // L arm goes forward when the R leg does (trailing the step a touch, like a loose arm)
        const sw = (0.3 * w + 0.45 * rf) * f * (1 - 0.6 * cr) - 0.04 * w; // swings evenly forward and back, a touch more back // a walking arm swings from the shoulder, a little ahead of the hip and a little behind it
        const across = Math.max(0, -f) * (0.07 * w + 0.2 * rf) - Math.max(0, f) * 0.03 * w; // the arm sways in across the belly as it comes forward
        return { cz: sg * 0.33, az: sg * (0.95 + 0.02 * rf + across), ay: 0, sway: across, ax: 0.05 - 0.17 * w * (1 - rf) - sw + cr * 0.3, /* walking, the arm hangs back enough that the hand swings evenly in front of and behind the hip */ el: -sg * (0.18 /* arms hang straight at your sides, elbows barely bent, palms toward your legs */ + 0.1 * w + 0.75 * rf + 0.12 * (w - rf * 0.5) * Math.max(0, -f) + cr * 0.95), hy: 0, hz: sg * 0.12, hx: 0 }; // fingers curl in a little toward the palm
      };
      const aL = arm(0), aR = arm(1);
      // holding something: right forearm up, item out in front, the swing damped
      const grip = hw ? this.grip(o.held) : null;
      if (grip && grip.carry) { aR.ax = 0.05 + 0.25 * (aR.ax - 0.08); aR.az = -0.95; aR.ay = 0; aR.el = 0.15; aR.hz = -0.1; } // heavy things hang at your side
      else if (grip) { aR.ax = 0.38 + 0.08 * (aR.ax - 0.08); aR.el = 1.35; aR.hz = -0.3; aR.az = -1.0; aR.ay = 0; }
      // head and neck: look where you were looking, keep the eyes level against the lean
      const pitch = cl(o.pitch || 0, -0.9, 0.7); let hx = pitch * 0.55 - lean * 0.45 - 0.1 + 0.1 * w + 0.02 * w * Math.cos(2 * ph), nx = pitch * 0.3 - lean * 0.35, hy = -0.05 * w * sL + cl(o.look || 0, -1.0, 1.0); // o.look: head turned ahead of the body
      // ---- idle: when he's standing still with his hands free he isn't a statue — his weight drifts from leg to leg, and every
      //      few seconds he looks around nervously, scratches his head or rubs his neck, or puts a hand over his mouth / to his
      //      forehead in shock. It's picked from the clock, so the tapes and the kill cam replay exactly what he did.
      const idleK = (1 - moving) * (ak ? 1 - aw : 1) * (1 - up) * (1 - cr);
      if (idleK > 0.01) {
        const hash = (q) => { const v = Math.sin(q * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
        const WIN = 6.5, n = Math.floor(t / WIN), u = t / WIN - n, r = hash(n);
        let act = o.idleAct || (r < 0.3 ? 'none' : r < 0.55 ? 'look' : r < 0.72 ? 'scratch' : r < 0.84 ? 'neck' : r < 0.93 ? 'mouth' : 'forehead');
        const uu = o.idleU != null ? o.idleU : u, env = cl((uu - 0.12) / 0.1, 0, 1) * cl((0.78 - uu) / 0.1, 0, 1), e = env * env * (3 - 2 * env) * idleK;
        // weight drifting from leg to leg
        const drift = Math.sin(t * 0.45) * idleK; M.hip.rotation.z += 0.025 * drift; if (M._hipX != null) M.hip.position.x = M._hipX + 0.018 * drift * Math.sign(M.legL.position.x || 1);
        if (act === 'look') { // a glance over one shoulder, a beat, then over the other
          const side = hash(n + 7) < 0.5 ? 1 : -1, g = Math.sin(cl((uu - 0.12) / 0.66, 0, 1) * Math.PI * 2);
          hy += side * 0.85 * g * e; M.torso.rotation.y += side * 0.18 * g * e; hx -= 0.05 * e; }
        else if (e > 0) {
          const useL = !!hw, A = useL ? aL : aR, s = useL ? -1 : 1, jig = Math.sin(t * 13) * 0.09, rub = Math.sin(t * 5.5) * 0.1;
          // (arm angles found by search, so the wrist and elbow land where a real hand would be for each gesture)
          const T = o.idleT ? o.idleT : act === 'scratch' ? { ax: 1.64, ay: 1.372, az: -0.059, el: 1.461 + jig, hz: 0, hx: 0.08, nx: 0.05, hyA: 0.12 }
            : act === 'neck' ? { ax: 2.18, ay: 1.645, az: -0.296, el: 1.724 + rub, hz: 0, hx: 0.12, nx: 0.08, hyA: -0.08 }
            : act === 'mouth' ? { ax: 1.434, ay: 0.485, az: -2.54, el: 1.553, hz: 0, hx: 0.1, nx: 0.04, hyA: 0 }
            : act === 'forehead' ? { ax: 2.183, ay: 0.414, az: -2.108, el: 1.042, hz: 0, hx: 0.14, nx: 0.06, hyA: 0 } : null;
          if (T) { A.ax = mix(A.ax, T.ax, e); A.ay = mix(A.ay, s * T.ay, e); A.az = mix(A.az, s * T.az, e); A.el = mix(A.el, s * T.el, e); A.hz = mix(A.hz, s * T.hz, e); A.cz = mix(A.cz, s * 0.12, e); A.tk = 1 - e; // no resting palm-turn on the arm that's reaching up
            hx += T.hx * e; nx += T.nx * e; hy += s * T.hyA * e; }
        }
      }
      // ---- hands busy
      if (aw > 0) {
        const jig = Math.sin(t * 9) * 0.12;
        if (ak === 'door' || ak === 'use') { // reach for the handle and push it away from you
          const push = ak === 'door' ? prog : 0;
          aR.ax = mix(aR.ax, 0.1, aw); aR.ay = mix(aR.ay, 1.2 + 0.1 * Math.sin(prog * Math.PI), aw); aR.az = mix(aR.az, -0.3, aw); aR.el = mix(aR.el, 0.55 - 0.4 * push, aw); aR.hz = mix(aR.hz, 0.25, aw); lean -= 0.08 * aw; hx -= 0.05 * aw; // flat palm on the door
        } else if (ak === 'pick' || ak === 'drop') { // reach out and close the hand on it (or let it go)
          aR.ax = mix(aR.ax, 0.2, aw); aR.ay = mix(aR.ay, 1.15, aw); aR.az = mix(aR.az, -0.75 - 0.2 * Math.sin(prog * Math.PI), aw); aR.el = mix(aR.el, 0.3, aw); aR.hz = mix(aR.hz, -0.5 * prog, aw); lean -= 0.18 * aw; hx -= 0.15 * aw;
        } else if (ak === 'pickLow') { // squat, reach down to the floor
          aR.ax = mix(aR.ax, 0.75 + 0.15 * Math.sin(prog * Math.PI), aw); aR.ay = mix(aR.ay, 0.35, aw); aR.az = mix(aR.az, -1.3, aw); aR.el = mix(aR.el, 0.05, aw); aR.hz = mix(aR.hz, -0.5 * prog, aw); aL.ax = mix(aL.ax, 0.6, aw); aL.el = mix(aL.el, -0.6, aw); lean -= 0.6 * aw; // other hand on the knee hx -= 0.25 * aw;
        } else { // working at something with both hands: cutting, unscrewing, prying
          const lw = ak === 'workLow';
          aL.ax = mix(aL.ax, lw ? 0.75 : 0.5, aw); aR.ax = mix(aR.ax, lw ? 0.75 : 0.5, aw); aL.az = mix(aL.az, 1.2, aw); aR.az = mix(aR.az, -1.2, aw); aL.ay = mix(aL.ay, -0.45, aw); aR.ay = mix(aR.ay, 0.45, aw); // hands come together in front
          aL.el = mix(aL.el, -(lw ? 0.9 : 1.2) - jig, aw); aR.el = mix(aR.el, (lw ? 0.9 : 1.2) - jig, aw); aL.hz = mix(aL.hz, 0.4, aw); aR.hz = mix(aR.hz, -0.4, aw);
          lean -= (lw ? 0.15 : 0.1) * aw; hx -= 0.3 * aw;
        }
        M.spine.rotation.x = lean * 0.55; M.torso.rotation.x = lean * 0.45 + breathe;
      }
      // ---- grabbed: shoulders up, hands up in front of the face, head turned away
      if (up) { aL.cz = -0.12; aR.cz = 0.12; aL.az = 1.0; aR.az = -1.0; aL.ay = -0.35; aR.ay = 0.35; aL.ax = 1.2; aR.ax = 1.1; aL.el = -1.75; aR.el = 1.75; aL.hz = -0.3; aR.hz = 0.3; hx = 0.1; nx = 0.05; hy = 0.45; M.spine.rotation.x = 0.06; M.torso.rotation.x = 0.1; }
      const shR = up ? 0 : 0.07 * w * (1 - cr) * Math.sin(ph - 0.25 * w); // the shoulders ride forward and back with the arm swing
      M.clavL.rotation.set(0, shR, aL.cz); M.clavR.rotation.set(0, shR, aR.cz);
      // arm angles are worked out as if from the T-pose; the mesh is bound with its arms already down, so convert
      const E = this._e || (this._e = new THREE.Euler()), Q = this._q || (this._q = new THREE.Quaternion());
      const I0 = this._i0 || (this._i0 = new THREE.Quaternion());
      [[M.armL, M.elbowL, M.handL, aL, M.qbL, M.elbowHL, M.twL], [M.armR, M.elbowR, M.handR, aR, M.qbR, M.elbowHR, M.twR]].forEach(([A, El, Hd, a, qb, EH, TW]) => {
        const qi = qb.clone().invert();
        A.quaternion.setFromEuler(E.set(a.ax, a.ay, a.az)).multiply(qi); // the upper arm is never twisted: that keeps the elbow hinging forward
        const tw = -1 * (1 - up) * (a.tk != null ? a.tk : 1) * (A === M.armR && hw && !(grip && grip.carry) ? 0 : 1) * (1 - (A === M.armL && !/work/.test(ak || '') ? 0 : aw)) * 0.5, xa = this._xa || (this._xa = new THREE.Vector3(1, 0, 0));
        // palms turn in toward the legs at the forearm and wrist (like a real forearm), not at the shoulder
        const add = (a.tk != null ? a.tk : 1) * (A === M.armL ? 1 : -1) * (0.3 * (1 - 0.1 * w) + rf * (0.45 + 2.2 * (a.sway || 0))) * (1 - up) * (1 - 0.7 * rf) * (1 - (A === M.armL && !/work/.test(ak || '') ? 0 : aw));
        El.quaternion.copy(qb).multiply(this._q3 = (this._q3 || new THREE.Quaternion()).setFromAxisAngle(this._za || (this._za = new THREE.Vector3(0, 0, 1)), add)).multiply(Q.setFromEuler(E.set(0, a.el, 0))).multiply(TW ? (this._q2 = (this._q2 || new THREE.Quaternion())).identity() : (this._q2 = (this._q2 || new THREE.Quaternion())).setFromAxisAngle(xa, tw)).multiply(qi);
        // the forearm rolls gradually from none at the elbow to the hand's full turn at the wrist (the hand ends up exactly where it was)
        if (TW) TW.quaternion.copy(qb).multiply(this._q2.setFromAxisAngle(xa, tw * 2)).multiply(qi);
        if (EH) EH.quaternion.copy(I0).slerp(El.quaternion, 0.5);
        Hd.quaternion.copy(qb).multiply(this._q2.setFromAxisAngle(xa, TW ? tw * 2 : tw)).multiply(Q.setFromEuler(E.set(a.hx, a.hy, a.hz))).multiply(qi);
      });
      M.neck.rotation.set(nx + hx, hy, 0); M.head.rotation.set(0, 0, 0); // head and neck move as one solid piece, pivoting at the base of the neck
      if (M.spine2) {
        // the lean, twist and sway worked out above are shared down the whole back (pelvis to shoulders) so it curves instead of hinging
        const a1 = M.spine.rotation, b1 = M.torso.rotation, tx = a1.x + b1.x, ty = a1.y + b1.y, tz = a1.z + b1.z;
        M.spine.rotation.set(tx * 0.28, ty * 0.22, tz * 0.3); M.spine2.rotation.set(tx * 0.27, ty * 0.26, tz * 0.27); M.torso.rotation.set(tx * 0.25, ty * 0.27, tz * 0.25); M.upperChest.rotation.set(tx * 0.2, ty * 0.25, tz * 0.18);
        const nr = M.neck.rotation, nX = nr.x, nY = nr.y; M.neck2.rotation.set(0, 0, 0);
        M.toeL.rotation.set(lL.toe, 0, 0); M.toeR.rotation.set(lR.toe, 0, 0);
        const bR = Math.sin(t * (1.7 + 1.6 * rf)) * (1 + 0.8 * rf); M.ribs.scale.set(1 + 0.018 * bR, 1 + 0.006 * bR, 1 + 0.035 * bR);
      }
      // the thing in your hand
      // ---- fingers: what each hand is doing decides how the fingers close
      if (M.fing) {
        const H = this.HANDS, idH = up ? null : o.held || null, gp = idH ? this.grip(idH) : null, run = rf;
        const mixH = (A, B, u) => A.map((r, i) => r.map((v, j) => v + (B[i][j] - v) * u));
        let R = mixH(H.relax, H.loose, run), L = mixH(H.relax, H.loose, run);
        if (cr > 0.5 && !idH) R = mixH(R, H.loose, 0.5), L = mixH(L, H.loose, 0.5);
        if (gp) { R = H[gp.hand] || H.fist; if (gp.k) R = R.map((r, i) => r.map((v) => v * (i === 4 ? gp.kt || gp.k : gp.k))); }
        if (aw > 0 && !up) {
          if (ak === 'door' || ak === 'use') R = mixH(R, H.flat, aw);
          else if (ak === 'pick' || ak === 'pickLow') R = mixH(R, prog < 0.45 ? H.open : (gp ? R : H.loose), aw); // open as you reach, close on it
          else if (ak === 'drop') R = mixH(R, H.open, aw * Math.min(1, prog * 2));
          else if (/work/.test(ak)) { R = mixH(R, H.fist, aw); L = mixH(L, H.handle, aw); }
          if (ak === 'pickLow') L = mixH(L, H.cup, aw); // other hand on the knee
        }
        if (up) R = L = H.open;
        const Z = this._zv || (this._zv = new THREE.Vector3(0, 0, 1)), Qf = this._qf || (this._qf = new THREE.Quaternion()), Qi = this._qfi || (this._qfi = new THREE.Quaternion());
        [[L, 0, M.qbL, -1], [R, 1, M.qbR, 1]].forEach(([curl, side, qb, sd]) => {
          Qi.copy(qb).invert();
          M.fing[side].forEach((bonesF, f) => {
            const c = f === 0 ? curl[4] : curl[f - 1];
            bonesF.forEach((bn, j) => {
              if (f === 0) Qf.setFromAxisAngle(M.thumbAxis[side], c[j] * (j === 0 ? 0.8 : 1)); else Qf.setFromAxisAngle(Z, -sd * c[j]);
              bn.quaternion.copy(qb).multiply(Qf).multiply(Qi);
            });
          });
        });
      }
      // ---- no snapping: when what he's doing changes all at once (grabbing or putting away an item, an action starting or ending,
      //      getting grabbed, crouching) every joint glides from where it was into the new pose over about 0.15 s, instead of
      //      jumping there in one frame. Ordinary walking and running motion isn't touched — only the jump is eased out.
      //      (The fingers are left exactly as they are.)
      if (o.t != null) {
        const key = [o.held || '', ak || '', up, cr > 0.5 ? 1 : 0].join('|'), dtS = M._st == null ? 0 : t - M._st; M._st = t;
        const SB = M._sb || (M._sb = [M.hip, M.spine, M.spine2, M.torso, M.upperChest, M.neck, M.neck2, M.head, M.clavL, M.clavR, M.armL, M.armR, M.elbowL, M.elbowR, M.elbowHL, M.elbowHR, M.twL, M.twR, M.handL, M.handR, M.legL, M.legR, M.kneeL, M.kneeR, M.kneeHL, M.kneeHR, M.footL, M.footR, M.toeL, M.toeR].filter(Boolean));
        M._legB = M._legB || new Set([M.legL, M.legR, M.kneeL, M.kneeR, M.kneeHL, M.kneeHR, M.footL, M.footR, M.toeL, M.toeR]);
        if (!M._sq || dtS <= 0 || dtS > 0.5) { M._sq = SB.map((b) => b.quaternion.clone()); M._so = SB.map(() => new THREE.Quaternion()); M._sa = SB.map(() => 9); M._sk = key; M._sh = M.hip.position.y; M._soh = 0; M._sah = 9; }
        else {
          const jump = key !== M._sk; M._sk = key; const DUR = 0.2, I = this._qI || (this._qI = new THREE.Quaternion()), tmp = this._qT || (this._qT = new THREE.Quaternion()), E2 = this._qE || (this._qE = new THREE.Quaternion());
          const fade = (a) => { const u = Math.min(1, a / DUR); return 1 - u * u * (3 - 2 * u); }; // holds, then lets go smoothly: no kick at either end
          SB.forEach((b, i) => {
            const T = b.quaternion, prevT = M._sq[i];
            const fast = !M._legB.has(b) && 2 * Math.acos(Math.min(1, Math.abs(T.dot(prevT)))) > 18 * dtS + 0.05; // (legs legitimately swing fast) // a joint asked to turn faster than any body can
            if (jump || fast) { // carry the jump as an offset: what's still showing of the old one, plus the new jump
              E2.identity().slerp(M._so[i], fade(M._sa[i])); M._so[i].copy(E2.multiply(tmp.copy(prevT).multiply(I.copy(T).invert()))).normalize(); M._sa[i] = 0; }
            else M._sa[i] += dtS;
            prevT.copy(T); const f = fade(M._sa[i]); if (f > 0) b.quaternion.premultiply(E2.identity().slerp(M._so[i], f));
          });
          const hy = M.hip.position.y; if (jump || Math.abs(hy - M._sh) > 1.5 * dtS + 0.02) { M._soh = M._soh * fade(M._sah) + (M._sh - hy); M._sah = 0; } else M._sah += dtS; M._sh = hy; M.hip.position.y = hy + M._soh * fade(M._sah);
        }
      }
      // the thing in your hand
      const id = up ? null : o.held || null;
      if (id !== M.held) {
        if (M.held && M.items[M.held]) M.items[M.held].visible = false;
        M.held = id;
        if (id) {
          let m = M.items[id];
          if (!m && TH.Items && TH.Items.buildMesh) {
            try {
              const it = TH.Items.buildMesh(id); it.traverse((q) => { if (q.isMesh) { q.castShadow = true; const cl = (mt) => { const c = mt.clone(); c.userData = { noPBR: true }; return c; }; if (Array.isArray(q.material)) q.material = q.material.map(cl); else if (q.material) q.material = cl(q.material); } });
              const gp = this.grip(id), V = (a) => new THREE.Vector3(...a).normalize();
              const frame = (a, b) => { const x = V(a), y = V(b); y.addScaledVector(x, -y.dot(x)).normalize(); const z = new THREE.Vector3().crossVectors(x, y); return new THREE.Matrix4().makeBasis(x, y, z); };
              const q = new THREE.Quaternion().setFromRotationMatrix(frame(gp.D, gp.T).multiply(frame(gp.A, gp.S).invert()));
              const at = new THREE.Vector3(...gp.at).applyQuaternion(q), spot = (gp.where === 'pinch' ? M.pinch : M.fist).clone();
              it.quaternion.copy(q); it.position.copy(spot.sub(at)); if (gp.off) it.position.add(new THREE.Vector3(...gp.off));
              const wrap = new THREE.Group(); wrap.quaternion.copy(M.qbR); wrap.add(it); M.handR.add(wrap); m = wrap; M.items[id] = m; if (TH.Linear) TH.Linear.fix(m);
            } catch (e) { m = null; console.warn('grip ' + id, e); }
          }
          if (m) m.visible = true;
        }
      }
    },
    buildBlocky() {
      const g = new THREE.Group(); g.userData.dynamic = true; g.visible = false; TH.scene.add(g);
      const m = (c, r, mt, em) => { const x = new THREE.MeshStandardMaterial({ color: c, roughness: r || 0.8, metalness: mt || 0 }); if (em) x.emissive.setHex(em); x.userData.noPBR = true; return x; };
      const hood = m(0x2b2f36, 0.95), hoodDk = m(0x23262c, 0.95), string = m(0xcfcac0, 0.9), pants = m(0x1e1e22, 0.9), skin = m(0xd8a088, 0.6),
        stubble = m(0xb08a72, 1), lips = m(0xc4867a, 0.5), brow = m(0x8a6a48, 0.9), white = m(0xeee8e2, 0.3), iris = m(0x6d8298, 0.2), stud = m(0x101012, 0.3, 0.4),
        hairBase = m(0x4f3420, 0.9), tie = m(0x111111, 0.7), shoe = m(0x141416, 0.6), crepe = m(0x0d0d0f, 0.95),
        silver = m(0xdedee2, 0.3, 0.9), ice = m(0xf4f4f8, 0.15, 0.7, 0x2a2a30), tiger = m(0x8a5a1c, 0.35, 0.2), sapph = m(0x2848c0, 0.15, 0.5);
      // the woven checker on the creepers
      const cc = document.createElement('canvas'); cc.width = 32; cc.height = 16; const cx = cc.getContext('2d'); for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { cx.fillStyle = (x + y) % 2 ? '#e8e4dc' : '#151515'; cx.fillRect(x * 4, y * 4, 4, 4); }
      const checkT = new THREE.CanvasTexture(cc); checkT.magFilter = THREE.NearestFilter; const check = new THREE.MeshStandardMaterial({ map: checkT, roughness: 0.8 }); check.userData.noPBR = true;
      const put = (geo, mat, p, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); p.add(o); return o; };
      const cyl = (rt, rb, h, n) => new THREE.CylinderGeometry(rt, rb, h, n || 12), sph = (r, a, b) => new THREE.SphereGeometry(r, a || 12, b || 9);
      let seed = 7; const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // same curls every time
      const hip = new THREE.Group(); hip.position.y = 0.92; g.add(hip);
      put(new THREE.BoxGeometry(0.34, 0.16, 0.21), pants, hip, 0, 0.01, 0);
      // legs: loose black pants down to black creepers (thick crepe sole, checkered strap)
      const leg = (x) => {
        const j = new THREE.Group(); j.position.set(x, 0, 0); hip.add(j);
        put(cyl(0.09, 0.078, 0.47), pants, j, 0, -0.235, 0); put(sph(0.077), pants, j, 0, -0.47, 0); put(cyl(0.077, 0.071, 0.36), pants, j, 0, -0.65, 0);
        put(new THREE.BoxGeometry(0.112, 0.068, 0.28), shoe, j, 0, -0.846, -0.05); put(new THREE.BoxGeometry(0.122, 0.042, 0.295), crepe, j, 0, -0.899, -0.05);
        put(new THREE.BoxGeometry(0.116, 0.026, 0.11), check, j, 0, -0.81, -0.12);
        return j;
      };
      const legL = leg(-0.1), legR = leg(0.1);
      // the hoodie (the same charcoal as the sleeves you see on your own arms)
      const torso = new THREE.Group(); hip.add(torso);
      put(cyl(0.19, 0.172, 0.54, 16), hood, torso, 0, 0.32, 0).scale.z = 0.62;
      put(cyl(0.178, 0.178, 0.06, 16), hoodDk, torso, 0, 0.06, 0).scale.z = 0.64;
      put(new THREE.CylinderGeometry(0.085, 0.085, 0.42, 12).rotateZ(Math.PI / 2), hood, torso, 0, 0.56, 0).scale.set(1, 1, 0.8);
      put(new THREE.BoxGeometry(0.25, 0.13, 0.012), hoodDk, torso, 0, 0.18, -0.113);
      const hd = put(new THREE.TorusGeometry(0.095, 0.045, 8, 16), hood, torso, 0, 0.62, 0.035); hd.rotation.x = Math.PI / 2 - 0.35; hd.scale.set(1, 0.85, 1);
      put(sph(0.11, 12, 8), hood, torso, 0, 0.55, 0.12).scale.set(1.05, 0.9, 0.55);
      [-0.045, 0.045].forEach((x) => put(cyl(0.006, 0.006, 0.16, 5), string, torso, x, 0.5, -0.12));
      // the iced-out chain and the spider pendant
      const chain = put(new THREE.TorusGeometry(0.075, 0.0065, 6, 28), ice, torso, 0, 0.6, -0.04); chain.rotation.x = Math.PI / 2 + 0.75;
      const spider = new THREE.Group(); spider.position.set(0, 0.535, -0.125); torso.add(spider);
      put(sph(0.016, 8, 6), ice, spider, 0, -0.006, 0).scale.set(1, 1.25, 0.6); put(sph(0.009, 8, 6), ice, spider, 0, 0.016, -0.002);
      for (let k = 0; k < 8; k++) { const s = k < 4 ? -1 : 1, i = k % 4, l = put(cyl(0.0022, 0.0018, 0.034, 4), ice, spider, s * 0.02, 0.012 - i * 0.009, -0.002); l.rotation.z = s * (0.9 + i * 0.35) * (i < 2 ? 1 : -1) + (i < 2 ? 0 : s * 2.2); }
      // neck and head
      put(cyl(0.048, 0.054, 0.1), skin, torso, 0, 0.67, 0.005);
      const head = new THREE.Group(); head.position.y = 0.79; torso.add(head);
      put(sph(0.104, 18, 14), skin, head).scale.set(0.88, 1.08, 0.98);
      put(sph(0.07, 14, 10), skin, head, 0, -0.06, -0.025).scale.set(1, 0.8, 1.05);
      put(new THREE.SphereGeometry(0.073, 14, 8, 0, Math.PI * 2, Math.PI / 2 - 0.15, Math.PI / 2 + 0.15), stubble, head, 0, -0.06, -0.027).scale.set(1, 0.8, 1.05); // light stubble along the jaw and chin
      [-1, 1].forEach((s) => {
        put(sph(0.024, 8, 6), skin, head, s * 0.09, -0.005, 0.005).scale.set(0.55, 1, 0.8); // ears
        put(sph(0.0055, 6, 5), stud, head, s * 0.093, -0.03, -0.002); // black studs
        put(sph(0.0135, 10, 8), white, head, s * 0.034, 0.012, -0.086); put(sph(0.0085, 10, 8), iris, head, s * 0.034, 0.012, -0.0955); // blue-grey eyes
        const b = put(new THREE.BoxGeometry(0.034, 0.006, 0.01), brow, head, s * 0.035, 0.036, -0.096); b.rotation.z = s * -0.12;
      });
      put(new THREE.ConeGeometry(0.016, 0.042, 7).rotateX(-Math.PI / 2), skin, head, 0, -0.012, -0.108); put(sph(0.011, 8, 6), skin, head, 0, -0.026, -0.112);
      const ring = put(new THREE.TorusGeometry(0.0055, 0.0013, 5, 12), silver, head, -0.011, -0.03, -0.112); ring.rotation.y = Math.PI / 2; // nose ring, left nostril
      put(new THREE.BoxGeometry(0.034, 0.009, 0.01), lips, head, 0, -0.054, -0.094);
      // the hair: a curly mop, brown at the roots going blonde at the ends, curls hanging over the forehead
      const cap = put(new THREE.SphereGeometry(0.117, 16, 12, 0, Math.PI * 2, 0, 1.62), hairBase, head, 0, 0.014, 0.012); cap.rotation.x = 0.36; cap.scale.set(0.96, 1, 1.04);
      const C0 = new THREE.Vector3(0, 0.014, 0.008), RX = 0.113, RY = 0.13, RZ = 0.121, Z = new THREE.Vector3(0, 0, 1);
      const dark = [0x3a2414, 0x47301c, 0x553520], mid = [0x6a4428, 0x7a5030, 0x8a5c36], blonde = [0xb3874c, 0xc49a5c, 0xd2ac6e];
      const curlM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 }); curlM.userData.noPBR = true; curlM.userData.lin = true;
      const spots = [];
      const phiMax = (th) => { const c = Math.cos(th); return 1.72 - 0.4 * Math.max(0, c) * Math.max(0, c) + 0.42 * Math.max(0, -c); };
      for (let i = 0; i < 230; i++) { const th = rr() * Math.PI * 2, pm = phiMax(th), ph = Math.acos(1 - rr() * (1 - Math.cos(pm))); spots.push([th, ph, ph / pm, 1]); }
      for (let i = 0; i < 26; i++) { const th = (rr() - 0.5) * 1.5, ph = 1.04 + rr() * 0.26; spots.push([th, ph, 0.8, 1.05]); } // the fringe, down to the brows
      for (let i = 0; i < 18; i++) { const th = (rr() < 0.5 ? -1 : 1) * (1.2 + rr() * 0.9), ph = 1.55 + rr() * 0.28; spots.push([th, ph, 1, 1.02]); } // over the ears
      const curls = new THREE.InstancedMesh(new THREE.TorusGeometry(0.0165, 0.0088, 6, 10), curlM, spots.length), dm = new THREE.Object3D(), col = new THREE.Color();
      spots.forEach(([th, ph, t, push], i) => {
        const d = new THREE.Vector3(Math.sin(ph) * Math.sin(th), Math.cos(ph), -Math.sin(ph) * Math.cos(th)), k = (0.98 + rr() * 0.12) * push;
        dm.position.set(C0.x + d.x * RX * k, C0.y + d.y * RY * k, C0.z + d.z * RZ * k);
        dm.quaternion.setFromUnitVectors(Z, d); dm.rotateZ(rr() * 6.28); dm.rotateX((rr() - 0.5) * 1.4);
        const sc = 0.85 + rr() * 0.5; dm.scale.set(sc, sc, sc); dm.updateMatrix(); curls.setMatrixAt(i, dm.matrix);
        const pal = rr() < 0.04 + 0.4 * t * t * t ? blonde : rr() < 0.5 ? mid : dark; // brown, going blonde at the ends
        col.setHex(pal[Math.floor(rr() * 3)]).convertSRGBToLinear(); curls.setColorAt(i, col);
      });
      curls.frustumCulled = false; head.add(curls);
      // the little braid by the left ear, blonde at the tip, black tie
      for (let k = 0; k < 10; k++) { col.setHex(k < 6 ? 0x8a6038 : 0xd2aa6a); const bm = m(col.getHex(), 0.75); put(sph(0.0105 - k * 0.0003, 7, 5), bm, head, -0.088 + (k % 2 ? 0.006 : -0.006) - k * 0.002, -0.035 - k * 0.019, 0.012 - k * 0.004); }
      put(new THREE.TorusGeometry(0.0085, 0.003, 5, 10).rotateX(Math.PI / 2), tie, head, -0.104, -0.205, -0.024);
      put(new THREE.ConeGeometry(0.009, 0.03, 6).rotateX(Math.PI), m(0xd8b272, 0.75), head, -0.105, -0.225, -0.026);
      // arms: from the elbow down these match the first-person hands (sleeves shoved up, bracelets, rings)
      const arm = (x, right) => {
        const j = new THREE.Group(); j.position.set(x, 0.55, 0); torso.add(j);
        put(cyl(0.062, 0.054, 0.38), hood, j, 0, -0.19, 0);
        [0.37, 0.4].forEach((y, i) => put(new THREE.TorusGeometry(0.052 - i * 0.004, 0.02, 7, 14).rotateX(Math.PI / 2), hood, j, 0, -y, 0));
        put(cyl(0.041, 0.034, 0.22), skin, j, 0, -0.52, 0);
        if (right) { for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; put(sph(0.011, 6, 5), k === 0 ? silver : tiger, j, Math.cos(a) * 0.04, -0.6, Math.sin(a) * 0.036); } }
        else put(new THREE.TorusGeometry(0.038, 0.006, 6, 18).rotateX(Math.PI / 2), sapph, j, 0, -0.6, 0);
        const hand = put(new THREE.BoxGeometry(0.075, 0.1, 0.035), skin, j, 0, -0.69, -0.005); hand.rotation.x = 0.08;
        put(new THREE.BoxGeometry(0.022, 0.055, 0.025), skin, j, (right ? -1 : 1) * 0.045, -0.665, -0.018);
        (right ? [-0.022, 0, 0.022] : [-0.022]).forEach((dx) => put(new THREE.BoxGeometry(0.019, 0.012, 0.04), silver, j, dx * (right ? 1 : -1), -0.73, -0.005));
        return j;
      };
      const armL = arm(-0.25, false), armR = arm(0.25, true);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); TH.Linear.fix(g);
      return (this.man = { g, hip, torso, head, legL, legR, armL, armR, phase: 0 });
    },
    play(done) {
      let fr = this.buf.slice(); this.buf = [];
      for (let i = fr.length - 1; i > 0; i--) { const a = fr[i], b = fr[i - 1]; if (Math.hypot(a.px - b.px, a.pz - b.pz) > 2.5 || Math.hypot(a.ex - b.ex, a.ez - b.ez) > 2.5 || Math.abs(a.py - b.py) > 2) { fr = fr.slice(i); break; } } // only since the last jump (new day, a teleport)
      if (fr.length < 4 || TH.state.mode !== 'play') { done(); return; }
      if (this.man && !this.man.rig && TH.Avatar.ready) { TH.scene.remove(this.man.g); this.man = null; } // the scan finished loading since the stand-in was made
      if (!this.man) this.build();
      // where to put the camera: off to the side of the struggle, somewhere with a clear view
      const L = fr[fr.length - 1], mx = (L.px + L.ex) / 2, mz = (L.pz + L.ez) / 2, lv = TH.Col.levelOf(L.py + 0.1), C = TH.Col;
      const side = Math.atan2(L.ex - L.px, L.ez - L.pz) + Math.PI / 2;
      let best = side, bestR = 1.2;
      for (let k = 0; k < 16; k++) {
        const a = side + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
        let r = 1.0; for (; r <= 3.6; r += 0.2) { const x = mx + Math.sin(a) * r, z = mz + Math.cos(a) * r; if (!C.los(mx, mz, x, z, lv) || !C.walkable(mx, mz, x, z, lv, 0.15)) break; }
        if (r - 0.2 > bestR + 0.3) { bestR = r - 0.2; best = a; } if (bestR >= 3.4) break;
      }
      const el = document.createElement('div'); el.id = 'replay-ov';
      el.innerHTML = '<div style="position:absolute;left:0;right:0;top:0;height:9vh;background:#000"></div><div style="position:absolute;left:0;right:0;bottom:0;height:9vh;background:#000"></div><div style="position:absolute;top:calc(9vh + 10px);left:16px;font:800 18px var(--ui);letter-spacing:.3em;color:#d23a2e;text-shadow:0 1px 6px #000">● REPLAY</div><div style="position:absolute;bottom:calc(9vh + 10px);right:16px;font:700 13px var(--ui);letter-spacing:.12em;color:rgba(236,228,210,.7)">TAP TO SKIP</div>';
      el.style.cssText = 'position:fixed;inset:0;z-index:36;pointer-events:auto';
      document.body.appendChild(el);
      const skip = () => { if (this.cur) this.cur.t = 1e9; }; el.addEventListener('pointerdown', skip); this._key = (e) => { if (/Space|KeyE|Enter|Escape/.test(e.code)) skip(); }; addEventListener('keydown', this._key);
      this.cur = { fr, t: 0, dur: (fr[fr.length - 1].t - fr[0].t), speed: 0.7, done, mx, mz, lv, ang: best, rad: Math.max(1.4, bestR), el, eState: TH.Enemy.state };
      TH.state.replay = true; this.man.g.visible = true; this._hud = document.getElementById('hud').hidden; document.getElementById('hud').hidden = true; TH.Enemy.model.root.visible = true;
    },
    update(dt, t) {
      this.record(dt);
      const c = this.cur;
      if (c) c.dbg = { man: [this.man.g.position.x, this.man.g.position.y, this.man.g.position.z, this.man.g.visible], tim: [TH.Enemy.pos.x, TH.Enemy.y, TH.Enemy.pos.z, TH.Enemy.model.root.visible], cam: [TH.camera.position.x, TH.camera.position.y, TH.camera.position.z] }; if (!c) return;
      c.t += dt * c.speed;
      const fr = c.fr, tt = fr[0].t + Math.min(c.t, c.dur); let i = 0; while (i < fr.length - 2 && fr[i + 1].t < tt) i++;
      const a = fr[i], b = fr[i + 1], u = U.clamp((tt - a.t) / Math.max(1e-3, b.t - a.t), 0, 1), L = (p, q) => p + (q - p) * u;
      // you
      const M = this.man, tr = this.track(fr, i, u, (p, q) => Math.hypot(q.px - p.px, q.pz - p.pz) < 2.5), px = tr.px, pz = tr.pz;
      const S = this.settle(M, U.angleLerp(a.yaw, b.yaw, u), L(a.pt || 0, b.pt || 0), tr.sp, c.t < 1e-6 ? 0 : dt * c.speed), sp = S.sp;
      M.g.position.set(px, L(a.py, b.py), pz); M.g.rotation.y = S.yaw;
      M.g.visible = !a.hid;
      this.stepPhase(M, sp * dt * c.speed, sp, a.crouch);
      const end = c.t >= c.dur - 0.25, aT = a.ak ? a.aT + (tt - a.t) : 0;
      this.posePlayer(M, { ph: M.phase, sp, cr: L(+!!a.crouch, +!!b.crouch), flinch: end, pitch: S.pitch, look: S.look, held: a.hd, ak: a.ak, aT, t }); // at the very end: hands up, flinching away
      // him
      const E = TH.Enemy; E.pos.set(L(a.ex, b.ex), 0, L(a.ez, b.ez)); E.y = L(a.ey, b.ey); E.face = U.angleLerp(a.face, b.face, u); E.state = a.st === 'capture' ? 'chase' : a.st; E.stunT = 0;
      E.animate(dt * c.speed, L(a.sp, b.sp), t);
      if (end) { const m = E.model; m.armL.rotation.x = -1.6; m.armR.rotation.x = -1.5; m.torso.rotation.x = 0.45; } // the grab
      // the camera: frames the two of you when he's close and in the same space, otherwise follows you. It never sits behind a wall:
      // it keeps to a spot it can see you (and him) from, sliding round the room when the view gets blocked.
      const C = TH.Col, lvP = TH.Col.levelOf(M.g.position.y + 0.1), cam = TH.camera;
      const dE = Math.hypot(E.pos.x - px, E.pos.z - pz), both = dE < 7 && Math.abs(E.y - M.g.position.y) < 1.5 && C.los(px, pz, E.pos.x, E.pos.z, lvP);
      const tx = both ? (px + E.pos.x) / 2 : px, tz = both ? (pz + E.pos.z) / 2 : pz, cy = M.g.position.y + 1.2;
      const want = both ? Math.min(3.4, 1.6 + dE * 0.45) : 2.6;
      // what can actually block the view: walls, doors (open or shut), furniture. Not you, him, or the camera itself.
      if (!c.occ) { const skipO = new Set([M.g, E.model.root, cam]); c.occ = TH.scene.children.filter((o) => !skipO.has(o) && !o.isLight && !o.isSprite && !o.isPoints && o.visible !== false); c.rc = new THREE.Raycaster(); }
      const chestP = new THREE.Vector3(px, M.g.position.y + 1.25, pz), chestE = new THREE.Vector3(E.pos.x, E.y + 1.3, E.pos.z);
      const clear = (from, to) => { const d = to.clone().sub(from), L = d.length(); if (L < 0.3) return true; c.rc.set(from, d.multiplyScalar(1 / L)); c.rc.far = L - 0.3; c.rc.near = 0.05; c.rc.camera = cam; let hits; try { hits = c.rc.intersectObjects(c.occ, true); } catch (e) { return true; } return !hits.some((h) => h.object.visible && !(h.object.material && h.object.material.transparent && h.object.material.opacity < 0.5)); };
      const viewOK = (v) => clear(v, chestP) && (!both || clear(v, chestE));
      const sees = (x, z) => C.los(x, z, px, pz, lvP) && (!both || C.los(x, z, E.pos.x, E.pos.z, lvP)) && C.los(tx, tz, x, z, lvP) && C.walkable(tx, tz, x, z, lvP, 0.25);
      if (c.cang == null) c.cang = c.ang;
      c.chk = (c.chk || 0) - dt;
      if (!c.goalA || c.chk <= 0) { // look for a spot a few times a second, not every frame
        c.chk = 0.25; const keep = c.cpos && viewOK(c.cpos);
        let pick = null; const HR = TH.House.roomAt, myRoom = HR(px, pz, lvP), tryAt = (a2, r) => { const x = tx + Math.sin(a2) * r, z = tz + Math.cos(a2) * r; return sees(x, z) && viewOK(new THREE.Vector3(x, cy + 0.45, z)); };
        if (keep && c.goalA != null && tryAt(c.goalA, c.goalR)) pick = { a: c.goalA, r: c.goalR };
        for (let pass = 0; pass < 2 && !pick; pass++) // same room as you first, then anywhere with a clear view
          for (let kk = 0; kk < 24 && !pick; kk++) {
            const a2 = c.cang + (kk % 2 ? 1 : -1) * Math.ceil(kk / 2) * (Math.PI / 12);
            for (let r = want; r >= 0.9; r -= 0.35) { const x = tx + Math.sin(a2) * r, z = tz + Math.cos(a2) * r; if ((pass || !myRoom || HR(x, z, lvP) === myRoom) && tryAt(a2, r)) { pick = { a: a2, r }; break; } }
          }
        if (!pick) pick = { a: c.cang, r: 0.9 };
        const jump = c.cpos && !keep; c.goalA = pick.a; c.goalR = pick.r; c.snap = jump;
      }
      c.cang = c.snap ? c.goalA : U.angleLerp(c.cang, c.goalA + 0.12 * Math.sin(c.t * 0.4), 1 - Math.exp(-2.5 * dt)); c.crad = c.snap || !c.crad ? c.goalR : c.crad + (c.goalR - c.crad) * (1 - Math.exp(-3 * dt));
      const goal = new THREE.Vector3(tx + Math.sin(c.cang) * c.crad, cy + 0.45, tz + Math.cos(c.cang) * c.crad);
      if (!c.cpos || c.snap) c.cpos = goal.clone(); else c.cpos.lerp(goal, 1 - Math.exp(-4 * dt)); // a hard cut when the view gets blocked, a drift otherwise
      c.snap = false;
      c.look = c.look || new THREE.Vector3(tx, cy - 0.15, tz); c.look.lerp(new THREE.Vector3(tx, cy - 0.15, tz), 1 - Math.exp(-5 * dt));
      cam.position.copy(c.cpos); cam.lookAt(c.look);
      if (c.t >= c.dur + 0.9) this.finish();
    },
    finish() {
      const c = this.cur; if (!c) return; this.cur = null;
      c.el.remove(); removeEventListener('keydown', this._key);
      this.man.g.visible = false; TH.state.replay = false; document.getElementById('hud').hidden = !!this._hud; TH.Enemy.state = c.eState;
      c.done();
    },
  };
})();
