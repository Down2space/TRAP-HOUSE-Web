/* TRAP HOUSE — outside the walls: a wraparound upstairs deck (front, both sides, the back and over the garage
   roof) with a second door in and a staircase down; a fenced backyard to explore; and a basement under the
   house that you reach through the cellar doors in the backyard. */
(function () {
  'use strict';
  const TH = window.TH;
  const R = (a, b) => a + Math.random() * (b - a);

  TH.Grounds = {
    sheets: [], embers: null,

    build(scene) {
      const Hs = TH.House, h = Hs.h, H = Hs.H, C = TH.Col, add = h.addMesh;
      const B = (w, hh, d, mat, x, y, z, parent, uv) => { const g = new THREE.BoxGeometry(w, hh, d); if (uv) TH.Tex.boxUV(g, w, hh, d, uv); return add(g, mat, x, y, z, parent); };
      // outdoor materials get a faint moonlit glow so they read at night (like outside.js)
      const moon = (map, color, o) => new THREE.MeshStandardMaterial(Object.assign({ map: map || null, color, roughness: 0.85, emissive: new THREE.Color(color).multiplyScalar(0.16), emissiveMap: map || null }, o || {}));
      const deckM = moon(TH.Tex.deckWood || TH.Tex.floorWood, 0x9a8a74), beamM = moon(TH.Tex.wood, 0x6a5a48), railM = moon(TH.Tex.wood, 0x8a8070), postM = moon(TH.Tex.wood, 0x5a4a3a);
      const rooms = Hs.rooms, walk = Hs.walkAreas;

      /* ================= the wraparound deck (level 1, floor at H) ================= */
      const DECK = [
        { name: 'Front Deck', x0: -18.6, x1: 18.6, z0: 12.1, z1: 14.6 },
        { name: 'West Deck', x0: -18.6, x1: -16.1, z0: -14.6, z1: 12.1 },
        { name: 'Back Deck', x0: -18.6, x1: 23.1, z0: -14.6, z1: -12.1 },
        { name: 'East Deck', x0: 16.1, x1: 18.6, z0: -2.9, z1: 12.1 },
        { name: 'Garage Roof', x0: 16.1, x1: 23.1, z0: -12.1, z1: -2.9, roof: true },
      ];
      const SX0 = 6, SX1 = 7.6, CX0 = -9.2, CX1 = -7.6, CZT = -17.0, CZB = -13.0; // deck stairs; cellar steps (top in the yard, bottom in the basement)
      DECK.forEach((d) => {
        const w = d.x1 - d.x0, dd = d.z1 - d.z0, cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
        B(w, 0.16, dd, d.roof ? moon(null, 0x3a3836, { roughness: 0.95 }) : deckM, cx, H - 0.08, cz, null, d.roof ? 0 : 1.2);
        if (d.roof) { // tar-paper roof with a few patches and a vent pipe
          for (let i = 0; i < 4; i++) B(R(0.6, 1.4), 0.01, R(0.5, 1.2), moon(null, 0x2a2826), R(d.x0 + 1, d.x1 - 1), H + 0.005, R(d.z0 + 1, d.z1 - 1)).rotation.y = R(0, 3);
          add(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 10), moon(null, 0x6a6a66, { metalness: 0.6 }), 22.4, H + 0.3, -5);
        } else { // beams underneath
          if (w > dd) [d.z0 + 0.1, d.z1 - 0.1].forEach((z) => B(w, 0.25, 0.12, beamM, cx, H - 0.29, z)); else [d.x0 + 0.1, d.x1 - 0.1].forEach((x) => B(0.12, 0.25, dd, beamM, x, H - 0.29, cz));
        }
        rooms.push({ id: d.name.toLowerCase().replace(/ /g, '_'), name: d.name, level: 1, x0: d.x0, x1: d.x1, z0: d.z0, z1: d.z1, floor: 'wood' });
        walk.push({ level: 1, x0: d.x0, x1: d.x1, z0: d.z0, z1: d.z1 });
      });
      // support posts down to the ground along the outside edge (they're solid in the backyard)
      const post = (x, z) => { if (x > CX0 - 0.4 && x < CX1 + 0.4 && z < CZB + 0.4) return; if (x > SX0 - 0.3 && x < SX1 + 0.3 && z < -12.2) return; B(0.16, H - 0.2, 0.16, postM, x, (H - 0.2) / 2, z); C.addRect(0, x, z, 0.2, 0.2, false); };
      for (let x = -18.5; x <= 16; x += 2.6) { post(x, 14.5); post(x, -14.5); }
      for (let z = -12; z <= 12; z += 2.6) post(-18.5, z);
      for (let z = -1; z <= 12; z += 2.6) post(18.5, z);
      post(18.5, 14.5); post(18.5, -14.5); post(23, -14.5); post(20.8, -14.5);

      // railings: posts, top & bottom rails, balusters. Colliders keep you on the deck.
      const railRun = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0), ax = x1 !== x0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        [H + 1.0, H + 0.12].forEach((y, i) => B(ax ? len : 0.07, i ? 0.06 : 0.08, ax ? 0.07 : len, railM, cx, y, cz));
        for (let t = 0; t <= len + 0.01; t += 0.14) { const x = ax ? x0 + Math.sign(x1 - x0) * t : x0, z = ax ? z0 : z0 + Math.sign(z1 - z0) * t; B(0.035, 0.86, 0.035, railM, x, H + 0.56, z); }
        for (let t = 0; t <= len + 0.01; t += 1.6) { const x = ax ? x0 + Math.sign(x1 - x0) * t : x0, z = ax ? z0 : z0 + Math.sign(z1 - z0) * t; B(0.1, 1.12, 0.1, postM, x, H + 0.56, z); }
        if (ax) C.addBox(1, Math.min(x0, x1), z0 - 0.08, Math.max(x0, x1), z0 + 0.08, false); else C.addBox(1, x0 - 0.08, Math.min(z0, z1), x0 + 0.08, Math.max(z0, z1), false);
      };
      railRun(-18.55, 14.55, 18.55, 14.55);           // front
      railRun(-18.55, -14.55, -18.55, 14.55);         // west
      railRun(-18.55, -14.55, SX0, -14.55); railRun(SX1, -14.55, 23.05, -14.55); // back, gap for the stairs
      railRun(18.55, -2.9, 18.55, 14.55);             // east
      railRun(23.05, -14.55, 23.05, -2.9);            // garage roof, far side
      railRun(18.55, -2.95, 23.05, -2.95);            // garage roof, street side
      this.backRail = { x0: -18.4, x1: SX0 - 0.2, z: -14.55 }; // you can vault this and drop into the yard
      // lanterns on the house wall, so the deck isn't pitch black
      const lantern = (level, x, z, ry) => {
        const y = level * H + 2.05, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
        const iron = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.5 });
        B(0.18, 0.26, 0.18, iron, 0, 0, 0.12, g); B(0.04, 0.04, 0.14, iron, 0, 0.08, 0.02, g);
        const glassM = new THREE.MeshBasicMaterial({ color: 0xffd28a }); const b = add(new THREE.BoxGeometry(0.13, 0.19, 0.13), glassM, 0, 0, 0.12, g); b.userData.dynamic = true;
        add(new THREE.ConeGeometry(0.15, 0.1, 4), iron, 0, 0.18, 0.12, g).rotation.y = Math.PI / 4;
        const fx = Math.sin(ry) * 0.12, fz = Math.cos(ry) * 0.12;
        Hs.fixtures.push({ x: x + fx * 2.5, y: y - 0.1, z: z + fz * 2.5, level, bulb: b, mat: glassM, power: 0.7, flicker: Math.random() < 0.4, color: 0xffc070 });
      };
      lantern(1, -8, 12.15, 0); lantern(1, 8, 12.15, 0); lantern(1, -16.15, 6, -Math.PI / 2); lantern(1, -6, -12.15, Math.PI); lantern(1, 14, -12.15, Math.PI); lantern(1, 16.15, 3, Math.PI / 2);
      lantern(0, 2.3, -12.15, Math.PI); // porch light by the back door
      Hs.fixtures.slice(-7).forEach((f, i) => { if (i % 2) { f.power = 0; f.mat.color.setHex(0x2a2620); } else f.power *= 0.6; }); // half the lanterns are dead
      // a couple of things on the deck
      { const wicker = moon(null, 0x8a6a40); const ch = new THREE.Group(); ch.position.set(-17.4, H, 4); ch.rotation.y = Math.PI / 2; scene.add(ch);
        B(0.6, 0.06, 0.55, wicker, 0, 0.42, 0, ch); B(0.6, 0.6, 0.06, wicker, 0, 0.72, -0.26, ch); [[-0.27, -0.24], [0.27, -0.24], [-0.27, 0.24], [0.27, 0.24]].forEach(([x, z]) => B(0.04, 0.42, 0.04, wicker, x, 0.21, z, ch));
        C.addRect(1, -17.4, 4, 0.6, 0.6, false);
        // the garage roof is the big open part of the deck: an old patio set, a grill, a lounger, dead planters and a string of bulbs
        const metal = TH.Tex.rusty(moon(null, 0x4a4c48, { metalness: 0.55, roughness: 0.6 }), 0x9a9a96), rustM = TH.Tex.rusty(moon(null, 0x5a3a26, { metalness: 0.4 }), 0x9a7a66), canvasM = moon(null, 0x6a3a30, { roughness: 1 });
        const chairAt = (x, z, ry) => { const c = new THREE.Group(); c.position.set(x, H, z); c.rotation.y = ry; scene.add(c);
          B(0.46, 0.04, 0.44, metal, 0, 0.45, 0, c); B(0.46, 0.5, 0.04, metal, 0, 0.72, -0.21, c); [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]].forEach(([a, b2]) => B(0.03, 0.45, 0.03, metal, a, 0.22, b2, c));
          for (let i = 0; i < 4; i++) B(0.44, 0.02, 0.02, metal, 0, 0.55 + i * 0.12, -0.21, c); C.addRect(1, x, z, 0.5, 0.5, false); };
        { const x = 19.8, z = -7.6; add(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 24), metal, x, H + 0.72, z); add(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), metal, x, H + 0.36, z);
          add(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8), moon(null, 0x8a8478), x, H + 1.1, z); add(new THREE.ConeGeometry(0.16, 1.2, 8), canvasM, x, H + 1.75, z); // the umbrella, folded shut
          C.addRect(1, x, z, 1.2, 1.2, false); h.spawn(1, x - 0.25, 0.75, z + 0.1, 'on the patio table on the roof deck');
          chairAt(x + 0.95, z + 0.2, -Math.PI / 2 - 0.3); chairAt(x - 0.95, z - 0.3, Math.PI / 2 + 0.2); const tip = new THREE.Group(); tip.position.set(x + 0.2, H + 0.23, z + 1.2); tip.rotation.set(0, 0.8, Math.PI / 2); scene.add(tip); B(0.46, 0.04, 0.44, metal, 0, 0, 0, tip); B(0.46, 0.5, 0.04, metal, 0, 0.27, -0.21, tip); C.addRect(1, x + 0.2, z + 1.2, 0.6, 0.6, false); }
        { const x = 22.3, z = -4.2; add(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), moon(null, 0x1a1a1a, { metalness: 0.4 }), x, H + 0.8, z); const lid = add(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), moon(null, 0x1a1a1a, { metalness: 0.4 }), x + 0.1, H + 0.86, z); lid.rotation.z = -0.7;
          [0, 2.1, 4.2].forEach((a) => { const l = add(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 6), metal, x + Math.cos(a) * 0.16, H + 0.4, z + Math.sin(a) * 0.16); l.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); }); C.addRect(1, x, z, 0.65, 0.65, false); } // kettle grill, lid hanging off
        { const g2 = new THREE.Group(); g2.position.set(17.5, H, -10.6); g2.rotation.y = Math.PI / 2; scene.add(g2); // a sagging lounger
          for (let i = 0; i < 9; i++) B(0.6, 0.03, 0.06, rustM, 0, 0.35 + (i > 6 ? (i - 6) * 0.12 : 0), -0.8 + i * 0.2, g2); [-0.29, 0.29].forEach((sx) => { B(0.03, 0.03, 1.8, metal, sx, 0.34, 0, g2); [-0.8, 0.8].forEach((sz) => B(0.03, 0.34, 0.03, metal, sx, 0.17, sz, g2)); }); C.addRect(1, 17.5, -10.6, 1.9, 0.7, false); }
        [[22.6, -11.6], [16.6, -3.5], [22.6, -3.4], [16.7, -11.6]].forEach(([x, z]) => { add(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 12), moon(null, 0x7a4a30), x, H + 0.25, z); for (let i = 0; i < 6; i++) { const s = add(new THREE.ConeGeometry(0.025, R(0.4, 0.9), 4), moon(null, 0x4a4028), x + R(-0.12, 0.12), H + 0.65, z + R(-0.12, 0.12)); s.rotation.set(R(-0.8, 0.8), 0, R(-0.8, 0.8)); } C.addRect(1, x, z, 0.55, 0.55, false); });
        add(new THREE.BoxGeometry(0.7, 0.42, 0.42), moon(null, 0x2a5a8a), 21.0, H + 0.21, -10.9).rotation.y = 0.3; C.addRect(1, 21.0, -10.9, 0.7, 0.5, false); // an old cooler
        { // string lights along the street-side rail, a few still burning
          const bulbOn = new THREE.MeshBasicMaterial({ color: 0xffc078, toneMapped: false }), bulbOff = moon(null, 0x3a3428); bulbOn.userData.noPBR = true;
          const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, x = 16.4 + t * 6.5; pts.push(new THREE.Vector3(x, H + 2.1 - Math.sin(t * Math.PI * 3) ** 2 * 0.35, -3.05)); }
          for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b2 = pts[i + 1], w = add(new THREE.CylinderGeometry(0.006, 0.006, a.distanceTo(b2), 4), moon(null, 0x111111), (a.x + b2.x) / 2, (a.y + b2.y) / 2, (a.z + b2.z) / 2); w.rotation.z = Math.PI / 2 + Math.atan2(b2.y - a.y, b2.x - a.x); }
          [16.4, 18.6, 20.8, 22.9].forEach((x) => add(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), metal, x, H + 1.1, -3.05));
          pts.forEach((p, i) => { if (i % 2) return; const on = Math.random() < 0.6; add(new THREE.SphereGeometry(0.04, 8, 6), on ? bulbOn : bulbOff, p.x, p.y - 0.06, p.z); });
          const sb = add(new THREE.SphereGeometry(0.04, 8, 6), bulbOn.clone(), 19.7, H + 1.95, -3.05); sb.userData.dynamic = true;
          Hs.fixtures.push({ x: 19.7, y: H + 1.6, z: -4.2, level: 1, bulb: sb, mat: sb.material, power: 0.35, flicker: true, candle: true, color: 0xffb070, range: 8 }); }
        // front deck: a pair of rockers by the balcony door with a little table, a bench at the far end
        const rocker = (x, z, ry) => { const r = new THREE.Group(); r.position.set(x, H, z); r.rotation.y = ry; scene.add(r); const w = moon(TH.Tex.wood, 0x6a4a30);
          B(0.5, 0.04, 0.48, w, 0, 0.42, 0, r); B(0.5, 0.75, 0.04, w, 0, 0.8, -0.24, r); [-1, 1].forEach((sd) => { const rk = add(new THREE.TorusGeometry(0.55, 0.02, 4, 16, 1.0), w, sd * 0.22, 0.56, 0, r); rk.rotation.set(0, Math.PI / 2, Math.PI + 1.07); B(0.03, 0.4, 0.03, w, sd * 0.22, 0.22, 0.18, r); B(0.03, 0.4, 0.03, w, sd * 0.22, 0.22, -0.18, r); B(0.05, 0.05, 0.5, w, sd * 0.25, 0.62, 0, r); });
          C.addRect(1, x, z, 0.6, 0.7, false); };
        rocker(-1.7, 13.4, Math.PI - 0.3); rocker(1.7, 13.4, Math.PI + 0.3);
        B(0.4, 0.5, 0.4, moon(TH.Tex.wood, 0x5a3a24), -2.6, H + 0.25, 13.8); C.addRect(1, -2.6, 13.8, 0.45, 0.45, false); h.spawn(1, -2.6, 0.52, 13.8, 'on the little table on the front deck');
        B(1.6, 0.06, 0.45, moon(TH.Tex.wood, 0x6a4a30), 12.5, H + 0.45, 14.1); [-0.7, 0.7].forEach((dx) => B(0.06, 0.45, 0.4, moon(TH.Tex.wood, 0x5a3a24), 12.5 + dx, H + 0.22, 14.1)); C.addRect(1, 12.5, 14.1, 1.6, 0.5, false);
        h.spawn(1, 20, 0.02, -5.6, 'on the garage roof'); }

      /* ================= stairs: back deck down to the backyard ================= */
      { const zt = -14.6, zb = -19.9, n = 19, cx = (SX0 + SX1) / 2, wd = SX1 - SX0;
        C.addStair(SX0, SX1, zb, zt, 0, H);
        for (let i = 0; i < n; i++) { const t = (i + 1) / n, z = zb + (zt - zb) * ((i + 0.5) / n), y = t * H; B(wd, 0.05, Math.abs(zt - zb) / n + 0.02, deckM, cx, y - 0.025, z, null, 1); }
        // stringers + handrails on both sides
        const L = Math.hypot(zt - zb, H), ang = -Math.atan2(H, zt - zb); // tilt so the high end is at the deck
        [SX0 - 0.04, SX1 + 0.04].forEach((x) => {
          const s = B(0.06, 0.28, L, beamM, x, H / 2 - 0.1, (zt + zb) / 2); s.rotation.x = ang;
          const r = B(0.06, 0.06, L, railM, x, H / 2 + 0.95, (zt + zb) / 2); r.rotation.x = ang;
          for (let i = 0; i <= 6; i++) { const t = i / 6, z = zb + (zt - zb) * t; B(0.07, 0.95, 0.07, postM, x, t * H + 0.47, z); }
          C.addBox(0, x - 0.06, zb, x + 0.06, zt, false); C.addBox(1, x - 0.06, zb, x + 0.06, zt, false);
        });
        C.addBox(0, SX0, zt - 0.02, SX1, zt + 0.25, false); // under the top of the flight you can't walk "into" the stairs
      }

      /* ================= the backyard (level 0) ================= */
      const YX0 = -21, YX1 = 27, YZ0 = -30, YZ1 = -12.1;
      rooms.push({ id: 'backyard', name: 'Backyard', level: 0, x0: YX0, x1: YX1, z0: YZ0, z1: YZ1, floor: 'grass' });
      walk.push({ level: 0, x0: YX0, x1: YX1, z0: YZ0, z1: YZ1 });
      // tall privacy fence, weathered and leaning a little
      { const fM = TH.Tex.photo.mwood ? moon(TH.Tex.photo.mwood, 0xb0a898) : moon(TH.Tex.wood, 0x7a7266); const fence = (x0, z0, x1, z1) => {
          const len = Math.hypot(x1 - x0, z1 - z0), ax = x1 !== x0;
          for (let t = 0; t < len; t += 0.15) { const x = ax ? Math.min(x0, x1) + t : x0, z = ax ? z0 : Math.min(z0, z1) + t; const hh = 1.9 + R(-0.08, 0.05); const b = B(ax ? 0.14 : 0.025, hh, ax ? 0.025 : 0.14, fM, x, hh / 2, z); b.rotation[ax ? 'z' : 'x'] = R(-0.03, 0.03); }
          [0.3, 1.6].forEach((y) => B(ax ? len : 0.05, 0.08, ax ? 0.05 : len, fM, (x0 + x1) / 2, y, (z0 + z1) / 2));
          if (ax) C.addBox(0, Math.min(x0, x1), z0 - 0.1, Math.max(x0, x1), z0 + 0.1, true); else C.addBox(0, x0 - 0.1, Math.min(z0, z1), x0 + 0.1, Math.max(z0, z1), true);
        };
        const GX0 = 2.3, GX1 = 3.9; fence(YX0, YZ0, GX0, YZ0); fence(GX1, YZ0, YX1, YZ0); fence(YX0, YZ0, YX0, YZ1); /* back fence, with a gap for the gate */ fence(YX1, YZ0, YX1, YZ1); fence(YX0, YZ1, -16.1, YZ1); fence(23.1, YZ1, YX1, YZ1); }
      /* ---- the back gate: a way out to the alley, chained and padlocked shut. Wire cutters get through the chain. ---- */
      { const GX0 = 2.3, GX1 = 3.9, gw = GX1 - GX0, fM = TH.Tex.photo.mwood ? moon(TH.Tex.photo.mwood, 0xb8b0a0) : moon(TH.Tex.wood, 0x847a6c);
        const steel = moon(null, 0x8a8e94, { metalness: 0.85, roughness: 0.4 }), brass = moon(null, 0xb08a3a, { metalness: 0.9, roughness: 0.35 }), iron = moon(null, 0x2a2a2a, { metalness: 0.6, roughness: 0.6 });
        [GX0 - 0.06, GX1 + 0.06].forEach((x) => { B(0.14, 2.1, 0.14, fM, x, 1.05, YZ0); C.addRect(0, x, YZ0, 0.16, 0.2, true); }); // gate posts
        const pivot = new THREE.Group(); pivot.position.set(GX0 + 0.02, 0, YZ0); pivot.userData.dynamic = true; scene.add(pivot);
        for (let x = 0.07; x < gw - 0.04; x += 0.15) add(new THREE.BoxGeometry(0.135, 1.85 + R(-0.04, 0.03), 0.03), fM, x, 0.98, 0, pivot);
        [0.35, 1.55].forEach((y) => add(new THREE.BoxGeometry(gw - 0.06, 0.09, 0.05), fM, gw / 2, y, -0.04, pivot));
        add(new THREE.BoxGeometry(Math.hypot(gw - 0.1, 1.2), 0.08, 0.04), fM, gw / 2, 0.95, -0.045, pivot).rotation.z = Math.atan2(1.2, gw - 0.1); // Z brace
        [0.4, 1.5].forEach((y) => add(new THREE.BoxGeometry(0.3, 0.04, 0.012), iron, 0.12, y, 0.025, pivot)); // hinges
        add(new THREE.BoxGeometry(0.18, 0.05, 0.03), iron, gw - 0.12, 1.05, 0.03, pivot); // latch bar
        // chain wrapped round the gate and its post, with a padlock hanging off it (yard side)
        const chain = new THREE.Group(); chain.position.set(GX1 - 0.02, 1.0, YZ0 + 0.05); chain.scale.setScalar(1.4); scene.add(chain); chain.userData.dynamic = true;
        for (let j = 0; j < 14; j++) { const l = add(new THREE.TorusGeometry(0.022, 0.006, 6, 12), steel, -0.12 + (j % 7) * 0.04, (j < 7 ? 0.07 : -0.05) - Math.abs((j % 7) - 3) * 0.005, 0, chain); l.scale.set(1.4, 1, 1); l.rotation.y = j % 2 ? Math.PI / 2 : 0; }
        const lock = new THREE.Group(); lock.position.set(0.02, -0.14, 0.02); chain.add(lock);
        add(new THREE.BoxGeometry(0.08, 0.07, 0.032), brass, 0, 0, 0, lock); add(new THREE.TorusGeometry(0.025, 0.006, 8, 16, Math.PI), steel, 0, 0.035, 0, lock);
        // 2) a drop bolt on the yard face, rusted down into the concrete
        const rust = TH.Tex.rusty ? TH.Tex.rusty(new THREE.MeshStandardMaterial({ color: 0x6a4a32, metalness: 0.6, roughness: 0.8 }), 0x7a5a40) : iron;
        [0.18, 0.5].forEach((y) => add(new THREE.BoxGeometry(0.06, 0.035, 0.05), iron, gw - 0.3, y, 0.045, pivot)); // guides
        const bolt = new THREE.Group(); bolt.position.set(gw - 0.3, 0, 0.06); pivot.add(bolt);
        add(new THREE.CylinderGeometry(0.013, 0.013, 0.62, 8), rust, 0, 0.27, 0, bolt); const hdl = add(new THREE.CylinderGeometry(0.009, 0.009, 0.09, 6), rust, 0.04, 0.45, 0, bolt); hdl.rotation.z = Math.PI / 2;
        add(new THREE.CylinderGeometry(0.035, 0.04, 0.02, 10), moon(null, 0x3a3630, { roughness: 0.95 }), gw - 0.3, 0.01, 0.06, pivot); // the rusty stain where it goes into the ground
        // 3) a magnetic lock on the latch post, wired back to the house; red light while it's powered
        const mag = new THREE.Group(); mag.position.set(GX1 + 0.06, 1.72, YZ0 + 0.1); scene.add(mag);
        add(new THREE.BoxGeometry(0.07, 0.24, 0.06), moon(null, 0x9a9ea4, { metalness: 0.7, roughness: 0.4 }), 0, 0, 0, mag);
        const ledM = new THREE.MeshBasicMaterial({ color: 0xff2a1a }); ledM.userData.noPBR = true; ledM.toneMapped = false;
        const led = add(new THREE.SphereGeometry(0.008, 8, 6), ledM, 0, 0.08, 0.032, mag);
        add(new THREE.CylinderGeometry(0.009, 0.009, 1.62, 6), moon(null, 0x55585c, { roughness: 0.6 }), 0.0, -0.93, -0.02, mag); // conduit down the post into the ground
        add(new THREE.BoxGeometry(0.035, 0.2, 0.012), steel, gw - 0.05, 1.72, 0.035, pivot); // the armature plate on the gate
        const col = C.addBox(0, GX0, YZ0 - 0.06, GX1, YZ0 + 0.06, true);
        this.gate = { x: (GX0 + GX1) / 2, z: YZ0, pivot, chain, col, bolt, led, ledM, cut: false, freed: false, open: false, angle: 0, target: 0 }; }
      /* ---- the breaker panel on the basement's west wall: one switch feeds the yard (and the gate's magnetic lock) ---- */
      { const panel = new THREE.Group(); panel.position.set(-15.99, -3.4 + 1.45, -6.5); panel.rotation.y = Math.PI / 2; scene.add(panel);
        const grey = TH.Tex.rusty ? TH.Tex.rusty(new THREE.MeshStandardMaterial({ color: 0x8a8e88, metalness: 0.5, roughness: 0.55 }), 0x9a9e98) : moon(null, 0x8a8e88);
        add(new THREE.BoxGeometry(0.42, 0.6, 0.09), grey, 0, 0, 0.045, panel);
        const dk = moon(null, 0x1c1c1e, { roughness: 0.6 }), wh = moon(null, 0xd8d4c8, { roughness: 0.8 });
        for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) { if (r === 2 && c === 1) continue; add(new THREE.BoxGeometry(0.06, 0.03, 0.025), dk, -0.09 + c * 0.18, 0.19 - r * 0.075, 0.1, panel); add(new THREE.BoxGeometry(0.05, 0.018, 0.004), wh, -0.09 + c * 0.18 + (c ? -0.075 : 0.075), 0.19 - r * 0.075, 0.093, panel); }
        const lbl = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const k = c.getContext('2d'); k.fillStyle = '#e8e0c8'; k.fillRect(0, 0, 128, 32); k.fillStyle = '#b3261e'; k.font = 'bold 22px monospace'; k.fillText('YARD', 34, 24); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
        add(new THREE.PlaneGeometry(0.11, 0.028), new THREE.MeshStandardMaterial({ map: lbl, roughness: 0.8 }), 0.0, 0.035, 0.093, panel); // red label taped on: YARD
        const handle = new THREE.Group(); handle.position.set(0.09, 0.04, 0.1); panel.add(handle); add(new THREE.BoxGeometry(0.06, 0.03, 0.03), moon(null, 0xb3261e, { roughness: 0.5 }), 0, 0, 0.005, handle);
        this.breaker = { x: -15.6, z: -6.5, panel, handle }; }
      // patchy dirt and dead grass on top of the lawn
      { const c = document.createElement('canvas'); c.width = c.height = 256; const k = c.getContext('2d'); k.fillStyle = '#5a5240'; k.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { k.fillStyle = `rgba(${R(60, 110) | 0},${R(70, 100) | 0},${R(40, 60) | 0},${R(0.2, 0.5)})`; k.fillRect(R(0, 256), R(0, 256), R(1, 4), R(4, 10)); }
        TH.seamless(c); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 4); t.encoding = THREE.sRGBEncoding;
        t.repeat.set(0.22, 0.22); const sh = new THREE.Shape(); sh.moveTo(YX0, -YZ0); sh.lineTo(YX1, -YZ0); sh.lineTo(YX1, -YZ1); sh.lineTo(YX0, -YZ1); sh.lineTo(YX0, -YZ0);
          const p = new THREE.Path(); p.moveTo(CX0 - 0.2, -CZT); p.lineTo(CX1 + 0.2, -CZT); p.lineTo(CX1 + 0.2, -CZB); p.lineTo(CX0 - 0.2, -CZB); p.lineTo(CX0 - 0.2, -CZT); sh.holes.push(p);
          const P = TH.Tex.photo, gm = P.grass ? moon(TH.Tex.pclone('grass', 1 / 2.6), 0xa8a490) : moon(t, 0x8a8470);
          const g = add(new THREE.ShapeGeometry(sh), gm, 0, -0.01, 0); g.rotation.x = -Math.PI / 2;
          if (P.ground && P.gravel) { // bare dirt worn into the grass, and gravel paths to the shed and the burn barrel
            const blob = (() => { const c2 = document.createElement('canvas'); c2.width = c2.height = 128; const q = c2.getContext('2d');
              for (let i = 0; i < 22; i++) { const x = 64 + R(-26, 26), y = 64 + R(-26, 26), r = R(16, 40), gr = q.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = gr; q.fillRect(0, 0, 128, 128); }
              return new THREE.CanvasTexture(c2); })();
            const dirtM = moon(TH.Tex.pclone('ground', 1, 1), 0xa89c8c, { alphaMap: blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
            [[2, -20, 3.4], [-6, -24, 2.6], [12.5, -21, 2.4], [-14, -15, 3], [16, -16, 2.2], [-17, -27, 2.8], [8, -28, 2.4], [24, -19, 2]].forEach(([x, z, r]) => { const d = add(new THREE.PlaneGeometry(2 * r, 2 * r), dirtM, x, -0.006, z); d.rotation.set(-Math.PI / 2, 0, R(0, 6)); });
            const grM = moon(TH.Tex.photo.gravel, 0xb0aaa0, { polygonOffset: true, polygonOffsetFactor: -2 });
            const path = (pts, w) => { const pos = [], uv = [], idx = []; let run = 0;
              pts.forEach(([x, z], i) => { const [ax, az] = pts[Math.max(0, i - 1)], [bx2, bz2] = pts[Math.min(pts.length - 1, i + 1)], dx = bx2 - ax, dz = bz2 - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, ww = w * (0.85 + 0.3 * Math.sin(i * 1.7));
                if (i) run += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
                pos.push(x + nx * ww / 2, 0, z + nz * ww / 2, x - nx * ww / 2, 0, z - nz * ww / 2); uv.push(0, run / 1.6, ww / 1.6, run / 1.6);
                if (i) { const k2 = (i - 1) * 2; idx.push(k2, k2 + 1, k2 + 2, k2 + 1, k2 + 3, k2 + 2); } });
              const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
              if (geo.attributes.normal.getY(0) < 0) { for (let q = 0; q < idx.length; q += 3) { const t3 = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = t3; } geo.setIndex(idx); geo.computeVertexNormals(); }
              add(geo, grM, 0, -0.004, 0); };
            path([[6.8, -14.6], [8.5, -17.5], [11.5, -20], [15, -22.4], [18.4, -24.4], [20, -25.6]], 1.25);   // deck stairs → shed
            path([[11.5, -20], [12.4, -20.3], [13, -20.5]], 1.0);                                            // spur to the burn barrel
            path([[-8.4, -17.6], [-6.5, -19.5], [-3, -20.5], [1, -20.2], [4, -19.2], [8.5, -17.5]], 1.0);     // cellar doors → across the yard
          } }
      // trees already standing in the yard get solid trunks
      [[12, -24], [-16, -18]].forEach(([x, z]) => C.addRect(0, x, z, 0.5, 0.5, true));
      // garden shed with an open doorway; a tall tool cabinet inside you can hide in
      { const sM = moon(TH.Tex.siding, 0x6a6e66), roofM = TH.Tex.rusty(moon(null, 0x2a2622), 0x9a948a, 'rustsheet', 1.6, 1.4), X0 = 18, X1 = 22, Z0 = -29.6, Z1 = -26.2, sh = 2.4;
        const wall = (x0, z0, x1, z1) => { const w = Math.max(0.1, Math.abs(x1 - x0)), d = Math.max(0.1, Math.abs(z1 - z0)); B(w, sh, d, sM, (x0 + x1) / 2, sh / 2, (z0 + z1) / 2, null, 2); C.addRect(0, (x0 + x1) / 2, (z0 + z1) / 2, w, d, true); };
        wall(X0, Z0, X1, Z0); wall(X0, Z0, X0, Z1); wall(X1, Z0, X1, Z1); wall(X0, Z1, X0 + 1.4, Z1); wall(X0 + 2.6, Z1, X1, Z1);
        B(1.2, 0.4, 0.1, sM, X0 + 2, sh - 0.2, Z1);
        const rf = B(X1 - X0 + 0.5, 0.08, Z1 - Z0 + 0.6, roofM, (X0 + X1) / 2, sh + 0.15, (Z0 + Z1) / 2); rf.rotation.x = 0.12;
        const fl = add(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), moon(TH.Tex.deckWood || TH.Tex.floorWood, 0x7a6a5a), (X0 + X1) / 2, 0.01, (Z0 + Z1) / 2); fl.rotation.x = -Math.PI / 2;
        h.wardrobe(0, X1 - 0.8, Z0 + 1.0, -Math.PI / 2, 'tool cabinet');
        B(1.4, 0.06, 0.5, moon(TH.Tex.wood, 0x7a5a3a), X0 + 1, 0.9, Z0 + 0.4); C.addRect(0, X0 + 1, Z0 + 0.4, 1.4, 0.5, false); h.spawn(0, X0 + 1, 0.94, Z0 + 0.4, 'on the potting bench in the shed');
        [[X0 + 0.6, Z0 + 0.3], [X0 + 1.4, Z0 + 0.3]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.1, 0.08, 0.16, 10), moon(null, 0x9a5a3a), x, 1.01, z));
        [[X0 + 0.42, Z1 - 0.5, 0.3, 0], [X1 + 0.6, Z0 + 0.55, 1.2, 0], [X1 + 0.75, Z0 + 1.25, 2.6, 0]].forEach(([x, z, ry]) => { const b = TH.Tex.barrel(); b.position.set(x, 0, z); b.rotation.y = ry; scene.add(b); C.addRect(0, x, z, 0.62, 0.62, false); });
        rooms.unshift({ id: 'shed', name: 'Garden Shed', level: 0, x0: X0, x1: X1, z0: Z0, z1: Z1, floor: 'wood' }); // ahead of 'Backyard' so it wins
        const sb = add(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), X0 + 2, sh - 0.3, Z0 + 1.7); sb.userData.dynamic = true;
        Hs.fixtures.push({ x: X0 + 2, y: sh - 0.35, z: Z0 + 1.7, level: 0, bulb: sb, mat: sb.material, power: 0.8, flicker: false, color: 0xffd28a, range: 9 }); } /* bright enough to find things in the shed */
      // clothesline with sheets that sway (you can't see through them)
      { const pole = moon(null, 0x5a5a58, { metalness: 0.5 }); [[-1, -23], [7, -23]].forEach(([x, z]) => { add(new THREE.CylinderGeometry(0.04, 0.04, 2.1, 8), pole, x, 1.05, z); B(0.9, 0.04, 0.04, pole, x, 2.05, z); C.addRect(0, x, z, 0.15, 0.15, false); });
        [-0.35, 0.35].forEach((dz) => { const line = add(new THREE.CylinderGeometry(0.005, 0.005, 8, 4), moon(null, 0xcac6b8), 3, 2.02, -23 + dz); line.rotation.z = Math.PI / 2; });
        const sheetM = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.95, side: THREE.DoubleSide, emissive: 0x2a2822, map: TH.Tex.fabric || null });
        [0.4, 2.6, 5.0].forEach((x, i) => { const g = new THREE.PlaneGeometry(1.8, 1.4, 6, 6); const m = add(g, sheetM, x, 1.32, -23 + (i % 2 ? 0.35 : -0.35)); m.userData.dynamic = true; this.sheets.push({ m, base: g.attributes.position.array.slice(), ph: R(0, 6) }); C.addRect(0, x, -23 + (i % 2 ? 0.35 : -0.35), 1.8, 0.1, true).sight = true; }); }
      // doghouse (empty, a chain running into it), picnic table, burn barrel with embers, wheelbarrow, weeds
      { const wood = moon(TH.Tex.wood, 0x6a4a30); const dh = new THREE.Group(); dh.position.set(-18.5, 0, -26); dh.rotation.y = 0.6; scene.add(dh);
        B(1.1, 0.8, 1.3, wood, 0, 0.4, 0, dh, 1.5); const rs = new THREE.Shape(); rs.moveTo(-0.65, 0); rs.lineTo(0.65, 0); rs.lineTo(0, 0.5); rs.lineTo(-0.65, 0);
        add(new THREE.ExtrudeGeometry(rs, { depth: 1.45, bevelEnabled: false }), moon(null, 0x3a2a22), 0, 0.8, -0.72, dh);
        add(new THREE.PlaneGeometry(0.45, 0.55), new THREE.MeshBasicMaterial({ color: 0x050403 }), 0, 0.3, 0.66, dh);
        for (let i = 0; i < 12; i++) { const l = add(new THREE.TorusGeometry(0.025, 0.007, 4, 8), moon(null, 0x6a6a68, { metalness: 0.7 }), 0.2 + i * 0.05, 0.01, 0.7 + i * 0.07, dh); l.rotation.set(Math.PI / 2, 0, i % 2 ? Math.PI / 2 : 0); }
        add(new THREE.CylinderGeometry(0.12, 0.1, 0.06, 12), moon(null, 0x8a2a1a, { metalness: 0.5 }), 0.6, 0.03, 1.1, dh);
        C.addRect(0, -18.5, -26, 1.5, 1.5, true);
        const pt = new THREE.Group(); pt.position.set(-2, 0, -18); scene.add(pt); const pw = moon(TH.Tex.wood, 0x7a6a56);
        B(2.0, 0.06, 0.8, pw, 0, 0.75, 0, pt, 1); [-0.62, 0.62].forEach((z) => B(2.0, 0.05, 0.28, pw, 0, 0.45, z, pt, 1)); [[-0.8, 1], [0.8, 1], [-0.8, -1], [0.8, -1]].forEach(([x, s]) => { const l = B(0.07, 0.9, 0.07, pw, x, 0.42, 0.25 * s, pt); l.rotation.x = 0.5 * s; });
        C.addRect(0, -2, -18, 2.0, 1.4, false); h.spawn(0, -2, 0.79, -18, 'on the picnic table out back');
        const barrel = add(new THREE.CylinderGeometry(0.3, 0.28, 0.85, 16, 1, true), TH.Tex.rusty(moon(null, 0x4a2a18, { metalness: 0.5, roughness: 0.8, side: THREE.DoubleSide }), 0x9a7060), 13, 0.43, -20.5);
        C.addRect(0, 13, -20.5, 0.65, 0.65, false);
        const em = new THREE.MeshBasicMaterial({ color: 0xff6a20 }); const ember = add(new THREE.CircleGeometry(0.26, 14), em, 13, 0.7, -20.5); ember.rotation.x = -Math.PI / 2; ember.userData.dynamic = true;
        Hs.fixtures.push({ x: 13, y: 1.1, z: -20.5, level: 0, bulb: ember, mat: em, power: 0.55, flicker: true, candle: true, color: 0xff7a30, range: 9 }); this.embers = ember;
        const wb = new THREE.Group(); wb.position.set(17, 0, -18.5); wb.rotation.y = 2.2; scene.add(wb); const tray = add(new THREE.CylinderGeometry(0.45, 0.3, 0.3, 4, 1, true), moon(null, 0x3a5a3a, { metalness: 0.5, side: THREE.DoubleSide }), 0, 0.5, 0, wb); tray.rotation.y = Math.PI / 4; tray.scale.z = 1.4;
        add(new THREE.TorusGeometry(0.17, 0.05, 6, 14), moon(null, 0x141414), 0, 0.2, 0.55, wb).rotation.y = Math.PI / 2; C.addRect(0, 17, -18.5, 1.0, 1.0, false);
        const weed = moon(null, 0x4a5030, { roughness: 1 }); for (let i = 0; i < 110; i++) { const x = R(YX0 + 0.5, YX1 - 0.5), z = R(YZ0 + 0.5, -14.8); if ((Math.abs(x - 6.8) < 1.5 && z > -21) || (Math.abs(x + 8.4) < 1.4 && z > -18)) continue; const c = add(new THREE.ConeGeometry(R(0.05, 0.12), R(0.3, 0.8), 4), weed, x, 0.2, z); c.rotation.z = R(-0.3, 0.3); } }

      /* ================= cellar doors + steps down to the basement ================= */
      { C.addStair(CX0, CX1, CZB, CZT, -H, 0);
        const ct = TH.Tex.photo.concrete || TH.Tex.photo.stone, conc = moon(ct || null, ct ? 0x9c9890 : 0x6a6a64, { roughness: 0.95 }), n = 16, cx = (CX0 + CX1) / 2;
        const CB = (w, h, d, x, y, z) => { const m = B(w, h, d, conc, x, y, z); if (ct) TH.Tex.boxUV(m.geometry, w, h, d, 1.2); return m; }; // worn concrete, not flat grey
        for (let i = 0; i < n; i++) { const t = (i + 1) / n, z = CZB + (CZT - CZB) * ((i + 0.5) / n), y = -H + t * H; CB(CX1 - CX0, 0.18, Math.abs(CZT - CZB) / n + 0.02, cx, y - 0.09, z); }
        // low concrete curb around the opening at yard level + side walls of the stairwell
        [CX0 - 0.1, CX1 + 0.1].forEach((x) => { CB(0.2, H + 0.35, CZB - CZT, x, -H / 2 + 0.17, (CZT + CZB) / 2); C.addBox(0, x - 0.12, CZT, x + 0.12, CZB, true); C.addBox(-1, x - 0.12, CZT, x + 0.12, CZB, true); });
        // the two slanted steel cellar doors, thrown open
        const steelM = TH.Tex.rusty(moon(null, 0x3a4a3a, { metalness: 0.6, roughness: 0.6 }), 0xa8a8a0, 'rustsheet');
        [[-1, CX0 - 0.15], [1, CX1 + 0.15]].forEach(([s, x]) => { const d = B(0.82, 0.04, CZB - CZT, steelM, x + s * 0.4, 0.36, (CZT + CZB) / 2); d.rotation.z = s * 0.35; B(0.04, 0.04, 0.3, moon(null, 0x8a8a86, { metalness: 0.8 }), x + s * 0.5, 0.52, (CZT + CZB) / 2); });
        Hs.rooms.push({ id: 'cellar', name: 'Cellar Steps', level: -1, x0: CX0, x1: CX1, z0: CZT, z1: CZB, floor: 'concrete' }); }

      /* ================= the basement (level -1) ================= */
      { const y0 = -H, BX0 = -16.1, BX1 = -2, BZ0 = -13, BZ1 = 2.1, WX1 = 8.1, WZ0 = -12.1, WZ1 = -5; // main cellar + the workshop under the mudroom
        rooms.push({ id: 'furnace', name: 'Furnace Room', level: -1, x0: -16, x1: -11, z0: -3, z1: 2, floor: 'concrete' });
        rooms.push({ id: 'basement', name: 'Basement', level: -1, x0: BX0, x1: BX1, z0: BZ0, z1: BZ1, floor: 'concrete' });
        rooms.push({ id: 'workshop', name: 'Basement Workshop', level: -1, x0: BX1, x1: WX1, z0: WZ0, z1: WZ1, floor: 'concrete' });
        walk.push({ level: -1, x0: BX0, x1: BX1, z0: BZ0, z1: BZ1 }, { level: -1, x0: BX1 - 0.1, x1: WX1, z0: WZ0, z1: WZ1 });
        const c = document.createElement('canvas'); c.width = c.height = 256; const k = c.getContext('2d'); k.fillStyle = '#7a7670'; k.fillRect(0, 0, 256, 256);
        for (let r = 0; r < 8; r++) for (let q = 0; q < 5; q++) { const x = q * 64 + (r % 2) * 32 - 32, y = r * 32, v = R(96, 124); k.fillStyle = `rgb(${v + 4 | 0},${v | 0},${v - 6 | 0})`; k.fillRect(x + 2, y + 2, 60, 28); } // grey cinder blocks
        for (let i = 0; i < 14; i++) { const x = R(0, 256), y = R(0, 256), r = R(12, 50), g = k.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(40,46,30,.45)'); g.addColorStop(1, 'rgba(40,46,30,0)'); k.fillStyle = g; k.beginPath(); k.arc(x, y, r, 0, Math.PI * 2); k.fill(); } // damp stains
        k.fillStyle = 'rgba(30,28,24,.35)'; for (let y = 0; y < 256; y += 32) k.fillRect(0, y, 256, 2); // mortar lines
        TH.seamless(c); const bt = new THREE.CanvasTexture(c); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.encoding = THREE.sRGBEncoding;
        const block = TH.Tex.photo.stone ? new THREE.MeshStandardMaterial({ map: TH.Tex.photo.stone, color: 0xb8b0a4, roughness: 1 }) : new THREE.MeshStandardMaterial({ map: bt, roughness: 0.92 }), floorM = (() => { const c2 = document.createElement('canvas'); c2.width = c2.height = 256; const q = c2.getContext('2d'); q.fillStyle = '#6a6862'; q.fillRect(0, 0, 256, 256);
          for (let i = 0; i < 2500; i++) { const v = R(80, 120) | 0; q.fillStyle = `rgba(${v},${v - 2},${v - 6},.25)`; q.fillRect(R(0, 256), R(0, 256), 2, 2); }
          for (let i = 0; i < 8; i++) { const x = R(0, 256), y = R(0, 256), r = R(20, 60), g = q.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(30,26,20,.5)'); g.addColorStop(1, 'rgba(30,26,20,0)'); q.fillStyle = g; q.beginPath(); q.arc(x, y, r, 0, 7); q.fill(); }
          q.strokeStyle = 'rgba(30,30,28,.6)'; q.lineWidth = 1.5; q.beginPath(); let x = R(0, 256), y = 0; q.moveTo(x, y); while (y < 256) { x += R(-12, 12); y += R(6, 16); q.lineTo(x, y); } q.stroke();
          TH.seamless(c2); const t2 = new THREE.CanvasTexture(c2); t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.repeat.set(1, 1); t2.encoding = THREE.sRGBEncoding; return TH.Tex.photo.concrete ? new THREE.MeshStandardMaterial({ map: TH.Tex.pclone('concrete', 2.2, 2.2), color: 0xa8a49c, roughness: 1 }) : new THREE.MeshStandardMaterial({ map: t2, roughness: 0.85 }); })(); // poured concrete
        [[BX0, BX1, BZ0, BZ1], [BX1, WX1, WZ0, WZ1]].forEach(([x0, x1, z0, z1]) => {
          const fg = new THREE.PlaneGeometry(x1 - x0, z1 - z0), fu = fg.attributes.uv; for (let i = 0; i < fu.count; i++) fu.setXY(i, (x0 + fu.getX(i) * (x1 - x0)) / 4.5, (z0 + fu.getY(i) * (z1 - z0)) / 4.5); // one shared world-space mapping, so the two floors meet without a seam
          const fl = add(fg, floorM, (x0 + x1) / 2, y0 + 0.002, (z0 + z1) / 2); fl.rotation.x = -Math.PI / 2;
          const ce = add(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 1 }), (x0 + x1) / 2, -0.06, (z0 + z1) / 2); ce.rotation.x = Math.PI / 2;
          const joist = h.woodMat(0x6a5038), C2 = Hs.CELL; for (let x = x0 + 0.4; x < x1; x += 0.6) { if (C2 && x > C2.x0 - 0.15 && x < C2.x1 + 0.15 && z1 > C2.zb) { B(0.06, 0.22, C2.zb - z0, joist, x, -0.18, (z0 + C2.zb) / 2); continue; } B(0.06, 0.22, z1 - z0, joist, x, -0.18, (z0 + z1) / 2); }
        });
        const wall = (x0, z0, x1, z1) => { const w = Math.max(0.2, Math.abs(x1 - x0)), d = Math.max(0.2, Math.abs(z1 - z0)); B(w, H, d, block, (x0 + x1) / 2, y0 + H / 2, (z0 + z1) / 2, null, 2); C.addRect(-1, (x0 + x1) / 2, (z0 + z1) / 2, w, d, true); };
        wall(BX0, BZ0, CX0 - 0.2, BZ0); wall(CX1 + 0.2, BZ0, BX1, BZ0); // back wall with the cellar-stair opening
        wall(BX0, BZ1, BX1, BZ1); wall(BX0, BZ0, BX0, BZ1); wall(BX1, BZ0, BX1, -10); wall(BX1, -8, BX1, BZ1); // east wall: an opening through to the workshop
        wall(BX1, WZ0, WX1, WZ0); wall(BX1, WZ1, WX1, WZ1); wall(WX1, WZ0, WX1, WZ1);
        wall(BX0, -3, -14.4, -3); wall(-13.2, -3, -11, -3); wall(-11, -3, -11, 2); // furnace room, open doorway at x -14.4..-13.2
        // lights: bare bulbs on pull chains, mostly dying
        h.fixture(-1, -6, -6.5, { flicker: true, power: 0.5 }); h.fixture(-1, -13.8, -0.5, { flicker: true, power: 0.4 }); h.fixture(-1, 3, -8.5, { flicker: true, power: 0.42 }); h.fixture(-1, -6, 0, { dead: true });
        // furnace + ducts, water heater, shelves of jars, workbench, an old mattress, boxes
        const metal = TH.Tex.rusty(new THREE.MeshStandardMaterial({ color: 0x5a5c5a, metalness: 0.6, roughness: 0.55 }), 0xa8a8a4), rust = TH.Tex.rusty(new THREE.MeshStandardMaterial({ color: 0x6a3a22, metalness: 0.4, roughness: 0.8 }), 0xa07a64);
        B(1.3, 1.7, 1.1, metal, -14.6, y0 + 0.85, 1.2); C.addRect(-1, -14.6, 1.2, 1.3, 1.1, true);
        const flame = new THREE.MeshBasicMaterial({ color: 0xff7a2a }); add(new THREE.PlaneGeometry(0.2, 0.08), flame, -14.6, y0 + 0.3, 0.64).userData.dynamic = true;
        Hs.fixtures.push({ x: -14.6, y: y0 + 0.5, z: 0.2, level: -1, bulb: null, mat: null, power: 0.25, flicker: true, candle: true, color: 0xff6a2a, range: 5 });
        B(0.5, 0.5, 2.6, metal, -14.6, -0.5, -0.4); B(0.5, 1.6, 0.5, metal, -14.6, -1.1, 0.9);
        { const wh = TH.Tex.rusty(new THREE.MeshStandardMaterial({ color: 0x6a3a22, metalness: 0.4, roughness: 0.8 }), 0xd0c8bc, 'rustsheet', 2, 1.2); add(new THREE.CylinderGeometry(0.3, 0.3, 1.5, 20), wh, -12.4, y0 + 0.75, 1.4); add(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 20), metal, -12.4, y0 + 1.5, 1.4); add(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 10), metal, -12.4, y0 + 2.0, 1.4); [-0.12, 0.12].forEach((dx) => add(new THREE.CylinderGeometry(0.018, 0.018, 1.6, 8), metal, -12.4 + dx, y0 + 2.3, 1.2)); } C.addRect(-1, -12.4, 1.4, 0.65, 0.65, true);
        h.wardrobe(-1, -2.45, -11.2, -Math.PI / 2, 'cedar wardrobe');
        { const sh = new THREE.Group(); sh.position.set(-7, y0, 1.75); scene.add(sh); const wd = h.woodMat(0x5a4028);
          for (let i = 0; i < 4; i++) B(2.4, 0.04, 0.45, wd, 0, 0.2 + i * 0.5, 0, sh); [-1.18, 1.18].forEach((x) => B(0.05, 2, 0.45, wd, x, 1, 0, sh));
          for (let i = 0; i < 18; i++) { const s2 = (i / 6) | 0; add(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), Hs.std('jar' + (i % 3), { color: [0x9a6a2a, 0x6a8a3a, 0xa83a2a][i % 3], roughness: 0.2, transparent: true, opacity: 0.85 }), -1 + (i % 6) * 0.38, 0.3 + s2 * 0.5, 0, sh); }
          C.addRect(-1, -7, 1.75, 2.4, 0.5, true); h.spawn(-1, -7.6, 1.24, 1.75, 'on the jar shelves in the basement'); }
        h.furn(-1, 1.5, -11.6, 1.8, 0.6, 0.9, 0x5a4028); h.spawn(-1, 1.3, 0.92, -11.6, 'on the basement workbench');
        { const peg = add(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.9 }), 1.5, y0 + 1.6, -12.0); for (let i = 0; i < 6; i++) B(0.03, R(0.2, 0.4), 0.02, metal, 0.8 + i * 0.28, y0 + 1.6, -11.98); }
        add(new THREE.BoxGeometry(0.9, 0.18, 1.9), new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1, map: TH.Tex.mattress || null }), -4.2, y0 + 0.09, -2).rotation.y = 0.2; C.addRect(-1, -4.2, -2, 1.1, 1.9, false);
        for (let i = 0; i < 6; i++) { const s2 = R(0.35, 0.6); const bx = B(s2, s2 * 0.8, s2, Hs.std('box1', { color: 0x8a7458, roughness: 0.95 }), -15.5 + R(0, 1), y0 + s2 * 0.4 + (i > 3 ? 0.45 : 0), -11.8 + R(0, 1.5)); bx.rotation.y = R(-0.4, 0.4); }
        C.addRect(-1, -15, -11, 1.4, 2.0, false);
        for (let i = 0; i < 5; i++) { const s2 = R(0.35, 0.6); B(s2, s2 * 0.8, s2, Hs.std('box2', { color: 0x7a6448, roughness: 0.95 }), -1.0 + R(-0.4, 0.4), y0 + s2 * 0.4, -11.5 + R(0, 0.6)).rotation.y = R(-0.4, 0.4); } C.addRect(-1, -1.0, -11.3, 1.2, 1.0, false);
        // a puddle (it's damp down here)
        const pud = add(new THREE.CircleGeometry(0.7, 20), new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.7 }), -7.5, y0 + 0.004, -5.5); pud.rotation.x = -Math.PI / 2; pud.scale.y = 0.6;
        Hs.creaks.push({ x: -6, z: -8, level: -1, r: 0.6 });
        [[-12.75, -12.5, 0.4], [-12.05, -12.45, 1.9]].forEach(([x, z, ry]) => { const b = TH.Tex.barrel(); b.position.set(x, y0, z); b.rotation.y = ry; scene.add(b); C.addRect(-1, x, z, 0.62, 0.62, false); });
      }
    },

    nav() {}, // (Tim's waypoints are worked out from the rooms in house.js)

    // the back gate's interaction (re-registered every new game by Puzzles.setup)
    // The back gate takes three things: the chain (wire cutters), the rusted drop bolt (oil can) and the magnetic lock (cut the
    // yard's power at the breaker panel in the basement). Any order; the gate always says what it still needs.
    register() {
      const g = this.gate, B = this.breaker, inv = TH.Inventory; if (!g) return;
      g.cut = false; g.freed = false; g.open = false; g.angle = g.target = 0; g.pivot.rotation.y = 0; g.col.off = false; g.bolt.position.y = 0;
      this.power = true; g.ledM.color.setHex(0xff2a1a); if (B) B.handle.rotation.x = 0;
      if (g.chain.parent !== TH.scene) { if (g.chain.parent) g.chain.parent.remove(g.chain); TH.scene.add(g.chain); }
      g.chain.position.set(g.x + 0.78, 1.0, g.z + 0.05); g.chain.rotation.set(0, 0, 0); g.chain.visible = true;
      const steps = () => [
        { id: 'chain', done: g.cut, can: inv.has('wire_cutters'), say: 'CUT THE GATE CHAIN', short: 'CUT', hold: 1.4, idle: 'BACK GATE · CHAINED', need: 'WIRE CUTTERS NEEDED · the gate is chained shut' },
        { id: 'bolt', done: g.freed, can: inv.has('oil_can'), say: 'OIL THE RUSTED BOLT', short: 'OIL', hold: 2.0, idle: 'BACK GATE · BOLT RUSTED SOLID', need: 'OIL CAN NEEDED · a drop bolt is rusted into the concrete' },
        { id: 'mag', done: !this.power, can: false, idle: 'BACK GATE · MAGNETIC LOCK', need: 'IT WON’T BUDGE · a magnetic lock on the post, humming. It runs off the house.' },
      ];
      const next = () => { const left = steps().filter((x) => !x.done); return left.find((x) => x.can) || left[0] || null; };
      const left = () => steps().filter((x) => !x.done).map((x) => ({ chain: 'the chain', bolt: 'the rusted bolt', mag: 'the magnetic lock' })[x.id]);
      const after = (what) => { const l = left(); TH.UI.toast(l.length ? what + ' · still: ' + l.join(', ') : what + ' · the gate is free'); };
      TH.Interact.add({
        x: g.x, z: g.z + 0.35, level: 0, y: 1.0, r: 2.0,
        get hold() { const n = next(); return n && n.can ? n.hold : 0; },
        prompt: () => { if (g.open) return null; const n = next(); return !n ? 'PUSH THE GATE OPEN' : n.can ? n.say : n.idle; },
        short: () => { const n = next(); return !n ? 'OPEN' : n.short || 'LOOK'; },
        check: () => { const n = next(); return n && !n.can ? n.need : null; },
        inspect: () => 'A chain and padlock, a drop bolt rusted into the concrete, and a magnetic lock humming on the post. On the other side: the alley, and the rest of the world.',
        onTick: () => { const n = next(); if (n && n.id === 'bolt' && Math.random() < 0.12) TH.Audio.play('door', { x: g.x, y: 0.4, z: g.z }, 10); else if (Math.random() < 0.08) TH.Audio.play('dropSmall', { x: g.x, y: 1, z: g.z }, 8); },
        use: () => {
          const n = next();
          if (n && n.id === 'chain') { g.cut = true; TH.Doors.drop(g.chain); TH.Audio.play('unlock'); TH.Noise.emit(g.x, g.z, 0, 9, 'a chain snapping'); TH.Bus.emit('lockRemoved', 'gate'); after('Chain cut'); return; }
          if (n && n.id === 'bolt') { g.freed = true; inv.remove('oil_can'); g.liftT = 0; TH.Audio.play('door', { x: g.x, y: 0.4, z: g.z }, 18); TH.Noise.emit(g.x, g.z, 0, 11, 'a rusted bolt shrieking'); TH.Bus.emit('lockRemoved', 'gate-bolt'); after('The bolt screams loose'); return; }
          if (n) return;
          g.open = true; g.target = -1.6; g.col.off = true; TH.Audio.play('door', { x: g.x, y: 1, z: g.z }, 20);
          TH.Game.escape('gate');
        },
      });
      if (B) TH.Interact.add({
        x: B.x, z: B.z, level: -1, y: -1.95, r: 1.7,
        prompt: () => (this.power ? 'FLIP THE YARD BREAKER' : 'BREAKER PANEL · YARD OFF'), short: () => (this.power ? 'FLIP' : 'LOOK'),
        check: () => (this.power ? null : 'Already off. Whatever it fed outside is dead.'),
        inspect: () => 'An old breaker panel. One switch has a strip of red tape on it: YARD.',
        use: () => {
          if (!this.power) return; this.power = false; B.handle.rotation.x = 0.9; g.ledM.color.setHex(0x1a0a08);
          TH.Audio.play('unlock'); TH.Noise.emit(B.x, B.z, -1, 12, 'a breaker clunking'); TH.Bus.emit('lockRemoved', 'gate-power');
          const l = left(); TH.UI.toast('YARD breaker off · somewhere outside, a hum dies' + (l.length ? '' : ' · the gate is free'));
        },
      });
    },

    update(t) {
      if (this.gate) { const g = this.gate; g.angle += (g.target - g.angle) * 0.06; g.pivot.rotation.y = g.angle; if (g.freed && g.bolt.position.y < 0.16) g.bolt.position.y = Math.min(0.16, g.bolt.position.y + 0.012); } // the bolt lifts out of the ground
      // sheets on the line move in the wind
      this.sheets.forEach((s) => { const p = s.m.geometry.attributes.position, a = p.array, b = s.base; for (let i = 0; i < p.count; i++) { const x = b[i * 3], y = b[i * 3 + 1]; const k = (0.7 - y) / 1.4; a[i * 3 + 2] = b[i * 3 + 2] + Math.sin(t * 1.7 + x * 2 + s.ph) * 0.12 * k * k; } p.needsUpdate = true; });
    },
  };
})();
