/* TRAP HOUSE — escape routes the Tenant can't follow: holes punched through walls, a hole in the floor, and an attic-style ladder.
   He's too big for them, so leading him past one and slipping through buys you time while he goes the long way around. */
(function () {
  'use strict';
  const TH = window.TH;
  const S = (TH.Shortcuts = {
    list: [
      { kind: 'crawl', level: 0, x: 5.3, z: -4, axis: 'x', name: 'den ↔ mudroom' },
      { kind: 'crawl', level: 0, x: 12, z: 0, axis: 'z', name: 'bathroom ↔ pantry' },
      { kind: 'crawl', level: 1, x: -7.5, z: -4, axis: 'x', name: 'sewing room ↔ kid’s room' },
      { kind: 'crawl', level: 1, x: 5, z: -4, axis: 'x', name: 'upstairs bath ↔ storage room' },
      { kind: 'drop', from: { x: -5, z: -0.5, level: 1 }, name: 'sewing room floor → dining room' },
      { kind: 'ladder', x: 3.45, z: -11, name: 'mudroom ↔ storage room' },
    ],
    // low things you can vault straight over (he has to go round): [name, level, x0, x1, z0, z1, height]
    vaults: [
      ['kitchen island', 0, -12.4, -10.6, -8.3, -7.3, 0.92], ['couch', 0, -8.65, -6.35, 7.72, 8.68, 0.8], ['couch', 0, 7.25, 9.55, 7.92, 8.88, 0.8],
      ['couch', 0, 4.85, 7.15, 0.42, 1.38, 0.8], ['fallen branch', 1, -2.9, 1.85, -9.65, -8.95, 0.85], ['fallen tree', 0, -8.55, -7.5, -26.6, -25.3, 1.0],
    ],

    build(scene) {
      const Hs = TH.House, h = Hs.h, H = Hs.H, add = (g, m, x, y, z, p) => h.addMesh(g, m, x, y, z, p);
      const dark = new THREE.MeshBasicMaterial({ color: 0x050403 });
      const plaster = new THREE.MeshStandardMaterial({ color: 0xc8bfa6, roughness: 0.95 }), lath = h.woodMat(0x8a6a44), splinter = h.woodMat(0x6a4a2a);
      const chunks = (lv, x, z, n) => { for (let i = 0; i < n; i++) { const c = add(new THREE.DodecahedronGeometry(0.02 + Math.random() * 0.05, 0), plaster, x + (Math.random() - 0.5) * 0.9, lv * H + 0.02, z + (Math.random() - 0.5) * 0.9); c.rotation.set(Math.random() * 3, Math.random() * 3, 0); } };
      const jag = (w, hh) => { const s = new THREE.Shape(); const pts = []; for (let i = 0; i <= 10; i++) pts.push([-w / 2 + (w * i) / 10, hh + (Math.random() * 0.08)]); for (let i = 0; i <= 6; i++) pts.push([w / 2 + Math.random() * 0.06, hh - (hh * i) / 6]); s.moveTo(-w / 2 - 0.04, 0);
        pts.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.lineTo(a - 0.03, b))); for (let i = 0; i <= 6; i++) s.lineTo(-w / 2 - Math.random() * 0.06, (hh * i) / 6); return new THREE.ShapeGeometry(s); };
      this.list.forEach((sc) => {
        if (sc.kind === 'crawl') {
          const lv = sc.level, y = lv * H; sc.a = sc.axis === 'x' ? { x: sc.x, z: sc.z - 0.8 } : { x: sc.x - 0.8, z: sc.z }; sc.b = sc.axis === 'x' ? { x: sc.x, z: sc.z + 0.8 } : { x: sc.x + 0.8, z: sc.z };
          [-1, 1].forEach((side) => { // broken plaster rim + snapped lath on both faces
            const g = new THREE.Group(); scene.add(g); g.position.set(sc.x + (sc.axis === 'z' ? side * 0.105 : 0), y, sc.z + (sc.axis === 'x' ? side * 0.105 : 0)); g.rotation.y = sc.axis === 'x' ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
            // broken plaster ring: jagged outside edge, the real opening inside (you can peek through)
            const ring = new THREE.Shape(); ring.moveTo(-0.52, 0); for (let i = 0; i <= 12; i++) ring.lineTo(-0.52 + (1.04 * i) / 12 + (Math.random() - 0.5) * 0.04, 0.84 + Math.random() * 0.1); ring.lineTo(0.52, 0); ring.lineTo(-0.52, 0);
            const hole = new THREE.Path(); hole.moveTo(-0.375, 0.0); hole.lineTo(-0.375, 0.72); hole.lineTo(0.375, 0.72); hole.lineTo(0.375, 0.0); ring.holes.push(hole);
            add(new THREE.ShapeGeometry(ring), new THREE.MeshStandardMaterial({ color: 0xa89c84, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0, 0.003, g);
            for (let i = 0; i < 4; i++) { const l = add(new THREE.BoxGeometry(0.2 + Math.random() * 0.25, 0.025, 0.012), lath, (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.15), 0.1 + i * 0.18, -0.03, g); l.rotation.z = (Math.random() - 0.5) * 0.6; }
          });
          chunks(lv, sc.a.x, sc.a.z, 6); chunks(lv, sc.b.x, sc.b.z, 6);
        }
        if (sc.kind === 'drop') {
          const f = sc.from, y1 = H;
          const hole = add(jag(1.0, 0.9), dark, f.x, y1 + 0.01, f.z + 0.45); hole.rotation.x = -Math.PI / 2;
          for (let i = 0; i < 7; i++) { const b = add(new THREE.BoxGeometry(0.12, 0.03, 0.3 + Math.random() * 0.25), splinter, f.x - 0.5 + i * 0.16, y1 + 0.02, f.z + (i % 2 ? 0.55 : -0.55)); b.rotation.x = (i % 2 ? 1 : -1) * (0.25 + Math.random() * 0.35); }
          const ceil = add(jag(1.0, 0.9), dark, f.x, H - 0.03, f.z - 0.45); ceil.rotation.x = Math.PI / 2;
          for (let i = 0; i < 5; i++) { const b = add(new THREE.BoxGeometry(0.1, 0.4 + Math.random() * 0.4, 0.03), splinter, f.x - 0.35 + i * 0.18, H - 0.3, f.z + (Math.random() - 0.5) * 0.6); b.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5); }
          chunks(0, f.x, f.z, 12);
          sc.col = TH.Col.addRect(1, f.x, f.z, 0.95, 0.95, false);
          sc.to = { x: f.x, z: f.z };
        }
        if (sc.kind === 'ladder') {
          const g = new THREE.Group(); scene.add(g); g.position.set(sc.x, 0, sc.z);
          [-0.22, 0.22].forEach((dz) => { const r = add(new THREE.BoxGeometry(0.06, H + 1.0, 0.04), lath, 0, (H + 1.0) / 2, dz, g); r.rotation.z = -0.06; });
          for (let y = 0.3; y < H + 0.9; y += 0.3) add(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8), lath, -0.06 + y * 0.06 * 0.25, y, 0, g).rotation.x = Math.PI / 2;
          // hatch: dark opening in the laundry ceiling + framed hole in the spare-room floor
          add(new THREE.PlaneGeometry(0.8, 1.0), dark, sc.x + 0.1, H - 0.03, sc.z).rotation.x = Math.PI / 2;
          [[0.9, 0.06, 0.06, 0.1, -0.53], [0.9, 0.06, 0.06, 0.1, 0.53], [0.06, 0.06, 1.1, 0.53, 0], [0.06, 0.06, 1.1, -0.33, 0]].forEach(([a, b, c, dx, dz]) => add(new THREE.BoxGeometry(a, b, c), lath, sc.x + dx, H - 0.06, sc.z + dz));
          add(new THREE.PlaneGeometry(0.8, 1.0), dark, sc.x + 0.1, H + 0.008, sc.z).rotation.x = -Math.PI / 2;
          [[0.9, 0.06, 0.06, 0.1, -0.53], [0.9, 0.06, 0.06, 0.1, 0.53], [0.06, 0.06, 1.1, 0.53, 0]].forEach(([a, b, c, dx, dz]) => add(new THREE.BoxGeometry(a, b, c), lath, sc.x + dx, H + 0.03, sc.z + dz));
          TH.Col.addRect(0, sc.x - 0.05, sc.z, 0.3, 0.55, false);
          sc.col = TH.Col.addRect(1, sc.x + 0.1, sc.z, 0.8, 1.0, false);
          sc.bottom = { x: sc.x + 0.6, z: sc.z }; sc.top = { x: sc.x + 0.85, z: sc.z };
        }
      });
    },

    register() {
      const IS = TH.Interact, P = TH.Player, H = TH.House.H;
      const look = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
      this.list.forEach((sc) => {
        if (sc.kind === 'crawl') {
          [[sc.a, sc.b], [sc.b, sc.a]].forEach(([from, to]) => {
            IS.add({ x: from.x, z: from.z, level: sc.level, r: 1.4, hold: 0, prompt: () => 'CRAWL THROUGH THE HOLE', short: 'CRAWL',
              use: () => {
                const y = sc.level * H, yaw = look(from, to);
                TH.Audio.play('crawl'); TH.Noise.emit(sc.x, sc.z, sc.level, 2, 'scraping in the walls');
                P.travel([{ x: from.x, y: y + P.eye, z: from.z, yaw, pitch: -0.1 }, { x: from.x + (sc.x - from.x) * 0.6, y: y + 0.45, z: from.z + (sc.z - from.z) * 0.6, yaw, pitch: -0.2 },
                  { x: to.x - (to.x - sc.x) * 0.4, y: y + 0.42, z: to.z - (to.z - sc.z) * 0.4, yaw, pitch: 0 }, { x: to.x, y: y + 0.95, z: to.z, yaw, pitch: 0 }], 1.5,
                { level: sc.level, crouch: true, wobble: 1, hideHands: true, tick: (p) => { if (Math.random() < 0.05) TH.Audio.play('crawl'); } });
                TH.Bus.emit('shortcut', sc);
              } });
          });
        }
        if (sc.kind === 'drop') {
          const f = sc.from;
          IS.add({ x: f.x, z: f.z, level: 1, r: 1.4, hold: 0, prompt: () => 'DROP THROUGH THE FLOOR', short: 'DROP',
            use: () => {
              const yaw = P.yaw;
              P.travel([{ x: P.pos.x, y: H + P.eye, z: P.pos.z, yaw, pitch: -0.6 }, { x: f.x, y: H + 0.6, z: f.z, yaw, pitch: -0.3 }, { x: f.x, y: 0.55, z: f.z, yaw, pitch: 0.1 }, { x: f.x, y: 0.95, z: f.z, yaw, pitch: 0 }], 0.9,
                { level: 0, crouch: true, hideHands: true, done: () => { TH.Audio.play('thud'); TH.Noise.emit(f.x, f.z, 0, 9, 'something crashing through the ceiling'); TH.UI.noisePulse(2); } });
              TH.Bus.emit('shortcut', sc);
            } });
        }
        if (sc.kind === 'ladder') {
          const up = (dir) => {
            const a = dir > 0 ? sc.bottom : sc.top, b = dir > 0 ? sc.top : sc.bottom, yaw = dir > 0 ? look(sc.bottom, { x: sc.x, z: sc.z }) : look(sc.top, { x: sc.x + 2, z: sc.z });
            const y0 = dir > 0 ? 0 : H, y1 = dir > 0 ? H : 0;
            P.travel([{ x: a.x, y: y0 + 1.6, z: a.z, yaw, pitch: dir > 0 ? 0.6 : -0.7 }, { x: sc.x + 0.35, y: y0 + 1.5, z: sc.z, yaw, pitch: dir > 0 ? 0.9 : -0.4 }, { x: sc.x + 0.35, y: y1 + (dir > 0 ? 0.9 : 1.4), z: sc.z, yaw, pitch: dir > 0 ? 0.4 : -0.6 }, { x: b.x, y: y1 + 1.6, z: b.z, yaw: dir > 0 ? look(sc.bottom, { x: sc.x + 3, z: sc.z }) : yaw + Math.PI, pitch: 0 }], 2.2,
              { level: dir > 0 ? 1 : 0, wobble: 0.5, tick: (p) => { if (Math.random() < 0.06) TH.Audio.play('climb'); } });
            TH.Noise.emit(sc.x, sc.z, dir > 0 ? 0 : 1, 3, 'a ladder creaking'); TH.Bus.emit('shortcut', sc);
          };
          IS.add({ x: sc.bottom.x, z: sc.bottom.z, level: 0, r: 1.4, hold: 0, prompt: () => 'CLIMB UP THE LADDER', short: 'CLIMB', use: () => up(1) });
          IS.add({ x: sc.top.x, z: sc.top.z, level: 1, r: 1.4, hold: 0, prompt: () => 'CLIMB DOWN THE LADDER', short: 'CLIMB', use: () => up(-1) });
        }
      });
      this.registerRail();
    },

    /* Stair railing: vault over it from the upstairs hall onto the stairs (and back up), so you can slip past him on the stairs. */
    registerRail() {
      const IS = TH.Interact, P = TH.Player, H = TH.House.H, C = TH.Col;
      const M = TH.House.MAIN, RX = M.x1, SX = (M.x0 + M.x1) / 2, Z0 = M.zt + 0.15, Z1 = M.zb - 0.15; // rail line, stair centre, usable span (the whole length)
      const stairY = (z) => TH.util.clamp((z - M.zb) / (M.zt - M.zb), 0, 1) * H;
      const onStairs = () => !!C.stairAt(P.pos.x, P.pos.z, P.y);
      const zr = () => TH.util.clamp(P.pos.z, Z0, Z1);
      const go = (pts, endY, msg) => {
        P.travel(pts, 0.85, { level: C.levelOf(endY), y: endY, wobble: 0.6, hideHands: true,
          done: () => { TH.Audio.play('thud'); TH.Noise.emit(P.pos.x, P.pos.z, C.levelOf(endY), 7, msg); TH.UI.noisePulse(1.5); } });
        TH.Audio.play('climb'); TH.Bus.emit('shortcut', { kind: 'rail' });
      };
      // over the rail, down onto the stairs
      IS.add({ get x() { return RX; }, get z() { return zr(); }, level: 1, r: 1.5, hold: 0,
        prompt: () => (!onStairs() && P.pos.x > RX && P.pos.z > Z0 - 0.6 && P.pos.z < Z1 + 0.6 ? 'VAULT OVER THE RAILING' : null), short: 'VAULT',
        use: () => {
          const z = zr(), y = stairY(z), yaw = Math.PI / 2; // face the stairwell (−x)
          go([{ x: P.pos.x, y: H + P.eye, z: P.pos.z, yaw, pitch: -0.3 }, { x: RX + 0.15, y: H + 1.75, z, yaw, pitch: -0.55 }, { x: RX - 0.45, y: H + 1.35, z, yaw, pitch: -0.7 },
            { x: SX, y: y + 1.25, z, yaw: Math.PI, pitch: -0.2 }, { x: SX, y: y + 1.6, z, yaw: Math.PI, pitch: 0 }], y, 'someone landing on the stairs');
        } });
      // the short rail across the end of the stairwell: over it and down onto the bottom steps
      const RZ = M.zb, X0r = M.x0 + 0.15, X1r = M.x1 - 0.15, xr = () => TH.util.clamp(P.pos.x, X0r, X1r);
      IS.add({ get x() { return xr(); }, z: RZ, level: 1, r: 1.5, hold: 0,
        prompt: () => (!onStairs() && P.pos.z > RZ && P.pos.x > X0r - 0.6 && P.pos.x < X1r + 0.4 ? 'VAULT OVER THE RAILING' : null), short: 'VAULT',
        use: () => {
          const x = xr(), z = RZ - 0.55, y = stairY(z), yaw = 0; // face the stairwell (−z)
          go([{ x: P.pos.x, y: H + P.eye, z: P.pos.z, yaw, pitch: -0.3 }, { x, y: H + 1.75, z: RZ + 0.15, yaw, pitch: -0.6 }, { x, y: H + 1.2, z: RZ - 0.3, yaw, pitch: -0.8 },
            { x: SX, y: y + 1.2, z, yaw: Math.PI, pitch: -0.2 }, { x: SX, y: y + 1.6, z, yaw: Math.PI, pitch: 0 }], y, 'someone landing on the stairs');
        } });
      // from the stairs, haul yourself back over into the hall
      IS.add({ get x() { return RX; }, get z() { return zr(); }, r: 1.6, hold: 0,
        prompt: () => (onStairs() && P.y > H * 0.35 && P.pos.z > Z0 - 0.3 && P.pos.z < Z1 ? 'CLIMB OVER THE RAILING' : null), short: 'CLIMB',
        use: () => {
          const z = zr(), yaw = -Math.PI / 2; // face the hall (+x)
          go([{ x: P.pos.x, y: P.y + P.eye, z: P.pos.z, yaw, pitch: 0.4 }, { x: RX - 0.35, y: H + 1.3, z, yaw, pitch: 0.2 }, { x: RX + 0.2, y: H + 1.75, z, yaw, pitch: -0.4 },
            { x: RX + 0.9, y: H + 1.6, z, yaw, pitch: 0 }], H, 'someone climbing the banister');
        } });
      this.registerVaults();
    },

    /* Vaulting: hop over a couch, the kitchen island, the fallen branch upstairs, the tree trunk in the yard. He can't, so
       he has to go round. And off the back deck: over the railing and a hard drop into the yard. */
    registerVaults() {
      const IS = TH.Interact, P = TH.Player, H = TH.House.H, C = TH.Col;
      this.vaults.forEach(([name, lv, x0, x1, z0, z1, h]) => {
        const alongX = x1 - x0 >= z1 - z0; // you cross the short way
        const side = () => (alongX ? (P.pos.z < (z0 + z1) / 2 ? -1 : 1) : (P.pos.x < (x0 + x1) / 2 ? -1 : 1));
        const ok = () => {
          if (P.level() !== lv || C.stairAt(P.pos.x, P.pos.z, P.y)) return false;
          if (alongX) return P.pos.x > x0 + 0.15 && P.pos.x < x1 - 0.15 && Math.abs(P.pos.z - (side() < 0 ? z0 : z1)) < 1.0;
          return P.pos.z > z0 + 0.15 && P.pos.z < z1 - 0.15 && Math.abs(P.pos.x - (side() < 0 ? x0 : x1)) < 1.0;
        };
        IS.add({ get x() { return alongX ? TH.util.clamp(P.pos.x, x0, x1) : (side() < 0 ? x0 : x1); }, get z() { return alongX ? (side() < 0 ? z0 : z1) : TH.util.clamp(P.pos.z, z0, z1); }, level: lv, y: lv * H + h, r: 1.3, hold: 0,
          prompt: () => (ok() ? 'VAULT OVER THE ' + name.toUpperCase() : null), short: 'VAULT', bias: () => 0.3,
          use: () => {
            const sd = side(), y0 = lv * H, yaw = alongX ? (sd < 0 ? Math.PI : 0) : (sd < 0 ? -Math.PI / 2 : Math.PI / 2);
            const tx = alongX ? P.pos.x : sd < 0 ? x1 + 0.55 : x0 - 0.55, tz = alongX ? (sd < 0 ? z1 + 0.55 : z0 - 0.55) : P.pos.z;
            const mx = alongX ? P.pos.x : (x0 + x1) / 2, mz = alongX ? (z0 + z1) / 2 : P.pos.z;
            P.travel([{ x: P.pos.x, y: y0 + P.eye, z: P.pos.z, yaw, pitch: -0.25 }, { x: mx, y: y0 + h + 0.95, z: mz, yaw, pitch: -0.35 }, { x: tx, y: y0 + 1.1, z: tz, yaw, pitch: -0.15 }, { x: tx, y: y0 + P.eye, z: tz, yaw, pitch: 0 }], 0.62,
              { level: lv, y: y0, wobble: 0.5, hideHands: true, done: () => { TH.Audio.play('thud'); TH.Noise.emit(tx, tz, lv, 5, 'something thumping over the furniture'); } });
            TH.Audio.play('climb'); TH.Bus.emit('vault', name);
          } });
      });
      // the back deck: over the rail, drop into the yard (Tim has to come round by the stairs)
      const BR = TH.Grounds && TH.Grounds.backRail; if (!BR) return;
      const okD = () => P.level() === 1 && P.pos.z > BR.z && P.pos.z < BR.z + 1.1 && P.pos.x > BR.x0 && P.pos.x < BR.x1 && !(P.pos.x > -9.7 && P.pos.x < -7.1);
      IS.add({ get x() { return TH.util.clamp(P.pos.x, BR.x0, BR.x1); }, z: BR.z, level: 1, y: H + 1.0, r: 1.4, hold: 0,
        prompt: () => (okD() ? 'VAULT THE RAILING AND DROP' : null), short: 'DROP',
        use: () => {
          const x = P.pos.x, yaw = 0, zl = BR.z - 0.9;
          P.travel([{ x, y: H + P.eye, z: P.pos.z, yaw, pitch: -0.3 }, { x, y: H + 1.8, z: BR.z + 0.1, yaw, pitch: -0.7 }, { x, y: H + 1.2, z: BR.z - 0.4, yaw, pitch: -0.9 }, { x, y: 0.55, z: zl, yaw, pitch: -0.2 }, { x, y: 1.6, z: zl, yaw, pitch: 0 }], 1.0,
            { level: 0, y: 0, wobble: 0.9, hideHands: true, done: () => { TH.Audio.play('thud'); TH.Noise.emit(x, zl, 0, 10, 'someone landing hard in the yard'); TH.UI.noisePulse(2); } });
          TH.Audio.play('climb'); TH.Bus.emit('shortcut', { kind: 'deckdrop' });
        } });
    },
  });
})();
