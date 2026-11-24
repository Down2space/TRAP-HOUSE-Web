/* TRAP HOUSE — the world outside the windows: night sky + moon, overgrown dead yard, picket fence, driveway,
   sidewalk, street with lamps, dead trees, neighbours' houses. Outdoor materials carry a faint moonlit emissive
   so they read as silhouettes against the sky without leaking light into the house. */
(function () {
  'use strict';
  const TH = window.TH, R = (a, b) => a + Math.random() * (b - a);
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return [c, c.getContext('2d')]; };
  const tex = (c, rep, seam) => { if (seam) TH.seamless(c); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; return t; };
  // moonlit material: the map also drives a dim blue emissive
  const moon = (map, color, extra) => new THREE.MeshStandardMaterial(Object.assign({ map, color: color || 0xffffff, roughness: 0.9, emissive: 0x2a3550, emissiveMap: map || null, emissiveIntensity: 0.55 }, extra || {}));

  TH.Outside = {
    build(scene) {
      const g = new THREE.Group(); scene.add(g);
      const add = (geo, m, x, y, z, p) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); (p || g).add(o); return o; };

      /* the night sky: a smooth gradient dome, real point stars (crisp at any distance, no stretched pixels), a faint milky
         band, a few soft wisps of cloud, and a big full moon with a halo. It all rides along with the camera. */
      const skyG = new THREE.Group(); skyG.userData.dynamic = true; g.add(skyG); this.sky = skyG;
      { const [c, k] = cv(8, 512);
        const gr = k.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#04060d'); gr.addColorStop(0.3, '#0a1122'); gr.addColorStop(0.46, '#18233d'); gr.addColorStop(0.5, '#25324e'); gr.addColorStop(0.53, '#141a28'); gr.addColorStop(1, '#07080c');
        k.fillStyle = gr; k.fillRect(0, 0, 8, 512);
        const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
        const dome = new THREE.Mesh(new THREE.SphereGeometry(140, 48, 24), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
        dome.material.userData.noPBR = true; dome.renderOrder = -10; skyG.add(dome); }
      { const N = 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
          const band = i < 900; // some of them crowd into a milky band across the sky
          let az = Math.random() * Math.PI * 2, el = Math.asin(Math.random() * 0.96 + 0.03);
          if (band) { az = Math.random() * Math.PI * 2; el = Math.max(0.05, Math.min(1.5, 0.9 + Math.sin(az * 1 + 0.6) * 0.75 + (Math.random() - 0.5) * 0.22)); }
          const r = 130; pos[i * 3] = Math.cos(el) * Math.cos(az) * r; pos[i * 3 + 1] = Math.sin(el) * r; pos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r;
          const b = (band ? 0.35 : 0.45) + Math.random() * (Math.random() < 0.06 ? 1.0 : 0.45), tint = Math.random();
          col[i * 3] = b * (tint < 0.15 ? 1 : 0.92); col[i * 3 + 1] = b * 0.95; col[i * 3 + 2] = b * (tint > 0.8 ? 1.15 : 1);
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const [sc, sk] = cv(32); const sg = sk.createRadialGradient(16, 16, 0, 16, 16, 16); sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(0.35, 'rgba(255,255,255,.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); sk.fillStyle = sg; sk.fillRect(0, 0, 32, 32);
        const stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: false, map: new THREE.CanvasTexture(sc), vertexColors: true, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        stars.material.userData.noPBR = true; stars.renderOrder = -9; skyG.add(stars); this.stars = stars; }
      { // soft wisps of cloud painted onto a band all the way round the sky: drawn wrap-around so nothing ever ends in a hard edge
        const W = 1024, Hh = 256, [c, k] = cv(W, Hh);
        for (let i = 0; i < 26; i++) { const x = Math.random() * W, y = 70 + Math.random() * 110, w = 40 + Math.random() * 110, a = 0.04 + Math.random() * 0.08;
          for (const ox of [-W, 0, W]) { k.save(); k.translate(x + ox, y); k.scale(1, 0.24); const cg = k.createRadialGradient(0, 0, 0, 0, 0, w); cg.addColorStop(0, `rgba(120,135,170,${a})`); cg.addColorStop(1, 'rgba(120,135,170,0)'); k.fillStyle = cg; k.beginPath(); k.arc(0, 0, w, 0, 6.29); k.fill(); k.restore(); } }
        const fade = k.getImageData(0, 0, W, Hh); for (let y = 0; y < Hh; y++) { const v = y / (Hh - 1), f = Math.min(1, v / 0.25, (1 - v) / 0.25); for (let x = 0; x < W; x++) fade.data[(y * W + x) * 4 + 3] *= Math.max(0, f); } k.putImageData(fade, 0, 0); // fades out top and bottom
        const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping;
        const cm = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide }); cm.userData.noPBR = true;
        const band = new THREE.Mesh(new THREE.SphereGeometry(134, 64, 8, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.27), cm); band.renderOrder = -8; skyG.add(band); this.clouds = band; }
      { // a full moon: limb-darkened disc with grey maria and a few bright craters, plus a wide soft halo
        const [mc, mk] = cv(512); mk.save(); mk.beginPath(); mk.arc(256, 256, 120, 0, 6.29); mk.clip();
        const dg = mk.createRadialGradient(240, 240, 10, 256, 256, 122); dg.addColorStop(0, '#ffffff'); dg.addColorStop(0.75, '#f3f5fb'); dg.addColorStop(1, '#c8cedc'); mk.fillStyle = dg; mk.fillRect(0, 0, 512, 512);
        [[205, 205, 42], [260, 190, 30], [300, 240, 36], [230, 275, 26], [190, 250, 20], [285, 300, 22], [320, 205, 16]].forEach(([x, y, r]) => { const mg = mk.createRadialGradient(x, y, 0, x, y, r); mg.addColorStop(0, 'rgba(140,148,170,.75)'); mg.addColorStop(1, 'rgba(150,158,178,0)'); mk.fillStyle = mg; mk.fillRect(x - r, y - r, r * 2, r * 2); });
        for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, d = Math.random() * 110, x = 256 + Math.cos(a) * d, y = 256 + Math.sin(a) * d, r = 1 + Math.random() * 4; mk.fillStyle = 'rgba(255,255,255,.35)'; mk.beginPath(); mk.arc(x, y, r, 0, 6.29); mk.fill(); mk.fillStyle = 'rgba(120,128,150,.3)'; mk.beginPath(); mk.arc(x + r * 0.4, y + r * 0.4, r, 0, 6.29); mk.fill(); }
        mk.restore();
        const [hc, hk] = cv(256); const hg = hk.createRadialGradient(128, 128, 30, 128, 128, 128); hg.addColorStop(0, 'rgba(200,215,245,.55)'); hg.addColorStop(0.3, 'rgba(150,170,215,.18)'); hg.addColorStop(1, 'rgba(120,140,190,0)'); hk.fillStyle = hg; hk.fillRect(0, 0, 256, 256);
        const dir = new THREE.Vector3(-40, 105, 70).normalize().multiplyScalar(118);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(hc), fog: false, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, opacity: 0.85 })); halo.scale.set(70, 70, 1); halo.position.copy(dir); halo.material.userData.noPBR = true; halo.renderOrder = -7; skyG.add(halo);
        const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(mc), fog: false, depthWrite: false, toneMapped: false, color: new THREE.Color(1, 1, 1) })); m.scale.set(48, 48, 1); m.position.copy(dir); m.material.userData.noPBR = true; m.renderOrder = -6; skyG.add(m); this.moon = m; }

      /* ground: dead lawn with bare patches, gravel driveway, cracked sidewalk, asphalt street */
      { const [c, k] = cv(512); k.fillStyle = '#4a4630'; k.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 9000; i++) { k.fillStyle = `rgba(${R(80, 150)},${R(78, 130)},${R(40, 70)},${R(0.2, 0.6)})`; k.fillRect(Math.random() * 512, Math.random() * 512, 1, R(2, 6)); }
        for (let i = 0; i < 14; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = R(20, 70); const dg = k.createRadialGradient(x, y, 0, x, y, r); dg.addColorStop(0, 'rgba(70,58,40,.8)'); dg.addColorStop(1, 'rgba(70,58,40,0)'); k.fillStyle = dg; k.fillRect(x - r, y - r, r * 2, r * 2); }
        const sh = new THREE.Shape(); sh.moveTo(-110, -110); sh.lineTo(110, -110); sh.lineTo(110, 110); sh.lineTo(-110, 110); sh.lineTo(-110, -110);
        (TH.House.groundHoles || []).forEach((h) => { const p = new THREE.Path(); p.moveTo(h.x0, -h.z0); p.lineTo(h.x0, -h.z1); p.lineTo(h.x1, -h.z1); p.lineTo(h.x1, -h.z0); p.lineTo(h.x0, -h.z0); sh.holes.push(p); }); // stairwells going down
        const lawn = add(new THREE.ShapeGeometry(sh), TH.Tex.photo.grass ? moon(TH.Tex.pclone('grass', 1 / 2.6), 0xa8a490) : moon(tex(c, [50 / 220, 50 / 220], true), 0x8a8a7a)); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.03; }
      { const [c, k] = cv(256); k.fillStyle = '#5c5850'; k.fillRect(0, 0, 256, 256); for (let i = 0; i < 4000; i++) { const v = R(60, 150); k.fillStyle = `rgb(${v},${v - 4},${v - 10})`; k.beginPath(); k.arc(Math.random() * 256, Math.random() * 256, R(0.8, 2.2), 0, 6.28); k.fill(); }
        const drive = add(new THREE.PlaneGeometry(3.6, 29.5), TH.Tex.photo.gravel ? moon(TH.Tex.pclone('gravel', 3.6 / 1.6, 29.5 / 1.6), 0xb0aaa0) : moon(tex(c, [2, 16], true), 0x9a968c)); drive.rotation.x = -Math.PI / 2; drive.position.set(19.6, 0.004, 11.6); // gravel driveway from the garage
        [-1, 1].forEach((sd) => { const oil = add(new THREE.CircleGeometry(0.5, 16), new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.15, transparent: true, opacity: 0.6 }), 19.6 + sd * 0.5, 0.008, 3 + sd); oil.rotation.x = -Math.PI / 2; oil.scale.set(1, 1.6, 1); }); }
      { const [c, k] = cv(256); k.fillStyle = '#6e6c66'; k.fillRect(0, 0, 256, 256); for (let i = 0; i < 2500; i++) { const v = R(90, 130); k.fillStyle = `rgba(${v},${v},${v - 6},.5)`; k.fillRect(Math.random() * 256, Math.random() * 256, 1, 1); }
        k.strokeStyle = '#3a3834'; k.lineWidth = 3; for (let x = 0; x <= 256; x += 128) { k.beginPath(); k.moveTo(x, 0); k.lineTo(x, 256); k.stroke(); } k.lineWidth = 1; for (let i = 0; i < 6; i++) { k.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; k.moveTo(x, y); for (let j = 0; j < 8; j++) { x += R(-14, 14); y += R(-14, 14); k.lineTo(x, y); } k.stroke(); }
        const walk = add(new THREE.PlaneGeometry(1.4, 12.6), moon(tex(c, [1, 9], true), 0xaaa8a0)); walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.006, 19.9);
        const side = add(new THREE.PlaneGeometry(220, 2), moon(tex(c, [150, 1.4], true), 0xaaa8a0)); side.rotation.x = -Math.PI / 2; side.position.set(0, 0.012, 27.5); }
      { const [c, k] = cv(512, 256); k.fillStyle = '#26262a'; k.fillRect(0, 0, 512, 256); for (let i = 0; i < 9000; i++) { const v = R(25, 70); k.fillStyle = `rgba(${v},${v},${v + 4},.6)`; k.fillRect(Math.random() * 512, Math.random() * 256, 1, 1); }
        k.fillStyle = '#b8962e'; for (let x = 0; x < 512; x += 64) { k.fillRect(x, 122, 36, 4); k.fillRect(x, 130, 36, 4); }
        k.strokeStyle = 'rgba(10,10,10,.8)'; for (let i = 0; i < 8; i++) { k.beginPath(); let x = Math.random() * 512, y = Math.random() * 256; k.moveTo(x, y); for (let j = 0; j < 10; j++) { x += R(-20, 20); y += R(-10, 10); k.lineTo(x, y); } k.stroke(); }
        const road = add(new THREE.PlaneGeometry(220, 8), moon(tex(c, [28, 1], true), 0x8a8a90, { roughness: 0.7 })); road.rotation.x = -Math.PI / 2; road.position.set(0, -0.01, 32.6);
        const curb = add(new THREE.BoxGeometry(220, 0.15, 0.25), moon(null, 0x7a7870), 0, 0.06, 28.6); }

      /* picket fence along the front with gaps for the path and driveway; a sagging gate */
      { const wood = moon(TH.Tex.wood, 0x8a8478); const pick = [], rails = [];
        const run = (x0, x1, z) => { for (let x = x0; x <= x1; x += 0.16) { const b = new THREE.BoxGeometry(0.09, 1.0 + R(-0.06, 0.04), 0.025); b.rotateZ(R(-0.06, 0.06)); b.translate(x, 0.5, z); pick.push(b); }
          [0.25, 0.8].forEach((y) => { const rb = new THREE.BoxGeometry(x1 - x0, 0.08, 0.04); rb.translate((x0 + x1) / 2, y, z - 0.03); rails.push(rb); }); };
        run(-34, -0.9, 26); run(0.9, 17.4, 26); run(21.8, 34, 26);
        g.add(new THREE.Mesh(merge(pick), wood)); g.add(new THREE.Mesh(merge(rails), wood));
        const gate = new THREE.Group(); gate.position.set(-0.85, 0, 26); gate.rotation.y = 0.9; g.add(gate); for (let x = 0.08; x < 1.7; x += 0.16) add(new THREE.BoxGeometry(0.09, 0.95, 0.025), wood, x, 0.48, 0, gate); add(new THREE.BoxGeometry(1.7, 0.08, 0.04), wood, 0.85, 0.3, -0.03, gate).rotation.z = -0.25;
        const side = []; for (const sx of [-34, 34]) for (let z = -30; z <= 26; z += 2.4) { const p = new THREE.BoxGeometry(0.12, 1.8, 0.12); p.translate(sx, 0.9, z); side.push(p); }
        for (let x = -34; x <= 34; x += 2.4) { const p = new THREE.BoxGeometry(0.12, 1.8, 0.12); p.translate(x, 0.9, -32); side.push(p); }
        g.add(new THREE.Mesh(merge(side), wood)); }

      /* overgrown hedges hugging the house, dead trees, junk in the yard */
      { const bushM = moon(null, 0x2e3a22, { roughness: 1 }); const bush = [];
        const lump = (x, z, s) => { const b = new THREE.IcosahedronGeometry(s, 1); const p = b.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + R(-0.18, 0.18); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); } b.translate(x, s * 0.6, z); bush.push(b); };
        for (let x = -15.5; x < 16; x += 1.1) if (Math.abs(x) > 1.4) lump(x, 12.8 + R(0, 0.4), R(0.5, 0.8));
        for (let z = -11.5; z < 12; z += 1.2) { lump(-16.8 - R(0, 0.3), z, R(0.5, 0.9)); if (z > -2) lump(16.8 + R(0, 0.1), z, R(0.4, 0.6)); }
        bush.forEach((b) => b.computeVertexNormals()); g.add(new THREE.Mesh(merge(bush), bushM)); }
      const bark = TH.Tex.photo.bark ? moon(TH.Tex.photo.bark, 0x8a8074, { roughness: 1 }) : moon(null, 0x3a3228, { roughness: 1 });
      const tree = (x, z, h, seed) => {
        const parts = []; let rs = seed;
        const rnd = () => { rs = (rs * 9301 + 49297) % 233280; return rs / 233280; };
        const branch = (p, dir, len, r, depth) => {
          const q = p.clone().addScaledVector(dir, len), geo = new THREE.CylinderGeometry(r * 0.7, r, len, 6);
          { const uv = geo.attributes.uv, ru = Math.max(1, Math.round((2 * Math.PI * r) / 1.3)), rv = Math.max(0.3, len / 1.6); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv); }
          const m = new THREE.Matrix4().lookAt(p, q, new THREE.Vector3(0, 1, 0)); geo.rotateX(-Math.PI / 2); geo.applyMatrix4(m); geo.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2); parts.push(geo);
          if (depth <= 0 || r < 0.02) return;
          const n = depth > 2 ? 2 : 3;
          for (let i = 0; i < n; i++) { const d = dir.clone().add(new THREE.Vector3(rnd() - 0.5, rnd() * 0.5, rnd() - 0.5).multiplyScalar(1.3)).normalize(); branch(q, d, len * (0.6 + rnd() * 0.2), r * 0.62, depth - 1); }
        };
        branch(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, 1, 0), h * 0.38, h * 0.045, 5);
        g.add(new THREE.Mesh(merge(parts), bark));
      };
      [[-24, 18, 9, 3], [25, 20, 8, 7], [-26, -6, 10, 11], [31, -20, 9, 13], [-8, 21, 6.5, 17], [12, -24, 9, 23], [-16, -18, 8, 29], [38, 12, 11, 31], [-40, 22, 12, 37]].forEach(([x, z, h, sd]) => tree(x, z, h, sd));
      { // mailbox, a tire swing, a rusted barrel, the realtor sign stays
        const metal = TH.Tex.rusty(moon(null, 0x5a5c58, { metalness: 0.6, roughness: 0.6 }), 0xa8a8a4);
        add(new THREE.BoxGeometry(0.08, 1.1, 0.08), bark, -2.2, 0.55, 27.1); const mb = add(new THREE.CylinderGeometry(0.15, 0.15, 0.48, 14, 1, false, 0, Math.PI), metal, -2.2, 1.12, 27.1); mb.rotation.z = Math.PI / 2; mb.rotation.y = Math.PI / 2; add(new THREE.BoxGeometry(0.3, 0.15, 0.48), metal, -2.2, 1.04, 27.1);
        add(new THREE.BoxGeometry(0.02, 0.18, 0.06), moon(null, 0x9a2a1a), -2.04, 1.2, 27.25);
        const tire = add(new THREE.TorusGeometry(0.35, 0.12, 10, 20), moon(null, 0x141414), -24, 2.2, 18.6); tire.rotation.y = 0.4; add(new THREE.CylinderGeometry(0.01, 0.01, 2.6, 4), moon(null, 0x6a5a40), -24, 3.8, 18.6);
        const barrel = add(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), TH.Tex.rusty(moon(null, 0x5a2a18, { metalness: 0.5 }), 0x9a6a58), 9, 0.45, 18); barrel.rotation.z = 1.4; }

      /* street lamps: a real light in the lamp head, glow sprite, light cone on the road */
      { const pole = moon(null, 0x3a3c3e, { metalness: 0.7, roughness: 0.5 });
        const softGlow = (r, g2, b) => { const [c2, k2] = cv(128), img = k2.createImageData(128, 128); for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const d = Math.hypot(x - 63.5, y - 63.5) / 63.5, a = d >= 1 ? 0 : Math.pow(1 - d, 2.6) * (0.55 + 0.45 * Math.exp(-d * d * 30)), i = (y * 128 + x) * 4; img.data[i] = r; img.data[i + 1] = g2; img.data[i + 2] = b; img.data[i + 3] = a * 255; } k2.putImageData(img, 0, 0); return c2; };
        const gc = softGlow(255, 190, 120);
        const glowT = tex(gc);
        [[-9, 28.9, 0.95], [24, 28.9, 0.55], [-40, 28.9, 0.8], [52, 28.9, 0.7], [7, 36.3, 0.75]].forEach(([x, z, br], i) => {
          const sd = z > 32 ? -1 : 1; // the far side of the street faces back toward the house
          add(new THREE.CylinderGeometry(0.07, 0.1, 6.5, 10), pole, x, 3.25, z);
          const arm = add(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), pole, x, 6.4, z + sd * 0.75); arm.rotation.x = Math.PI / 2;
          add(new THREE.CylinderGeometry(0.12, 0.28, 0.25, 12), pole, x, 6.3, z + sd * 1.5);
          const bulb = add(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffdcaa, toneMapped: false }), x, 6.15, z + sd * 1.5); bulb.material.userData.noPBR = true;
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: br })); glow.scale.set(4.2, 4.2, 1); glow.position.set(x, 5.95, z + sd * 1.6); glow.material.userData.noPBR = true; g.add(glow);
          const pool = add(new THREE.CircleGeometry(5.5, 32), new THREE.MeshBasicMaterial({ map: glowT, transparent: true, opacity: br * 0.3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), x, 0.02, z + sd * 1.8); pool.rotation.x = -Math.PI / 2; pool.material.userData.noPBR = true;
          if (i < 2) { const L = new THREE.PointLight(0xffb070, i ? 1.7 : 2.4, 26, 1.4); L.position.set(x, 6, z + sd * 1.5); g.add(L); }
          if (i === 1) this.flicker = glow; // that one's dying
        }); }

      /* neighbours: dark houses at the edges of the fog, a couple of lit windows */
      { const sid = moon(TH.Tex.siding, 0x7a7870), roofM = moon(null, 0x1e1c1a);
        const litM = new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false }); litM.userData.noPBR = true;
        const darkW = new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 0.2, metalness: 0.3 });
        const house = (x, z, w, d, h, ry, lit) => {
          const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = ry; g.add(hg);
          add(TH.Tex.boxUV(new THREE.BoxGeometry(w, h, d), w, h, d, 3), sid, 0, h / 2, 0, hg);
          const rs = new THREE.Shape(); rs.moveTo(-w / 2 - 0.4, 0); rs.lineTo(w / 2 + 0.4, 0); rs.lineTo(0, h * 0.45); rs.lineTo(-w / 2 - 0.4, 0);
          const roof = add(new THREE.ExtrudeGeometry(rs, { depth: d + 0.8, bevelEnabled: false }), roofM, 0, h, -d / 2 - 0.4, hg);
          for (let i = 0; i < 4; i++) { const wx = -w / 2 + (i + 0.5) * (w / 4); add(new THREE.PlaneGeometry(1, 1.3), lit.includes(i) ? litM : darkW, wx, h * 0.55, d / 2 + 0.01, hg); }
          add(new THREE.PlaneGeometry(1.1, 2.1), darkW, 0, 1.05, d / 2 + 0.012, hg); return hg;
        };
        // each neighbour leaves a porch light on: a lamp by the door, its glow, and a warm pool on the step and lawn
        const pc2 = (() => { const [c2, k2] = cv(128), img = k2.createImageData(128, 128); for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const d = Math.hypot(x - 63.5, y - 63.5) / 63.5, a = d >= 1 ? 0 : Math.pow(1 - d, 2.6) * (0.55 + 0.45 * Math.exp(-d * d * 30)), i = (y * 128 + x) * 4; img.data[i] = 255; img.data[i + 1] = 196; img.data[i + 2] = 125; img.data[i + 3] = a * 255; } k2.putImageData(img, 0, 0); return c2; })();
        const porchT = tex(pc2), lampM = new THREE.MeshBasicMaterial({ color: 0xffd6a0, toneMapped: false }); lampM.userData.noPBR = true;
        const porch = (hg, d, on) => { if (!on) return;
          add(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 10), lampM, 0.85, 2.3, d / 2 + 0.12, hg); add(new THREE.ConeGeometry(0.13, 0.1, 10), darkW, 0.85, 2.46, d / 2 + 0.12, hg);
          const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: porchT, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.85 })); s2.scale.set(2.6, 2.6, 1); s2.position.set(0.85, 2.3, d / 2 + 1.35); s2.material.depthTest = true; s2.material.userData.noPBR = true; hg.add(s2);
          const pl = add(new THREE.CircleGeometry(3.6, 28), new THREE.MeshBasicMaterial({ map: porchT, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 0.4, 0.03, d / 2 + 1.6, hg); pl.rotation.x = -Math.PI / 2; pl.material.userData.noPBR = true;
          const wash = add(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: porchT, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 0.6, 2.0, d / 2 + 0.02, hg); wash.material.userData.noPBR = true; };
        [[-34, 34, 11, 8, 5.5, Math.PI, [2], 1], [-6, 46, 12, 9, 6.5, Math.PI, [], 1], [26, 44, 10, 8, 5.8, Math.PI, [0, 3], 1], [52, 38, 10, 8, 5.6, Math.PI, [1], 1],
         [-44, 2, 10, 9, 6, Math.PI / 2, [3], 1], [46, 4, 11, 9, 6.2, -Math.PI / 2, [1], 1], [-42, -24, 10, 8, 5.8, Math.PI / 2, [], 1], [44, -22, 10, 8, 6, -Math.PI / 2, [2], 0], [4, -46, 12, 9, 6.2, 0, [1], 1], [-22, -46, 10, 8, 5.6, 0, [], 1]]
          .forEach(([x, z, w, d, h, ry, lit, on]) => { const hg = house(x, z, w, d, h, ry, lit); porch(hg, d, on); }); }

      TH.Linear.fix(g);
      this.group = g;
    },
    update(t) {
      if (this.sky) this.sky.position.copy(TH.camera.position);
      if (this.flicker) this.flicker.material.opacity = Math.random() < 0.06 ? 0.05 : 0.5 + Math.sin(t * 40) * 0.05;
    },
  };

  function merge(geos) {
    let n = 0; const parts = geos.map((g) => { const ng = g.index ? g.toNonIndexed() : g; n += ng.attributes.position.count; return ng; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    parts.forEach((g) => { if (!g.attributes.normal) g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; });
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return out;
  }
})();
