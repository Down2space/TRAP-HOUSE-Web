/* TRAP HOUSE — the garage escape.
   Garage: cinder-block walls, stained concrete, joists, fluorescent tube, workbench, pegboard, shelving, sectional door with opener.
   The car: a 1970s full-size sedan (Tim Wright's), built from extruded/lofted profiles with clear-coated paint,
   rust, chrome trim, glass you can see the interior through, real wheels, working hood, gas cap and ignition.
   To escape: put in the spark plug, fill the tank, find the keys, get in and start it. Then floor it. */
(function () {
  'use strict';
  const TH = window.TH, R = (a, b) => a + Math.random() * (b - a);
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return [c, c.getContext('2d')]; };
  const tx = (c, rep) => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; return t; };
  const V2 = (pts) => pts.map(([a, b]) => new THREE.Vector2(a, b));
  const CAR = { x: 19.6, z: -7.4 }; // car centre; it faces +z (toward the garage door)

  const G = (TH.Garage = {
    build(scene) {
      const Hs = TH.House, H = Hs.H, h = Hs.h, add = (geo, m, x, y, z, p) => h.addMesh(geo, m, x, y, z, p);

      /* ---------- materials ---------- */
      const [bc, bk] = cv(512); bk.fillStyle = '#8c8a82'; bk.fillRect(0, 0, 512, 512);
      for (let row = 0; row < 8; row++) for (let col = -1; col < 4; col++) { const x = col * 160 + (row % 2) * 80, y = row * 64, l = R(118, 150); bk.fillStyle = `rgb(${l},${l - 2},${l - 8})`; bk.fillRect(x + 3, y + 3, 154, 58); for (let i = 0; i < 70; i++) { bk.fillStyle = `rgba(60,58,50,${R(0.1, 0.4)})`; bk.fillRect(x + R(4, 154), y + R(4, 58), R(1, 3), R(1, 3)); } }
      for (let i = 0; i < 6; i++) { const x = R(0, 512); const gr = bk.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, 'rgba(70,55,30,.45)'); gr.addColorStop(R(0.4, 1), 'rgba(70,55,30,0)'); bk.fillStyle = gr; bk.fillRect(x, 0, R(4, 14), 512); }
      TH.seamless(bc); const block = new THREE.MeshStandardMaterial({ map: tx(bc, [1, 1]), roughness: 0.95 });
      const [cc, ck] = cv(512); ck.fillStyle = '#7a7872'; ck.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 20000; i++) { const v = R(95, 135); ck.fillStyle = `rgba(${v},${v - 2},${v - 6},.5)`; ck.fillRect(Math.random() * 512, Math.random() * 512, 1, 1); }
      ck.strokeStyle = 'rgba(40,38,34,.7)'; ck.lineWidth = 2; ck.beginPath(); ck.moveTo(256, 0); ck.lineTo(256, 512); ck.stroke();
      for (let i = 0; i < 5; i++) { ck.lineWidth = 1; ck.beginPath(); let x = R(0, 512), y = R(0, 512); ck.moveTo(x, y); for (let j = 0; j < 12; j++) { x += R(-18, 18); y += R(-18, 18); ck.lineTo(x, y); } ck.stroke(); }
      for (let i = 0; i < 6; i++) { const x = R(60, 450), y = R(60, 450), r = R(30, 90); const og = ck.createRadialGradient(x, y, 0, x, y, r); og.addColorStop(0, 'rgba(15,14,12,.85)'); og.addColorStop(0.7, 'rgba(25,22,18,.5)'); og.addColorStop(1, 'rgba(25,22,18,0)'); ck.fillStyle = og; ck.fillRect(x - r, y - r, r * 2, r * 2); }
      TH.seamless(cc); const concrete = new THREE.MeshStandardMaterial({ map: tx(cc), roughness: 0.75 });
      const joist = h.woodMat(0x8a6a44), steel = TH.Tex.rusty(new THREE.MeshStandardMaterial({ color: 0x8a8c8e, metalness: 0.8, roughness: 0.45 }), 0xc8c4c0);
      const siding = Hs.mats.W.siding;

      /* ---------- shell: floor, ceiling joists, walls (+ exterior siding), shed roof ---------- */
      const X0 = 16.1, X1 = 23, Z0 = -12, Z1 = -3, cxm = (X0 + X1) / 2, czm = (Z0 + Z1) / 2;
      const floor = add(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), concrete, cxm, 0.002, czm); floor.rotation.x = -Math.PI / 2;
      const ceil = add(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshStandardMaterial({ color: 0x5a5248, roughness: 1 }), cxm, H - 0.12, czm); ceil.rotation.x = Math.PI / 2;
      for (let x = X0 + 0.4; x < X1; x += 0.6) add(new THREE.BoxGeometry(0.05, 0.24, Z1 - Z0), joist, x, H - 0.25, czm);
      const wall = (x0, z0, x1, z1, y0, y1) => { const w = Math.max(0.2, Math.abs(x1 - x0)), d = Math.max(0.2, Math.abs(z1 - z0)), hh = y1 - y0;
        add(TH.Tex.boxUV(new THREE.BoxGeometry(w, hh, d), w, hh, d, 2), block, (x0 + x1) / 2, y0 + hh / 2, (z0 + z1) / 2);
        if (y0 < 0.1) TH.Col.addRect(0, (x0 + x1) / 2, (z0 + z1) / 2, w, d, true); };
      const sk = (x, z, w, d, y0, y1) => add(TH.Tex.boxUV(new THREE.BoxGeometry(w, y1 - y0, d), w, y1 - y0, d, 2.5), siding, x, (y0 + y1) / 2, z);
      wall(X0, Z0 - 0.1, X1 + 0.1, Z0 + 0.1, 0, H); sk(cxm + 0.05, Z0 - 0.125, X1 - X0 + 0.3, 0.05, 0, H);
      wall(X1 - 0.1, Z0, X1 + 0.1, Z1, 0, H); sk(X1 + 0.125, czm, 0.05, Z1 - Z0 + 0.2, 0, H);
      const D0 = 18.1, D1 = 21.1, DH = 2.4; // garage door opening
      wall(X0, Z1 - 0.1, D0, Z1 + 0.1, 0, H); wall(D1, Z1 - 0.1, X1 + 0.1, Z1 + 0.1, 0, H); wall(D0, Z1 - 0.1, D1, Z1 + 0.1, DH, H);
      sk((X0 + D0) / 2, Z1 + 0.125, D0 - X0, 0.05, 0, H); sk((D1 + X1) / 2 + 0.05, Z1 + 0.125, X1 - D1 + 0.1, 0.05, 0, H); sk((D0 + D1) / 2, Z1 + 0.125, D1 - D0, 0.05, DH, H);
      const trimW = h.woodMat(0xc8b89a); add(new THREE.BoxGeometry(D1 - D0 + 0.3, 0.14, 0.06), trimW, (D0 + D1) / 2, DH + 0.07, Z1 + 0.17); [D0, D1].forEach((x) => add(new THREE.BoxGeometry(0.14, DH, 0.06), trimW, x, DH / 2, Z1 + 0.17));
      // flat roof: it's part of the wraparound deck now (built with the deck)
      // garage door collider (removed when the door opens)
      this.doorCol = TH.Col.addRect(0, (D0 + D1) / 2, Z1, D1 - D0, 0.2, true);

      /* ---------- sectional garage door with ribbed panels and a row of dirty windows ---------- */
      const gd = (this.door = new THREE.Group()); gd.userData.dynamic = true; scene.add(gd); gd.position.set((D0 + D1) / 2, 0, Z1);
      const panelM = TH.Tex.rusty(new THREE.MeshStandardMaterial({ color: 0xb8b2a2, metalness: 0.4, roughness: 0.55 }), 0xd8d2c8), rib = TH.Tex.rusty(new THREE.MeshStandardMaterial({ color: 0x8a8476, metalness: 0.4, roughness: 0.6 }), 0xa8a29a);
      const GD = TH.Tex.photo.gdoor, gdM = GD && new THREE.MeshStandardMaterial({ map: GD, color: 0xc8beb4, roughness: 1, metalness: 0 }); // old studded carriage-house door, one row of panels per section
      for (let i = 0; i < 4; i++) { const py = 0.3 + i * 0.6, pg = new THREE.BoxGeometry(D1 - D0 - 0.02, 0.58, 0.05);
        if (GD) { const uv = pg.attributes.uv; for (let q = 0; q < uv.count; q++) uv.setXY(q, uv.getX(q) * (D1 - D0) / 2.4, (i + uv.getY(q)) / 4); }
        add(pg, GD ? gdM : panelM, 0, py, 0, gd); if (!GD) for (let k = -1; k <= 1; k++) add(new THREE.BoxGeometry(D1 - D0 - 0.3, 0.025, 0.06), rib, 0, py + k * 0.15, 0.005, gd);
        if (i === 3) for (let k = 0; k < 4; k++) add(new THREE.PlaneGeometry(0.55, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.1, metalness: 0.4 }), -1.1 + k * 0.73, py, -0.03, gd).rotation.y = Math.PI; }
      add(new THREE.BoxGeometry(0.2, 0.04, 0.05), steel, 0, 0.9, -0.05, gd); // handle
      // tracks + opener motor on the ceiling
      [D0 + 0.05, D1 - 0.05].forEach((x) => { add(new THREE.BoxGeometry(0.05, DH, 0.08), steel, x, DH / 2, Z1 - 0.12); add(new THREE.BoxGeometry(0.05, 0.08, 2.8), steel, x, DH + 0.05, Z1 - 1.5); });
      add(new THREE.BoxGeometry(0.06, 0.06, 3.2), steel, (D0 + D1) / 2, H - 0.25, Z1 - 1.7); add(new THREE.BoxGeometry(0.45, 0.2, 0.35), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.6 }), (D0 + D1) / 2, H - 0.25, Z1 - 3.3);

      /* ---------- fluorescent tube (a real light for the lighting pool) ---------- */
      const tubeMat = new THREE.MeshBasicMaterial({ color: 0xe8f0ff });
      const fx = add(new THREE.BoxGeometry(1.25, 0.06, 0.18), steel, 19.6, H - 0.4, -8.2); add(new THREE.CylinderGeometry(0.018, 0.018, 1.2, 8), tubeMat, 19.6, H - 0.45, -8.2).rotation.z = Math.PI / 2;
      const bulb = add(new THREE.CylinderGeometry(0.018, 0.018, 1.2, 8), tubeMat, 19.6, H - 0.45, -8.14); bulb.rotation.z = Math.PI / 2; bulb.userData.dynamic = true;
      Hs.fixtures.push({ x: 19.6, y: H - 0.55, z: -8.2, level: 0, bulb, mat: tubeMat, power: 0.6, flicker: true, color: 0xdde8ff });

      /* ---------- workbench, vise, pegboard with tools, shelving, tires, junk ---------- */
      const wb = h.woodMat(0x7a5a38);
      add(TH.Tex.boxUV(new THREE.BoxGeometry(0.7, 0.06, 3.2), 0.7, 0.06, 3.2, 1), wb, 22.55, 0.92, -8.4); TH.Col.addRect(0, 22.55, -8.4, 0.7, 3.2, false);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(new THREE.BoxGeometry(0.07, 0.9, 0.07), wb, 22.55 + a * 0.3, 0.45, -8.4 + b * 1.5));
      add(new THREE.BoxGeometry(0.62, 0.04, 3.1), wb, 22.55, 0.3, -8.4);
      const vise = new THREE.Group(); vise.position.set(22.4, 0.95, -7.2); scene.add(vise); add(new THREE.BoxGeometry(0.22, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a5a8a, metalness: 0.5, roughness: 0.5 }), 0, 0.05, 0, vise); add(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), steel, -0.16, 0.05, 0, vise).rotation.z = Math.PI / 2;
      const [pc, pk] = cv(512, 256); pk.fillStyle = '#9a8460'; pk.fillRect(0, 0, 512, 256); for (let y = 8; y < 256; y += 16) for (let x = 8; x < 512; x += 16) { pk.fillStyle = '#3a3020'; pk.beginPath(); pk.arc(x, y, 2, 0, 6.28); pk.fill(); }
      pk.strokeStyle = '#2a2a2a'; pk.lineWidth = 7; [[40, 40, 40, 200], [90, 40, 70, 170], [150, 60, 150, 210], [200, 50, 230, 200], [270, 40, 270, 140], [320, 60, 360, 190], [420, 40, 420, 210]].forEach(([a, b, c, d]) => { pk.beginPath(); pk.moveTo(a, b); pk.lineTo(c, d); pk.stroke(); });
      pk.strokeStyle = 'rgba(20,20,20,.35)'; pk.lineWidth = 3; [[460, 120, 30]].forEach(([x, y, r]) => { pk.beginPath(); pk.arc(x, y, r, 0, 6.28); pk.stroke(); }); // outline of a missing tool
      const peg = add(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshStandardMaterial({ map: tx(pc), roughness: 0.85 }), 22.88, 1.85, -8.4); peg.rotation.y = -Math.PI / 2;
      const shelf = h.woodMat(0x6a5038);
      for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(2.6, 0.04, 0.5), shelf, 17.6, 0.35 + k * 0.6, -11.7);
      [16.35, 18.85].forEach((x) => add(new THREE.BoxGeometry(0.05, 2.3, 0.5), steel, x, 1.15, -11.7)); TH.Col.addRect(0, 17.6, -11.7, 2.6, 0.55, true);
      const canM = [0xb03024, 0x2a5a8a, 0xd8c040, 0x6a6a6a].map((c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.6, roughness: 0.4 }));
      for (let i = 0; i < 9; i++) add(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 14), TH.util.pick(canM), 16.6 + (i % 5) * 0.45, 0.47 + Math.floor(i / 5) * 0.6, -11.68);
      const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 });
      for (let i = 0; i < 3; i++) { const t = add(new THREE.TorusGeometry(0.3, 0.11, 10, 22), rubber, 22.4, 0.11 + i * 0.22, -11.3); t.rotation.x = Math.PI / 2; } TH.Col.addRect(0, 22.4, -11.3, 0.85, 0.85, false);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), TH.Tex.rusty(new THREE.MeshStandardMaterial({ color: 0x2a4a3a, metalness: 0.5, roughness: 0.6 }), 0xd0c8bc, 'rustsheet', 2, 1), 16.6, 0.45, -3.7); TH.Col.addRect(0, 16.6, -3.7, 0.6, 0.6, false);
      // light switch & a scrawled note
      add(new THREE.BoxGeometry(0.08, 0.12, 0.02), new THREE.MeshStandardMaterial({ color: 0xd8d0c0 }), 16.25, 1.2, -11.88).rotation.y = 0;
      const lk = TH.Tex.graffiti('KEYS IN\nTHE OFFICE', '#c8372d', 1.6); lk.position.set(16.22, 1.7, -10.4); lk.rotation.y = Math.PI / 2; scene.add(lk);
      // tall metal cabinet you can hide in
      { const cab = new THREE.Group(); cab.position.set(16.45, 0, -8.2); cab.rotation.y = Math.PI / 2; scene.add(cab); const cm = TH.Tex.photo.bluemetal ? new THREE.MeshStandardMaterial({ map: TH.Tex.photo.bluemetal, color: 0xd0d4d8, metalness: 0.55, roughness: 1 }) : TH.Tex.rusty(new THREE.MeshStandardMaterial({ color: 0x5a6a5a, metalness: 0.6, roughness: 0.5 }), 0x9aa89a);
        add(new THREE.BoxGeometry(0.9, 1.95, 0.05), cm, 0, 0.98, -0.25, cab); [-1, 1].forEach((sd) => add(new THREE.BoxGeometry(0.05, 1.95, 0.5), cm, sd * 0.45, 0.98, 0, cab)); add(new THREE.BoxGeometry(0.9, 0.05, 0.5), cm, 0, 1.96, 0, cab);
        for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.3, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }), -0.2, 1.4 + i * 0.05, 0.26, cab);
        [-1, 1].forEach((sd) => add(new THREE.BoxGeometry(0.43, 1.9, 0.02), cm, sd * 0.22, 0.98, 0.25, cab));
        TH.Col.addRect(0, 16.45, -8.2, 0.55, 0.95, true);
        Hs.hideSpots.push({ type: 'closet', name: 'metal cabinet', level: 0, x: 16.45, z: -8.2, enter: { x: 17.4, z: -8.2 }, cam: { x: 16.5, z: -8.2, y: 1.45 }, yaw: -Math.PI / 2, r: 2.0 }); }

      this.hoodT = 0; this.driving = false; this.hoodOpen = false;
      /* ---------- the car ---------- */
      this.car = this.buildCar(); this.car.position.set(CAR.x, 0, CAR.z); scene.add(this.car);
      TH.Col.addRect(0, CAR.x, CAR.z, 1.92, 5.1, false); this.carCol = TH.Col.boxes[0][TH.Col.boxes[0].length - 1];
      const blob = add(new THREE.PlaneGeometry(2.6, 5.6), new THREE.MeshBasicMaterial({ map: TH.Tex.blob, transparent: true, depthWrite: false, opacity: 0.9 }), CAR.x, 0.006, CAR.z); blob.rotation.x = -Math.PI / 2; this.blob = blob; blob.userData.dynamic = true;
    },

    /* =============== the car model =============== */
    buildCar() {
      const car = new THREE.Group(); car.userData.dynamic = true;
      const add = (geo, m, x, y, z, p) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; (p || car).add(o); return o; };
      // paint: faded seafoam with rust blooms, scratches and grime under a dull clear coat
      // paint map (multiplied with the paint colour). UV v ≈ height on the body sides, so the bottom of the canvas = rocker panels.
      const [pc, pk] = cv(1024); pk.fillStyle = '#ffffff'; pk.fillRect(0, 0, 1024, 1024);
      const blotch = (x, y, r, a) => { for (let k = 0; k < 26; k++) { const px = x + R(-r, r), py = y + R(-r, r) * 0.6, rr = R(r * 0.15, r * 0.45); const g = pk.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, `rgba(${R(120, 160)},${R(58, 80)},${R(24, 36)},${a})`); g.addColorStop(1, 'rgba(150,80,40,0)'); pk.fillStyle = g; pk.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
        for (let k = 0; k < 60; k++) { pk.fillStyle = `rgba(${R(70, 110)},${R(30, 50)},12,${R(0.3, 0.7)})`; pk.fillRect(x + R(-r, r) * 0.8, y + R(-r, r) * 0.5, R(1, 3), R(1, 3)); } };
      for (let x = 0; x < 1024; x += R(30, 70)) blotch(x, R(880, 1010), R(25, 55), 0.8);    // rocker-panel rust band
      for (let i = 0; i < 7; i++) blotch(R(0, 1024), R(560, 860), R(14, 40), 0.65);          // a few blooms higher up
      for (let i = 0; i < 260; i++) { pk.fillStyle = `rgba(${R(110, 150)},${R(60, 80)},30,${R(0.4, 0.9)})`; const s2 = R(1, 4); pk.fillRect(R(0, 1024), R(0, 1024), s2, s2); } // chips
      pk.strokeStyle = 'rgba(230,230,225,.55)'; pk.lineWidth = 1; for (let i = 0; i < 90; i++) { pk.beginPath(); const x = R(0, 1024), y = R(0, 1024); pk.moveTo(x, y); pk.lineTo(x + R(-70, 70), y + R(-5, 5)); pk.stroke(); }
      const dg = pk.createLinearGradient(0, 600, 0, 1024); dg.addColorStop(0, 'rgba(120,108,85,0)'); dg.addColorStop(1, 'rgba(120,108,85,.5)'); pk.fillStyle = dg; pk.fillRect(0, 600, 1024, 424); // road grime low down
      for (let i = 0; i < 9; i++) { const x = R(0, 1024); const g = pk.createLinearGradient(0, 300, 0, 1024); g.addColorStop(0, 'rgba(110,100,80,.25)'); g.addColorStop(1, 'rgba(110,100,80,0)'); pk.fillStyle = g; pk.fillRect(x, 300, R(6, 20), 724); } // drip streaks
      const pt = tx(pc); pt.repeat.set(0.4, 1.0); pt.offset.set(0, -0.3);
      const paint = new THREE.MeshPhysicalMaterial({ color: 0x6f9a8a, map: pt, metalness: 0.35, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.35, envMapIntensity: 0.9 });
      const chrome = new THREE.MeshStandardMaterial({ color: 0xe0e4e8, metalness: 1, roughness: 0.12, envMapIntensity: 1.4 });
      const pitted = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.95, roughness: 0.32 });
      const blackTrim = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 });
      const glass = new THREE.MeshStandardMaterial({ color: 0x0c1216, metalness: 0.6, roughness: 0.04, transparent: true, opacity: 0.62, envMapIntensity: 2.0, side: THREE.DoubleSide, depthWrite: false });
      const rubber = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.82 });
      const vinyl = new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.55 }), dash = new THREE.MeshStandardMaterial({ color: 0x2a201a, roughness: 0.6 });
      const W = 1.88, L = 5.05;

      // body: side profile (z = length, y = height) extruded across the width with soft rounded edges; wheel arches cut in
      const fw = 1.55, rw = -1.48, ar = 0.43;
      // rear/centre body (full width): cabin floor to tail, rear wheel arch cut out
      const s = new THREE.Shape();
      s.moveTo(-2.52, 0.34); s.lineTo(rw - ar, 0.34); s.absarc(rw, 0.36, ar, Math.PI, 0, true); s.lineTo(1.03, 0.34); s.lineTo(1.03, 0.95); s.lineTo(-1.32, 0.95);
      s.lineTo(-2.38, 0.93); s.quadraticCurveTo(-2.52, 0.9, -2.55, 0.78); s.lineTo(-2.52, 0.34);
      const bodyGeo = new THREE.ExtrudeGeometry(s, { depth: W - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 5, curveSegments: 18 });
      bodyGeo.translate(0, 0, -(W - 0.16) / 2); bodyGeo.rotateY(-Math.PI / 2);
      add(bodyGeo, paint);
      // front fenders (left & right) with the front wheel arches; the engine bay sits open between them under the hood
      const f = new THREE.Shape(); f.moveTo(1.0, 0.34); f.lineTo(fw - ar, 0.34); f.absarc(fw, 0.36, ar, Math.PI, 0, true); f.lineTo(2.5, 0.34);
      f.quadraticCurveTo(2.56, 0.5, 2.54, 0.7); f.quadraticCurveTo(2.5, 0.84, 2.36, 0.87); f.lineTo(1.0, 0.95); f.lineTo(1.0, 0.34);
      [-0.86, 0.66].forEach((oz) => { const fg = new THREE.ExtrudeGeometry(f, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 5, curveSegments: 18 }); fg.translate(0, 0, oz); fg.rotateY(-Math.PI / 2); add(fg, paint); });
      add(new THREE.BoxGeometry(1.36, 0.26, 1.5), paint, 0, 0.45, 1.78);           // lower front pan
      add(new THREE.BoxGeometry(1.36, 0.3, 0.1), paint, 0, 0.72, 2.5);             // grille header / radiator support
      add(new THREE.BoxGeometry(1.5, 0.36, 0.06), paint, 0, 0.78, 1.04);           // firewall
      // greenhouse: lofted profile, narrower than the body (tumblehome); glass with painted pillars & roof over it
      const g2 = new THREE.Shape(); g2.moveTo(-1.32, 0); g2.lineTo(-0.88, 0.41); g2.quadraticCurveTo(-0.8, 0.44, -0.6, 0.445); g2.lineTo(0.28, 0.45); g2.quadraticCurveTo(0.38, 0.445, 0.44, 0.41); g2.lineTo(1.0, 0); g2.lineTo(-1.32, 0);
      const cabGeo = new THREE.ExtrudeGeometry(g2, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 10 });
      cabGeo.translate(0, 0.95, -0.75); cabGeo.rotateY(-Math.PI / 2);
      add(cabGeo, glass);
      const roofGeo = new THREE.ExtrudeGeometry((() => { const r = new THREE.Shape(); r.moveTo(-0.84, 0.41); r.quadraticCurveTo(-0.8, 0.455, -0.6, 0.46); r.lineTo(0.28, 0.465); r.quadraticCurveTo(0.4, 0.46, 0.44, 0.42); r.lineTo(0.43, 0.405); r.lineTo(-0.83, 0.395); return r; })(), { depth: 1.56, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 3 });
      roofGeo.translate(0, 0.95, -0.78); roofGeo.rotateY(-Math.PI / 2); add(roofGeo, new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.6 })); // cream vinyl roof
      const pillar = (z0, y0, z1, y1, t) => [-1, 1].forEach((sd) => { const len = Math.hypot(z1 - z0, y1 - y0); const p = add(new THREE.BoxGeometry(0.05, len, t), paint, sd * 0.79, (y0 + y1) / 2, (z0 + z1) / 2); p.rotation.x = Math.atan2(z1 - z0, y1 - y0); });
      pillar(0.99, 0.96, 0.43, 1.38, 0.07); pillar(-0.25, 0.96, -0.25, 1.4, 0.09); pillar(-1.3, 0.96, -0.86, 1.37, 0.12); // A, B, C pillars
      [-1, 1].forEach((sd) => { add(new THREE.BoxGeometry(0.012, 0.012, 2.25), chrome, sd * 0.8, 0.97, -0.16); }); // belt-line chrome
      // body side details: chrome spear, door seams, handles, mirror, gas door, emblem
      [-1, 1].forEach((sd) => {
        const x = sd * (W / 2 + 0.005);
        add(new THREE.BoxGeometry(0.012, 0.025, 3.9), chrome, x, 0.7, 0.05);
        [1.0, -0.25, -1.32].forEach((z) => add(new THREE.BoxGeometry(0.006, 0.6, 0.006), blackTrim, x, 0.66, z));
        [0.5, -0.75].forEach((z) => { add(new THREE.BoxGeometry(0.03, 0.03, 0.16), chrome, x + sd * 0.012, 0.86, z); add(new THREE.BoxGeometry(0.02, 0.02, 0.04), chrome, x + sd * 0.012, 0.86, z - 0.07); });
        add(new THREE.CylinderGeometry(0.015, 0.02, 0.1, 8), chrome, sd * 0.93, 1.01, 0.95);
        const mir = add(new THREE.SphereGeometry(0.075, 14, 10), chrome, sd * 1.0, 1.06, 0.95); mir.scale.set(0.5, 0.6, 0.9);
        add(new THREE.BoxGeometry(0.01, 0.42, 0.006), blackTrim, x, 0.66, 1.62); // fender seam
      });
      const gasDoor = add(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 18), paint, -(W / 2 + 0.006), 0.78, -1.95); gasDoor.rotation.z = Math.PI / 2; this.gasDoor = gasDoor;
      // hood (hinged at the windshield) with a centre crease and ornament
      const hood = (this.hood = new THREE.Group()); hood.position.set(0, 0.955, 1.0); car.add(hood);
      const hs = new THREE.Shape(); hs.moveTo(0, 0); hs.lineTo(1.38, -0.075); hs.quadraticCurveTo(1.45, -0.08, 1.48, -0.11); hs.lineTo(1.48, -0.13); hs.lineTo(0, -0.03);
      const hoodGeo = new THREE.ExtrudeGeometry(hs, { depth: W - 0.24, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }); hoodGeo.translate(0, 0, -(W - 0.24) / 2); hoodGeo.rotateY(-Math.PI / 2);
      add(hoodGeo, paint, 0, 0.012, 0, hood); add(new THREE.BoxGeometry(0.012, 0.012, 1.36), chrome, 0, 0.005, 0.7, hood).rotation.x = 0.055;
      const orn = add(new THREE.ConeGeometry(0.025, 0.09, 4), chrome, 0, -0.035, 1.42, hood); orn.rotation.x = Math.PI / 2;
      // engine bay (seen when the hood is up)
      const bay = new THREE.Group(); car.add(bay);
      add(new THREE.BoxGeometry(1.5, 0.05, 1.35), new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.9 }), 0, 0.58, 1.75, bay);
      const eng = new THREE.MeshStandardMaterial({ color: 0x2a4a6a, metalness: 0.5, roughness: 0.55 });
      add(new THREE.BoxGeometry(0.62, 0.26, 0.75), eng, 0, 0.66, 1.65, bay); [-1, 1].forEach((sd) => add(new THREE.BoxGeometry(0.16, 0.08, 0.72), eng, sd * 0.33, 0.8, 1.65, bay));
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 24), chrome, 0, 0.85, 1.65, bay); add(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), chrome, 0, 0.9, 1.65, bay);
      add(new THREE.BoxGeometry(0.22, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }), 0.55, 0.72, 2.15, bay); [0.5, 0.6].forEach((x) => add(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8), x < 0.55 ? new THREE.MeshStandardMaterial({ color: 0xb02020 }) : blackTrim, x, 0.835, 2.1, bay));
      add(new THREE.BoxGeometry(0.75, 0.24, 0.06), new THREE.MeshStandardMaterial({ color: 0x3a3a38, metalness: 0.4, roughness: 0.6 }), 0, 0.68, 2.35, bay); // radiator
      this.plugs = []; for (let i = 0; i < 4; i++) [-1, 1].forEach((sd) => { const wire = add(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xa01818, roughness: 0.6 }), sd * 0.42, 0.8, 1.35 + i * 0.18, bay); wire.rotation.z = sd * 0.7; this.plugs.push(wire); });
      this.emptySocket = add(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10), new THREE.MeshBasicMaterial({ color: 0x050505 }), 0.42, 0.77, 1.89, bay); // the one that's missing
      // grille, headlights, bumpers, plates, taillights
      const grilleM = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.4 });
      add(new THREE.BoxGeometry(1.25, 0.26, 0.04), grilleM, 0, 0.68, 2.6);
      for (let i = 0; i < 15; i++) add(new THREE.BoxGeometry(0.012, 0.26, 0.05), chrome, -0.6 + i * 0.086, 0.68, 2.62);
      add(new THREE.BoxGeometry(1.29, 0.025, 0.05), chrome, 0, 0.82, 2.62); add(new THREE.BoxGeometry(1.29, 0.025, 0.05), chrome, 0, 0.545, 2.62);
      const lens = new THREE.MeshPhysicalMaterial({ color: 0xf0f0e0, roughness: 0.05, transmission: 0, clearcoat: 1, emissive: 0xffe8b0, emissiveIntensity: 0 });
      this.headLens = lens;
      [-1, 1].forEach((sd) => [0.72, 0.88].forEach((x) => {
        const bez = add(new THREE.TorusGeometry(0.085, 0.02, 10, 24), chrome, sd * x * 0.92, 0.68, 2.6); bez.position.z = 2.61;
        const l = add(new THREE.SphereGeometry(0.08, 18, 10, 0, Math.PI * 2, 0, Math.PI / 3.5), lens, sd * x * 0.92, 0.68, 2.56); l.rotation.x = Math.PI / 2;
      }));
      const bumper = (z, dir) => { const b = new THREE.Shape(); b.moveTo(-0.11, -0.09); b.lineTo(0.09, -0.07); b.quadraticCurveTo(0.13, 0, 0.09, 0.07); b.lineTo(-0.11, 0.09);
        const g = new THREE.ExtrudeGeometry(b, { depth: W + 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4 }); g.translate(0, 0, -(W + 0.08) / 2); g.rotateY(-Math.PI / 2);
        const m = add(g, chrome, 0, 0.42, z); m.scale.z = dir;
        [-1, 1].forEach((sd) => add(new THREE.BoxGeometry(0.12, 0.14, 0.12), rubber, sd * 0.62, 0.4, z + dir * 0.1)); }; // bumper guards
      bumper(2.62, 1); bumper(-2.64, -1);
      const plate = (z, ry) => { const [c, k] = cv(256, 128); k.fillStyle = '#e8dcb0'; k.fillRect(0, 0, 256, 128); k.strokeStyle = '#1a3a6a'; k.lineWidth = 6; k.strokeRect(5, 5, 246, 118); k.fillStyle = '#1a3a6a'; k.font = '800 22px "Barlow Condensed", sans-serif'; k.textAlign = 'center'; k.fillText('ARIZONA', 128, 30); k.font = '900 54px "Barlow Condensed", sans-serif'; k.fillText('TWR · 77', 128, 92); k.fillStyle = 'rgba(120,80,30,.4)'; k.fillRect(0, 90, 256, 38);
        const p = add(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({ map: tx(c), roughness: 0.5, metalness: 0.3 }), 0, 0.5, z); p.rotation.y = ry; };
      plate(2.76, 0); plate(-2.77, Math.PI);
      const tail = new THREE.MeshStandardMaterial({ color: 0x7a0a08, roughness: 0.2, emissive: 0x500000, emissiveIntensity: 0.4 }); this.tailMat = tail;
      [-1, 1].forEach((sd) => { add(new THREE.BoxGeometry(0.42, 0.13, 0.04), tail, sd * 0.68, 0.72, -2.6); add(new THREE.BoxGeometry(0.46, 0.17, 0.03), chrome, sd * 0.68, 0.72, -2.59); });
      const trunkLock = add(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), chrome, 0, 0.84, -2.6); trunkLock.rotation.x = Math.PI / 2;
      // wheels: tread pattern, sidewall lettering, steel wheel + chrome hubcap; one tyre soft
      const [tc, tk] = cv(512, 64); tk.fillStyle = '#1a1a1a'; tk.fillRect(0, 0, 512, 64); for (let x = 0; x < 512; x += 16) { tk.fillStyle = '#0a0a0a'; tk.fillRect(x, 6, 6, 52); tk.fillRect(x + 8, 0, 3, 64); }
      const treadT = tx(tc); treadT.repeat.set(4, 1);
      const tire = new THREE.MeshStandardMaterial({ map: treadT, color: 0x2a2a2a, roughness: 0.9 });
      const [sc, sk] = cv(512); sk.fillStyle = '#1a1a1a'; sk.fillRect(0, 0, 512, 512); sk.fillStyle = 'rgba(200,200,200,.5)'; sk.font = '700 30px "Barlow Condensed", sans-serif'; sk.textAlign = 'center';
      for (let i = 0; i < 2; i++) { sk.save(); sk.translate(256, 256); sk.rotate(i * Math.PI); sk.fillText('ROADMASTER  G78-15', 0, -200); sk.restore(); }
      const sideT = new THREE.MeshStandardMaterial({ map: tx(sc), roughness: 0.85 });
      const steelWheel = new THREE.MeshStandardMaterial({ color: 0x5a5c5e, metalness: 0.7, roughness: 0.5 });
      this.wheels = [];
      [[0.79, fw], [-0.79, fw], [0.79, rw], [-0.79, rw]].forEach(([x, z], i) => {
        const wg = new THREE.Group(); wg.position.set(x, 0.36, z); car.add(wg); const side = Math.sign(x);
        const t = add(new THREE.TorusGeometry(0.27, 0.095, 16, 40), tire, 0, 0, 0, wg); t.rotation.y = Math.PI / 2; t.scale.set(1, 1, 1.05);
        add(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 40, 1, true), tire, 0, 0, 0, wg).rotation.z = Math.PI / 2;
        [-1, 1].forEach((f) => { const sw = add(new THREE.RingGeometry(0.2, 0.355, 40), sideT, f * 0.1, 0, 0, wg); sw.rotation.y = f * Math.PI / 2; });
        const rim = add(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 32), steelWheel, 0, 0, 0, wg); rim.rotation.z = Math.PI / 2;
        const cap = add(new THREE.LatheGeometry(V2([[0, 0.06], [0.06, 0.055], [0.12, 0.04], [0.18, 0.015], [0.19, 0]]), 32), chrome, side * 0.1, 0, 0, wg); cap.rotation.z = -side * Math.PI / 2;
        for (let k = 0; k < 8; k++) { const sl = add(new THREE.BoxGeometry(0.004, 0.05, 0.016), blackTrim, side * 0.13, Math.cos(k * 0.785) * 0.14, Math.sin(k * 0.785) * 0.14, wg); sl.rotation.x = -k * 0.785; }
        if (i === 3) { wg.position.y = 0.32; wg.scale.y = 0.93; } // that one's going flat
        this.wheels.push(wg);
      });
      // underbody / exhaust
      add(new THREE.BoxGeometry(W - 0.2, 0.12, L - 0.6), new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 1 }), 0, 0.26, 0);
      const ex = add(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 10), pitted, -0.55, 0.22, -2.55); ex.rotation.x = Math.PI / 2;
      // interior: bench seats with pleats, dash with gauges, steering wheel, column shifter, rear-view mirror, junk on the seat
      const pleat = (() => { const [c, k] = cv(128); k.fillStyle = '#6a442c'; k.fillRect(0, 0, 128, 128); for (let x = 0; x < 128; x += 16) { k.fillStyle = 'rgba(0,0,0,.35)'; k.fillRect(x, 0, 3, 128); k.fillStyle = 'rgba(255,255,255,.08)'; k.fillRect(x + 4, 0, 2, 128); } return new THREE.MeshStandardMaterial({ map: tx(c, [3, 1]), roughness: 0.5 }); })();
      [[0.25, 1], [-0.95, 1]].forEach(([z]) => { add(new THREE.BoxGeometry(1.5, 0.16, 0.55), pleat, 0, 0.62, z); const back = add(new THREE.BoxGeometry(1.5, 0.55, 0.14), pleat, 0, 0.93, z - 0.3); back.rotation.x = -0.18; });
      const dashG = new THREE.Group(); dashG.position.set(0, 0.95, 0.82); car.add(dashG);
      add(new THREE.BoxGeometry(1.56, 0.2, 0.35), dash, 0, -0.04, 0, dashG);
      const [gc2, gk2] = cv(256, 96); gk2.fillStyle = '#0c0c0c'; gk2.fillRect(0, 0, 256, 96); [48, 128, 208].forEach((x, i) => { gk2.strokeStyle = '#b8b0a0'; gk2.lineWidth = 3; gk2.beginPath(); gk2.arc(x, 50, 34, 0, 6.28); gk2.stroke(); for (let k = 0; k < 9; k++) { const a = Math.PI * 0.8 + k * 0.17; gk2.beginPath(); gk2.moveTo(x + Math.cos(a) * 26, 50 + Math.sin(a) * 26); gk2.lineTo(x + Math.cos(a) * 32, 50 + Math.sin(a) * 32); gk2.stroke(); } gk2.strokeStyle = '#d84020'; gk2.beginPath(); gk2.moveTo(x, 50); gk2.lineTo(x + Math.cos(2.6 + i * 0.3) * 26, 50 + Math.sin(2.6 + i * 0.3) * 26); gk2.stroke(); });
      gk2.fillStyle = '#d84020'; gk2.font = '700 12px sans-serif'; gk2.fillText('E', 30, 82); // the fuel gauge reads empty
      const gauges = add(new THREE.PlaneGeometry(0.45, 0.17), new THREE.MeshStandardMaterial({ map: tx(gc2), roughness: 0.3, emissive: 0x302010, emissiveMap: tx(gc2), emissiveIntensity: 0 }), -0.38, 0.03, -0.18, dashG); gauges.rotation.y = Math.PI; gauges.rotation.x = 0.25; this.gaugeMat = gauges.material;
      const sw = new THREE.Group(); sw.position.set(-0.38, 0.03, -0.32); sw.rotation.x = -0.45; dashG.add(sw);
      add(new THREE.TorusGeometry(0.19, 0.016, 10, 36), new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.4 }), 0, 0, 0, sw);
      [0, 2.1, 4.2].forEach((a) => { const sp = add(new THREE.BoxGeometry(0.17, 0.02, 0.012), chrome, Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0, sw); sp.rotation.z = a; });
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), chrome, 0, 0, 0.01, sw).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.03, 0.035, 0.32, 10), dash, 0, -0.06, 0.16, sw).rotation.x = Math.PI / 2;
      this.steering = sw;
      add(new THREE.BoxGeometry(0.22, 0.06, 0.012), chrome, 0, 1.33, 0.4).rotation.x = 0.2; // rear-view mirror
      add(new THREE.BoxGeometry(0.4, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.9 }), 0.35, 0.72, 0.25).rotation.y = 0.4; // newspaper on the seat
      // shadow catcher & headlight beams (off until it starts)
      this.beams = [];
      [-0.7, 0.7].forEach((x) => { const b = new THREE.Mesh(new THREE.ConeGeometry(1.4, 8, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); b.material.userData.noPBR = true; b.rotation.x = -Math.PI / 2; b.position.set(x, 0.68, 6.6); car.add(b); this.beams.push(b); });
      this.headLight = new THREE.SpotLight(0xfff0d0, 0, 30, 0.5, 0.5, 1.2); this.headLight.position.set(0, 0.7, 2.6); this.headLight.target.position.set(0, 0, 12); car.add(this.headLight, this.headLight.target);
      car.traverse((o) => { if (o.material) o.material.userData.noPBR = true; });
      return car;
    },

    /* =============== interactions =============== */
    reset() {
      this.plug = false; this.fuel = false; this.hoodOpen = false; this.hoodT = 0; this.driving = false; this.doorT = 0; this.speed = 0;
      this.car.position.set(CAR.x, 0, CAR.z); this.door.position.y = 0; this.door.rotation.x = 0; this.doorCol.off = false; this.carCol.off = false;
      this.blob.position.set(CAR.x, 0.006, CAR.z); this.emptySocket.visible = true; this.headLens.emissiveIntensity = 0; this.beams.forEach((b) => (b.material.opacity = 0)); this.headLight.intensity = 0; this.gaugeMat.emissiveIntensity = 0;
    },
    register() {
      const IS = TH.Interact, inv = TH.Inventory;
      this.reset();
      IS.add({ x: CAR.x, z: CAR.z + 3.05, level: 0, y: 0.9, r: 1.6,
        prompt: () => (!this.hoodOpen ? 'OPEN THE HOOD' : !this.plug ? (inv.has('spark_plug') ? 'INSTALL SPARK PLUG' : 'ENGINE · ONE SPARK PLUG MISSING') : 'CLOSE THE HOOD'),
        short: () => (!this.hoodOpen ? 'OPEN' : !this.plug ? 'INSTALL' : 'CLOSE'),
        check: () => (this.hoodOpen && !this.plug && !inv.has('spark_plug') ? 'SPARK PLUG NEEDED' : null),
        use: () => {
          if (!this.hoodOpen) { this.hoodOpen = true; TH.Audio.play('door', { x: CAR.x, y: 1, z: CAR.z + 2 }, 14); TH.Noise.emit(CAR.x, CAR.z + 2, 0, 5, 'a car hood creaking'); TH.UI.toast(this.plug ? 'The engine looks ready.' : 'One of the spark plugs is missing.'); return; }
          if (!this.plug) { inv.remove('spark_plug'); this.plug = true; this.emptySocket.visible = false; TH.Audio.play('unlock'); TH.UI.toast('Spark plug installed'); TH.Bus.emit('carPart', 'plug'); return; }
          this.hoodOpen = false; TH.Audio.play('doorShut', { x: CAR.x, y: 1, z: CAR.z + 2 }, 20); TH.Noise.emit(CAR.x, CAR.z + 2, 0, 9, 'a car hood slamming');
        } });
      IS.add({ x: CAR.x - 1.5, z: CAR.z - 1.95, level: 0, y: 0.8, r: 1.5, hold: 3,
        prompt: () => (this.fuel ? null : inv.has('gas_can') ? 'POUR GAS INTO THE TANK' : 'GAS TANK · EMPTY'), short: 'FILL',
        check: () => (inv.has('gas_can') ? null : 'GAS CAN NEEDED'),
        onTick: (p) => { if (Math.random() < 0.1) TH.Audio.play('drip', { x: CAR.x - 1, y: 0.8, z: CAR.z - 2 }, 10); if (Math.random() < 0.02) TH.Noise.emit(CAR.x, CAR.z, 0, 4, 'sloshing'); },
        use: () => { inv.remove('gas_can'); this.fuel = true; TH.UI.toast('Tank filled'); TH.Bus.emit('carPart', 'fuel'); } });
      IS.add({ x: CAR.x - 1.45, z: CAR.z + 0.35, level: 0, y: 1.0, r: 1.6,
        prompt: () => (this.driving ? null : 'GET IN AND START THE CAR'), short: 'START',
        check: () => { const miss = []; if (!inv.has('car_keys')) miss.push('keys'); if (!this.plug) miss.push('spark plug'); if (!this.fuel) miss.push('gas'); return miss.length ? 'NEEDS: ' + miss.join(', ').toUpperCase() : null; },
        use: () => this.start() });
    },
    // cinematic: crank, catch, garage door rolls up, headlights on, floor it
    start() {
      this.driving = true; this.t = 0; TH.state.cinematic = true; TH.Input.unlock(); TH.Inventory.remove('car_keys');
      this.hoodOpen = false; TH.Audio.play('doorShut', { x: CAR.x, y: 1, z: CAR.z }, 20);
      TH.Noise.emit(CAR.x, CAR.z, 0, 60, 'an engine turning over');
      TH.UI.toast('Come on... come on...');
    },
    update(dt, t) {
      // hood swing
      this.hoodT += ((this.hoodOpen ? 1 : 0) - this.hoodT) * Math.min(1, dt * 4); this.hood.rotation.x = -this.hoodT * 1.05;
      if (!this.driving) return;
      this.t += dt; const T = this.t, cam = TH.camera, car = this.car;
      // driver's seat camera
      const seat = new THREE.Vector3(-0.38, 1.18, 0.15).applyMatrix4(car.matrixWorld);
      cam.position.copy(seat); cam.rotation.set(-0.05 + (T < 2.6 ? Math.sin(T * 30) * 0.004 : 0), Math.PI, 0); // facing +z
      if (T < 2.4) { if ((this._k = (this._k || 0) + dt) > 0.22) { this._k = 0; TH.Audio.play('crank'); } }
      else if (!this.caught) { this.caught = true; TH.Audio.play('engine'); this.headLens.emissiveIntensity = 2.5; this.headLight.intensity = 3; this.beams.forEach((b) => (b.material.opacity = 0.07)); this.gaugeMat.emissiveIntensity = 1.2; TH.UI.toast('It caught!'); }
      if (T > 2.6) { this.doorT = Math.min(1, this.doorT + dt / 2.2); const d = this.doorT; this.door.position.y = d * 2.35; this.door.position.z = -3 - d * d * 0.6; this.door.rotation.x = -d * d * 1.2; this.doorCol.off = d > 0.6; }
      if (T > 4.4) { this.speed = Math.min(14, this.speed + dt * 6); car.position.z += this.speed * dt; this.blob.position.z = car.position.z; this.wheels.forEach((w) => (w.rotation.x += this.speed * dt / 0.36)); TH.Audio.rev && TH.Audio.rev(this.speed); }
      if (T > 8.2 && !this.done) { this.done = true; TH.Game.escape('car'); }
    },
  });
})();
