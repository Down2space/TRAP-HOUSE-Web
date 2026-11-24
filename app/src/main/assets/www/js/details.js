/* TRAP HOUSE — set dressing. Furniture builders (tables, chairs, couch…) and room-by-room clutter:
   mouldings, chandeliers, rugs, curtains, paintings, books, kitchen fittings, pipes, cobwebs, mould. */
(function () {
  'use strict';
  const TH = window.TH;
  const R = (a, b) => a + Math.random() * (b - a);

  // Merge many small pieces into one mesh (one draw call) — keeps phones fast
  function merge(geos) {
    let n = 0; const parts = geos.map((g) => { const ng = g.index ? g.toNonIndexed() : g; n += ng.attributes.position.count; return ng; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    parts.forEach((g) => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return out;
  }
  const mergeGeo = (g) => merge(g);
  // a turned leg: bulbs and coves along its length, like a real lathe-turned table leg
  function turnedLeg(h, r, x, z) {
    const P = [[0, 0], [r * 0.7, 0], [r * 0.9, 0.04], [r * 0.6, 0.1], [r * 0.75, 0.16], [r * 1.05, 0.3], [r * 0.8, 0.45], [r * 0.6, 0.55], [r * 0.75, 0.62], [r * 1.1, 0.7], [r * 1.1, 1.0], [0, 1.0]];
    const g = new THREE.LatheGeometry(P.map(([a, b]) => new THREE.Vector2(a, b * h)), 10); g.translate(x, 0, z); return g;
  }
  let pleatTex = null;
  function pleats() { // a pleated fabric lampshade with a little fringe
    if (pleatTex) return pleatTex; const c = document.createElement('canvas'); c.width = 256; c.height = 128; const k = c.getContext('2d');
    k.fillStyle = '#e8d6b0'; k.fillRect(0, 0, 256, 128); for (let x = 0; x < 256; x += 8) { k.fillStyle = 'rgba(120,80,40,.25)'; k.fillRect(x, 0, 3, 128); k.fillStyle = 'rgba(255,240,210,.35)'; k.fillRect(x + 4, 0, 2, 128); }
    k.fillStyle = 'rgba(150,90,40,.8)'; k.fillRect(0, 0, 256, 6); k.fillRect(0, 112, 256, 6); for (let x = 0; x < 256; x += 4) k.fillRect(x, 118, 2, 10);
    pleatTex = new THREE.CanvasTexture(c); pleatTex.wrapS = THREE.RepeatWrapping; pleatTex.encoding = THREE.sRGBEncoding; return pleatTex;
  }
  const MC = {}; const pm = (k, o) => MC[k] || (MC[k] = new THREE.MeshPhongMaterial(o)); const bm = (k, o) => MC[k] || (MC[k] = new THREE.MeshBasicMaterial(o)); const lm = (k, o) => MC[k] || (MC[k] = new THREE.MeshLambertMaterial(o));
  function bx(w, h, d, x, y, z, ry) { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; }

  const D = (TH.Details = {
    /* ---------- vintage lamps (they're real lights in the lighting pool) ---------- */
    lamp(level, x, z, y, base) {
      const H = TH.House.h, g = new THREE.Group(); H.scene.add(g); g.position.set(x, H.yOf(level) + y, z);
      const cer = new THREE.MeshStandardMaterial({ color: base || 0x3a6a6a, roughness: 0.25, metalness: 0.05 }), brass = new THREE.MeshStandardMaterial({ color: 0xb8913a, metalness: 0.9, roughness: 0.35 });
      const jar = [[0, 0], [0.06, 0], [0.065, 0.012], [0.05, 0.03], [0.085, 0.12], [0.08, 0.2], [0.045, 0.27], [0.03, 0.29], [0, 0.3]];
      H.addMesh(new THREE.LatheGeometry(jar.map(([a, b]) => new THREE.Vector2(a, b)), 20), cer, 0, 0, 0, g);
      H.addMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), brass, 0, 0.37, 0, g); H.addMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 10), brass, 0, 0.45, 0, g);
      const shadeMat = new THREE.MeshBasicMaterial({ map: pleats(), side: THREE.DoubleSide, color: 0xffd8a0 }); // (each shade is its own light)
      const shade = H.addMesh(new THREE.CylinderGeometry(0.1, 0.19, 0.22, 28, 1, true), shadeMat, 0, 0.52, 0, g); shade.userData.dynamic = true;
      H.addMesh(new THREE.SphereGeometry(0.015, 8, 6), brass, 0, 0.66, 0, g);
      TH.House.fixtures.push({ x, y: H.yOf(level) + y + 0.5, z, level, bulb: shade, mat: shadeMat, power: 0.55, flicker: Math.random() < 0.3, color: 0xffc888 });
      return g;
    },
    floorLamp(level, x, z) {
      const H = TH.House.h, g = new THREE.Group(); H.scene.add(g); g.position.set(x, H.yOf(level), z);
      const brass = new THREE.MeshStandardMaterial({ color: 0xa8823a, metalness: 0.9, roughness: 0.4 });
      for (let i = 0; i < 3; i++) { const a = i * 2.094, f = H.addMesh(new THREE.CylinderGeometry(0.01, 0.012, 0.3, 6), brass, Math.sin(a) * 0.12, 0.08, Math.cos(a) * 0.12, g); f.rotation.set(Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1); }
      H.addMesh(new THREE.CylinderGeometry(0.014, 0.018, 1.5, 10), brass, 0, 0.85, 0, g); H.addMesh(new THREE.SphereGeometry(0.03, 10, 8), brass, 0, 0.9, 0, g);
      const shadeMat = new THREE.MeshBasicMaterial({ map: pleats(), side: THREE.DoubleSide, color: 0xffd8a0 }); // (each shade is its own light)
      const shade = H.addMesh(new THREE.CylinderGeometry(0.16, 0.28, 0.32, 32, 1, true), shadeMat, 0, 1.62, 0, g); shade.userData.dynamic = true;
      TH.Col.addRect(level, x, z, 0.35, 0.35, false);
      TH.House.fixtures.push({ x, y: H.yOf(level) + 1.55, z, level, bulb: shade, mat: shadeMat, power: 0.7, flicker: Math.random() < 0.3, color: 0xffc888 });
      return g;
    },

    /* ---------- furniture ---------- */
    table(level, x, z, w, d, h, color, opts) {
      opts = opts || {}; const H = TH.House.h, y = H.yOf(level), m = H.woodMat(color);
      const g = new THREE.Group(); H.scene.add(g); g.position.set(x, y, z);
      const top = H.addMesh(TH.Tex.boxUV(new THREE.BoxGeometry(w, 0.06, d), w, 0.06, d, 1), m, 0, h - 0.03, 0, g);
      const lg = []; const lx = w / 2 - 0.07, lz = d / 2 - 0.07;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => lg.push(turnedLeg(h - 0.06, 0.036, a * lx, b * lz)));
      lg.push(bx(w - 0.1, 0.1, 0.03, 0, h - 0.11, lz), bx(w - 0.1, 0.1, 0.03, 0, h - 0.11, -lz), bx(0.03, 0.1, d - 0.1, lx, h - 0.11, 0), bx(0.03, 0.1, d - 0.1, -lx, h - 0.11, 0));
      lg.push(bx(w + 0.02, 0.02, d + 0.02, 0, h - 0.07, 0)); // moulded edge under the top
      if (opts.drawers) { lg.push(bx(w * 0.4, h * 0.65, d - 0.1, w * 0.28, h * 0.6 - h * 0.05, 0)); }
      H.addMesh(merge(lg), m, 0, 0, 0, g);
      if (opts.drawers) [0.3, 0.55].forEach((yy) => H.addMesh(new THREE.BoxGeometry(0.08, 0.02, 0.03), H.lam(0xb8913a), w * 0.28, h * yy, -d / 2 + 0.03, g));
      TH.Col.addRect(level, x, z, w, d, false);
      return g;
    },
    chair(level, x, z, ry, knocked) {
      const H = TH.House.h, m = H.woodMat(0x3b2616);
      const parts = [bx(0.46, 0.05, 0.46, 0, 0.47, 0)];
      [[-1, 1], [1, 1]].forEach(([a, b]) => parts.push(turnedLeg(0.47, 0.024, a * 0.2, b * 0.2)));
      [[-1, -1], [1, -1]].forEach(([a, b]) => parts.push(turnedLeg(1.0, 0.024, a * 0.2, b * 0.2)));
      for (let i = -1; i <= 1; i++) { const sp = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8); sp.translate(i * 0.1, 0.73, -0.2); parts.push(sp); }
      const crest = new THREE.CylinderGeometry(0.03, 0.03, 0.46, 10); crest.rotateZ(Math.PI / 2); crest.scale(1, 1.6, 0.8); crest.translate(0, 0.97, -0.2); parts.push(crest);
      parts.push(bx(0.4, 0.03, 0.03, 0, 0.18, 0.2), bx(0.03, 0.03, 0.4, -0.2, 0.18, 0), bx(0.03, 0.03, 0.4, 0.2, 0.18, 0)); // stretchers
      const c = H.addMesh(merge(parts), m, x, H.yOf(level), z); c.rotation.y = ry || 0;
      const seat = H.addMesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), H.fabricMat(0x6a2a2a), 0, 0.515, 0, c); seat.scale.set(1, 1, 1);
      for (let i = 0; i < 9; i++) { const t = i / 8; H.addMesh(new THREE.SphereGeometry(0.008, 6, 4), H.lam(0xb8913a), -0.2 + t * 0.4, 0.5, 0.21, c); } // brass upholstery nails
      if (knocked) { c.rotation.set(0, ry, Math.PI / 2); c.position.y = H.yOf(level) + 0.23; }
      TH.Col.addRect(level, x, z, 0.5, 0.5, false); // you (and he) bump into chairs instead of walking through them
      return c;
    },
    couch(level, x, z, w, ry, color) {
      const H = TH.House.h, f = H.fabricMat(color), g = new THREE.Group(); H.scene.add(g); g.position.set(x, H.yOf(level), z); g.rotation.y = ry;
      H.addMesh(merge([bx(w, 0.42, 0.95, 0, 0.21, 0), bx(w, 0.6, 0.22, 0, 0.62, -0.37), bx(0.22, 0.62, 0.95, -w / 2 + 0.11, 0.31, 0), bx(0.22, 0.62, 0.95, w / 2 - 0.11, 0.31, 0)]), f, 0, 0, 0, g);
      for (let i = 0; i < 3; i++) { const cu = H.addMesh(new THREE.BoxGeometry((w - 0.5) / 3 - 0.03, 0.16, 0.66), f, -((w - 0.5) / 3) + i * ((w - 0.5) / 3), 0.5, 0.08, g); cu.rotation.z = R(-0.06, 0.06); }
      H.addMesh(new THREE.BoxGeometry(0.5, 0.36, 0.14), H.fabricMat(0x8a7a3a), w * 0.3, 0.72, -0.18, g).rotation.set(-0.3, 0.2, 0.15); // pillow
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => H.addMesh(new THREE.SphereGeometry(0.05, 10, 8), H.woodMat(0x2a1a0e), a * (w / 2 - 0.1), 0.0, b * 0.38, g).scale.set(1, 0.8, 1)); // bun feet
      [-1, 1].forEach((sd) => { const arm = H.addMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.97, 16), f, sd * (w / 2 - 0.11), 0.64, 0, g); arm.rotation.x = Math.PI / 2; }); // rolled arms
      const btn = H.fabricMat(new THREE.Color(color).multiplyScalar(0.6).getHex());
      for (let r = 0; r < 2; r++) for (let i = 0; i < Math.round(w * 4); i++) { const bxp = -w / 2 + 0.3 + (i + (r % 2) * 0.5) * ((w - 0.6) / Math.round(w * 4)); if (bxp > w / 2 - 0.3) continue; H.addMesh(new THREE.SphereGeometry(0.018, 6, 4), btn, bxp, 0.62 + r * 0.16, -0.255, g); } // deep buttoning
      const sw = Math.abs(Math.sin(ry)) > 0.5; TH.Col.addRect(level, x, z, sw ? 0.95 : w, sw ? w : 0.95, false);
    },
    bookshelf(level, x, z, ry, w) {
      const H = TH.House.h, g = new THREE.Group(); H.scene.add(g); g.position.set(x, H.yOf(level), z); g.rotation.y = ry; w = w || 1.4;
      const shelves = [bx(w, 2.1, 0.04, 0, 1.05, -0.17), bx(0.04, 2.1, 0.36, -w / 2, 1.05, 0), bx(0.04, 2.1, 0.36, w / 2, 1.05, 0)];
      for (let i = 0; i < 5; i++) shelves.push(bx(w, 0.03, 0.36, 0, 0.05 + i * 0.5, 0));
      H.addMesh(merge(shelves), H.woodMat(0x4a2e18), 0, 0, 0, g);
      const cols = [0x6a1e1e, 0x1e3a5a, 0x2e4a2a, 0x7a6a3a, 0x3a2a4a, 0x8a5a2a, 0x222222];
      cols.forEach((c) => {
        const bk = []; for (let s = 0; s < 4; s++) { let bxp = -w / 2 + 0.06; while (bxp < w / 2 - 0.1) { const bw = R(0.035, 0.07), bh = R(0.24, 0.4); if (Math.random() < 1 / cols.length) { const lean = Math.random() < 0.08; bk.push(lean ? bx(bh, bw, 0.22, bxp + bh / 2, 0.08 + s * 0.5 + bw / 2, 0) : bx(bw, bh, 0.22, bxp, 0.07 + s * 0.5 + bh / 2, 0)); } bxp += bw + 0.005; } }
        if (bk.length) H.addMesh(merge(bk), H.lam(c), 0, 0, 0, g);
      });
      const sw = Math.abs(Math.sin(ry)) > 0.5; TH.Col.addRect(level, x, z, sw ? 0.4 : w, sw ? w : 0.4, true);
    },
    chandelier(level, x, z, r) {
      const H = TH.House.h, y = H.yOf(level) + TH.House.H - 0.95, brass = pm('chbrass', { color: 0x9a7a3a, shininess: 60, specular: 0x886633 });
      const g = new THREE.Group(); H.scene.add(g); g.position.set(x, y, z);
      const ring = H.addMesh(new THREE.TorusGeometry(r, 0.025, 6, 20), brass, 0, 0, 0, g); ring.rotation.x = Math.PI / 2;
      H.addMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4), brass, 0, 0.45, 0, g);
      const bulb = new THREE.MeshBasicMaterial({ color: 0xffd890 }); let i = 0;
      for (let a = 0; a < 6.28; a += 6.28 / 6) {
        H.addMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), pm('chcandle', { color: 0xe6dcc0 }), Math.cos(a) * r, 0.08, Math.sin(a) * r, g);
        if (i++ % 4 !== 3) H.addMesh(new THREE.SphereGeometry(0.035, 6, 4), bulb, Math.cos(a) * r, 0.17, Math.sin(a) * r, g); // a couple are burnt out
      }
      for (let k = 0; k < 8; k++) { const cr = H.addMesh(new THREE.OctahedronGeometry(0.03), pm('crystal', { color: 0xdde8f0, shininess: 90, transparent: true, opacity: 0.8 }), Math.cos(k) * r * 0.7, -0.12 - (k % 3) * 0.05, Math.sin(k) * r * 0.7, g); }
      g.rotation.z = 0.04; // hanging slightly crooked
    },
    rug(level, x, z, w, d, ry) { const H = TH.House.h; const tex = TH.Tex.rugFor(w, d); const m = H.addMesh(new THREE.PlaneGeometry(w, d), new THREE.MeshPhongMaterial({ map: tex, shininess: 0, specular: 0, bumpMap: TH.settings.quality !== 'low' ? tex : null, bumpScale: 0.01 }), x, H.yOf(level) + 0.008, z); m.rotation.set(-Math.PI / 2, 0, ry || 0); return m; },
    // a real paper poster: slightly wavy, corners lifting off the wall, pinned with thumbtacks. Image loads in the background.
    poster(level, x, y, z, ry, w, h, url) {
      const H = TH.House.h, c = document.createElement('canvas'); c.width = c.height = 4; const k = c.getContext('2d'); k.fillStyle = '#d8ccb0'; k.fillRect(0, 0, 4, 4);
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
      const img = new Image(); img.onload = () => { tex.image = img; tex.needsUpdate = true; }; img.src = url;
      const geo = new THREE.PlaneGeometry(w, h, 10, 12), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2);
        let dz = 0.004 * Math.sin(u * 3.1 + v * 1.7) + 0.003 * Math.sin(v * 5.3);           // paper waviness
        const cu = Math.max(0, Math.abs(u) - 0.7) / 0.3, cv = Math.max(0, Math.abs(v) - 0.75) / 0.25;
        dz += 0.03 * Math.pow(cu * cv, 1.5) * (u > 0 && v < 0 ? 1.8 : 0.6);                   // corners curl away from the wall (bottom right most)
        p.setZ(i, dz + 0.003);
      }
      geo.computeVertexNormals();
      const g = new THREE.Group(); H.scene.add(g); g.position.set(x, H.yOf(level) + y, z); g.rotation.y = ry;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0, side: THREE.DoubleSide }); mat.userData.noPBR = true;
      H.addMesh(geo, mat, 0, 0, 0, g);
      const tack = new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.35, metalness: 0.2 });
      [[-1, 1], [1, 1], [-1, -1]].forEach(([sx, sy]) => { const m = H.addMesh(new THREE.SphereGeometry(0.009, 10, 8), tack, sx * (w / 2 - 0.03), sy * (h / 2 - 0.03), 0.009, g); m.scale.z = 0.6; }); // one tack is missing, so that corner curls
      return g;
    },
    painting(level, x, y, z, ry, w, h, hue) {
      const H = TH.House.h, c = document.createElement('canvas'); c.width = 128; c.height = 128 * (h / w); const k = c.getContext('2d');
      const gr = k.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, `hsl(${hue},25%,32%)`); gr.addColorStop(1, `hsl(${hue + 30},30%,14%)`); k.fillStyle = gr; k.fillRect(0, 0, 128, c.height);
      k.fillStyle = `hsl(${hue + 60},20%,20%)`; k.beginPath(); k.moveTo(0, c.height * 0.7); for (let i = 0; i <= 8; i++) k.lineTo(i * 16, c.height * (0.55 + Math.random() * 0.15)); k.lineTo(128, c.height); k.lineTo(0, c.height); k.fill();
      k.fillStyle = 'rgba(80,60,20,.35)'; k.fillRect(0, 0, 128, c.height);
      const g = new THREE.Group(); H.scene.add(g); g.position.set(x, H.yOf(level) + y, z); g.rotation.y = ry;
      H.addMesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.04), pm('pframe', { color: 0x8a6a2a, shininess: 40 }), 0, 0, 0.02, g);
      H.addMesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(c), shininess: 20 }), 0, 0, 0.045, g);
      g.rotation.z = R(-0.06, 0.06);
    },
    curtains(level, x, z, ry, w) {
      const H = TH.House.h, g = new THREE.Group(); H.scene.add(g); g.position.set(x, H.yOf(level), z); g.rotation.y = ry;
      const m = pm('curtain', { color: 0x5a2a2e, shininess: 4, side: THREE.DoubleSide });
      [-1, 1].forEach((s) => { const geo = new THREE.PlaneGeometry(0.6, 2.4, 6, 1); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 16) * 0.05); geo.computeVertexNormals(); H.addMesh(geo, m, s * (w / 2 + 0.25), 1.55, 0.22, g); }); // hung in front of the boards, not through them
      H.addMesh(new THREE.CylinderGeometry(0.02, 0.02, w + 1.5, 6), pm('crod', { color: 0x8a6a2a }), 0, 2.75, 0.22, g).rotation.z = Math.PI / 2;
    },
    cobweb(level, x, z, ry) { const H = TH.House.h; const m = H.addMesh(new THREE.PlaneGeometry(0.9, 0.9), bm('cobweb', { map: TH.Tex.cobweb, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8 }), x, H.yOf(level) + TH.House.H - 0.4, z); m.rotation.set(0, ry, 0); return m; },
    mold(level, x, y, z, rx, ry, s) { const H = TH.House.h; const m = H.addMesh(new THREE.PlaneGeometry(s, s), lm('mold', { map: TH.Tex.mold, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), x, H.yOf(level) + y, z); m.rotation.set(rx, ry, Math.random() * 6); },
    boxes(level, x, z, n) { const H = TH.House.h, list = []; for (let i = 0; i < n; i++) { const s = R(0.35, 0.6); list.push(bx(s, s * 0.8, s, x + R(-0.5, 0.5), (i > 2 ? 0.5 : 0) + s * 0.4, z + R(-0.5, 0.5), R(0, 1))); } H.addMesh(merge(list), H.lam(0x9a7a50), 0, H.yOf(level), 0); TH.Col.addRect(level, x, z, 1.2, 1.2, false); },
    clothes(level, x, z) { const H = TH.House.h; for (let i = 0; i < 6; i++) { const c = H.addMesh(new THREE.BoxGeometry(R(0.3, 0.6), 0.05, R(0.3, 0.5)), H.fabricMat(TH.util.pick([0x5a2a2a, 0x2a3a5a, 0x3a3a3a, 0x6a6a5a, 0x4a5a3a])), x + R(-0.5, 0.5), H.yOf(level) + 0.03 + i * 0.03, z + R(-0.5, 0.5)); c.rotation.y = R(0, 3); } },
    pipes(level, x0, z0, x1, z1) {
      const H = TH.House.h, y = H.yOf(level) + TH.House.H - 0.18, len = Math.hypot(x1 - x0, z1 - z0);
      const p = H.addMesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), pm('pipe', { color: 0x6a5a48, shininess: 30 }), (x0 + x1) / 2, y, (z0 + z1) / 2);
      p.rotation.set(Math.PI / 2, 0, 0); p.rotation.order = 'YXZ'; p.rotation.y = Math.atan2(x1 - x0, z1 - z0);
      for (let t = 0.2; t < 1; t += 0.3) H.addMesh(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 8), H.lam(0x8a4a2a), x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t).rotation.set(Math.PI / 2, Math.atan2(x1 - x0, z1 - z0), 0, 'YXZ');
    },
    radiator(level, x, z, ry) { const H = TH.House.h, parts = []; for (let i = 0; i < 10; i++) parts.push(bx(0.06, 0.6, 0.16, -0.36 + i * 0.08, 0.4, 0)); parts.push(bx(0.84, 0.05, 0.12, 0, 0.12, 0)); const m = H.addMesh(merge(parts), pm('radiator', { color: 0x8a8478, shininess: 30 }), x, H.yOf(level), z); m.rotation.y = ry; },

    /* ---------- the dressing pass, room by room ---------- */
    build() {
      const H = TH.House.h, Hs = TH.House, HH = Hs.H, T = 0.2;

      // mouldings on every wall: baseboard, chair rail, crown
      [0, 1].forEach((lv) => {
        const base = [], crown = [], rail = [];
        Hs.walls.filter((w) => w.level === lv).forEach((w) => {
          let cur = w.a0; const segs = [];
          w.gaps.filter((g) => !g.win || g.crawl).forEach((g) => { segs.push([cur, g.c - g.w / 2 - 0.06]); cur = g.c + g.w / 2 + 0.06; }); segs.push([cur, w.a1]);
          segs.forEach(([a, b]) => {
            const len = b - a; if (len < 0.1) return; const c = (a + b) / 2, y0 = lv * HH;
            const mk = (h, th, y) => (w.axis === 'x' ? bx(len, h, T + th, c, y0 + y, w.k) : bx(T + th, h, len, w.k, y0 + y, c));
            base.push(mk(0.17, 0.05, 0.085)); rail.push(mk(0.05, 0.035, 0.95)); crown.push(mk(0.14, 0.12, HH - 0.09));
          });
        });
        H.addMesh(merge(base), H.woodMat(0x3a2414), 0, 0, 0); H.addMesh(merge(rail), H.woodMat(0x4a3020), 0, 0, 0);
        H.addMesh(merge(crown), new THREE.MeshPhongMaterial({ color: 0xc8bfa6, shininess: 6 }), 0, 0, 0);
      });
      // ceiling medallions under every bulb
      Hs.fixtures.concat(Hs.deadBulbs || []).filter((f) => f.ceiling !== false && !f.candle && !f.moon && !f.tv && f.level >= 0 && (!f.bulb || f.y > f.level * HH + 2.5) && Hs.roomAt(f.x, f.z, f.level) && !/deck|roof|yard|shed/i.test(Hs.roomAt(f.x, f.z, f.level).name)).forEach((f) => H.addMesh(new THREE.CylinderGeometry(0.32, 0.36, 0.05, 16), pm('medallion', { color: 0xcfc6ad }), f.x, f.level * HH + HH - 0.045, f.z));

      // More windows on the outside walls (most are boarded up)

      // Contact shadows: soft dark pools under every piece of furniture and along every wall base / ceiling edge.
      // (This is what makes objects feel like they sit on the floor instead of floating.)
      { const blobMat = new THREE.MeshBasicMaterial({ map: TH.Tex.blob, transparent: true, depthWrite: false, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -1 });
        [0, 1].forEach((lv) => TH.Col.boxes[lv].forEach((b) => {
          const w = b.x1 - b.x0, d = b.z1 - b.z0; if (Math.min(w, d) < 0.26 || Math.max(w, d) > 5.5) return;
          const m = H.addMesh(new THREE.PlaneGeometry(w + 0.55, d + 0.55), blobMat, (b.x0 + b.x1) / 2, lv * HH + 0.006, (b.z0 + b.z1) / 2); m.rotation.x = -Math.PI / 2;
        }));
        const edgeMat = new THREE.MeshBasicMaterial({ map: TH.Tex.edge, transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -1, side: THREE.DoubleSide });
        const ceilEdge = new THREE.MeshBasicMaterial({ map: TH.Tex.edge, transparent: true, depthWrite: false, opacity: 0.45, polygonOffset: true, polygonOffsetFactor: -1, side: THREE.DoubleSide });
        [0, 1].forEach((lv) => {
          const floorG = [], ceilG = [];
          Hs.walls.filter((w) => w.level === lv).forEach((w) => {
            let cur = w.a0; const segs = []; w.gaps.filter((g) => !g.win || g.crawl).forEach((g) => { segs.push([cur, g.c - g.w / 2]); cur = g.c + g.w / 2; }); segs.push([cur, w.a1]);
            segs.forEach(([a0, a1]) => { const len = a1 - a0; if (len < 0.1) return; const c = (a0 + a1) / 2;
              [-1, 1].forEach((side) => {
                const mk = (wid, y, list, flip) => { const g = new THREE.PlaneGeometry(len, wid); g.rotateX(-Math.PI / 2); if (side < 0) g.rotateY(Math.PI); if (w.axis === 'z') g.rotateY(Math.PI / 2); const off = side * (T / 2 + wid / 2);
                  if (w.axis === 'x') g.translate(c, y, w.k + off); else g.translate(w.k + off, y, c); list.push(g); };
                mk(0.45, lv * HH + 0.007, floorG); mk(0.35, lv * HH + HH - 0.025, ceilG);
              });
            });
          });
          H.addMesh(mergeGeo(floorG), edgeMat, 0, 0, 0); H.addMesh(mergeGeo(ceilG), ceilEdge, 0, 0, 0);
        });
      }

      const L = (a, b2, r0, r1) => H.log(a, b2, r0, r1, false);
      // Foyer
      D.chandelier(0, 0, 9, 0.55);
      D.painting(0, 2.88, 1.75, 11.1, -Math.PI / 2, 0.55, 0.7, 20);
      { // grandfather clock
        const g = new THREE.Group(); H.scene.add(g); g.userData.dynamic = true; g.position.set(2.65, 0, 6.75); g.rotation.y = -Math.PI / 2;
        H.addMesh(TH.Tex.boxUV(new THREE.BoxGeometry(0.55, 2.2, 0.35), 0.55, 2.2, 0.35, 1), H.woodMat(0x3a1e10), 0, 1.1, 0, g);
        H.addMesh(new THREE.CircleGeometry(0.18, 16), new THREE.MeshPhongMaterial({ color: 0xe8dcc0 }), 0, 1.8, 0.18, g);
        H.addMesh(new THREE.BoxGeometry(0.01, 0.13, 0.01), H.lam(0x111111), 0, 1.84, 0.19, g).rotation.z = 0.6;
        H.addMesh(new THREE.BoxGeometry(0.01, 0.09, 0.01), H.lam(0x111111), 0.02, 1.8, 0.19, g).rotation.z = -1.4;
        const pend = H.addMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), new THREE.MeshPhongMaterial({ color: 0xb8913a, shininess: 70 }), 0, 0.9, 0.18, g); pend.rotation.x = Math.PI / 2;
        TH.Details.pendulum = pend; TH.Col.addRect(0, 2.65, 6.75, 0.4, 0.6, true);
      }
      { // coat rack + coats
        H.addMesh(new THREE.CylinderGeometry(0.03, 0.05, 1.8, 6), H.woodMat(0x3a2414), 1.7, 0.9, 11.55);
        [0x2a2a30, 0x5a3a2a].forEach((c, i) => { const coat = H.addMesh(new THREE.BoxGeometry(0.4, 0.9, 0.12), H.fabricMat(c), 1.7 + (i ? 0.15 : -0.12), 1.25, 11.55 + (i ? -0.1 : -0.08)); coat.rotation.y = i * 0.8; });
        TH.Col.addRect(0, 1.7, 11.55, 0.5, 0.5, false);
      }
      for (let i = 0; i < 9; i++) { const e = H.addMesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshLambertMaterial({ color: i % 3 ? 0xe8e0cc : 0xe8c8b0, side: THREE.DoubleSide }), R(-0.8, 0.8), 0.01 + i * 0.002, R(10.8, 11.7)); e.rotation.set(-Math.PI / 2, 0, R(0, 3)); } // unpaid mail
      D.radiator(0, -2.82, 6.7, Math.PI / 2); D.rug(0, 0, 8.6, 1.6, 3.2, 0);

      // Grand hall + back hall
      D.rug(0, 1.1, 1.0, 1.2, 9, 0); D.pipes(0, 2.7, -3.8, 2.7, 5.8); D.cobweb(0, 2.75, 5.75, (3 * Math.PI) / 4);
      D.painting(0, 2.88, 1.75, -2.4, -Math.PI / 2, 0.55, 0.7, 200);
      { const ped = H.addMesh(new THREE.CylinderGeometry(0.16, 0.2, 1.05, 12), new THREE.MeshPhongMaterial({ color: 0x8a8478, shininess: 20 }), 2.45, 0.52, -3.3); TH.Col.addRect(0, 2.45, -3.3, 0.42, 0.42, false);
        H.addMesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshPhongMaterial({ color: 0xb8b0a0, shininess: 30 }), 2.45, 1.25, -3.3).scale.set(0.85, 1.15, 0.9); } // a plaster bust
      D.rug(0, 0, -8, 1.4, 6, 0); D.cobweb(0, -2.75, -11.75, Math.PI / 4); D.radiator(0, 2.82, -6, -Math.PI / 2);
      [[-2.6, -10.8], [-2.4, -10.6]].forEach(([x, z], i) => { const b2 = H.addMesh(new THREE.BoxGeometry(0.11, 0.18, 0.28), H.lam(0x2a1e14), x + i * 0.14, 0.09, z); b2.rotation.y = R(-0.4, 0.4); }); // muddy boots

      // Music room: upright piano, a gramophone, a music stand
      { const g = new THREE.Group(); H.scene.add(g); g.position.set(-14.9, 0, 11.55); g.rotation.y = Math.PI;
        H.addMesh(TH.Tex.boxUV(new THREE.BoxGeometry(1.5, 1.25, 0.55), 1.5, 1.25, 0.55, 1), H.woodMat(0x1e120a), 0, 0.62, 0, g);
        H.addMesh(new THREE.BoxGeometry(1.4, 0.04, 0.2), H.lam(0xe8e0c8), 0, 0.75, 0.33, g);
        const bk = []; for (let i = 0; i < 20; i++) if (i % 7 !== 2 && i % 7 !== 6) bk.push(bx(0.025, 0.02, 0.11, -0.66 + i * 0.07, 0.78, 0.29)); H.addMesh(merge(bk), H.lam(0x111111), 0, 0, 0, g);
        H.addMesh(TH.Tex.boxUV(new THREE.BoxGeometry(0.8, 0.45, 0.35), 0.8, 0.45, 0.35, 1), H.woodMat(0x1e120a), 0, 0.23, 0.75, g);
        TH.Col.addRect(0, -14.9, 11.55, 1.5, 0.6, false); TH.Col.addRect(0, -14.9, 10.8, 0.8, 0.35, false); }
      { const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.85, roughness: 0.35 }), g = new THREE.Group(); H.scene.add(g); g.position.set(-12.3, 0.76, 11.2);
        H.addMesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), H.woodMat(0x4a2a14), 0, 0.07, 0, g); H.addMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 24), H.lam(0x111111), 0, 0.15, 0, g);
        const horn = H.addMesh(new THREE.LatheGeometry([[0.015, 0], [0.03, 0.1], [0.06, 0.2], [0.13, 0.3], [0.2, 0.34]].map(([a2, b2]) => new THREE.Vector2(a2, b2)), 20), Object.assign(brass.clone(), { side: THREE.DoubleSide }), 0.1, 0.22, -0.05, g); horn.rotation.set(-0.9, 0, -0.5); }
      D.chandelier(0, -13, 8, 0.5); D.rug(0, -13, 8, 3.2, 4.4, 0.08); D.curtains(0, -15.88, 8, Math.PI / 2, 1.2); D.painting(0, -15.88, 1.9, 5.2, Math.PI / 2, 0.7, 0.9, 260);
      D.chair(0, -11.5, 6.5, -2.4, true); D.cobweb(0, -15.75, 11.75, -Math.PI / 4);

      // Parlor
      D.rug(0, -7.5, 9.2, 4, 3, 0); D.curtains(0, -4.6, 11.88, Math.PI, 1.1); D.painting(0, -7.5, 2.05, 11.86, Math.PI, 1.2, 0.8, 15);
      D.armchair(0, -9.2, 9.9, Math.PI / 2 + 0.3, 0x5a2a2a); D.armchair(0, -5.8, 9.9, -Math.PI / 2 - 0.3, 0x5a2a2a);
      D.embers(0, -7.5, 11.32); D.bookshelf(0, -9.78, 5.4, Math.PI / 2, 1.4); D.cobweb(0, -3.25, 11.75, (3 * Math.PI) / 4);

      // Library
      D.bookshelf(0, -15.78, -2.6, Math.PI / 2, 1.6); D.bookshelf(0, -15.78, 2.4, Math.PI / 2, 1.6); D.bookshelf(0, -11.2, -3.78, 0, 1.4); D.bookshelf(0, -14.6, 3.78, Math.PI, 1.2);
      D.rug(0, -13, 0.3, 3, 2.4, 0); D.armchair(0, -11.4, 2.7, Math.PI * 0.85, 0x2a4a3a); D.curtains(0, -15.88, -0.2, Math.PI / 2, 1.2);
      { const g = H.addMesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshPhongMaterial({ color: 0x8a7a50, shininess: 30 }), -10.9, 0.95, -2.6); H.addMesh(new THREE.CylinderGeometry(0.03, 0.08, 0.75, 8), H.woodMat(0x3a2414), -10.9, 0.37, -2.6); TH.Col.addRect(0, -10.9, -2.6, 0.4, 0.4, false); } // globe

      // Dining room
      D.chandelier(0, -6.5, 0.6, 0.75); D.rug(0, -6.5, 0.6, 4.6, 3, 0);
      D.painting(0, -4.4, 1.9, 3.88, Math.PI, 1.2, 0.8, 30); D.cobweb(0, -9.75, 3.75, -Math.PI / 4); D.cobweb(0, -3.25, -3.75, (3 * Math.PI) / 4);
      { // china plates with a blue rim pattern and leftover grime
        const pc = document.createElement('canvas'); pc.width = pc.height = 256; const k = pc.getContext('2d'); k.fillStyle = '#d6cfbd'; k.fillRect(0, 0, 256, 256);
        k.strokeStyle = '#2c4a7a'; k.lineWidth = 6; k.beginPath(); k.arc(128, 128, 116, 0, 6.28); k.stroke(); k.lineWidth = 2; k.beginPath(); k.arc(128, 128, 98, 0, 6.28); k.stroke();
        for (let a2 = 0; a2 < 6.28; a2 += 0.39) { k.fillStyle = '#2c4a7a'; k.beginPath(); k.arc(128 + Math.cos(a2) * 107, 128 + Math.sin(a2) * 107, 4, 0, 6.28); k.fill(); }
        const gr = k.createRadialGradient(140, 120, 5, 140, 120, 60); gr.addColorStop(0, 'rgba(110,70,30,.6)'); gr.addColorStop(1, 'rgba(110,70,30,0)'); k.fillStyle = gr; k.fillRect(0, 0, 256, 256);
        const pt = new THREE.CanvasTexture(pc); pt.encoding = THREE.sRGBEncoding; const china = new THREE.MeshStandardMaterial({ map: pt, roughness: 0.22, metalness: 0 });
        const plate = new THREE.LatheGeometry([[0, 0], [0.08, 0], [0.085, 0.004], [0.12, 0.016], [0.128, 0.02], [0.124, 0.022], [0.08, 0.008], [0, 0.006]].map(([r2, y]) => new THREE.Vector2(r2, y)), 28);
        const uv = plate.attributes.uv, pp = plate.attributes.position; for (let v = 0; v < pp.count; v++) uv.setXY(v, 0.5 + pp.getX(v) / 0.26, 0.5 + pp.getZ(v) / 0.26);
        for (let i = 0; i < 3; i++) H.addMesh(plate, china, -7.6 + i * 1.0, 0.762, 0.35 + (i % 2) * 0.5);
      }

      // Kitchen fittings
      { const doors = [], handles = [], KZ = -12;
        for (let x = -15.3; x < -8.6; x += 0.62) { if (x > -11.7 && x < -10.3) continue; doors.push(bx(0.58, 0.68, 0.02, x, 0.44, KZ + 0.735)); handles.push(bx(0.12, 0.02, 0.03, x, 0.7, KZ + 0.755)); }
        [[-15.3, -12.9], [-9.1, -7.6]].forEach(([a2, b2]) => { for (let x = a2; x < b2; x += 0.62) doors.push(bx(0.58, 0.7, 0.02, x, 1.82, KZ + 0.45)); });
        H.addMesh(merge(doors), H.woodMat(0x6a4a2a), 0, 0, 0); H.addMesh(merge(handles), new THREE.MeshPhongMaterial({ color: 0xa8a8a0, shininess: 60 }), 0, 0, 0);
        [[-8.15, KZ + 0.25], [-7.75, KZ + 0.25], [-8.15, KZ + 0.55], [-7.75, KZ + 0.55]].forEach(([x, z]) => H.addMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), H.lam(0x111111), x, 0.96, z));
        H.addMesh(new THREE.BoxGeometry(0.6, 0.45, 0.02), H.lam(0x1a1a1a), -7.95, 0.45, KZ + 0.74);
        for (let i = 0; i < 5; i++) H.addMesh(new THREE.CylinderGeometry(0.12, 0.11, 0.02, 12), H.lam(0xd8d0bc), -11 + R(-0.15, 0.15), 0.97 + i * 0.025, KZ + 0.45 + R(-0.08, 0.08)); // dishes in the sink
        H.addMesh(new THREE.BoxGeometry(0.42, 0.24, 0.3), new THREE.MeshPhongMaterial({ color: 0xc8b890, shininess: 40 }), -14.6, 1.06, KZ + 0.4); // bread box
        { const c = document.createElement('canvas'); c.width = 64; c.height = 96; const k = c.getContext('2d'); k.fillStyle = '#d9b44a'; k.fillRect(0, 0, 64, 96); k.fillStyle = '#c8372d'; k.font = '900 18px "Barlow Condensed", sans-serif'; k.fillText('CRUNCH', 4, 30); k.fillText('O’S', 4, 52);
          const cb = H.addMesh(new THREE.BoxGeometry(0.2, 0.3, 0.07), new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(c) }), -13.3, 1.09, KZ + 0.45); cb.rotation.y = 0.3; }
        H.addMesh(new THREE.BoxGeometry(1.6, 0.04, 0.04), H.lam(0x333333), -11.5, 2.6, -7.8);
        [-0.6, -0.1, 0.45].forEach((dx, i) => { H.addMesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 4), H.lam(0x333333), -11.5 + dx, 2.45, -7.8); const pot = H.addMesh(new THREE.CylinderGeometry(0.14 + i * 0.03, 0.12 + i * 0.03, 0.12, 12), new THREE.MeshPhongMaterial({ color: 0x5a5a5a, shininess: 50 }), -11.5 + dx, 2.22, -7.8); pot.rotation.z = R(-0.2, 0.2); });
      }
      D.mold(0, -13, HH - 0.03, -6, Math.PI / 2, 0, 1.6); D.mold(0, -15.88, 1.3, -5, 0, Math.PI / 2, 1.2); D.cobweb(0, -15.75, -11.75, Math.PI / 4); D.rug(0, -11.5, -6.2, 2.2, 1.0, 0);

      // Back stairs: runner
      { const run = []; for (let i = 0; i < 19; i++) { const t = (i + 1) / 19; run.push(bx(1.2, 0.012, 5 / 19, -4.5, t * HH + 0.006, -10.8 + (i + 0.5) * (5 / 19))); } H.addMesh(merge(run), H.fabricMat(0x3a3a2a), 0, 0, 0); }

      // Living room
      D.rug(0, 8.2, 8.8, 4, 3, 0.05); D.bookshelf(0, 3.32, 5, Math.PI / 2, 1.4); D.radio(0, 10.45, 4.0, -Math.PI / 2);
      D.painting(0, 9, 2.05, 11.86, Math.PI, 1.1, 0.8, 210); D.curtains(0, 5.6, 11.88, Math.PI, 1.1); D.embers(0, 9, 11.32);
      D.armchair(0, 6.4, 10.1, Math.PI / 2 + 0.4, 0x3a3a5a); D.cobweb(0, 10.75, 11.75, -Math.PI / 4); D.mold(0, 6, HH - 0.03, 5, Math.PI / 2, 0, 1.2);

      // Sunroom: wicker, dead plants, glass on the floor, the tree's crown hanging through the ceiling
      { const wick = H.woodMat(0x8a6a40);
        [[14.4, 10.6, 0.8], [15.2, 9.5, -1.4]].forEach(([x, z, r]) => { const g = new THREE.Group(); H.scene.add(g); g.position.set(x, 0, z); g.rotation.y = r;
          H.addMesh(new THREE.CylinderGeometry(0.3, 0.25, 0.42, 12), wick, 0, 0.21, 0, g); const back = H.addMesh(new THREE.CylinderGeometry(0.32, 0.3, 0.5, 12, 1, true, 0, Math.PI), Object.assign(wick.clone(), { side: THREE.DoubleSide }), 0, 0.66, 0, g); back.rotation.y = Math.PI / 2; TH.Col.addRect(0, x, z, 0.6, 0.6, false); });
        [[11.6, 11.4], [15.4, 3.6], [11.6, 3.6], [15.5, 7.5]].forEach(([x, z]) => { H.addMesh(new THREE.CylinderGeometry(0.2, 0.15, 0.35, 12), H.lam(0x8a4a2a), x, 0.17, z); for (let i = 0; i < 5; i++) { const l = H.addMesh(new THREE.ConeGeometry(0.03, R(0.4, 0.8), 4), H.lam(0x4a4028), x + R(-0.1, 0.1), 0.5, z + R(-0.1, 0.1)); l.rotation.set(R(-0.9, 0.9), 0, R(-0.9, 0.9)); } TH.Col.addRect(0, x, z, 0.45, 0.45, false); });
        const glassM = new THREE.MeshStandardMaterial({ color: 0xbfd0d8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.5 });
        for (let i = 0; i < 30; i++) { const s2 = H.addMesh(new THREE.PlaneGeometry(R(0.03, 0.12), R(0.03, 0.1)), glassM, R(14.4, 15.8), 0.006, R(6.4, 8.6)); s2.rotation.set(-Math.PI / 2, 0, R(0, 3)); }
        const g = Hs.TREES.find((t) => t.name === 'guest').floor; for (let i = 0; i < 6; i++) { const a2 = R(0, 6.28); L([g.x + Math.cos(a2) * 0.3, HH, g.z + Math.sin(a2) * 0.3], [g.x + Math.cos(a2) * R(0.4, 1.0), R(1.4, 2.4), g.z + Math.sin(a2) * R(0.4, 1.0)], 0.05, 0.015); }
        D.cobweb(0, 15.75, 3.25, (3 * Math.PI) / 4); }

      // TV den
      D.rug(0, 6, -1.2, 3.2, 2.6, 0); D.armchair(0, 4.1, -2.4, Math.PI / 2 + 0.5, 0x6a4a2a); D.radiator(0, 3.18, 2.0, Math.PI / 2);
      for (let i = 0; i < 4; i++) H.addMesh(new THREE.BoxGeometry(0.22, 0.008, 0.3), H.lam(TH.util.pick([0xc84a3a, 0xd8c8a0, 0x3a6a9a])), 5.6 + R(-0.3, 0.3), 0.45 + i * 0.008, -1.3 + R(-0.15, 0.15)).rotation.y = R(-0.6, 0.6); // magazines
      D.painting(0, 8.88, 1.8, 1.5, -Math.PI / 2, 0.7, 0.5, 120); D.cobweb(0, 8.75, -3.75, Math.PI / 4);

      // Bathroom (ground floor)
      H.addMesh(new THREE.PlaneGeometry(0.6, 0.8), pm('mirror', { color: 0x9aa4a8, shininess: 120, specular: 0x8899aa }), 9.12, 1.55, -3.6).rotation.y = Math.PI / 2;
      D.mold(0, 11.88, 2.3, 1.2, 0, -Math.PI / 2, 1.3); D.pipes(0, 11.8, -3.8, 11.8, 2.8);
      // Pantry
      { const cols = [0x9a6a2a, 0x6a8a3a, 0xa83a2a, 0xd8c8a0]; for (let i = 0; i < 26; i++) { const jh = R(0.12, 0.2); H.addMesh(new THREE.CylinderGeometry(0.05, 0.05, jh, 10), Hs.std('pjar' + (i % 4), { color: cols[i % 4], roughness: 0.25, transparent: true, opacity: 0.85 }), 15.62 + R(-0.08, 0.08), [0.52, 1.02, 1.52][i % 3] + jh / 2, -3.4 + (i / 26) * 5.8); } // sitting on the shelf boards
        for (let i = 0; i < 4; i++) { const s2 = H.addMesh(new THREE.SphereGeometry(0.28, 10, 8), H.fabricMat(0xb8a880), 12.42, 0.22, -2.75 + i * 0.5); s2.scale.set(0.8, 0.8, 1); } TH.Col.addRect(0, 12.42, -2.0, 0.6, 2.2, false); // sacks along the side wall, clear of the laundry door
        D.cobweb(0, 12.25, -3.75, Math.PI / 4); D.cobweb(0, 15.75, 2.75, -Math.PI * 0.75); }
      // Mudroom + laundry
      D.pipes(0, 7.8, -11.8, 7.8, -4.2); D.cobweb(0, 3.25, -4.25, (3 * Math.PI) / 4);
      D.pipes(0, 8.3, -11.8, 15.8, -11.8); D.pipes(0, 15.8, -11.8, 15.8, -4.3); D.clothes(0, 12.5, -6); D.clothes(0, 10.5, -9);
      { const wh = TH.Tex.rusty ? TH.Tex.rusty(new THREE.MeshStandardMaterial({ color: 0xbab4a6, metalness: 0.5, roughness: 0.6 }), 0xc8c0b2) : new THREE.MeshPhongMaterial({ color: 0xbab4a6, shininess: 20 }); H.addMesh(new THREE.CylinderGeometry(0.3, 0.3, 1.5, 18), wh, 15.45, 0.75, -11.4); /* the water heater: rusted, like the rest of the metal */ TH.Col.addRect(0, 15.45, -11.4, 0.6, 0.6, false); }
      [[9.7, -11.55], [10.5, -11.55]].forEach(([x, z]) => H.addMesh(new THREE.CircleGeometry(0.25, 16), H.lam(0x2a2a2e), x, 0.5, z + 0.38));

      // Grand staircase: carpet runner + handrail
      { const run = []; for (let i = 0; i < 19; i++) { const t = (i + 1) / 19; run.push(bx(1.1, 0.012, 5 / 19, -1.9, t * HH + 0.006, 4.5 - (i + 0.5) * (5 / 19))); run.push(bx(1.1, HH / 19, 0.012, -1.9, (i + 0.5) / 19 * HH, 4.5 - i * (5 / 19) + 0.007)); } H.addMesh(merge(run), H.fabricMat(0x5a1e1e), 0, 0, 0); }

      // Upstairs hall
      D.rug(1, 1.1, 7, 1.1, 9, 0); D.rug(1, 1.1, -4.5, 1.1, 8, 0); D.chandelier(1, 0.8, 8, 0.4); D.radiator(1, 2.82, -2.8, -Math.PI / 2);
      D.cobweb(1, 2.75, 11.75, (3 * Math.PI) / 4); D.mold(1, 1, HH - 0.03, -5.5, Math.PI / 2, 0, 1.4); D.painting(1, -2.88, 1.8, 10.2, Math.PI / 2, 0.6, 0.8, 300);
      // Master bedroom
      D.rug(1, -11, 8, 3, 2.2, 0); D.curtains(1, -15.88, 10, Math.PI / 2, 1.1); D.curtains(1, -14.2, 11.88, Math.PI, 1.1);
      D.painting(1, -10.3, 1.8, 3.12, 0, 1.0, 1.3, 340); /* beside the nursery door, not over it */ D.chair(1, -9.6, 4.1, 2.6, true); D.clothes(1, -14, 4.2);
      { H.addMesh(new THREE.PlaneGeometry(0.7, 0.9), pm('mirror', { color: 0x9aa4a8, shininess: 120, specular: 0x8899aa }), -15.88, HH + 1.45, 3.9).rotation.y = Math.PI / 2; }
      // Walk-in closet: a rail of old clothes
      H.addMesh(new THREE.CylinderGeometry(0.015, 0.015, 2.4, 6), H.lam(0x888888), -5, HH + 1.9, 3.35).rotation.z = Math.PI / 2;
      for (let i = 0; i < 9; i++) H.addMesh(new THREE.BoxGeometry(0.06, 0.95, 0.5), H.fabricMat(TH.util.pick([0x6b2b2b, 0x2b3b5b, 0x3b3b3b, 0x5b5b3b, 0x7a6a5a])), -6.1 + i * 0.27, HH + 1.38, 3.4);
      TH.Col.addBox(1, -6.3, 3.1, -3.8, 3.7, true);
      // Master bath
      H.addMesh(new THREE.PlaneGeometry(0.6, 0.8), pm('mirror2', { color: 0x8a948f, shininess: 120, specular: 0x667777 }), -3.12, HH + 1.55, 10.9).rotation.y = -Math.PI / 2;
      D.mold(1, -5, HH - 0.03, 9.5, Math.PI / 2, 0, 1.4);
      // Nursery: rocking horse, a mobile over the crib, blocks, a doll on the toy chest
      { const g = new THREE.Group(); H.scene.add(g); g.position.set(-11.2, HH, 1.4); g.rotation.y = -0.6;
        H.addMesh(new THREE.BoxGeometry(0.2, 0.25, 0.6), H.woodMat(0x8a5a3a), 0, 0.55, 0, g); H.addMesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), H.woodMat(0x8a5a3a), 0, 0.75, 0.3, g);
        const rk = H.addMesh(new THREE.TorusGeometry(0.5, 0.03, 4, 16, 1.4), H.woodMat(0x5a3a22), 0, 0.5, 0, g); rk.rotation.set(0, Math.PI / 2, Math.PI + 0.85); }
      for (let i = 0; i < 4; i++) { H.addMesh(new THREE.CylinderGeometry(0.003, 0.003, 0.4, 4), H.lam(0xaaaaaa), -14.6 + Math.cos(i * 1.57) * 0.25, HH + 1.75, 1.9 + Math.sin(i * 1.57) * 0.25); H.addMesh(new THREE.OctahedronGeometry(0.06), H.lam(TH.util.pick([0xc04040, 0x4060c0, 0xd0b030])), -14.6 + Math.cos(i * 1.57) * 0.25, HH + 1.52, 1.9 + Math.sin(i * 1.57) * 0.25); }
      for (let i = 0; i < 6; i++) H.addMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), H.lam(TH.util.pick([0xc04040, 0x4060c0, 0xd0b030])), -12.4 + R(-0.6, 0.6), HH + 0.08, -2.4 + R(-0.6, 0.6)).rotation.y = R(0, 2);
      { const doll = new THREE.Group(); H.scene.add(doll); doll.position.set(-15.4, HH + 0.52, -3.4); doll.rotation.y = 0.9; H.addMesh(new THREE.CylinderGeometry(0.06, 0.09, 0.2, 10), H.fabricMat(0x7a3a4a), 0, 0.1, 0, doll); H.addMesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshPhongMaterial({ color: 0xe8dcc8, shininess: 60 }), 0, 0.27, 0, doll); [-1, 1].forEach((s2) => H.addMesh(new THREE.SphereGeometry(0.012, 8, 6), H.lam(0x111111), s2 * 0.025, 0.285, 0.06, doll)); }
      D.curtains(1, -15.88, -2.6, Math.PI / 2, 1.0); D.cobweb(1, -15.75, 2.75, -Math.PI * 0.75);
      // Sewing room: a dress form, spools, fabric piles
      { const g = new THREE.Group(); H.scene.add(g); g.position.set(-4.2, HH, -3.3); H.addMesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), H.lam(0x2a2a2a), 0, 0.55, 0, g); H.addMesh(new THREE.LatheGeometry([[0.0, 0], [0.15, 0], [0.19, 0.2], [0.14, 0.35], [0.18, 0.55], [0.1, 0.66], [0, 0.68]].map(([a2, b2]) => new THREE.Vector2(a2, b2)), 16), H.fabricMat(0xc8b890), 0, 1.0, 0, g); TH.Col.addRect(1, -4.2, -3.3, 0.4, 0.4, true); }
      for (let i = 0; i < 8; i++) H.addMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8), H.lam(TH.util.pick([0xc04040, 0x4060c0, 0xd0b030, 0xe8e0d0])), -5.7 + R(-0.4, 0.4), HH + 0.8, 2.6 + R(-0.15, 0.15));
      D.clothes(1, -7.6, 1.6); D.clothes(1, -4.4, -0.2); D.cobweb(1, -8.75, -3.75, Math.PI / 4);
      // Kid's bedroom
      { const c = document.createElement('canvas'); c.width = 96; c.height = 128; const k = c.getContext('2d'); k.fillStyle = '#2a3a6a'; k.fillRect(0, 0, 96, 128); k.fillStyle = '#e8c040'; k.font = '900 26px "Barlow Condensed", sans-serif'; k.fillText('SKATE', 12, 40); k.fillText('OR DIE', 10, 70); k.fillStyle = 'rgba(80,60,20,.4)'; k.fillRect(0, 90, 96, 38);
        const ps = H.addMesh(new THREE.PlaneGeometry(0.5, 0.66), new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(c) }), -8.7, HH + 1.7, -4.12); ps.rotation.y = Math.PI; ps.rotation.z = 0.05; }
      for (let i = 0; i < 5; i++) H.addMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), H.lam(TH.util.pick([0xc04040, 0x4060c0, 0xd0b030])), -7.4 + R(-0.6, 0.6), HH + 0.1, -9.6 + R(-0.6, 0.6)).rotation.y = R(0, 2);
      D.rug(1, -8.5, -9.8, 2, 1.6, 0.2); D.cobweb(1, -10.75, -11.75, Math.PI / 4);
      // Filthy bathroom
      H.addMesh(new THREE.PlaneGeometry(0.6, 0.8), pm('mirror2', { color: 0x8a948f, shininess: 120, specular: 0x667777 }), -11.12, HH + 1.55, -10.2).rotation.y = -Math.PI / 2;
      D.mold(1, -13.5, HH - 0.03, -7, Math.PI / 2, 0, 2.2); D.mold(1, -15.88, 2.2, -8.8, 0, Math.PI / 2, 1.3); D.mold(1, -11.12, 0.5, -6, 0, -Math.PI / 2, 1.0);
      // Office
      D.bookshelf(1, 8.68, 7.4, -Math.PI / 2, 1.5);
      { const safe = H.addMesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshPhongMaterial({ color: 0x3a4038, shininess: 40 }), 8.5, HH + 0.3, 11.5); TH.Col.addRect(1, 8.5, 11.5, 0.6, 0.6, false);
        H.addMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12), new THREE.MeshPhongMaterial({ color: 0xb8b8b0, shininess: 80 }), 8.5, HH + 0.35, 11.18).rotation.x = Math.PI / 2; }
      for (let i = 0; i < 4; i++) H.addMesh(new THREE.BoxGeometry(0.3, 0.02 * (i + 2), 0.22), H.lam(0xe8e0cc), 5.8 + i * 0.05, HH + 0.8 + i * 0.03, 10.5).rotation.y = R(-0.3, 0.3);
      { const tw = new THREE.Group(); H.scene.add(tw); tw.position.set(7.0, HH + 0.78, 10.45); H.addMesh(new THREE.BoxGeometry(0.4, 0.1, 0.3), H.lam(0x1a1a1a), 0, 0.05, 0, tw); H.addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 10), H.lam(0x111111), 0, 0.14, -0.1, tw).rotation.z = Math.PI / 2; H.addMesh(new THREE.PlaneGeometry(0.2, 0.25), H.lam(0xe8e0cc), 0, 0.24, -0.14, tw).rotation.x = -0.3; } // typewriter
      D.painting(1, 6, 1.9, 3.12, 0, 1.2, 0.8, 40); D.curtains(1, 6, 11.88, Math.PI, 1.1); D.rug(1, 6, 8, 3, 2, 0);
      // Guest bedroom
      D.rug(1, 13, 9.5, 2.8, 2, 0); D.curtains(1, 12.4, 11.88, Math.PI, 1.1); D.painting(1, 15.88, 1.8, 10.4, -Math.PI / 2, 0.8, 0.6, 180); D.chair(1, 10.4, 7.2, 1.2, true); D.clothes(1, 11, 4.4);
      // Upstairs bath
      H.addMesh(new THREE.PlaneGeometry(0.6, 0.8), pm('mirror', { color: 0x9aa4a8, shininess: 120, specular: 0x8899aa }), 3.12, HH + 1.55, -2.6).rotation.y = Math.PI / 2;
      D.mold(1, 5.5, HH - 0.03, 0, Math.PI / 2, 0, 1.3);
      // Spare bedroom: furniture under dust sheets
      D.sheeted(1, 10.6, -2.8, 1.4, 0.7, 0.9); D.sheeted(1, 12.2, 1.6, 0.9, 0.9, 1.1); D.sheeted(1, 9.0, 1.8, 0.6, 0.6, 1.6);
      D.boxes(1, 14.6, -3, 3); D.cobweb(1, 8.25, 2.75, -Math.PI * 0.75); D.mold(1, 12, HH - 0.03, -1.5, Math.PI / 2, 0, 1.3);
      // Storage room
      D.boxes(1, 7.3, -4.75, 4); D.sheeted(1, 7.4, -10.55, 0.8, 0.6, 1.7);
      { const tk = H.addMesh(TH.Tex.boxUV(new THREE.BoxGeometry(0.9, 0.5, 0.5), 0.9, 0.5, 0.5, 1), H.woodMat(0x5a3a22), 4.4, HH + 0.25, -9.4); TH.Col.addRect(1, 4.4, -9.4, 0.9, 0.5, false); } // old steamer trunk
      D.cobweb(1, 7.75, -11.75, -Math.PI / 4);
      // Back bedroom (you wake up here)
      D.rug(1, 11.6, -8.6, 2.6, 1.8, 0.1); D.curtains(1, 9.6, -11.88, 0, 1.0); D.clothes(1, 13.5, -6.2);
      D.poster(1, 9.6, 1.72, -4.115, Math.PI, 0.66, 0.82, 'img/tim-poster.jpg'); // the Tim Wright poster
      D.painting(1, 15.88, 1.9, -6, -Math.PI / 2, 0.9, 0.6, 60); D.cobweb(1, 15.75, -11.75, Math.PI / 4);
    },
    /* ---------- extra vintage pieces ---------- */
    armchair(level, x, z, ry, color) {
      const H = TH.House.h, teddy = TH.Tex.photo.teddy && color === 0x2a4a3a, g = new THREE.Group(); H.scene.add(g); g.position.set(x, H.yOf(level), z); g.rotation.y = ry;
      const f = teddy ? (D._teddy || (D._teddy = new THREE.MeshPhongMaterial({ map: TH.Tex.photo.teddy, color: 0xc8c8c0, shininess: 2, specular: 0x000000 }))) : H.fabricMat(color); // the library chair wears a fleecy check
      H.addMesh(merge([bx(0.8, 0.4, 0.8, 0, 0.3, 0), bx(0.8, 0.75, 0.18, 0, 0.75, -0.33), bx(0.14, 0.35, 0.75, -0.36, 0.6, 0), bx(0.14, 0.35, 0.75, 0.36, 0.6, 0)]), f, 0, 0, 0, g);
      [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]].forEach(([a, b]) => H.addMesh(new THREE.CylinderGeometry(0.03, 0.02, 0.12, 8), H.woodMat(0x2a1a0e), a, 0.06, b, g));
      [-1, 1].forEach((s) => { const w = H.addMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 12, 1, false, 0, Math.PI), f, s * 0.38, 1.0, -0.33, g); w.rotation.set(0, 0, 0); }); // wings
      TH.Col.addRect(level, x, z, 0.85, 0.85, false);
    },
    radio(level, x, z, ry) { // a 1940s floor-standing radio cabinet with a cloth grille and a glowing dial
      const H = TH.House.h, g = new THREE.Group(); H.scene.add(g); g.position.set(x, H.yOf(level), z); g.rotation.y = ry;
      const wood = H.woodMat(0x5a3418); H.addMesh(TH.Tex.boxUV(new THREE.BoxGeometry(0.7, 1.05, 0.38), 0.7, 1.05, 0.38, 1), wood, 0, 0.525, 0, g);
      const top = H.addMesh(new THREE.CylinderGeometry(0.35, 0.35, 0.38, 20, 1, false, 0, Math.PI), wood, 0, 1.05, 0, g); top.rotation.set(Math.PI / 2, 0, Math.PI / 2); top.scale.set(1, 1, 0.5);
      H.addMesh(new THREE.PlaneGeometry(0.46, 0.42), H.fabricMat(0x8a7a50), 0, 0.5, 0.195, g);
      H.addMesh(new THREE.PlaneGeometry(0.3, 0.08), new THREE.MeshBasicMaterial({ color: 0x5a4a20 }), 0, 0.88, 0.195, g);
      [-0.1, 0.1].forEach((dx) => H.addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), H.lam(0x2a1a0e), dx, 0.78, 0.2, g).rotation.x = Math.PI / 2);
      TH.Col.addRect(level, x, z, 0.5, 0.75, false);
    },
    sheeted(level, x, z, w, d, h) { // furniture under a dust sheet: a lumpy draped shape
      const H = TH.House.h, g = new THREE.BoxGeometry(w, h, d, 6, 6, 6), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = y < -h / 2 + 0.05 ? 1.12 : 1 + Math.sin(p.getX(i) * 9 + p.getZ(i) * 7) * 0.04; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); if (y > h / 2 - 0.01) p.setY(i, y - Math.abs(Math.sin(p.getX(i) * 4)) * 0.05); }
      g.computeVertexNormals(); H.addMesh(g, H.fabricMat(0xc8c2b0), x, H.yOf(level) + h / 2, z); TH.Col.addRect(level, x, z, w + 0.1, d + 0.1, h > 1.4);
    },
    embers(level, x, z) { // a fire that's nearly out: glowing coals in the grate, a faint warm light
      const H = TH.House.h, m = new THREE.MeshBasicMaterial({ color: 0xff5a1a }); const e = H.addMesh(new THREE.CircleGeometry(0.22, 12), m, x, H.yOf(level) + 0.1, z); e.rotation.x = -Math.PI / 2; e.userData.dynamic = true;
      [[0, 0], [0.12, 0.05]].forEach(([a, b]) => H.addMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 6), H.woodMat(0x2a1a10), x + a, H.yOf(level) + 0.14, z + b).rotation.z = Math.PI / 2);
      TH.House.fixtures.push({ x, y: H.yOf(level) + 0.5, z: z - 0.4, level, bulb: e, mat: m, power: 0.3, flicker: true, candle: true, ember: true, color: 0xff6a2a, range: 6 });
    },
    // the console television: walnut cabinet on splayed legs, a bulging tube showing live static, rabbit ears
    tv(level, x, z, ry) {
      const H = TH.House.h, g = new THREE.Group(); H.scene.add(g); g.position.set(x, H.yOf(level), z); g.rotation.y = ry;
      const wood = H.woodMat(0x4a2a14), brass = new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.85, roughness: 0.35 });
      H.addMesh(TH.Tex.boxUV(new THREE.BoxGeometry(1.25, 0.72, 0.5), 1.25, 0.72, 0.5, 1), wood, 0, 0.6, 0, g);
      [[-0.55, -0.18], [0.55, -0.18], [-0.55, 0.18], [0.55, 0.18]].forEach(([a, b]) => { const l = H.addMesh(new THREE.CylinderGeometry(0.025, 0.012, 0.26, 8), wood, a, 0.12, b, g); l.rotation.set(b * 0.8, 0, -a * 0.25); });
      H.addMesh(new THREE.BoxGeometry(0.74, 0.56, 0.02), H.lam(0x0c0c0c), -0.17, 0.62, 0.251, g); // bezel
      const c = document.createElement('canvas'); c.width = 96; c.height = 72; const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      const scr = new THREE.PlaneGeometry(0.64, 0.48, 8, 6), sp = scr.attributes.position; for (let i = 0; i < sp.count; i++) { const u = sp.getX(i) / 0.32, v = sp.getY(i) / 0.24; sp.setZ(i, (1 - u * u * 0.6) * (1 - v * v * 0.6) * 0.035); } scr.computeVertexNormals();
      const smat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); smat.userData.noPBR = true;
      const screen = H.addMesh(scr, smat, -0.17, 0.62, 0.262, g); screen.userData.dynamic = true;
      H.addMesh(new THREE.PlaneGeometry(0.34, 0.5), H.fabricMat(0x8a7a50), 0.42, 0.62, 0.252, g); // speaker cloth
      [0.78, 0.6].forEach((y) => H.addMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 14), brass, 0.42, y, 0.27, g).rotation.x = Math.PI / 2);
      const ant = new THREE.Group(); ant.position.set(0.2, 0.96, 0); g.add(ant); H.addMesh(new THREE.SphereGeometry(0.05, 12, 8), H.lam(0x1a1a1a), 0, 0, 0, ant);
      [-1, 1].forEach((s) => { const r = H.addMesh(new THREE.CylinderGeometry(0.004, 0.004, 0.7, 4), brass, s * 0.15, 0.32, 0, ant); r.rotation.z = -s * 0.45; });
      TH.Col.addRect(level, x, z, Math.abs(Math.sin(ry)) > 0.5 ? 0.5 : 1.3, Math.abs(Math.sin(ry)) > 0.5 ? 1.3 : 0.5, false);
      const fx = Math.sin(ry), fz = Math.cos(ry);
      const fix = { x: x + fx * 0.7, y: H.yOf(level) + 0.75, z: z + fz * 0.7, level, power: 0.45, flicker: false, tv: true, color: 0x9ab0ff, range: 7 };
      TH.House.fixtures.push(fix);
      D.tvSet = { x, z, level, fx, fz, tex, ctx: c.getContext('2d'), mat: smat, fix, state: 'quiet', t: 0, noiseT: 0 };
    },
    // the TV can be turned up full to make a racket somewhere else: he comes to shut it off
    register() {
      const T = D.tvSet; if (!T) return; T.state = 'quiet';
      TH.Interact.add({ x: T.x + T.fx * 0.75, z: T.z + T.fz * 0.75, level: T.level, y: T.level * TH.House.H + 0.7, r: 1.6,
        bias: () => 0.5, prompt: () => (T.state === 'loud' ? 'TURN THE TV OFF' : T.state === 'off' ? 'TURN THE TV ON (LOUD)' : 'TURN THE TV UP ALL THE WAY'), short: () => (T.state === 'loud' ? 'OFF' : 'TURN UP'),
        use: () => { if (T.state === 'loud') { T.state = 'off'; TH.Audio.play('handle', { x: T.x, y: 0.8, z: T.z }, 8); } else { T.state = 'loud'; T.noiseT = 0; TH.UI.toast('Static roars out of the set. Get away from it.'); } } });
    },
    lamps() {},
    /* Distance culling for the moving bits (doors, drawers, portraits, vents, the fridge, the car): they can't be merged
       into the static batches, so each is its own draw call. Far away or on another floor, they're behind walls anyway. */
    cull() {
      const Hs = TH.House;
      if (!D._cull) {
        const L = (D._cull = []), seen = new Set(), add = (o, x, z, level, r) => { if (o && !seen.has(o)) { seen.add(o); L.push({ o, x, z, level, r: r || 0 }); } };
        TH.Doors.list.forEach((d) => add(d.pivot, d.x, d.z, d.level));
        (TH.Openables ? TH.Openables.list : []).forEach((o) => add(o.parent, o.wx, o.wz, o.level));
        Hs.frames.forEach((f) => add(f.group, f.x, f.z, f.level)); Hs.vents.forEach((v) => add(v.group, v.x, v.z, v.level));
        Hs.cabinets.forEach((c) => (c.doors || []).forEach((dd) => add(dd.p, c.x, c.z, c.level)));
        if (TH.Garage && TH.Garage.car) { add(TH.Garage.car, 19.6, -7.4, 0, 3); add(TH.Garage.door, 19.6, -3, 0, 2); }
      }
      const P = TH.Player, cp = TH.camera.getWorldPosition(D._cp || (D._cp = new THREE.Vector3())), lv = TH.Col.levelOf(cp.y - 1.2);
      const driving = TH.Garage && TH.Garage.driving;
      D._cull.forEach((c) => { const d = Math.hypot(c.x - cp.x, c.z - cp.z) - c.r; c.o.visible = driving || (c.level === lv ? d < 19 : d < 7.5) || (lv === 1 && c.level === 0 && d < 11); });
    },
    update(t, dt) {
      if (TH.House.update) TH.House.update();
      if ((D._cf = (D._cf || 0) + 1) % 6 === 0 && TH.camera && TH.state.mode !== 'menu') D.cull();
      if (D.pendulum) D.pendulum.position.x = Math.sin(t * 2.1) * 0.12;
      const T = D.tvSet; if (T) {
        T.t += 1 / 60; const on = T.state !== 'off';
        if (on && ((T._f = (T._f || 0) + 1) % 3 === 0)) { const k = T.ctx, img = k.createImageData(96, 72), d = img.data; for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 * (0.55 + 0.45 * Math.sin(i * 0.0007 + t * 8)); d[i] = v * 0.85; d[i + 1] = v * 0.9; d[i + 2] = v; d[i + 3] = 255; } k.putImageData(img, 0, 0); k.fillStyle = 'rgba(0,0,0,.25)'; for (let y = (t * 40) % 6; y < 72; y += 6) k.fillRect(0, y, 96, 2); T.tex.needsUpdate = true; }
        if (!on && T._wasOn !== false) { T.ctx.fillStyle = '#060606'; T.ctx.fillRect(0, 0, 96, 72); T.tex.needsUpdate = true; }
        T._wasOn = on; T.fix.power = on ? (T.state === 'loud' ? 0.6 : 0.42) * (0.75 + Math.random() * 0.25) : 0;
        if (T.state === 'loud' && TH.state.mode === 'play') {
          T.noiseT -= 1 / 60; if (T.noiseT <= 0) { T.noiseT = 2.4; TH.Audio.play('static', { x: T.x, y: 0.7, z: T.z }, 34); TH.Noise.emit(T.x, T.z, T.level, 38, 'a television blaring static'); }
          const E = TH.Enemy; if (E && E.active && E.level() === T.level && Math.hypot(E.pos.x - T.x, E.pos.z - T.z) < 1.7) { T.state = 'off'; TH.Audio.play('grunt', E.mouth(), 22); TH.Audio.play('handle', { x: T.x, y: 0.8, z: T.z }, 10); }
        }
      }
      // candle flames sway; fireplace embers breathe
      TH.House.fixtures.forEach((f) => { if (f.flames) f.flames.forEach((m, i) => { m.scale.y = 0.8 + Math.sin(t * 17 + i + f.x) * 0.15 + Math.random() * 0.1; m.rotation.z = Math.sin(t * 3 + f.z) * 0.15; }); if (f.halo) f.halo.material.opacity = 0.35 + (f.cur || 0.4) * 0.5; });
    },
  });
})();
