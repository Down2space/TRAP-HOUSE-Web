/* TRAP HOUSE — first-person hands, modelled on the player's own hands from photos.
   Sculpted hand bodies (back-of-hand veins and tendons, knuckles, palm lines), long jointed fingers with knuckle
   wrinkles and real nails (lunula, free edge), forearm hair, sleeves pushed up.
   RIGHT hand: open-triangle silver ring (index), onyx + mother-of-pearl signet (middle), horseshoe claw ring (ring finger),
               tiger's-eye bead bracelet with a silver accent bead.
   LEFT hand:  coral + turquoise triangle inlay band (index), blue sapphire tennis bracelet.
   Drawn in their own pass after the world, lit by the room you stand in. */
(function () {
  'use strict';
  const TH = window.TH, U = TH.util;
  const R = Math.random, rnd = (a, b) => a + R() * (b - a), sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
  const colTex = (c) => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  const datTex = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const FX = [-0.026, -0.0085, 0.0095, 0.026]; // knuckle x of index..pinky (right hand; thumb side is -x)

  /* ================= painting helpers ================= */
  function skinBase(c, rgb, mott) { // tileable mottled skin + pores, straight into pixels
    const g = c.getContext('2d'), w = c.width, h = c.height, img = g.createImageData(w, h), d = img.data, ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6), rnd(0, 6)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, u = (x / w) * 6.2832, v = (y / h) * 6.2832;
      const f = (Math.sin(u * 3 + ph[0]) * Math.cos(v * 2 + ph[1]) + Math.sin(u * 7 + v * 5 + ph[2]) * 0.5 + Math.sin(u * 13 - v * 11 + ph[3]) * 0.25) * mott, p = (R() - 0.5) * 7;
      d[i] = rgb[0] + f + p; d[i + 1] = rgb[1] + f * 0.85 + p; d[i + 2] = rgb[2] + f * 0.7 + p; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); return g;
  }
  const flat = (c, col) => { const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return g; };
  function blob(g, x, y, r, rgb, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  function path(g, pts) { // smooth curve through points
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
  }
  function stroke(g, pts, w, col) { g.lineCap = g.lineJoin = 'round'; g.lineWidth = w; g.strokeStyle = col; path(g, pts); g.stroke(); }
  function hair(g, x, y, ang, len, a) {
    const c = rnd(-0.35, 0.35); g.strokeStyle = `rgba(58,36,22,${a})`; g.lineWidth = rnd(0.7, 1.1); g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang + c) * len * 0.5, y + Math.sin(ang + c) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
  }
  function poly(g, pts, fill) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = fill; g.fill(); }
  function shrink(pts, k) { const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length; return pts.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]); }

  /* ================= skin textures ================= */
  // the hand body is UV-projected from above: u = x across the hand, v = wrist (0) → knuckles (1)
  const HX = (x, N) => (x / 0.1 + 0.5) * N, HY = (z, N) => (1 - (0.008 - z) / 0.102) * N;
  function dorsalTex() {
    const N = 512, c = cv(N), b = cv(N), g = skinBase(c, [216, 160, 136], 7), h = flat(b, '#808080');
    const P = (a) => a.map(([x, z]) => [HX(x, N), HY(z, N)]);
    blob(g, N * 0.5, N * 0.9, 260, '232,182,158', 0.18); // paler toward the wrist
    FX.forEach((fx) => { const pts = P([[fx * 0.3, 0.006], [fx * 0.65, -0.04], [fx, -0.082]]); // extensor tendons
      stroke(h, pts, 10, 'rgba(255,255,255,0.05)'); stroke(h, pts, 5, 'rgba(255,255,255,0.08)'); stroke(g, pts, 6, 'rgba(255,228,210,0.06)'); });
    FX.forEach((fx) => { // knuckles: redder, bony, creased
      blob(g, HX(fx, N), HY(-0.085, N), 30, '205,108,92', 0.22); blob(h, HX(fx, N), HY(-0.085, N), 22, '255,255,255', 0.22);
      for (let k = 0; k < 4; k++) { const y = HY(-0.079 - k * 0.0028, N) + rnd(-2, 2), x = HX(fx, N); g.strokeStyle = 'rgba(140,80,66,0.24)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - rnd(8, 13), y + rnd(-2, 2)); g.quadraticCurveTo(x, y - rnd(2, 5), x + rnd(8, 13), y + rnd(-2, 2)); g.stroke(); }
    });
    // the veins (traced off the photos): two trunks off the wrist, an arch across the middle, branches to the finger gaps and thumb web
    const V = [
      [[-0.004, 0.008], [-0.009, -0.02], [-0.014, -0.045], [-0.017, -0.066], [-0.0175, -0.08]],
      [[-0.009, -0.022], [-0.02, -0.037], [-0.03, -0.045], [-0.04, -0.05]],
      [[0.011, 0.008], [0.015, -0.022], [0.017, -0.05], [0.0185, -0.068], [0.018, -0.08]],
      [[-0.015, -0.05], [-0.004, -0.042], [0.008, -0.046], [0.017, -0.055]],
      [[0.0005, -0.044], [0.0012, -0.062], [0.0006, -0.079]],
      [[0.016, -0.034], [0.026, -0.05], [0.034, -0.062]],
      [[0.004, 0.008], [0.002, -0.012], [-0.006, -0.026]],
    ];
    V.forEach((v, i) => { const pts = P(v), w = i === 1 || i === 5 || i === 6 ? 0.7 : 1;
      stroke(g, pts, 16 * w, 'rgba(110,112,140,0.06)'); stroke(g, pts, 10 * w, 'rgba(95,105,138,0.07)'); stroke(g, pts, 5 * w, 'rgba(85,98,130,0.05)');
      stroke(h, pts, 15 * w, 'rgba(255,255,255,0.08)'); stroke(h, pts, 10 * w, 'rgba(255,255,255,0.12)'); stroke(h, pts, 5 * w, 'rgba(255,255,255,0.16)'); });
    for (let k = 0; k < 1800; k++) { g.fillStyle = `rgba(120,70,55,${rnd(0.04, 0.12)})`; g.fillRect(rnd(0, N), rnd(0, N), 1.2, 1.2); } // pores
    for (let k = 0; k < 16; k++) blob(g, rnd(0, N), rnd(0, N), rnd(1.5, 3), '150,90,60', 0.3); // freckles
    for (let k = 0; k < 400; k++) { // fine dark hair, thick at the wrist, thinning out before the knuckles
      const q = Math.pow(R(), 1.5), z = 0.008 - q * 0.075, x = rnd(-0.046, 0.046);
      hair(g, HX(x, N), HY(z, N), -Math.PI / 2 + 0.55 * Math.sign(x) * R() + rnd(-0.25, 0.25), rnd(5, 12), (0.16 + 0.3 * R()) * (1 - q * 0.8));
    }
    return { map: colTex(c), bump: datTex(b) };
  }
  function palmTex() {
    const N = 512, c = cv(N), b = cv(N), g = skinBase(c, [222, 142, 120], 9), h = flat(b, '#808080');
    const P = (a) => a.map(([x, z]) => [HX(x, N), HY(z, N)]);
    for (let k = 0; k < 34; k++) blob(g, rnd(0, N), rnd(0, N), rnd(10, 30), '205,80,70', 0.11); // blotchy palm
    blob(g, HX(-0.024, N), HY(-0.03, N), 80, '232,172,145', 0.28); blob(g, HX(0.026, N), HY(-0.035, N), 60, '228,165,140', 0.2); // mounds
    const L = [
      [[-0.034, -0.071], [-0.022, -0.054], [-0.013, -0.032], [-0.007, -0.012], [-0.004, 0.004]], // life line
      [[-0.035, -0.069], [-0.016, -0.061], [0.004, -0.054], [0.026, -0.047]], // head line
      [[0.042, -0.072], [0.026, -0.075], [0.008, -0.079], [-0.011, -0.086]], // heart line
      [[0.005, 0.004], [0.004, -0.03], [0.002, -0.058]], // fate line
    ];
    L.forEach((l, i) => { const pts = P(l), a = i === 3 ? 0.45 : 1;
      stroke(g, pts, 7, `rgba(170,80,68,${0.1 * a})`); stroke(g, pts, 2.2, `rgba(135,60,52,${0.22 * a})`); stroke(h, pts, 4, `rgba(0,0,0,${0.18 * a})`); });
    for (let k = 0; k < 700; k++) { const x = rnd(0, N), y = rnd(0, N), a = rnd(0, 6.28), l = rnd(5, 18); g.strokeStyle = 'rgba(130,60,50,0.07)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); h.strokeStyle = 'rgba(0,0,0,0.1)'; h.stroke(); }
    [0.004, 0.0005].forEach((z) => stroke(g, P([[-0.03, z], [0, z - 0.002], [0.03, z]]), 1.4, 'rgba(130,60,50,0.35)')); // wrist creases
    FX.forEach((fx) => stroke(g, P([[fx - 0.008, -0.091], [fx, -0.093], [fx + 0.008, -0.091]]), 1.4, 'rgba(130,60,50,0.4)'));
    return { map: colTex(c), bump: datTex(b) };
  }
  // finger segments: u wraps around (0 = back of the finger, .5 = palm side), v runs knuckle (0) → tip (1)
  function fingerTex(kind) {
    const N = 256, c = cv(N), b = cv(N), g = skinBase(c, [216, 156, 132], 6), h = flat(b, '#808080'), Yv = (v) => (1 - v) * N;
    const gr = g.createLinearGradient(0, 0, N, 0); gr.addColorStop(0, 'rgba(225,125,105,0)'); gr.addColorStop(0.5, 'rgba(225,118,100,0.24)'); gr.addColorStop(1, 'rgba(225,125,105,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N);
    const wrinkles = (v0, v1, n, wid, a) => { for (const cx of [0, N]) {
      blob(g, cx, Yv((v0 + v1) / 2), wid * 1.2, '205,112,96', 0.18);
      for (let k = 0; k < n; k++) { const y = Yv(v0 + ((v1 - v0) * (k + 0.5)) / n) + rnd(-2, 2), w = wid * rnd(0.6, 1);
        g.strokeStyle = `rgba(130,74,62,${a * 0.75 * rnd(0.6, 1)})`; g.lineWidth = rnd(0.7, 1.2); g.beginPath(); g.moveTo(cx - w, y + rnd(-3, 3)); g.quadraticCurveTo(cx, y + rnd(-5, 1), cx + w, y + rnd(-3, 3)); g.stroke();
        h.strokeStyle = 'rgba(0,0,0,0.2)'; h.lineWidth = 2.2; h.beginPath(); h.moveTo(cx - w, y); h.quadraticCurveTo(cx, y - 2, cx + w, y); h.stroke(); } } };
    const crease = (v) => [-3, 3].forEach((o) => { const y = Yv(v) + o; g.strokeStyle = 'rgba(140,66,56,0.3)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(N * 0.3, y); g.quadraticCurveTo(N * 0.5, y + 3, N * 0.7, y); g.stroke(); h.strokeStyle = 'rgba(0,0,0,0.22)'; h.lineWidth = 2; h.stroke(); });
    if (kind === 0) { wrinkles(0.8, 1.0, 5, 34, 0.32); crease(0.05); crease(0.95);
      for (let k = 0; k < 34; k++) { const x = R() < 0.5 ? rnd(0, 34) : rnd(N - 34, N); hair(g, x, Yv(rnd(0.12, 0.6)), -Math.PI / 2 + rnd(-0.3, 0.3), rnd(5, 10), rnd(0.25, 0.5)); } }
    else if (kind === 1) { wrinkles(0, 0.22, 5, 32, 0.34); wrinkles(0.84, 1, 3, 24, 0.24); crease(0.05); crease(0.95); }
    else { wrinkles(0, 0.14, 3, 24, 0.24); crease(0.05);
      for (let k = 0; k < 9; k++) { g.strokeStyle = 'rgba(140,70,60,0.1)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(N * 0.5, Yv(0.62), 10 + k * 4, 14 + k * 5, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); } } // fingerprint
    for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(120,70,55,${rnd(0.03, 0.1)})`; g.fillRect(rnd(0, N), rnd(0, N), 1, 1); }
    return { map: colTex(c), bump: datTex(b) };
  }
  function forearmTex() { // u around (0 = back of the arm), v along
    const N = 512, c = cv(N), b = cv(N), g = skinBase(c, [214, 158, 134], 7), h = flat(b, '#808080');
    blob(g, N * 0.5, N * 0.5, 220, '226,150,128', 0.18); // paler/pinker inner wrist
    for (const x0 of [N * 0.42, N * 0.56]) { const pts = [[x0, N], [x0 + rnd(-14, 14), N * 0.6], [x0 + rnd(-14, 14), N * 0.25], [x0 + rnd(-10, 10), 0]]; stroke(g, pts, 6, 'rgba(85,100,140,0.12)'); stroke(h, pts, 7, 'rgba(255,255,255,0.12)'); }
    for (let k = 0; k < 1700; k++) { // dense dark forearm hair on the back of the arm, sparse underneath
      const u = R(), back = Math.abs(Math.cos(u * Math.PI * 2)); if (R() > 0.18 + 0.82 * Math.pow(back, 0.7) && u > 0.2 && u < 0.8) continue;
      hair(g, u * N, rnd(0, N), -Math.PI / 2 + rnd(-0.5, 0.5) + (u < 0.5 ? 0.25 : -0.25), rnd(7, 15), rnd(0.14, 0.38));
    }
    for (let k = 0; k < 2200; k++) { g.fillStyle = `rgba(120,70,55,${rnd(0.04, 0.1)})`; g.fillRect(rnd(0, N), rnd(0, N), 1.2, 1.2); }
    return { map: colTex(c), bump: datTex(b) };
  }
  function nailTex() {
    const W = 64, H = 96, c = cv(W, H), g = c.getContext('2d');
    g.beginPath(); g.moveTo(5, H); g.lineTo(5, 26); g.quadraticCurveTo(5, 4, 32, 3); g.quadraticCurveTo(59, 4, 59, 26); g.lineTo(59, H); g.closePath(); g.save(); g.clip();
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f1e6dc'); gr.addColorStop(0.13, '#f0e2d8'); gr.addColorStop(0.17, '#e0aea0'); gr.addColorStop(0.75, '#dcab9c'); gr.addColorStop(1, '#e9c6b8');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    blob(g, 32, H + 6, 30, '246,226,218', 0.85); // lunula
    for (let k = 0; k < 9; k++) { g.fillStyle = `rgba(255,255,255,${rnd(0.03, 0.08)})`; g.fillRect(rnd(8, 56), 14, 1.5, H); } // ridges
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(14, 22, 6, H - 34); // highlight
    g.restore(); g.strokeStyle = 'rgba(150,90,75,0.55)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(4, H - 1); g.lineTo(60, H - 1); g.stroke(); // cuticle
    return colTex(c);
  }

  /* ================= jewellery textures ================= */
  function stonePattern(base, light, dark, veins) {
    const c = cv(128), g = flat(c, base);
    for (let k = 0; k < 40; k++) blob(g, rnd(0, 128), rnd(0, 128), rnd(5, 18), light, rnd(0.2, 0.5));
    for (let k = 0; k < 30; k++) blob(g, rnd(0, 128), rnd(0, 128), rnd(3, 12), dark, rnd(0.2, 0.45));
    if (veins) for (let k = 0; k < 6; k++) { g.strokeStyle = veins; g.lineWidth = rnd(0.6, 1.4); g.beginPath(); let x = rnd(0, 128), y = rnd(0, 128); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += rnd(-18, 18); y += rnd(-18, 18); g.lineTo(x, y); } g.stroke(); }
    for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(0,0,0,${rnd(0.03, 0.12)})`; g.fillRect(rnd(0, 128), rnd(0, 128), 1, 1); }
    return c;
  }
  function inlayBandTex() { // coral + turquoise triangles, alternating, set in silver
    const W = 1024, H = 80, c = cv(W, H), m = cv(W, H), g = flat(c, '#d6d6da'), q = flat(m, 'rgb(0,80,255)');
    const tur = g.createPattern(stonePattern('#47ad9b', '120,208,190', '40,128,112', 'rgba(40,60,52,0.45)'), 'repeat');
    const cor = g.createPattern(stonePattern('#c4452f', '226,104,76', '150,46,34', null), 'repeat');
    const n = 11, P = W / n, b = 8, sk = 0.8;
    for (let k = 0; k <= n; k++) { const x = k * P;
      const up = shrink([[x - P / 2, H - b], [x + P / 2, H - b], [x, b]], sk), dn = shrink([[x, b], [x + P, b], [x + P / 2, H - b]], sk);
      poly(g, up, tur); poly(g, dn, cor); poly(q, up, 'rgb(0,110,0)'); poly(q, dn, 'rgb(0,110,0)'); }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 2, W, 2); g.fillRect(0, H - 4, W, 2);
    return { map: colTex(c), mr: datTex(m) };
  }
  function signetTex() { // onyx | mother-of-pearl | onyx, divided by silver
    const W = 256, H = 212, c = cv(W, H), m = cv(W, H), g = flat(c, '#d4d4d8'), q = flat(m, 'rgb(0,70,255)');
    const b = 16, s = 30, cx = W / 2;
    const white = [[b + s + 7, b], [W - b - s - 7, b], [cx, H - b - 9]], left = [[b, b], [b + s - 4, b], [cx - 10, H - b], [b, H - b]], right = left.map(([x, y]) => [W - x, y]);
    const on = g.createLinearGradient(0, 0, W, H); on.addColorStop(0, '#1b1b20'); on.addColorStop(0.45, '#070708'); on.addColorStop(1, '#141418');
    poly(g, left, on); poly(g, right, on);
    const mp = g.createLinearGradient(0, 0, W, H); mp.addColorStop(0, '#f4efe6'); mp.addColorStop(0.4, '#e9eef0'); mp.addColorStop(0.7, '#f3e8ea'); mp.addColorStop(1, '#e8efe6'); poly(g, white, mp);
    g.save(); poly(g, white, 'rgba(0,0,0,0)'); g.clip(); for (let k = 0; k < 10; k++) blob(g, rnd(70, 190), rnd(20, 170), rnd(15, 40), ['255,190,210', '180,230,215', '190,205,255'][k % 3], 0.25); g.restore();
    [left, right, white].forEach((p) => poly(q, p, 'rgb(0,28,0)'));
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 3; g.strokeRect(5, 5, W - 10, H - 10);
    return { map: colTex(c), mr: datTex(m) };
  }
  function engravedTex() { // ornate engraved silver for the horseshoe ring's shield
    const c = cv(128), g = flat(c, '#c9c9cd');
    g.strokeStyle = 'rgba(40,40,46,0.7)'; g.lineWidth = 2; for (let k = -6; k < 12; k++) { g.beginPath(); g.moveTo(k * 14, 128); g.lineTo(k * 14 + 70, 0); g.stroke(); }
    g.lineWidth = 4; g.strokeStyle = 'rgba(30,30,34,0.8)'; g.strokeRect(6, 6, 116, 116);
    for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(0,0,0,${rnd(0.05, 0.2)})`; g.fillRect(rnd(0, 128), rnd(0, 128), 1.5, 1.5); }
    return colTex(c);
  }
  function tigerTex() { // chatoyant golden-brown banding with silky fibres
    const W = 256, H = 128, c = cv(W, H), g = flat(c, '#6a3f16');
    for (let k = 0; k < 22; k++) { const y0 = rnd(-10, H), th = rnd(3, 10), col = ['#c08a34', '#e0ac4c', '#4a2a10', '#9a6422', '#2e1a08', '#d49c40'][k % 6], ph = rnd(0, 6), amp = rnd(4, 10);
      g.fillStyle = col; g.globalAlpha = rnd(0.35, 0.7); g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, y0 + Math.sin((x / W) * 6.2832 * 2 + ph) * amp); for (let x = W; x >= 0; x -= 4) g.lineTo(x, y0 + th + Math.sin((x / W) * 6.2832 * 2 + ph + 0.5) * amp); g.fill(); }
    g.globalAlpha = 1; for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(${R() < 0.55 ? '255,214,130' : '30,14,2'},${rnd(0.04, 0.14)})`; g.fillRect(rnd(0, W), rnd(0, H), 1, rnd(3, 10)); }
    for (let k = 0; k < 6; k++) blob(g, rnd(0, W), rnd(0, H), rnd(12, 28), '255,205,110', 0.22); // the cat's-eye shimmer
    return colTex(c);
  }
  function envTex() { // a dim room to reflect in the silver
    const c = cv(256, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#9a9aa6'); gr.addColorStop(0.42, '#5c5c66'); gr.addColorStop(0.55, '#3a3634'); gr.addColorStop(1, '#1c1a18'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    blob(g, 60, 26, 26, '255,220,170', 0.95); blob(g, 60, 26, 7, '255,250,235', 1); blob(g, 190, 36, 18, '255,200,140', 0.8);
    g.fillStyle = 'rgba(200,215,255,0.8)'; g.fillRect(112, 20, 40, 44); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 50, 256, 3); blob(g, 230, 70, 30, '120,90,60', 0.3);
    const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
    try { const pm = new THREE.PMREMGenerator(TH.renderer); const e = pm.fromEquirectangular(t).texture; pm.dispose(); return e; } catch (e) { return null; }
  }

  /* ================= geometry ================= */
  // grid surface: fn(s, t) → [x, y, z, u, v]; faces are flipped automatically so `chk` vertex's normal agrees with `want`
  function grid(NS, NT, fn, isTop, chk) {
    const pos = [], uv = [];
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NT; j++) { const r = fn(i / NS, j / NT, i, j); pos.push(r[0], r[1], r[2]); uv.push(r[3], r[4]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const A = [], B = [];
    for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) { const a = i * (NT + 1) + j, b = a + NT + 1; (isTop && !isTop(i, j) ? B : A).push(a, b, a + 1, b, b + 1, a + 1); }
    g.setIndex(A.concat(B)); if (isTop) { g.addGroup(0, A.length, 0); g.addGroup(A.length, B.length, 1); }
    g.computeVertexNormals();
    if (chk) { const k = chk[0] * (NT + 1) + chk[1], n = g.attributes.normal; if (n.getX(k) * chk[2][0] + n.getY(k) * chk[2][1] + n.getZ(k) * chk[2][2] < 0) { const ix = g.index.array; for (let q = 0; q < ix.length; q += 3) { const t = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = t; } g.computeVertexNormals(); } }
    return g;
  }
  function handBody() { // wrist (z = .008) → knuckles (z = -.094); back of hand up (+y)
    const NS = 40, NT = 56;
    return grid(NS, NT, (s, t) => {
      const z = 0.008 - s * 0.102, th = t * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      const w = 0.029 + 0.0145 * sstep(0, 0.55, s), T = 0.0125 - 0.0016 * s, Bt = 0.016 - 0.003 * s;
      let cap = 1; if (s > 0.86) { const q = (s - 0.86) / 0.14; cap = Math.sqrt(Math.max(0, 1 - q * q)); }
      const x = w * sp(c, 0.78) * (0.6 + 0.4 * cap); let y;
      if (sn >= 0) {
        y = T * Math.pow(sn, 0.72) * cap - 0.0018 * (x / 0.04) * sn; // back of the hand slopes off toward the pinky edge
        let kb = 0; FX.forEach((f, k) => (kb += [0.0036, 0.004, 0.0035, 0.003][k] * Math.exp(-((x - f) ** 2) / 0.0074 ** 2 - ((z + 0.084) ** 2) / 0.0085 ** 2)));
        y += kb * Math.pow(sn, 1.5);
      } else {
        const d = -sn; y = -Bt * Math.pow(d, 0.72) * cap;
        const then = 0.0075 * Math.exp(-((x + 0.022) ** 2) / 0.012 ** 2 - ((z + 0.028) ** 2) / 0.022 ** 2), hyp = 0.0045 * Math.exp(-((x - 0.025) ** 2) / 0.01 ** 2 - ((z + 0.035) ** 2) / 0.026 ** 2);
        const pads = FX.reduce((a, f) => a + 0.0022 * Math.exp(-((x - f) ** 2) / 0.008 ** 2 - ((z + 0.08) ** 2) / 0.008 ** 2), 0);
        y -= (then + hyp + pads) * Math.pow(d, 1.2) * cap; y += 0.0026 * Math.exp(-(x * x) / 0.012 ** 2 - ((z + 0.05) ** 2) / 0.018 ** 2) * d * d; // palm hollow
      }
      return [x, y, z, x / 0.1 + 0.5, (0.008 - z) / 0.102];
    }, (i, j) => j < NT / 2, [NS / 2, NT / 4, [0, 1, 0]]);
  }
  function forearmGeo() { // elliptical forearm, z -.27 → wrist at -.452 (arm space); u = 0 on the back of the arm
    const NS = 24, NT = 40, z0 = -0.27, z1 = -0.447;
    return grid(NS, NT, (s, t) => {
      const z = z0 + (z1 - z0) * s, q = Math.pow(s, 0.8), th = t * Math.PI * 2, c = Math.cos(th);
      const a = 0.036 - 0.0068 * q, b = c > 0 ? 0.028 - 0.0152 * q : 0.028 - 0.0122 * q;
      return [a * Math.sin(th), b * c, z, t, s * 1.4];
    }, null, [NS / 2, 0, [0, 1, 0]]);
  }
  function fingerSeg(r0, r1, len) { // tapered, slightly oval, swelling at the joints, fleshy underneath
    const g = new THREE.CylinderGeometry(r1, r0, len, 18, 8, true); g.rotateX(-Math.PI / 2); g.translate(0, 0, -len / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = -z / len;
      const sw = 1 + 0.07 * (Math.exp(-((t / 0.14) ** 2)) + Math.exp(-(((1 - t) / 0.14) ** 2))), pad = y < 0 ? 1 + 0.1 * Math.sin(Math.PI * t) : 1;
      p.setXYZ(i, x * sw, y * sw * 0.9 * pad, z); }
    g.computeVertexNormals(); return g;
  }
  function nailGeo(rr, len) {
    const w = rr * 1.5, l = len * 0.56 + rr * 0.42, g = new THREE.PlaneGeometry(w, l, 8, 10); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), tz = (-z + l / 2) / l;
      p.setY(i, -0.5 * rr * (x / (w / 2)) ** 2 - 0.55 * rr * Math.max(0, tz - 0.62) ** 2 / 0.144 + 0.08 * rr * Math.sin(Math.PI * tz)); }
    g.computeVertexNormals(); return { g, l };
  }
  // a ring band: closed rounded profile swept round the finger axis (-z), u=0 on the back of the finger.
  // o: W width, T thickness, Wt/Tt at the top (signet head), Ytop flattens the head, dome rounds the outside
  function ringGeo(R, o) {
    const NA = 64, pw = o.pw || 2, W0 = o.W, T0 = o.T, Wt = o.Wt || W0, Tt = o.Tt || T0, dome = o.dome || 0;
    const prof = (W, T) => { const e = Math.min(W, T) * 0.25; return [[R, -W / 2 + e], [R + e, -W / 2], [R + T - e, -W / 2], [R + T, -W / 2 + e], [R + T + dome, 0], [R + T, W / 2 - e], [R + T - e, W / 2], [R + e, W / 2], [R, W / 2 - e], [R, -W / 2 + e]]; };
    return grid(NA, 9, (s, t, i, j) => {
      const a = s * Math.PI * 2, f = Math.pow(Math.max(0, Math.cos(a)), pw), pr = prof(W0 + (Wt - W0) * f, T0 + (Tt - T0) * f)[j];
      let x = pr[0] * Math.sin(a), y = pr[0] * Math.cos(a); if (o.Ytop && y > o.Ytop) y = o.Ytop;
      return [x, y, pr[1], s, j / 9];
    }, null, [0, 4, [0, 1, 0]]);
  }

  /* ================= the hands ================= */
  const H = (TH.Hands = {
    ready: false, reachT: 0, held: null, heldId: null,

    init() {
      const std = (o) => new THREE.MeshStandardMaterial(o);
      const D = dorsalTex(), Pm = palmTex(), F = [0, 1, 2].map(fingerTex), A = forearmTex(), bs = 0.0011;
      this.env = envTex();
      const skin = (t, r) => std({ map: t.map, bumpMap: t.bump, bumpScale: bs, roughness: r || 0.55, metalness: 0, emissive: 0x3a0e06, emissiveIntensity: 0.1 });
      this.dorsalM = skin(D); this.palmM = skin(Pm, 0.6); this.fingerM = F.map((t) => skin(t)); this.foreM = skin(A, 0.6);
      this.skinM = std({ map: F[1].map, roughness: 0.55, metalness: 0, emissive: 0x3a0e06, emissiveIntensity: 0.1 }); this.skinM.map = F[1].map.clone(); this.skinM.map.repeat.set(0.15, 0.15); this.skinM.map.needsUpdate = true;
      this.nailM = std({ map: nailTex(), alphaTest: 0.5, roughness: 0.28, metalness: 0 });
      const metal = (col, rough, extra) => std(Object.assign({ color: col, metalness: 1, roughness: rough, envMap: this.env, envMapIntensity: 1 }, extra || {}));
      this.silver = metal(0xdedee2, 0.24); this.brushed = metal(0xcfd0d4, 0.4); this.darkSilver = metal(0x3c3c42, 0.5);
      const ib = inlayBandTex(), sg = signetTex();
      this.inlayM = metal(0xffffff, 1, { map: ib.map, metalnessMap: ib.mr, roughnessMap: ib.mr });
      this.signetM = metal(0xffffff, 1, { map: sg.map, metalnessMap: sg.mr, roughnessMap: sg.mr });
      this.engravedM = metal(0xffffff, 0.34, { map: engravedTex() });
      this.tigerM = std({ map: tigerTex(), roughness: 0.14, metalness: 0.1, envMap: this.env, envMapIntensity: 1 });
      this.clearM = metal(0xffffff, 0.02, { emissive: 0x2a2a32, flatShading: true });
      this.sapphM = std({ color: 0x1d3fb0, metalness: 0.55, roughness: 0.06, envMap: this.env, envMapIntensity: 1, emissive: 0x060c34 });
      this.jewels = [this.silver, this.brushed, this.darkSilver, this.inlayM, this.signetM, this.engravedM, this.tigerM, this.clearM, this.sapphM];
      this.sleeveM = std({ map: this.sleeveTex(), roughness: 0.95, metalness: 0 });
      this.geo = { body: handBody(), fore: forearmGeo() };
      this.scene = new THREE.Scene();
      this.cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 5);
      this.hemi = new THREE.HemisphereLight(0xfff0dc, 0x2a2018, 0.6); this.scene.add(this.hemi);
      this.key = new THREE.DirectionalLight(0xffe0b8, 0.6); this.key.position.set(0.3, 1, 0.4); this.scene.add(this.key);
      this.rim = new THREE.DirectionalLight(0x8090b0, 0.25); this.rim.position.set(-0.6, 0.2, -1); this.scene.add(this.rim);
      this.right = this.buildArm(1); this.left = this.buildArm(-1);
      this.scene.add(this.right.root, this.left.root);
      this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.userData.noPBR = true)); });
      TH.Linear.fix(this.scene);
      addEventListener('resize', () => { this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); });
      TH.Bus.on('inv', () => this.setHeld(TH.Inventory.heldId()));
      this.ready = true;
    },

    sleeveTex() {
      const c = cv(128), h = flat(c, '#2b2f36'); for (let y = 0; y < 128; y += 2) { h.fillStyle = `rgba(255,255,255,${0.02 + R() * 0.03})`; h.fillRect(0, y, 128, 1); }
      for (let k = 0; k < 8; k++) blob(h, rnd(0, 128), rnd(0, 128), rnd(10, 30), '90,70,40', 0.3);
      const t = colTex(c); t.repeat.set(3, 3); return t;
    },

    buildArm(side) {
      const root = new THREE.Group(), arm = new THREE.Group(); root.add(arm);
      const add = (p, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); p.add(o); return o; };
      // hoodie sleeve, pushed up the forearm and bunched
      add(arm, new THREE.CylinderGeometry(0.047, 0.052, 0.36, 14, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.06), this.sleeveM);
      [-0.118, -0.14].forEach((z, i) => add(arm, new THREE.TorusGeometry(0.046 - i * 0.003, 0.009, 8, 20), this.sleeveM, 0, 0, z));
      // forearm + wrist jewellery turn with the hand
      const fore = new THREE.Group(); arm.add(fore);
      add(fore, this.geo.fore, this.foreM);
      const hand = new THREE.Group(); hand.position.set(0, 0, -0.44); arm.add(hand);
      hand.scale.x = side; // mirror the left hand
      add(hand, this.geo.body, [this.dorsalM, this.palmM]);
      const fingers = [], defs = [[-0.026, [0.049, 0.029, 0.022], 0.0083, -0.004], [-0.0085, [0.054, 0.033, 0.023], 0.0087, -0.007], [0.0095, [0.051, 0.031, 0.022], 0.0081, -0.005], [0.026, [0.04, 0.024, 0.02], 0.007, 0.0]];
      defs.forEach(([x, lens, r, dz]) => fingers.push(this.finger(hand, x, -0.086 + dz, lens, r)));
      // thumb: angled out from the side of the palm, with the meaty web to the index finger
      const tb = new THREE.Group(); tb.position.set(-0.03, -0.006, -0.02); tb.rotation.set(-0.25, 0.62, -0.75); hand.add(tb);
      add(tb, new THREE.SphereGeometry(1, 18, 12), this.skinM, 0.004, 0.002, -0.012).scale.set(0.0135, 0.012, 0.025);
      const thumb = this.finger(tb, 0, -0.028, [0.034, 0.029], 0.0112, true);
      const grip = new THREE.Group(); grip.position.set(0.0, -0.03, -0.088); hand.add(grip); // where a held item sits
      if (side > 0) {
        this.triRing(this.ringOn(fingers[0], 0.34)); this.signet(this.ringOn(fingers[1], 0.32)); this.horseshoe(this.ringOn(fingers[2], 0.34));
        this.tigerBracelet(fore, -0.416);
      } else {
        this.inlayRing(this.ringOn(fingers[0], 0.36));
        this.tennisBracelet(fore, -0.418);
      }
      root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      return { root, arm, fore, hand, fingers, thumb, grip, side, curl: 0.35, spread: 0 };
    },

    finger(parent, x, z, lens, r, isThumb) {
      const joints = []; let p = new THREE.Group(); p.position.set(x, 0.002, z); parent.add(p); let rr = r;
      lens.forEach((len, i) => {
        if (i > 0) { const j = new THREE.Group(); j.position.z = -lens[i - 1]; p.add(j); p = j; }
        joints.push(p);
        const kind = isThumb ? (i ? 2 : 0) : i;
        p.add(new THREE.Mesh(fingerSeg(rr, rr * 0.9, len), this.fingerM[kind]));
        const ball = new THREE.Mesh(new THREE.SphereGeometry(rr * 1.06, 16, 12), this.fingerM[kind]); ball.scale.y = 0.9; ball.rotation.x = Math.PI / 2; p.add(ball);
        if (i === lens.length - 1) {
          const re = rr * 0.9, tip = new THREE.Mesh(new THREE.SphereGeometry(re, 16, 12), this.fingerM[2]); tip.position.z = -len; tip.scale.set(1.02, 0.86, 1.3); p.add(tip);
          const n = nailGeo(re * (isThumb ? 1.08 : 1), len), nail = new THREE.Mesh(n.g, this.nailM);
          nail.position.set(0, re * 0.93 + 0.0003, -len + n.l / 2 - re * 0.5); p.add(nail);
        }
        rr *= 0.9;
      });
      return { joints, isThumb, r, lens };
    },

    /* ---------- jewellery ---------- */
    ringOn(f, frac) { // a ring group sitting `frac` of the way up the first finger bone
      const g = new THREE.Group(); g.position.z = -f.lens[0] * frac; g.scale.y = 0.94; f.joints[0].add(g);
      g.userData.R = f.r * (1 - 0.1 * frac) * 1.06; return g;
    },
    flatShape(pts, holes) { const s = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1]))); (holes || []).forEach((h) => s.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1]))))); return s; },
    layOnTop(geo, y) { geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0); return geo; }, // shape XY → lies on the back of the finger, shape +y toward the fingertip
    inlayRing(g) { // left index: coral + turquoise triangle band
      const R = g.userData.R, T = 0.0011, W = 0.0068;
      g.add(new THREE.Mesh(ringGeo(R, { W, T }), this.silver));
      const face = new THREE.CylinderGeometry(R + T + 0.00012, R + T + 0.00012, W * 0.8, 64, 1, true); face.rotateX(-Math.PI / 2);
      g.add(new THREE.Mesh(face, this.inlayM));
    },
    triRing(g) { // right index: wide brushed band, open-triangle cut-out with a slashing bar
      const R = g.userData.R, T = 0.0014, top = R + 0.0027;
      g.add(new THREE.Mesh(ringGeo(R, { W: 0.0094, T, Wt: 0.0102, Tt: 0.0042, Ytop: top, pw: 2 }), this.brushed));
      const mm = (a) => a.map(([x, y]) => [x * 0.001, y * 0.001]);
      const outer = mm([[-4.3, -3.4], [4.3, -3.4], [0, 4.4]]), inner = mm([[-2.0, -2.0], [2.0, -2.0], [0, 2.1]]);
      g.add(new THREE.Mesh(this.layOnTop(new THREE.ShapeGeometry(this.flatShape(outer)), top + 0.00004), this.darkSilver));
      const ex = { depth: 0.0007, bevelEnabled: true, bevelThickness: 0.0002, bevelSize: 0.00015, bevelSegments: 2 };
      g.add(new THREE.Mesh(this.layOnTop(new THREE.ExtrudeGeometry(this.flatShape(outer, [inner]), ex), top), this.silver));
      g.add(new THREE.Mesh(this.layOnTop(new THREE.ExtrudeGeometry(this.flatShape(mm([[-5.2, 0.4], [-4.3, 1.3], [0.9, -4.0], [0.0, -4.9]])), ex), top + 0.0001), this.silver));
    },
    signet(g) { // right middle: chunky signet, onyx | mother-of-pearl | onyx, ridged shoulders
      const R = g.userData.R, top = R + 0.0034;
      g.add(new THREE.Mesh(ringGeo(R, { W: 0.006, T: 0.0013, Wt: 0.0106, Tt: 0.006, Ytop: top, pw: 2 }), this.silver));
      const PW = 0.0122, PL = 0.0102, ch = 0.0018;
      const geo = new THREE.ShapeGeometry(this.flatShape([[-PW / 2 + ch, -PL / 2], [PW / 2 - ch, -PL / 2], [PW / 2, -PL / 2 + ch], [PW / 2, PL / 2 - ch], [PW / 2 - ch, PL / 2], [-PW / 2 + ch, PL / 2], [-PW / 2, PL / 2 - ch], [-PW / 2, -PL / 2 + ch]]));
      this.layOnTop(geo, top + 0.00005);
      const m = this.signetM; m.map.repeat.set(1 / PW, 1 / PL); m.map.offset.set(0.5, 0.5); m.metalnessMap.repeat.copy(m.map.repeat); m.metalnessMap.offset.copy(m.map.offset);
      g.add(new THREE.Mesh(geo, m));
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { // grooved shoulders
        const a = sx * (0.62 + k * 0.13), rib = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.0006, 0.0056 - k * 0.0006), this.silver);
        rib.position.set(Math.sin(a) * (R + 0.0021 - k * 0.0003), Math.cos(a) * (R + 0.0021 - k * 0.0003), 0); rib.rotation.z = -a; g.add(rib); }
    },
    horseshoe(g) { // right ring finger: horseshoe of knuckled segments on an engraved shield
      const R = g.userData.R, top = R + 0.0023;
      g.add(new THREE.Mesh(ringGeo(R, { W: 0.0042, T: 0.0012, Wt: 0.0086, Tt: 0.0034, Ytop: top, pw: 3 }), this.silver));
      const sh = new THREE.ShapeGeometry(this.flatShape([[-0.0046, 0.0028], [0.0046, 0.0028], [0.0048, -0.0016], [0, -0.0058], [-0.0048, -0.0016]]));
      this.layOnTop(sh, top + 0.00005); const em = this.engravedM; em.map.repeat.set(1 / 0.0096, 1 / 0.0096); em.map.offset.set(0.5, 0.5);
      g.add(new THREE.Mesh(sh, em));
      const n = 9, seg = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), this.silver, n), nub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), this.silver, n * 2);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), open = Math.atan2(0.7, 0.7), rad = 0.0036;
      for (let k = 0; k < n; k++) {
        const a = open + 0.75 + (k / (n - 1)) * (Math.PI * 2 - 1.5), x = Math.cos(a) * rad, z = -Math.sin(a) * rad - 0.0004, y = top + 0.0011;
        Q.setFromAxisAngle(V.set(0, 1, 0), a); S.set(0.00105, 0.0012, 0.0019); M.compose(V.set(x, y, z), Q, S); seg.setMatrixAt(k, M);
        for (let s2 = 0; s2 < 2; s2++) { const rr = rad + (s2 ? 0.0012 : -0.0012); S.setScalar(0.00045); M.compose(V.set(Math.cos(a) * rr, y + 0.0005, -Math.sin(a) * rr - 0.0004), Q, S); nub.setMatrixAt(k * 2 + s2, M); }
      }
      g.add(seg, nub);
    },
    // place instances evenly (by arc length) round an ellipse in the wrist plane; local +y faces out
    aroundWrist(meshes, a, b, z, count, each) {
      const P = [], L = [0]; for (let i = 0; i <= 720; i++) { const t = (i / 720) * Math.PI * 2; P.push([a * Math.sin(t), b * Math.cos(t), t]); if (i) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); }
      const tot = L[720], M = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(); let j = 0;
      for (let k = 0; k < count; k++) { const want = (k / count) * tot; while (L[j + 1] < want) j++; const t = P[j][2];
        Y.set(Math.sin(t) / a, Math.cos(t) / b, 0).normalize(); X.set(Math.cos(t) * a, -Math.sin(t) * b, 0).normalize(); Z.crossVectors(X, Y);
        M.makeBasis(X, Y, Z).setPosition(a * Math.sin(t), b * Math.cos(t), z); each(k, M, t); }
    },
    tigerBracelet(fore, z) { // 10 mm tiger's-eye beads + one ornate silver bead
      const n = 19, g = new THREE.Group(); g.rotation.x = 0.08; g.position.set(0, -0.0018, z); fore.add(g); z = 0;
      const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0046, 18, 14), this.tigerM, n), M2 = new THREE.Matrix4(), rot = new THREE.Matrix4();
      let silverAt = null;
      this.aroundWrist(null, 0.0356, 0.0215, z, n + 1, (k, M) => {
        if (k === 3) { silverAt = M.clone(); return; }
        rot.makeRotationFromEuler(new THREE.Euler(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28))); M2.multiplyMatrices(M, rot); beads.setMatrixAt(k > 3 ? k - 1 : k, M2);
      });
      g.add(beads);
      const sb = new THREE.Group(); sb.applyMatrix4(silverAt); g.add(sb);
      const orn = new THREE.SphereGeometry(0.0047, 16, 12), p = orn.attributes.position; // embossed, lumpy silver bead
      for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i), k = 1 + 0.09 * Math.sin(v.x * 2600) * Math.sin(v.y * 2300 + 1) * Math.sin(v.z * 2900 + 2); p.setXYZ(i, v.x * k, v.y * k * 0.92, v.z * k); }
      orn.computeVertexNormals(); sb.add(new THREE.Mesh(orn, this.silver));
      [-1, 1].forEach((s) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, 0.0011, 16), this.silver); d.rotation.z = Math.PI / 2; d.position.x = s * 0.0052; sb.add(d); });
    },
    tennisBracelet(fore, z) { // silver links, a blue sapphire then three clear stones, round and round
      const n = 42, g = new THREE.Group(); g.rotation.x = 0.06; g.position.set(0, -0.004, z); fore.add(g); z = 0;
      const nS = Math.ceil(n / 4), set = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0036, 0.0016, 0.0032), this.silver, n);
      const sap = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 1), this.sapphM, nS), clr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 1, 0.6, 8, 1), this.clearM, n - nS);
      const S = new THREE.Matrix4(); let a = 0, b = 0;
      this.aroundWrist(null, 0.0325, 0.02, z, n, (k, M) => {
        set.setMatrixAt(k, M);
        const blue = k % 4 === 0; S.makeScale(blue ? 0.0019 : 0.0016, blue ? 0.0011 : 0.0012, blue ? 0.0016 : 0.0016).setPosition(0, blue ? 0.0011 : 0.0012, 0);
        const m = M.clone().multiply(S); if (blue) sap.setMatrixAt(a++, m); else clr.setMatrixAt(b++, m);
      });
      g.add(set, sap, clr);
    },

    setHeld(id) {
      if (!this.ready || id === this.heldId) return;
      if (this.held) this.right.grip.remove(this.held);
      this.heldId = id; this.held = null;
      if (!id) return;
      const m = TH.Items.buildMesh(id);
      m.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.userData.noPBR = true; o.frustumCulled = false; } });
      // how each item sits in the fist
      // [x, y, z, rotX, rotY, rotZ, scale] — items lie across the fist; the business end sticks out the thumb side
      const P = Math.PI, pose = {
        front_key: [0.04, 0, 0, 0, P, 0, 1], padlock_key: [0.04, 0, 0, 0, P, 0, 1], rusty_key: [0.04, 0, 0, 0, P, 0, 1],
        screwdriver: [0.02, 0, 0, 0, P, 0, 1], wire_cutters: [-0.1, 0, 0, 0, P, 0, 1],
        pan: [0.19, 0, 0, -0.5, P, 0, 0.8], bottle: [0.07, 0, 0, 0, 0, P / 2, 0.85],
        crowbar: [-0.02, 0, 0, P / 2, P, 0, 1], gas_can: [0.0, -0.33, 0.0, 0, 0, P / 2, 1], spark_plug: [0.005, 0, 0, 0, P, 0, 1.6], car_keys: [0.03, 0, 0, P / 2, P, 0, 1.2],
        slingshot: [0.0, 0, 0, 0, P, 0, 1.1], taser: [0.02, 0, 0, 0, P, 0, 1.1], taser_body: [0.02, 0, 0, 0, P, 0, 1.1], taser_battery: [0.02, 0, 0, 0, P, 0, 1.2],
      }[id] || [0, 0, 0, 0, 0, 0, 1];
      m.position.set(pose[0], pose[1], pose[2]); m.rotation.set(pose[3], pose[4], pose[5]); m.scale.setScalar(pose[6]);
      this.right.grip.add(m); this.held = m; TH.Linear.fix(m);
    },

    poseArm(a, curl, spread, thumbCurl, dt) {
      a.curl = U.damp(a.curl, curl, 14, dt); a.spread = U.damp(a.spread, spread, 14, dt);
      a.fingers.forEach((f, i) => f.joints.forEach((j, k) => { j.rotation.x = -a.curl * [1.0, 1.35, 0.7][k] * (1 + i * 0.04); if (k === 0) j.rotation.y = (i - 1.5) * a.spread * 0.12; }));
      a.thumb.joints.forEach((j, k) => (j.rotation.x = -thumbCurl * (k ? 0.9 : 0.6)));
      a.fore.rotation.z = a.hand.rotation.z * 0.85; // the forearm twists with the hand
    },

    update(dt, t) {
      if (!this.ready) return;
      const P = TH.Player, st = TH.state, show = st.mode === 'play' && !st.hidden && !st.caught && !st.cinematic && !(st.travel && st.travel.end.hideHands) && P.active;
      this.right.root.visible = this.left.root.visible = show;
      if (!show) return;
      const I = TH.Input;
      if (I.hit('KeyE') || I.hit('Interact')) this.reachT = 0.45;
      const holding = TH.Interact.holding && TH.Interact.progress > 0; // long actions keep the hand out
      this.reachT = Math.max(holding ? 0.2 : 0, this.reachT - dt);
      const reach = this.reachT > 0 ? 1 : 0;
      this._reach = U.damp(this._reach || 0, reach, 10, dt);
      const bob = P.bob, ba = Math.min(1, P.speed / 4), run = P.sprinting ? 1 : 0, crouch = P.crouch ? 1 : 0;
      const sx = U.clamp(-(I.look.dx || 0) * 0.0006, -0.03, 0.03), sy = U.clamp((I.look.dy || 0) * 0.0006, -0.03, 0.03);
      this._sx = U.damp(this._sx || 0, sx, 8, dt); this._sy = U.damp(this._sy || 0, sy, 8, dt);
      const Rr = this.right, L = this.left, k = this._reach;
      // right arm: holds items, reaches for things
      Rr.root.position.set(0.17 + this._sx - k * 0.05 + Math.sin(bob) * 0.012 * ba, -0.15 + this._sy + k * 0.04 - Math.abs(Math.cos(bob)) * 0.014 * ba - crouch * 0.02 + Math.sin(bob * 2) * 0.012 * run, 0.02 - k * 0.04 + Math.sin(bob) * 0.03 * run);
      Rr.root.rotation.set(0.04 + k * 0.1 + (this.held ? 0.06 : 0) + Math.sin(bob) * 0.08 * run, 0.1 + k * 0.03, 0);
      Rr.hand.rotation.set((this.held ? -0.1 : 0.14) - k * 0.1, 0.12, this.held ? -0.8 : -0.3 + k * 0.15);
      // left arm: relaxed, swings with your stride
      L.root.position.set(-0.18 + this._sx - Math.sin(bob) * 0.012 * ba, -0.16 + this._sy - Math.abs(Math.sin(bob)) * 0.016 * ba - crouch * 0.02 - Math.sin(bob * 2) * 0.012 * run, 0.04 - Math.sin(bob) * 0.03 * run);
      L.root.rotation.set(0.03 - Math.sin(bob) * 0.1 * run, -0.12, 0); L.hand.rotation.set(0.14, -0.12, 0.3);
      const breathe = Math.sin(t * 1.4) * 0.03;
      this.poseArm(Rr, this.held ? 1.02 : k > 0.5 ? 0.12 : 0.3 + breathe, this.held ? 0 : k > 0.5 ? 0.6 : 0.2, this.held ? 1.1 : k > 0.5 ? 0.1 : 0.35, dt);
      this.poseArm(L, 0.32 + breathe, 0.25, 0.3, dt);
      // light the hands like the room you're standing in
      const cp = TH.camera.position; let lux = 0;
      TH.Lights.pool.forEach((l) => { const d = l.position.distanceTo(cp); lux += l.intensity / (1 + d * d * 0.12); });
      lux = U.clamp(lux * 0.55 + 0.08, 0.06, 1.3); this._lux = U.damp(this._lux || lux, lux, 4, dt);
      this.hemi.intensity = 0.32 * this._lux; this.key.intensity = 0.5 * this._lux; this.rim.intensity = 0.28 * this._lux;
      const ei = 0.25 + 1.1 * this._lux; this.jewels.forEach((m) => (m.envMapIntensity = ei));
      // keep the key light pointing from the nearest bulb (in camera space)
      const l0 = TH.Lights.pool[0];
      if (l0) { const v = l0.position.clone(); TH.camera.worldToLocal(v); v.normalize(); this.key.position.set(v.x, Math.max(0.3, v.y), v.z); }
      if (!this.scene.environment && TH.scene.environment) this.scene.environment = TH.scene.environment;
    },
  });
})();
