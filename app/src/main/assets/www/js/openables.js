/* TRAP HOUSE — things you can open: the fridge (freezer + main door) and real sliding drawers in the dressers,
   nightstand, chest and kitchen island. Some hold an item; a few hold roaches. */
(function () {
  'use strict';
  const TH = window.TH;
  const R = (a, b) => a + Math.random() * (b - a);

  TH.Openables = {
    list: [],

    build(scene) {
      const Hs = TH.House, h = Hs.h, H = Hs.H;
      this.list = [];
      const dark = new THREE.MeshStandardMaterial({ color: 0x17110c, roughness: 0.95 });
      const raw = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.85, map: TH.Tex.wood || null }); // unfinished drawer-box wood
      const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.85, roughness: 0.35 });
      const chrome = new THREE.MeshStandardMaterial({ color: 0xdcdcd6, metalness: 0.55, roughness: 0.28 });
      const cloth = [0x5a6a7a, 0x8a3a32, 0xd6d0bc, 0x3a3a3a, 0x6a7a4a, 0x9a8a6a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, map: TH.Tex.fabric || null }));
      const paper = new THREE.MeshStandardMaterial({ color: 0xe0d8c0, roughness: 0.9 });
      const B = (w, hh, d, mat, x, y, z, parent, uv) => { const g = new THREE.BoxGeometry(w, hh, d); if (uv && TH.Tex.boxUV) TH.Tex.boxUV(g, w, hh, d, 1); return h.addMesh(g, mat, x, y, z, parent); };
      const piece = (level, x, z, ry) => { const g = new THREE.Group(); g.position.set(x, level * H, z); g.rotation.y = ry; scene.add(g); return g; };
      const collider = (level, x, z, ry, w, d, sight) => { const sw = Math.abs(Math.sin(ry)) > 0.5; TH.Col.addRect(level, x, z, sw ? d : w, sw ? w : d, sight); };

      // a real drawer: front, handle, open-top box with clutter inside. Lives in its own (dynamic) group so it can slide.
      const drawer = (g, level, label, wood, w, hh, d, x, y, fz, knobs) => {
        const p = new THREE.Group(); p.position.set(x, y, 0); p.userData.dynamic = true; g.add(p);
        B(w - 0.01, hh - 0.01, 0.022, wood, 0, 0, fz - 0.011, p, true);
        if (knobs === 2) [-1, 1].forEach((s) => { const k = h.addMesh(new THREE.SphereGeometry(0.016, 10, 8), brass, s * w * 0.27, 0, fz + 0.012, p); k.scale.z = 0.8; });
        else { B(Math.min(0.12, w * 0.3), 0.014, 0.014, brass, 0, 0.005, fz + 0.026, p); [-1, 1].forEach((s) => B(0.01, 0.01, 0.028, brass, s * Math.min(0.05, w * 0.12), 0.005, fz + 0.012, p)); }
        const bd = d - 0.07, by = -hh / 2 + 0.025, ih = hh - 0.06, bz = fz - 0.022 - bd / 2;
        B(w - 0.05, 0.01, bd, dark, 0, by, bz, p);
        [-1, 1].forEach((s) => B(0.012, ih, bd, raw, s * (w / 2 - 0.03), by + ih / 2, bz, p));
        B(w - 0.05, ih, 0.012, raw, 0, by + ih / 2, bz - bd / 2 + 0.006, p);
        // clutter: folded clothes, papers, a pill bottle…
        const n = Math.floor(R(1, 4));
        for (let i = 0; i < n; i++) {
          const r = Math.random(), cx = R(-w / 2 + 0.12, w / 2 - 0.12), cz = bz + R(-bd / 2 + 0.1, bd / 2 - 0.1);
          if (r < 0.55) { const t = R(0.03, Math.min(0.07, ih * 0.6)); const m = B(R(0.16, 0.24), t, R(0.14, 0.2), cloth[Math.floor(Math.random() * cloth.length)], cx, by + 0.005 + t / 2, cz, p); m.rotation.y = R(-0.3, 0.3); }
          else if (r < 0.85) { const m = B(R(0.15, 0.21), 0.006, R(0.2, 0.28), paper, cx, by + 0.008, cz, p); m.rotation.y = R(-0.5, 0.5); }
          else { h.addMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0xc87a2a, roughness: 0.4, transparent: true, opacity: 0.85 }), cx, by + 0.035, cz, p); }
        }
        const o = { kind: 'drawer', label, level, parent: g, node: p, z0: 0, slide: bd * 0.7, t: 0, open: false, front: new THREE.Vector3(x, y, fz + 0.05), spot: new THREE.Vector3(0, by + 0.006, bz + bd * 0.18) };
        this.list.push(o); return o;
      };

      // chest of drawers: real carcass (sides, top, back, rails, dividers) so an open drawer shows a dark cavity behind it
      const chest = (level, x, z, ry, w, hh, d, rows, cols, color, label, knobs) => {
        const g = piece(level, x, z, ry), wood = h.woodMat(color);
        B(w + 0.03, 0.03, d + 0.025, wood, 0, hh - 0.015, 0.006, g, true); // top
        [-1, 1].forEach((s) => B(0.025, hh - 0.03, d, wood, s * (w / 2 - 0.0125), (hh - 0.03) / 2, 0, g, true));
        B(w - 0.05, 0.07, 0.02, wood, 0, 0.035, d / 2 - 0.03, g); // kick rail
        B(w, hh - 0.03, 0.012, dark, 0, (hh - 0.03) / 2, -d / 2 + 0.006, g); // back
        B(w - 0.05, 0.012, d - 0.02, dark, 0, 0.076, 0, g); // floor of the carcass
        const y0 = 0.082, y1 = hh - 0.03, rh = (y1 - y0) / rows, cw = (w - 0.05) / cols;
        for (let r = 1; r < rows; r++) { const y = y0 + rh * r; B(w - 0.05, 0.018, 0.025, wood, 0, y, d / 2 - 0.0125, g); B(w - 0.05, 0.006, d - 0.04, dark, 0, y, -0.01, g); }
        for (let c = 1; c < cols; c++) B(0.018, y1 - y0, d - 0.02, wood, -w / 2 + 0.025 + cw * c, (y0 + y1) / 2, 0, g);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) drawer(g, level, label, wood, cw - 0.008, rh - 0.012, d - 0.02, -w / 2 + 0.025 + cw * (c + 0.5), y0 + rh * (r + 0.5), d / 2, knobs);
        collider(level, x, z, ry, w, d, false);
        return g;
      };

      chest(1, 15.62, -8.5, -Math.PI / 2, 1.2, 0.85, 0.48, 3, 2, 0x3a2616, 'DRAWER', 2); // back bedroom dresser
      chest(1, -15.62, 6.2, Math.PI / 2, 1.4, 0.85, 0.5, 3, 2, 0x3a2616, 'DRAWER', 2); // master dresser
      chest(1, 9.38, 10.2, Math.PI / 2, 0.9, 0.75, 0.5, 2, 1, 0x4a3020, 'DRAWER', 1); // guest room chest
      chest(1, -12.3, 11.62, Math.PI, 0.45, 0.6, 0.45, 2, 1, 0x3a2616, 'NIGHTSTAND DRAWER', 1); // master nightstand
      chest(1, 10.65, -11.65, 0, 0.45, 0.6, 0.45, 2, 1, 0x3a2616, 'NIGHTSTAND DRAWER', 1); // back bedroom nightstand
      chest(0, -2.65, -5.6, Math.PI / 2, 1.0, 0.8, 0.45, 2, 2, 0x4a2a14, 'DRAWER', 1); // chest of drawers in the back hall

      // kitchen island: three cutlery drawers under the worktop, facing the room
      { const g = piece(0, -11.5, -7.8, 0), wood = h.woodMat(0x5a4a38);
        [-0.6, 0, 0.6].forEach((dx) => {
          B(0.56, 0.17, 0.42, dark, dx, 0.76, 0.29, g); // the slot the drawer sits in
          const o = drawer(g, 0, 'DRAWER', wood, 0.56, 0.16, 0.46, dx, 0.76, 0.522, 1);
          for (let k = 0; k < 6; k++) { const m = B(0.012, 0.004, 0.18, chrome, R(-0.2, 0.2), -0.044, 0.3 + R(-0.06, 0.06), o.node); m.rotation.y = R(-0.15, 0.15); } // forks/knives
        }); }

      // the fridge: a 70s top-freezer with an enamel shell, a lit liner, shelves, food, and two hinged doors
      { const level = 0, ry = Math.PI / 2, g = piece(level, -15.48, -6.5, ry);
        const w = 0.78, hh = 1.78, zf = 0.29, zb = -0.36, bd = zf - zb;
        const enamel = new THREE.MeshPhysicalMaterial({ color: 0xd9cfb2, roughness: 0.32, metalness: 0.02, clearcoat: 0.5, clearcoatRoughness: 0.35 });
        const liner = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.55, emissive: 0x24241f });
        const rubber = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.9 });
        const glass = new THREE.MeshStandardMaterial({ color: 0xcfe0e0, roughness: 0.1, transparent: true, opacity: 0.35 });
        g.userData.noPBR = false;
        [-1, 1].forEach((s) => B(0.035, hh, bd, enamel, s * (w / 2 - 0.0175), hh / 2, (zf + zb) / 2, g));
        B(w, 0.035, bd, enamel, 0, hh - 0.0175, (zf + zb) / 2, g); B(w, hh, 0.02, enamel, 0, hh / 2, zb + 0.01, g);
        B(w - 0.02, 0.1, 0.02, dark, 0, 0.05, zf - 0.03, g); // kick grille
        for (let i = 0; i < 5; i++) B(w - 0.08, 0.008, 0.005, chrome, 0, 0.025 + i * 0.018, zf - 0.018, g);
        // liner (glows faintly as if the bulb were on)
        B(w - 0.08, hh - 0.2, 0.01, liner, 0, hh / 2 + 0.03, zb + 0.03, g);
        [-1, 1].forEach((s) => B(0.01, hh - 0.2, bd - 0.05, liner, s * (w / 2 - 0.04), hh / 2 + 0.03, (zf + zb) / 2, g));
        B(w - 0.08, 0.01, bd - 0.05, liner, 0, 0.12, (zf + zb) / 2, g); B(w - 0.08, 0.01, bd - 0.05, liner, 0, hh - 0.045, (zf + zb) / 2, g);
        B(w - 0.08, 0.035, bd - 0.04, liner, 0, 1.3, (zf + zb) / 2, g); // freezer floor
        h.addMesh(new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), 0.25, 1.24, zb + 0.08, g); // bulb
        [0.5, 0.88].forEach((y) => B(w - 0.1, 0.008, bd - 0.08, glass, 0, y, (zf + zb) / 2 - 0.01, g));
        B(w - 0.12, 0.2, bd - 0.12, glass, 0, 0.24, (zf + zb) / 2 - 0.02, g); // crisper
        // food: milk, takeout, jars, beer, a mouldy plate, ketchup; frost and boxes in the freezer
        const food = (geo, color, x, y, z, rough) => h.addMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: rough || 0.5 }), x, y, z, g);
        food(new THREE.BoxGeometry(0.1, 0.22, 0.1), 0xf2f0e8, -0.22, 0.12 + 0.12, -0.1); food(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10), 0x2a5ac8, -0.22, 0.37, -0.1);
        food(new THREE.BoxGeometry(0.13, 0.1, 0.12), 0xeee8d8, 0.1, 0.56, -0.12, 0.8); food(new THREE.BoxGeometry(0.135, 0.012, 0.125), 0xb03a2a, 0.1, 0.6, -0.12);
        for (let i = 0; i < 3; i++) food(new THREE.CylinderGeometry(0.03, 0.033, 0.2, 12), 0x4a2a10, 0.22 - i * 0.07, 0.99, 0.0, 0.15);
        food(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 14), 0x7a8a3a, -0.18, 0.95, -0.12, 0.6); food(new THREE.CylinderGeometry(0.047, 0.047, 0.02, 14), 0xb0a080, -0.18, 1.01, -0.12);
        food(new THREE.CylinderGeometry(0.11, 0.09, 0.02, 18), 0xe8e4d8, -0.05, 0.515, 0.02, 0.4); food(new THREE.SphereGeometry(0.06, 10, 8), 0x5a6a3a, -0.05, 0.53, 0.02, 1.0).scale.y = 0.4;
        food(new THREE.CylinderGeometry(0.025, 0.03, 0.17, 10), 0xb0201a, -0.27, 0.6, 0.05, 0.3);
        food(new THREE.BoxGeometry(0.22, 0.06, 0.16), 0xc8c0a8, 0.14, 0.15 + 0.04, -0.05, 0.7);
        food(new THREE.BoxGeometry(0.2, 0.14, 0.15), 0x3a5a8a, -0.12, 1.39, -0.1, 0.6); food(new THREE.BoxGeometry(0.16, 0.05, 0.22), 0xdadada, 0.15, 1.345, -0.05, 0.7);
        food(new THREE.BoxGeometry(w - 0.1, 0.03, 0.2), 0xf4f6f8, 0, hh - 0.07, -0.15, 0.9); // frost
        // doors: hinged on the left; liner, gasket, shelves and bottles on the inside, chrome handle outside
        const mkDoor = (y0, y1, label, main) => {
          const p = new THREE.Group(); p.position.set(w / 2, 0, zf); p.scale.x = -1; p.userData.dynamic = true; g.add(p); // hinged on the right (mirrored)
          const dh = y1 - y0, cy = (y0 + y1) / 2;
          B(w - 0.006, dh - 0.008, 0.06, enamel, w / 2, cy, 0.03, p);
          B(w - 0.04, dh - 0.04, 0.012, rubber, w / 2, cy, -0.004, p);
          B(w - 0.09, dh - 0.09, 0.02, liner, w / 2, cy, -0.012, p);
          B(0.026, Math.min(0.3, dh * 0.45), 0.022, chrome, w - 0.06, y1 - (main ? 0.25 : 0.2), 0.085, p);
          [-1, 1].forEach((s) => B(0.02, 0.02, 0.03, chrome, w - 0.06, y1 - (main ? 0.25 : 0.2) + s * Math.min(0.13, dh * 0.2), 0.068, p));
          if (main) {
            [0.32, 0.66, 0.98].forEach((y, i) => {
              B(w - 0.14, 0.07, 0.008, liner, w / 2, y + 0.035, -0.105, p); B(w - 0.14, 0.008, 0.09, liner, w / 2, y, -0.065, p);
              if (i === 2) for (let k = 0; k < 5; k++) h.addMesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 }), 0.15 + k * 0.1, y + 0.03, -0.065, p).scale.y = 1.25; // eggs
            });
          }
          return p;
        };
        const doorF = mkDoor(1.32, hh - 0.005, 'FREEZER', false), doorM = mkDoor(0.105, 1.31, 'FRIDGE', true);
        // bottles in the door bins (built after so they attach to the main door)
        [[0.32, [0x3a6a2a, 0xc8a83a, 0xe8e0d0]], [0.66, [0x9a2a1a, 0x2a2a2a]]].forEach(([y, cols]) => cols.forEach((c, k) => {
          const bh = R(0.16, 0.22); h.addMesh(new THREE.CylinderGeometry(0.03, 0.032, bh, 10), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }), 0.17 + k * 0.17, y + bh / 2 + 0.005, -0.065, doorM);
        }));
        const fr = (node, label, y, main) => { const o = { kind: 'door', fridge: true, main, label, level, parent: g, node, max: 1.75, t: 0, open: false, front: new THREE.Vector3(0, y, zf + 0.12), spot: main ? new THREE.Vector3(0.22, 0.506, 0.08) : null, spotLocalToParent: true }; this.list.push(o); };
        fr(doorF, 'FREEZER', 1.55, false); fr(doorM, 'FRIDGE', 1.0, true);
        collider(level, -15.48, -6.5, ry, w, 0.72, true);
      }

      // world positions for the prompts
      scene.updateMatrixWorld(true);
      this.list.forEach((o) => { const p = o.parent.localToWorld(o.front.clone()); o.wx = p.x; o.wy = p.y; o.wz = p.z; });
    },

    reset() {
      this.list.forEach((o) => {
        if (o.item) this.unplace(o);
        o.open = false; o.t = 0; o.contents = null; o.item = null; o.roaches = Math.random() < 0.18; o.shutPending = false; this.apply(o);
      });
    },
    apply(o) {
      const e = o.t * o.t * (3 - 2 * o.t);
      if (o.kind === 'drawer') o.node.position.z = o.z0 + o.slide * e; else o.node.rotation.y = o.max * e; // mirrored door: positive swings it out
    },
    // pull an item that's still sitting in a drawer back "inside" when you shut it
    unplace(o) {
      const w = o.item, I = TH.Items;
      if (w && I.world.includes(w)) { TH.scene.remove(w.mesh); TH.Interact.remove(w.it); I.world = I.world.filter((x) => x !== w); o.contents = { id: w.id, extra: w.extra }; }
      o.item = null;
    },

    register() {
      const IS = TH.Interact;
      this.list.forEach((o) => {
        IS.add({ x: o.wx, z: o.wz, level: o.level, y: o.wy, r: o.fridge ? 1.7 : 1.45,
          prompt: () => (o.open ? 'CLOSE ' : 'OPEN ') + 'THE ' + o.label, short: () => (o.open ? 'CLOSE' : 'OPEN'), bias: () => (o.item ? 0.8 : 0.2), // whatever's inside wins your aim over the door/drawer
          use: () => {
            o.open = !o.open;
            const pos = { x: o.wx, y: o.wy, z: o.wz };
            if (o.open) {
              TH.Audio.play(o.fridge ? 'fridge' : 'drawer', pos, 12); TH.Noise.emit(o.wx, o.wz, o.level, o.fridge ? 4 : 3, o.fridge ? 'the fridge door' : 'a drawer sliding');
              if (o.roaches) { o.roaches = false; TH.Roaches.burst(o.wx, o.level * TH.House.H + 0.3, o.wz, 8, o.level); TH.Audio.play('roach'); TH.UI.toast('Roaches.'); }
            } else { if (o.item) this.unplace(o); o.shutPending = true; }
          } });
      });
    },

    update(dt) {
      this.list.forEach((o) => {
        const want = o.open ? 1 : 0; if (o.t === want) return;
        o.t += (want - o.t) * Math.min(1, dt * (o.fridge ? 5 : 8)); if (Math.abs(want - o.t) < 0.004) o.t = want;
        this.apply(o);
        if (o.open && o.t > 0.85 && o.contents && !o.item && o.spot) {
          o.node.updateMatrixWorld(true);
          const p = (o.kind === 'drawer' ? o.node : o.parent).localToWorld(o.spot.clone());
          o.item = TH.Items.place(o.contents.id, p.x, p.y, p.z, o.level, o.contents.extra); o.contents = null;
        }
        if (!o.open && o.shutPending && o.t < 0.06) { o.shutPending = false; TH.Audio.play(o.fridge ? 'fridgeShut' : 'drawerShut', { x: o.wx, y: o.wy, z: o.wz }, 12); }
      });
      // anything you took out of a drawer is no longer "in" it
      this.list.forEach((o) => { if (o.item && !TH.Items.world.includes(o.item)) o.item = null; });
    },
  };
})();
