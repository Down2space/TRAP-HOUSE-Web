/* TRAP HOUSE — the house. A big two-storey Victorian (32 x 24 m), 32 rooms, two staircases, a basement, and three
   trees that came down through the roof in a storm. Moonlight falls through the holes; candles and a few dying bulbs do the rest.
   All layout data lives here: rooms, walls, doors, hiding spots, item spawn points, frames, vents and the enemy's nav graph.
   Coordinates: x = west(-)/east(+), z = back(-)/front(+). Front door at z = +12. Level 1 sits H metres up. */
(function () {
  'use strict';
  const TH = window.TH;
  const H = 3.4, T = 0.2; // floor height, wall thickness

  const Hs = (TH.House = {
    H, rooms: [], hideSpots: [], spawnPoints: [], frames: [], vents: [], creaks: [], fixtures: [], cabinets: [], nav: { nodes: {}, edges: [] },
    X0: -16, X1: 16, Z0: -12, Z1: 12,
    playerSpawn: { x: 11.2, z: -7.6, level: 1, yaw: Math.PI / 2 },
    enemySpawns: [{ x: -12.5, z: -7.5, level: 0 }, { x: 12, z: -8, level: 0 }, { x: 7, z: 6.5, level: 0 }, { x: -13, z: -1.5, level: 0 }, { x: 0.5, z: 1, level: 0 },
      { x: -6.5, z: 8, level: 0 }, { x: -6, z: -8, level: -1 }, { x: 3, z: -8.5, level: -1 }, { x: 11, z: -22, level: 0 }, { x: 17.2, z: -10.8, level: 0 }, { x: -12, z: -0.5, level: 1 }, { x: -1.5, z: 9, level: 1 }],
  });

  let scene, mats = {};
  const HI = () => TH.settings.quality !== 'low';
  // bump maps reuse the colour texture: dark grooves (grout, board gaps, cracks) read as recessed
  function phong(tex, color, bump, shin, spec) { return new THREE.MeshPhongMaterial({ map: tex || null, color: color || 0xffffff, shininess: shin || 3, specular: spec || 0x111111, bumpMap: HI() && bump ? tex : null, bumpScale: bump || 0 }); }
  // Per-pixel shading everywhere: lights from bulbs fall off smoothly across big flat furniture faces.
  function lam(color) { const k = 'l' + color; if (!mats[k]) mats[k] = new THREE.MeshPhongMaterial({ color, shininess: 10, specular: 0x161410 }); return mats[k]; }
  function isWoodish(c) { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return r > g && g >= b && r - b > 22 && r < 150; }
  function woodMat(color) {
    const k = 'w' + color; if (mats[k]) return mats[k];
    const c = new THREE.Color(color); c.r = Math.min(1, c.r * 1.45 + 0.03); c.g = Math.min(1, c.g * 1.45 + 0.02); c.b = Math.min(1, c.b * 1.45 + 0.02);
    return (mats[k] = new THREE.MeshPhongMaterial({ map: TH.Tex.wood, color: c, shininess: 26, specular: 0x2a2018, bumpMap: HI() ? TH.Tex.wood : null, bumpScale: 0.006 }));
  }
  function fabricMat(color) { const k = 'f' + color; if (!mats[k]) { const c = new THREE.Color(color); c.multiplyScalar(1.6); mats[k] = new THREE.MeshPhongMaterial({ map: TH.Tex.fabric, color: c, shininess: 2, specular: 0x000000, bumpMap: HI() ? TH.Tex.fabric : null, bumpScale: 0.012 }); } return mats[k]; }
  function solidMat(color) { return isWoodish(color) ? woodMat(color) : lam(color); }
  Hs.lam = lam;
  const yOf = (level) => level * H;

  // shared materials: one per look, so static batching can merge everything that wears it into a single draw call
  function std(key, o) { mats['s' + key] = mats['s' + key] || new THREE.MeshStandardMaterial(o); return mats['s' + key]; }
  Hs.std = std;
  function addMesh(geo, mat, x, y, z, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || scene).add(m); return m; }

  /* ---------- walls ---------- */
  // wall along X at constant z, from x0..x1. gaps: [{ c, w, door, arch }]
  function wallX(level, z, x0, x1, mat, gaps, ext) { wallRun(level, 'x', z, x0, x1, mat, (gaps || []).concat(winGaps(level, 'x', z)), ext); }
  function wallZ(level, x, z0, z1, mat, gaps, ext) { wallRun(level, 'z', x, z0, z1, mat, (gaps || []).concat(winGaps(level, 'z', x)), ext); }
  // windows registered for this wall line become openings in it
  function winGaps(level, axis, k) { return (Hs.WINDOWS || []).filter((w) => w.level === level && w.axis === axis && Math.abs(w.k - k) < 0.01).map((w) => ({ c: w.c, w: w.w + 0.06, win: [w.y - w.h / 2 - 0.03, w.y + w.h / 2 + 0.03] })); }
  // which wallpaper each room gets (tiled and exterior walls keep their own material)
  const PAPER = { foyer: 'wallDeco', ghall: 'wallStripe', bhall: 'wallStripe', music: 'wallBlue', parlor: 'wallFloral', library: 'wallGreen', dining: 'wallRed',
    kitchen: 'wallYellow', sstairs: 'wallPlaster', living: 'wallPlaid', sunroom: 'wallGreen', den: 'wallYellow', bath: 'tile', pantry: 'wallPlaster', mudroom: 'wallPeel', laundry: 'wallPeel',
    uhall: 'wallGreen', master: 'wallFloral', mbath: 'tile', wic: 'wallYellow', nursery: 'wallBlue', sewing: 'wallFloral', kids: 'wallStripe', ubath: 'tile', blanding: 'wallStripe',
    office: 'wallPlaid', guest: 'wallRed', ubath2: 'tile', spare: 'wallStripe', linen: 'wallYellow', backbed: 'wallBlue' };
  const paperMats = {};
  function paperFor(level, axis, k, c, side, fallback) {
    if (!Hs.mats || !Hs.mats.W || ![Hs.mats.W.red, Hs.mats.W.green, Hs.mats.W.yellow].includes(fallback)) return fallback;
    const x = axis === 'x' ? c : k + side * 0.3, z = axis === 'x' ? k + side * 0.3 : c;
    const r = (Hs.rooms || []).find((q) => q.level === level && x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
    const key = r && PAPER[r.id]; if (key === 'tile') return Hs.mats.W.tile; if (!key || !TH.Tex[key]) return fallback;
    return paperMats[key] || (paperMats[key] = phong(TH.Tex[key], 0, 0.012, 4));
  }
  function wallRun(level, axis, k, a0, a1, mat, gaps, ext) {
    const y0 = yOf(level), hh = H - 0.02;
    gaps = gaps.slice().sort((p, q) => p.c - q.c);
    (Hs.walls = Hs.walls || []).push({ level, axis, k, a0, a1, gaps });
    let cur = a0;
    // split a run of wall wherever the room on either side changes, so each stretch wears the right paper
    const seg = (s0, s1, yb, yt) => {
      if (s1 - s0 <= 0.01 || yt - yb <= 0.01) return;
      const cuts = new Set(); (Hs.rooms || []).forEach((r) => { if (r.level !== level) return; const [r0, r1, q0, q1] = axis === 'x' ? [r.x0, r.x1, r.z0, r.z1] : [r.z0, r.z1, r.x0, r.x1]; if (k < q0 - 0.35 || k > q1 + 0.35) return; [r0, r1].forEach((c) => { if (c > s0 + 0.05 && c < s1 - 0.05) cuts.add(c); }); });
      const pts = [s0, ...[...cuts].sort((p, q) => p - q), s1];
      if (pts.length > 2) { for (let i = 0; i < pts.length - 1; i++) seg1(pts[i], pts[i + 1], yb, yt); if (yb < 0.1) { if (axis === 'x') TH.Col.addRect(level, (s0 + s1) / 2, k, s1 - s0, T); else TH.Col.addRect(level, k, (s0 + s1) / 2, T, s1 - s0); } return; }
      seg1(s0, s1, yb, yt, true);
    };
    const seg1 = (s0, s1, yb, yt, col) => {
      const len = s1 - s0; if (len <= 0.01 || yt - yb <= 0.01) return;
      const h = yt - yb, c = (s0 + s1) / 2;
      // each face of the wall wears the paper of the room it faces (one wall line can be two different rooms)
      const pp = paperFor(level, axis, k, c, 1, mat), pn = paperFor(level, axis, k, c, -1, mat);
      if (pp === pn) {
        const geo = TH.Tex.shiftUV(TH.Tex.boxUV(axis === 'x' ? new THREE.BoxGeometry(len, h, T) : new THREE.BoxGeometry(T, h, len), axis === 'x' ? len : T, h, axis === 'x' ? T : len, 1.3), (s0 + k * 0.37) / 1.3, (y0 + yb) / 1.3);
        if (axis === 'x') addMesh(geo, pp, c, y0 + yb + h / 2, k); else addMesh(geo, pp, k, y0 + yb + h / 2, c);
      } else [[pp, 1], [pn, -1]].forEach(([m, sd]) => {
        const t2 = T / 2, geo = TH.Tex.shiftUV(TH.Tex.boxUV(axis === 'x' ? new THREE.BoxGeometry(len, h, t2) : new THREE.BoxGeometry(t2, h, len), axis === 'x' ? len : t2, h, axis === 'x' ? t2 : len, 1.3), (s0 + k * 0.37) / 1.3, (y0 + yb) / 1.3);
        if (axis === 'x') addMesh(geo, m, c, y0 + yb + h / 2, k + sd * t2 / 2); else addMesh(geo, m, k + sd * t2 / 2, y0 + yb + h / 2, c);
      });
      if (col && yb < 0.1) { if (axis === 'x') TH.Col.addRect(level, c, k, len, T); else TH.Col.addRect(level, k, c, T, len); }
    };
    // exterior skin: weathered siding on the outside face, with the same openings
    const skin = (s0, s1, yb, yt) => {
      if (!ext) return; const len = s1 - s0; if (len <= 0.01 || yt - yb <= 0.01) return; const h = yt - yb, c = (s0 + s1) / 2, off = k + ext * (T / 2 + 0.025);
      const geo = TH.Tex.shiftUV(TH.Tex.boxUV(axis === 'x' ? new THREE.BoxGeometry(len, h, 0.05) : new THREE.BoxGeometry(0.05, h, len), axis === 'x' ? len : 0.05, h, axis === 'x' ? 0.05 : len, 2.5), (s0 + k * 0.37) / 2.5, 0);
      if (axis === 'x') addMesh(geo, Hs.mats.W.siding, c, y0 + yb + h / 2, off); else addMesh(geo, Hs.mats.W.siding, off, y0 + yb + h / 2, c);
    };
    const full = (s0, s1, yb, yt) => { seg(s0, s1, yb, yt); skin(s0, s1, yb, yt === hh ? H : yt); };
    gaps.forEach((g) => {
      const g0 = g.c - g.w / 2, g1 = g.c + g.w / 2;
      full(cur, g0, 0, hh); cur = g1;
      if (g.win) { // window or crawl hole: wall below and above the opening
        full(g0, g1, 0, g.win[0]); full(g0, g1, g.win[1], hh);
        if (g.crawl) { if (axis === 'x') TH.Col.addRect(level, g.c, k, g.w, T, false); else TH.Col.addRect(level, k, g.c, T, g.w, false); }
        return;
      }
      full(g0, g1, 2.2, hh);
      const dx = axis === 'x' ? g.c : k, dz = axis === 'x' ? k : g.c;
      if (g.door) TH.Doors.create(Object.assign({ x: dx, z: dz, level, axis, w: g.w }, g.door));
      // frame trim around the opening
      const trim = TH.Tex.trim(false), head = TH.Tex.trim(true); // painted white, one solid board per side, grain running up the sides and along the head
      // (the head sits right on top of the opening; outside walls get a second set of casings over the siding so the frame isn't swallowed by it)
      const casing = (dep, off) => {
        if (axis === 'x') { addMesh(new THREE.BoxGeometry(0.1, 2.3, dep), trim, g0, y0 + 1.15, k + off); addMesh(new THREE.BoxGeometry(0.1, 2.3, dep), trim, g1, y0 + 1.15, k + off); addMesh(new THREE.BoxGeometry(g.w + 0.2, 0.1, dep), head, g.c, y0 + 2.25, k + off); }
        else { addMesh(new THREE.BoxGeometry(dep, 2.3, 0.1), trim, k + off, y0 + 1.15, g0); addMesh(new THREE.BoxGeometry(dep, 2.3, 0.1), trim, k + off, y0 + 1.15, g1); addMesh(new THREE.BoxGeometry(dep, 0.1, g.w + 0.2), head, k + off, y0 + 2.25, g.c); }
      };
      casing(T + 0.06, 0); if (ext) casing(0.04, ext * (T / 2 + 0.07));
    });
    full(cur, a1, 0, hh);
  }

  /* ---------- floors / ceilings ---------- */
  // a rectangle minus axis-aligned holes, cut into strips
  function subtract(r, holes) {
    const hs = holes.map((h) => ({ x0: Math.max(r.x0, h.x0), x1: Math.min(r.x1, h.x1), z0: Math.max(r.z0, h.z0), z1: Math.min(r.z1, h.z1) })).filter((h) => h.x1 - h.x0 > 0.01 && h.z1 - h.z0 > 0.01);
    if (!hs.length) return [r];
    const xs = [...new Set([r.x0, r.x1].concat(...hs.map((h) => [h.x0, h.x1])))].sort((a, b) => a - b), out = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1]; if (xb - xa < 0.01) continue;
      const iv = hs.filter((h) => h.x0 <= xa + 1e-6 && h.x1 >= xb - 1e-6).map((h) => [h.z0, h.z1]).sort((a, b) => a[0] - b[0]);
      let z = r.z0; iv.forEach(([a, b]) => { if (a - z > 0.01) out.push({ x0: xa, x1: xb, z0: z, z1: a }); z = Math.max(z, b); }); if (r.z1 - z > 0.01) out.push({ x0: xa, x1: xb, z0: z, z1: r.z1 });
    }
    return out;
  }
  function plane(x0, x1, z0, z1, y, mat, down, s) {
    const w = x1 - x0, d = z1 - z0, g = new THREE.PlaneGeometry(w, d), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * w) / s, (uv.getY(i) * d - z1) / s);
    const m = addMesh(g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2); m.rotation.x = down ? Math.PI / 2 : -Math.PI / 2; return m;
  }
  // a jagged hole punched through a floor or ceiling: the patch fills the hole's bounding box, minus a ragged opening
  function holePatch(h, y, mat, down, s) {
    const sg = down ? 1 : -1, sh = new THREE.Shape(), x0 = h.x - h.w / 2, x1 = h.x + h.w / 2, z0 = h.z - h.d / 2, z1 = h.z + h.d / 2;
    sh.moveTo(x0, sg * z0); sh.lineTo(x1, sg * z0); sh.lineTo(x1, sg * z1); sh.lineTo(x0, sg * z1); sh.lineTo(x0, sg * z0);
    const p = new THREE.Path(), n = 13, seed = h.seed || 1; let rs = seed * 9301;
    const rnd = () => { rs = (rs * 9301 + 49297) % 233280; return rs / 233280; };
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.62 + rnd() * 0.36, px = h.x + Math.cos(a) * (h.w / 2 - 0.12) * k, pz = h.z + Math.sin(a) * (h.d / 2 - 0.12) * k; if (i) p.lineTo(px, sg * pz); else p.moveTo(px, sg * pz); }
    sh.holes.push(p);
    const g = new THREE.ShapeGeometry(sh), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / s, uv.getY(i) / s);
    const m = addMesh(g, mat, 0, y, 0); m.rotation.x = down ? Math.PI / 2 : -Math.PI / 2;
    // snapped boards and lath hanging off the broken edge
    const splint = woodMat(0x6a4a2a);
    for (let i = 0; i < 7; i++) { const a = rnd() * Math.PI * 2, bx = h.x + Math.cos(a) * h.w * 0.36, bz = h.z + Math.sin(a) * h.d * 0.36, len = 0.3 + rnd() * 0.5;
      const b = addMesh(new THREE.BoxGeometry(0.09, len, 0.025), splint, bx, y + (down ? -len / 2 + 0.05 : len / 2 - 0.05) * (down ? 1 : -1) * -1, bz); b.rotation.set((rnd() - 0.5) * 0.9, a, (rnd() - 0.5) * 0.9); b.position.y = y - (down ? len / 2 - 0.05 : len / 2 - 0.08); }
    return m;
  }
  // floor (and ceiling) over a rectangle, with holes cut out of each
  function slab(level, x0, x1, z0, z1, floorMat, ceilMat, noCeil, fHoles, cHoles) {
    const y = yOf(level), R0 = { x0, x1, z0, z1 };
    if (floorMat) { const hs = (fHoles || []).filter((h) => !h.jag).concat((fHoles || []).filter((h) => h.jag).map((h) => ({ x0: h.x - h.w / 2, x1: h.x + h.w / 2, z0: h.z - h.d / 2, z1: h.z + h.d / 2 })));
      subtract(R0, hs).forEach((r) => plane(r.x0, r.x1, r.z0, r.z1, y + 0.001, floorMat, false, 2)); }
    if (!noCeil && ceilMat) { const hs = (cHoles || []).filter((h) => !h.jag).concat((cHoles || []).filter((h) => h.jag).map((h) => ({ x0: h.x - h.w / 2, x1: h.x + h.w / 2, z0: h.z - h.d / 2, z1: h.z + h.d / 2 })));
      subtract(R0, hs).forEach((r) => plane(r.x0, r.x1, r.z0, r.z1, y + H - 0.02, ceilMat, true, 3)); }
  }

  /* ---------- furniture helpers ---------- */
  function furn(level, x, z, w, d, h, color, opts) {
    opts = opts || {};
    const y = yOf(level) + (opts.y || 0);
    const m = addMesh(TH.Tex.boxUV(new THREE.BoxGeometry(w, h, d), w, h, d, 1), opts.mat || solidMat(color), x, y + h / 2, z);
    if (opts.ry) m.rotation.y = opts.ry;
    if (!opts.noCol) TH.Col.addRect(level, x, z, opts.ry ? Math.max(w, d) : w, opts.ry ? Math.max(w, d) : d, h > 1.5);
    return m;
  }
  // open shelving: end panels, a back, uprights and boards you can actually put things on (tops at the given heights)
  function shelving(level, x, z, w, d, h, boards, open, color) {
    const y = yOf(level), mat = solidMat(color), alongX = open === '+z' || open === '-z', L = alongX ? w : d, D = alongX ? d : w;
    const sgn = open[0] === '+' ? 1 : -1, box = (a, b, c, px, py, pz) => { const [gw, gd, ox, oz] = alongX ? [a, c, px, pz] : [c, a, pz, px]; addMesh(TH.Tex.boxUV(new THREE.BoxGeometry(gw, b, gd), gw, b, gd, 1), mat, x + ox, y + py, z + oz); };
    // in local terms: 'along' runs the length of the unit, 'out' points from the back toward the open face
    const part = (along, out, la, lb, lc, py) => box(la, lb, lc, along, py, out);
    part(0, -sgn * (D / 2 - 0.015), L, h, 0.03, h / 2);                                  // back
    const ups = Math.max(1, Math.round(L / 1.6)); for (let i = 0; i <= ups; i++) part(-L / 2 + 0.02 + (i * (L - 0.04)) / ups, 0, 0.04, h, D, h / 2); // ends + uprights
    boards.forEach((t) => part(0, 0, L, 0.03, D, t - 0.015));
    TH.Col.addRect(level, x, z, w, d, h > 1.5);
  }
  function trash(level, x, z, n) {
    for (let i = 0; i < n; i++) {
      const s = 0.25 + Math.random() * 0.35;
      if (!Hs._bagMat) { Hs._bagMat = [new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.32, metalness: 0.1 }), new THREE.MeshStandardMaterial({ color: 0x2a2c24, roughness: 0.36, metalness: 0.1 })]; }
      const geo = new THREE.SphereGeometry(s, 14, 10), p = geo.attributes.position;
      for (let v = 0; v < p.count; v++) { const nx = p.getX(v), ny = p.getY(v), nz = p.getZ(v), k = 1 + Math.sin(nx * 23 + nz * 17) * 0.08 + Math.sin(ny * 31) * 0.06 + (ny < 0 ? -0.15 : 0); p.setXYZ(v, nx * k, Math.max(ny * k, -s * 0.55), nz * k); }
      geo.computeVertexNormals();
      const bx0 = x + (Math.random() - 0.5) * 1.4, bz0 = z + (Math.random() - 0.5) * 1.4, m = addMesh(geo, TH.util.pick(Hs._bagMat), bx0, yOf(level) + s * 0.55, bz0);
      m.scale.y = 0.85; m.rotation.y = Math.random() * 6;
      const neck = addMesh(new THREE.ConeGeometry(s * 0.22, s * 0.5, 8), m.material, bx0, yOf(level) + s * 1.15, bz0); neck.rotation.set(Math.PI, 0, (Math.random() - 0.5) * 0.6);
    }
    if (!Hs._canMats) Hs._canMats = [['#b02a24', 'COLA'], ['#2a52a0', 'BREW'], ['#c8c8c0', 'LITE']].map(([c, w]) => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const k = cv.getContext('2d'); k.fillStyle = c; k.fillRect(0, 0, 128, 64); k.fillStyle = '#f2ece0'; k.font = '900 26px "Barlow Condensed", sans-serif'; k.fillText(w, 30, 40); k.fillStyle = 'rgba(255,255,255,.25)'; k.fillRect(0, 8, 128, 3); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return new THREE.MeshStandardMaterial({ map: t, metalness: 0.7, roughness: 0.35 }); });
    for (let i = 0; i < n; i++) { const c = addMesh(new THREE.CylinderGeometry(0.033, 0.033, 0.122, 14), TH.util.pick(Hs._canMats), x + (Math.random() - 0.5) * 2, yOf(level) + 0.04, z + (Math.random() - 0.5) * 2); c.rotation.z = Math.PI / 2; c.rotation.y = Math.random() * 6; c.scale.set(1, 0.7 + Math.random() * 0.3, 1); }
  }
  function bed(level, x, z, w, l, ry, hide, name) {
    const g = new THREE.Group(); scene.add(g); g.position.set(x, yOf(level), z); g.rotation.y = ry || 0;
    const wood = woodMat(0x4a2f1c);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => addMesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), wood, a * (w / 2 - 0.05), 0.275, b * (l / 2 - 0.05), g));
    addMesh(new THREE.BoxGeometry(w, 0.1, l), wood, 0, 0.52, 0, g);
    const mat = new THREE.MeshLambertMaterial({ map: TH.Tex.mattress });
    addMesh(new THREE.BoxGeometry(w - 0.1, 0.22, l - 0.1), mat, 0, 0.68, 0, g);
    addMesh(new THREE.BoxGeometry(w, 1.1, 0.1), wood, 0, 0.55, -l / 2, g); // headboard
    addMesh(new THREE.BoxGeometry(w * 0.4, 0.14, 0.4), lam(0xa69c80), -w * 0.22, 0.86, -l / 2 + 0.35, g);
    addMesh(new THREE.BoxGeometry(w - 0.2, 0.06, l * 0.55), lam(0x5b5040), 0.05, 0.81, l * 0.15, g).rotation.y = 0.06; // blanket
    // collider = footprint (low, doesn't block sight)
    const sw = Math.abs(Math.sin(ry || 0)) > 0.5;
    TH.Col.addRect(level, x, z, sw ? l : w, sw ? w : l, false);
    if (hide) {
      // camera lies under the bed, looking out of the long side
      const side = { x: Math.cos(ry || 0), z: -Math.sin(ry || 0) }; // local +x in world space
      Hs.hideSpots.push({ type: 'bed', name: name || 'bed', level, x, z,
        enter: { x: x + side.x * (w / 2 + 0.8), z: z + side.z * (w / 2 + 0.8) },
        cam: { x: x + side.x * (w / 2 - 0.35), z: z + side.z * (w / 2 - 0.35), y: yOf(level) + 0.22 },
        yaw: Math.atan2(-side.x, -side.z), r: Math.max(w, l) / 2 + 1.2 });
    }
    return g;
  }
  function wardrobe(level, x, z, ry, name) {
    const g = new THREE.Group(); scene.add(g); g.position.set(x, yOf(level), z); g.rotation.y = ry || 0;
    const wood = woodMat(0x3d2717), dark = lam(0x120c08);
    addMesh(new THREE.BoxGeometry(1.4, 2.2, 0.05), wood, 0, 1.1, -0.35, g);
    addMesh(new THREE.BoxGeometry(0.05, 2.2, 0.75), wood, -0.7, 1.1, 0, g); addMesh(new THREE.BoxGeometry(0.05, 2.2, 0.75), wood, 0.7, 1.1, 0, g);
    addMesh(new THREE.BoxGeometry(1.4, 0.05, 0.75), wood, 0, 2.2, 0, g); addMesh(new THREE.BoxGeometry(1.4, 0.05, 0.75), wood, 0, 0.03, 0, g);
    addMesh(new THREE.BoxGeometry(1.3, 2.1, 0.6), dark, 0, 1.1, -0.04, g).scale.set(0.98, 0.98, 0.5);
    // slatted doors: you can peek out through the gaps
    for (let i = 0; i < 12; i++) addMesh(new THREE.BoxGeometry(1.36, 0.09, 0.03), wood, 0, 0.2 + i * 0.165, 0.37, g).rotation.x = -0.5;
    const s = { x: Math.sin(ry || 0), z: Math.cos(ry || 0) }; // front direction
    TH.Col.addRect(level, x, z, Math.abs(s.x) > 0.5 ? 0.8 : 1.45, Math.abs(s.x) > 0.5 ? 1.45 : 0.8, true);
    Hs.hideSpots.push({ type: 'closet', name: name || 'wardrobe', level, x, z, enter: { x: x + s.x * 1.2, z: z + s.z * 1.2 }, cam: { x: x + s.x * 0.05, z: z + s.z * 0.05, y: yOf(level) + 1.45 }, yaw: Math.atan2(-s.x, -s.z), r: 2.2 });
    return g;
  }
  /* ---------- porcelain fixtures: built from revolved & lofted curves, so they're round like the real thing ---------- */
  function porcelain() {
    if (Hs._porc) return Hs._porc;
    const c = document.createElement('canvas'); c.width = c.height = 256; const k = c.getContext('2d');
    k.fillStyle = '#ece6d6'; k.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 30; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 6 + Math.random() * 30; const g = k.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${120 + Math.random() * 40},${90 + Math.random() * 30},40,.28)`); g.addColorStop(1, 'rgba(120,90,40,0)'); k.fillStyle = g; k.fillRect(x - r, y - r, r * 2, r * 2); }
    k.strokeStyle = 'rgba(70,60,50,.35)'; k.lineWidth = 0.7; for (let i = 0; i < 25; i++) { k.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; k.moveTo(x, y); for (let j = 0; j < 6; j++) { x += Math.random() * 16 - 8; y += Math.random() * 16 - 8; k.lineTo(x, y); } k.stroke(); } // crazing
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (Hs._porc = { white: new THREE.MeshStandardMaterial({ map: t, roughness: 0.12, metalness: 0 }), grime: new THREE.MeshStandardMaterial({ color: 0x5a5030, roughness: 0.6 }),
      water: new THREE.MeshStandardMaterial({ color: 0x4a4a2a, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 1, roughness: 0.15 }), seat: new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.35 }), iron: new THREE.MeshStandardMaterial({ color: 0x2a2a28, metalness: 0.6, roughness: 0.5 }) });
  }
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg || 32);

  // Clawfoot bathtub: rounded oval basin with a rolled rim, ball-and-claw feet, chrome tap & drain
  function tub(level, x, z, alongX, name, frontDir) {
    const y = yOf(level), M = porcelain(), g = new THREE.Group(); scene.add(g); g.position.set(x, y, z); g.rotation.y = alongX ? Math.PI / 2 : 0;
    const L = 1.68, W = 0.78, prof = [[0.0, 0.16], [0.3, 0.14], [0.36, 0.2], [0.385, 0.42], [0.39, 0.62], [0.4, 0.66], [0.38, 0.67], [0.355, 0.63], [0.345, 0.42], [0.29, 0.24], [0.0, 0.22]];
    const bowl = new THREE.Mesh(lathe(prof, 40), M.white); bowl.scale.set(W / 0.8, 1, L / 0.8); g.add(bowl);   // revolved, then stretched into an oval
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), M.water); water.rotation.x = -Math.PI / 2; water.position.y = 0.3; water.scale.set(W / 0.8, L / 0.8, 1); g.add(water);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.352, 0.012, 6, 40), M.grime); ring.rotation.x = Math.PI / 2; ring.position.y = 0.31; ring.scale.set(W / 0.8, L / 0.8, 1); g.add(ring); // bathtub ring
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const f = new THREE.Group(); f.position.set(a * W * 0.36, 0, b * L * 0.36); g.add(f);
      const leg = new THREE.Mesh(lathe([[0.0, 0], [0.045, 0.0], [0.05, 0.03], [0.035, 0.08], [0.028, 0.15], [0.04, 0.2], [0.0, 0.2]], 12), M.iron); f.add(leg);
      for (let k = 0; k < 3; k++) { const claw = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), M.iron); claw.position.set(Math.cos(k * 2.1 + a) * 0.04, 0.012, Math.sin(k * 2.1 + b) * 0.04); claw.scale.set(1, 0.6, 1.6); f.add(claw); } });
    const tap = new THREE.Group(); tap.position.set(0, 0.66, -L * 0.47); g.add(tap);
    const spout = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 14, Math.PI), M.chrome); spout.rotation.y = Math.PI / 2; spout.position.y = 0.05; tap.add(spout);
    [-1, 1].forEach((sd) => { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), M.chrome); h.position.set(sd * 0.09, 0.03, 0); tap.add(h); const cross = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.008, 0.008), M.chrome); cross.position.set(sd * 0.09, 0.065, 0); tap.add(cross); });
    const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.004, 14), M.chrome); drain.position.set(0, 0.165, -L * 0.3); g.add(drain);
    TH.Col.addRect(level, x, z, alongX ? L : W, alongX ? W : L, false);
    // shower curtain on a ring rail over the tub
    const cur = new THREE.MeshStandardMaterial({ color: 0x8aa39a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, roughness: 0.6 }), fx = frontDir.x, fz = frontDir.z;
    const geo = new THREE.PlaneGeometry(1.7, 1.75, 24, 1), pp = geo.attributes.position; for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin(pp.getX(i) * 22) * 0.035); geo.computeVertexNormals();
    const cx = x + fx * (alongX ? 0 : 0.4), cz = z + fz * (alongX ? 0.4 : 0);
    const c = addMesh(geo, cur, cx, y + 1.3, cz); if (!alongX) c.rotation.y = Math.PI / 2;
    const rail = addMesh(new THREE.CylinderGeometry(0.012, 0.012, 1.75, 8), M.chrome, cx, y + 2.2, cz); rail.rotation.set(alongX ? 0 : Math.PI / 2, 0, alongX ? Math.PI / 2 : 0);
    Hs.hideSpots.push({ type: 'curtain', name: name || 'shower', level, x, z, enter: { x: x + fx * 1.2, z: z + fz * 1.2 }, cam: { x: x + fx * 0.15, z: z + fz * 0.15, y: y + 1.5 }, yaw: Math.atan2(-fx, -fz), r: 2.2 });
  }
  // Toilet: oval bowl lofted into a round pedestal, horseshoe seat & lid, curved cistern
  function toilet(level, x, z, ry) {
    const M = porcelain(), g = new THREE.Group(); scene.add(g); g.position.set(x, yOf(level), z); g.rotation.y = ry;
    const base = new THREE.Mesh(lathe([[0, 0], [0.13, 0], [0.12, 0.05], [0.1, 0.2], [0.13, 0.3], [0.0, 0.3]], 28), M.white); base.scale.set(1, 1, 1.35); base.position.z = 0.04; g.add(base);
    const bowl = new THREE.Mesh(lathe([[0.0, 0.27], [0.06, 0.27], [0.12, 0.3], [0.17, 0.36], [0.19, 0.4], [0.18, 0.41], [0.16, 0.38], [0.1, 0.32], [0.0, 0.3]], 32), M.white); bowl.scale.set(1, 1, 1.3); bowl.position.z = 0.1; g.add(bowl);
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), M.water); w.rotation.x = -Math.PI / 2; w.scale.set(1, 1.3, 1); w.position.set(0, 0.32, 0.11); g.add(w);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 28), M.seat); seat.rotation.x = Math.PI / 2; seat.scale.set(1, 1.3, 0.5); seat.position.set(0, 0.425, 0.1); g.add(seat);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 28), M.seat); lid.scale.set(1, 1, 1.25); lid.position.set(0, 0.55, -0.12); lid.rotation.x = -1.35; g.add(lid); // lid propped up
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.18, 4, 4, 2), M.white); const tp = tank.geometry.attributes.position;
    for (let i = 0; i < tp.count; i++) { const tx = tp.getX(i), tz = tp.getZ(i); tp.setZ(i, tz * (1 - Math.pow(tx / 0.22, 4) * 0.35)); } tank.geometry.computeVertexNormals(); tank.position.set(0, 0.6, -0.2); g.add(tank);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.04, 0.21), M.white); tl.position.set(0, 0.8, -0.2); g.add(tl);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), M.chrome); handle.position.set(-0.19, 0.74, -0.1); g.add(handle);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8), M.chrome); pipe.position.set(0.15, 0.2, -0.3); g.add(pipe);
    TH.Col.addRect(level, x, z, 0.55, 0.65, false);
  }
  // Pedestal sink: fluted column, round basin, chrome taps, cracked mirror is on the wall
  function sink(level, x, z, ry) {
    const M = porcelain(), g = new THREE.Group(); scene.add(g); g.position.set(x, yOf(level), z); g.rotation.y = ry;
    g.add(new THREE.Mesh(lathe([[0, 0], [0.13, 0], [0.12, 0.04], [0.07, 0.12], [0.06, 0.55], [0.09, 0.66], [0, 0.66]], 24), M.white));
    const basin = new THREE.Mesh(lathe([[0, 0.66], [0.12, 0.66], [0.22, 0.72], [0.27, 0.8], [0.28, 0.85], [0.26, 0.86], [0.22, 0.8], [0.14, 0.74], [0.0, 0.73]], 32), M.white); basin.scale.set(1.15, 1, 0.85); g.add(basin);
    const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 12), M.chrome); drain.position.y = 0.735; g.add(drain);
    [-1, 1].forEach((sd) => { const t = new THREE.Mesh(lathe([[0, 0], [0.022, 0], [0.016, 0.03], [0.02, 0.06], [0, 0.065]], 12), M.chrome); t.position.set(sd * 0.11, 0.85, -0.16); g.add(t); });
    const sp = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 12, Math.PI / 1.5), M.chrome); sp.position.set(0, 0.88, -0.17); sp.rotation.set(0, Math.PI / 2, 0); g.add(sp);
    TH.Col.addRect(level, x, z, 0.6, 0.5, false);
  }
  function fixture(level, x, z, opts) {
    opts = opts || {}; const y = yOf(level) + H - 0.02;
    addMesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4), lam(0x111111), x, y - 0.25, z);
    const bulbMat = opts.dead ? new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.4, transparent: true, opacity: 0.85 }) : new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
    const b = addMesh(new THREE.SphereGeometry(0.09, 8, 6), bulbMat, x, y - 0.55, z); b.userData.dynamic = true;
    if (level >= 0 && !opts.bare) { // a milk-glass schoolhouse shade around the bulb; it glows (and flickers) with it
      bulbMat.side = THREE.DoubleSide;
      const prof = [[0.045, 0.12], [0.06, 0.1], [0.07, 0.06], [0.12, -0.02], [0.15, -0.1], [0.16, -0.14], [0.155, -0.15]];
      const sh = addMesh(new THREE.LatheGeometry(prof.map(([a, c]) => new THREE.Vector2(a, c)), 24), opts.dead ? new THREE.MeshStandardMaterial({ color: 0x8a8678, roughness: 0.5, side: THREE.DoubleSide }) : bulbMat, x, y - 0.55, z); sh.userData.dynamic = true;
      addMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), std('brass2', { color: 0xb8913a, metalness: 0.9, roughness: 0.35 }), x, y - 0.42, z);
    }
    if (opts.dead) { Hs.deadBulbs = (Hs.deadBulbs || []).concat([{ x, z, level }]); return; } // burnt out: just a dark shade
    Hs.fixtures.push(Object.assign({ x, y: y - 0.6, z, level, bulb: b, mat: bulbMat, power: 1, flicker: false, color: 0xffd28a }, opts));
  }
  // a candle (or a few on a brass stick): a small flickering warm light you can navigate by
  function candle(level, x, z, y, n, power) {
    n = n || 1; const by = yOf(level) + y, brass = std('brass', { color: 0xa8833a, metalness: 0.9, roughness: 0.35 }), wax = std('wax', { color: 0xe6dcc4, roughness: 0.6 });
    if (!Hs._flame) Hs._flame = new THREE.MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0.95, depthWrite: false });
    const fm = Hs._flame.clone(), flames = [];
    const one = (cx, cz, hgt) => {
      addMesh(new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.048, 0.012], [0.018, 0.03], [0.012, 0.07], [0.02, 0.09], [0.024, 0.1], [0, 0.1]].map(([a, b]) => new THREE.Vector2(a, b)), 14), brass, cx, by, cz);
      const h = hgt || 0.12 + Math.random() * 0.1; addMesh(new THREE.CylinderGeometry(0.011, 0.012, h, 10), wax, cx, by + 0.1 + h / 2, cz);
      for (let d = 0; d < 3; d++) addMesh(new THREE.SphereGeometry(0.006, 6, 4), wax, cx + Math.cos(d * 2.1) * 0.012, by + 0.1 + h - 0.02 - d * 0.02, cz + Math.sin(d * 2.1) * 0.012).scale.set(1, 2.2, 1); // wax drips
      const f = addMesh(new THREE.ConeGeometry(0.008, 0.032, 8), fm, cx, by + 0.1 + h + 0.02, cz); f.userData.dynamic = true; flames.push(f);
      return by + 0.1 + h + 0.02;
    };
    let top = 0; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; top = one(x + (n > 1 ? Math.cos(a) * 0.09 : 0), z + (n > 1 ? Math.sin(a) * 0.09 : 0)); }
    if (!Hs._halo) { const c = document.createElement('canvas'); c.width = c.height = 64; const k = c.getContext('2d'), g = k.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,190,110,.9)'); g.addColorStop(0.25, 'rgba(255,150,70,.25)'); g.addColorStop(1, 'rgba(255,140,60,0)'); k.fillStyle = g; k.fillRect(0, 0, 64, 64); Hs._halo = new THREE.CanvasTexture(c); }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: Hs._halo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, toneMapped: false })); halo.material.userData.noPBR = true; halo.scale.set(0.5, 0.5, 1); halo.position.set(x, top + 0.01, z); halo.userData.dynamic = true; scene.add(halo);
    Hs.fixtures.push({ x, y: top + 0.15, z, level, bulb: flames[0], flames, halo, mat: fm, power: power || 0.42, flicker: true, candle: true, color: 0xff9a48, range: 7 });
  }
  function decal(mesh, x, y, z, ry) { mesh.position.set(x, y, z); mesh.rotation.y = ry || 0; scene.add(mesh); return mesh; }
  // Gilded portrait frame with a procedurally painted oil portrait and a brass nameplate
  const SITTERS = [['ELEANOR WRIGHT', '1921', 28], ['HAROLD T. WRIGHT', '1934', 205], ['THE WRIGHT CHILDREN', '1948', 95]];
  function portraitTex(i) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 320; const k = c.getContext('2d'); const hue = SITTERS[i % 3][2];
    const bg = k.createRadialGradient(128, 120, 20, 128, 160, 220); bg.addColorStop(0, `hsl(${hue},22%,26%)`); bg.addColorStop(1, `hsl(${hue},30%,6%)`); k.fillStyle = bg; k.fillRect(0, 0, 256, 320);
    const figure = (cx, cy, s) => {
      k.fillStyle = `hsl(${hue + 20},18%,9%)`; k.beginPath(); k.ellipse(cx, cy + 150 * s, 95 * s, 85 * s, 0, Math.PI, 0); k.fill(); k.fillRect(cx - 95 * s, cy + 150 * s, 190 * s, 120 * s); // shoulders
      k.fillStyle = '#d8cfb8'; k.beginPath(); k.moveTo(cx - 18 * s, cy + 70 * s); k.lineTo(cx, cy + 110 * s); k.lineTo(cx + 18 * s, cy + 70 * s); k.fill(); // collar
      const face = k.createRadialGradient(cx - 10 * s, cy - 10 * s, 5, cx, cy, 55 * s); face.addColorStop(0, '#d9c3a2'); face.addColorStop(0.7, '#a88c6c'); face.addColorStop(1, '#4a3828');
      k.fillStyle = face; k.beginPath(); k.ellipse(cx, cy, 38 * s, 50 * s, 0, 0, 6.28); k.fill();
      k.fillStyle = `hsl(${hue},20%,12%)`; k.beginPath(); k.ellipse(cx, cy - 34 * s, 42 * s, 26 * s, 0, Math.PI, 0); k.fill(); // hair
      k.fillStyle = '#1a120c'; [-1, 1].forEach((d) => { k.beginPath(); k.ellipse(cx + d * 14 * s, cy - 4 * s, 7 * s, 4 * s, 0, 0, 6.28); k.fill(); });
      k.fillStyle = 'rgba(255,240,210,.8)'; [-1, 1].forEach((d) => k.fillRect(cx + d * 14 * s + 1, cy - 6 * s, 1.5, 1.5)); // the eyes follow you
      k.strokeStyle = '#5a3a28'; k.lineWidth = 2 * s; k.beginPath(); k.moveTo(cx - 10 * s, cy + 24 * s); k.quadraticCurveTo(cx, cy + 27 * s, cx + 10 * s, cy + 24 * s); k.stroke();
    };
    if (i % 3 === 2) { figure(80, 140, 0.62); figure(176, 150, 0.58); figure(128, 205, 0.48); } else figure(128, 130, 1);
    k.strokeStyle = 'rgba(0,0,0,.35)'; k.lineWidth = 0.6; for (let n = 0; n < 160; n++) { const x = Math.random() * 256, y = Math.random() * 320; k.beginPath(); k.moveTo(x, y); k.lineTo(x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 24); k.stroke(); } // craquelure
    k.fillStyle = 'rgba(120,80,20,.28)'; k.fillRect(0, 0, 256, 320); // yellowed varnish
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function frame(level, x, z, ry, name) {
    // ry: direction the picture faces. Hangs on the wall; knocked off by the puzzle system.
    const i = Hs.frames.length, g = new THREE.Group(); scene.add(g); g.userData.dynamic = true; g.position.set(x, yOf(level) + 1.7, z); g.rotation.y = ry;
    const gilt = new THREE.MeshStandardMaterial({ color: 0xa8833a, metalness: 0.85, roughness: 0.42 }), giltDark = new THREE.MeshStandardMaterial({ color: 0x6a5020, metalness: 0.8, roughness: 0.55 });
    const W = 0.72, Hh = 0.92;
    [[W + 0.16, 0.1, 0, Hh / 2 + 0.05], [W + 0.16, 0.1, 0, -Hh / 2 - 0.05], [0.1, Hh, -W / 2 - 0.05, 0], [0.1, Hh, W / 2 + 0.05, 0]].forEach(([a, b, px, py]) => {
      addMesh(new THREE.BoxGeometry(a, b, 0.07), gilt, px, py, 0.035, g); addMesh(new THREE.BoxGeometry(a * 0.98, b * 0.45, 0.085), giltDark, px, py, 0.04, g);
    });
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([a, b]) => addMesh(new THREE.SphereGeometry(0.035, 10, 8), gilt, a * (W / 2 + 0.05), b * (Hh / 2 + 0.05), 0.07, g)); // corner rosettes
    addMesh(new THREE.BoxGeometry(W, Hh, 0.02), giltDark, 0, 0, 0.01, g);
    addMesh(new THREE.PlaneGeometry(W - 0.04, Hh - 0.04), new THREE.MeshStandardMaterial({ map: portraitTex(i), roughness: 0.55, metalness: 0 }), 0, 0, 0.022, g);
    // brass nameplate
    const [nm, yr] = SITTERS[i % 3]; const pc = document.createElement('canvas'); pc.width = 256; pc.height = 48; const pk = pc.getContext('2d');
    const pg = pk.createLinearGradient(0, 0, 0, 48); pg.addColorStop(0, '#c9a24a'); pg.addColorStop(1, '#7a5a20'); pk.fillStyle = pg; pk.fillRect(0, 0, 256, 48);
    pk.fillStyle = '#2a1c08'; pk.font = '700 20px "Barlow Condensed", serif'; pk.textAlign = 'center'; pk.fillText(nm, 128, 24); pk.font = '14px "Barlow Condensed", serif'; pk.fillText(yr, 128, 42);
    const pt = new THREE.CanvasTexture(pc); pt.encoding = THREE.sRGBEncoding;
    addMesh(new THREE.BoxGeometry(0.26, 0.05, 0.008), new THREE.MeshStandardMaterial({ map: pt, metalness: 0.8, roughness: 0.35 }), 0, -Hh / 2 - 0.03, 0.08, g);
    // the hollow in the wall behind it (shown when knocked off)
    const nook = new THREE.Group(); g.add(nook); nook.visible = false;
    addMesh(new THREE.PlaneGeometry(0.38, 0.32), new THREE.MeshBasicMaterial({ color: 0x050403 }), 0, -0.15, 0.004, nook);
    [[0.42, 0.04, 0, 0.01], [0.42, 0.04, 0, -0.33], [0.04, 0.32, -0.21, -0.16], [0.04, 0.32, 0.21, -0.16]].forEach(([a, b, px, py]) => addMesh(new THREE.BoxGeometry(a, b, 0.02), new THREE.MeshStandardMaterial({ color: 0xa89a80, roughness: 0.95 }), px, py, 0.01, nook)); // broken plaster lip
    Hs.frames.push({ level, x, z, ry, group: g, nook, name, knocked: false, fallT: -1, x2: x + Math.sin(ry) * 0.9, z2: z + Math.cos(ry) * 0.9 });
  }
  function vent(level, x, z, ry, room) {
    const g = new THREE.Group(); scene.add(g); g.userData.dynamic = true; g.position.set(x, yOf(level) + 0.45, z); g.rotation.y = ry;
    addMesh(new THREE.PlaneGeometry(0.56, 0.36), new THREE.MeshBasicMaterial({ color: 0x030302 }), 0, 0, 0.003, g); // dark duct
    addMesh(new THREE.BoxGeometry(0.56, 0.02, 0.2), new THREE.MeshStandardMaterial({ color: 0x5a5a56, metalness: 0.6, roughness: 0.6 }), 0, -0.17, -0.09, g); // duct floor
    const cover = new THREE.Group(); g.add(cover);
    const metal = new THREE.MeshStandardMaterial({ color: 0xb4b0a4, metalness: 0.75, roughness: 0.48 }), dirty = new THREE.MeshStandardMaterial({ color: 0x6a6658, metalness: 0.6, roughness: 0.7 });
    [[0.66, 0.05, 0, 0.215], [0.66, 0.05, 0, -0.215], [0.05, 0.38, -0.305, 0], [0.05, 0.38, 0.305, 0]].forEach(([a, b, px, py]) => addMesh(new THREE.BoxGeometry(a, b, 0.018), metal, px, py, 0.012, cover));
    for (let k = 0; k < 8; k++) { const l = addMesh(new THREE.BoxGeometry(0.56, 0.035, 0.006), k % 3 ? metal : dirty, 0, -0.165 + k * 0.047, 0.012, cover); l.rotation.x = -0.6; }
    const screws = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([a, b]) => { const sc = addMesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 10), new THREE.MeshStandardMaterial({ color: 0x8a8070, metalness: 0.9, roughness: 0.4 }), a * 0.3, b * 0.21, 0.022, cover); sc.rotation.x = Math.PI / 2; addMesh(new THREE.BoxGeometry(0.018, 0.003, 0.002), new THREE.MeshBasicMaterial({ color: 0x111111 }), 0, 0.007, 0, sc).rotation.x = -Math.PI / 2; screws.push(sc); });
    Hs.vents.push({ level, x, z, ry, group: g, cover, screws, room, open: false, front: { x: x + Math.sin(ry) * 0.9, z: z + Math.cos(ry) * 0.9 } });
  }
  function spawn(level, x, y, z, where) { Hs.spawnPoints.push({ level, x, y: yOf(level) + y, z, where }); }
  // Window unit set into a real wall opening: grimy cracked glass you can see through, sash & muntins, casing, sill, and (sometimes) boards nailed across
  function windowUnit(w) {
    const lvY = yOf(w.level), cx = w.axis === 'x' ? w.c : w.k - w.out * 0.12, cz = w.axis === 'x' ? w.k - w.out * 0.12 : w.c;
    const ry = w.axis === 'x' ? (w.out > 0 ? Math.PI : 0) : (w.out > 0 ? -Math.PI / 2 : Math.PI / 2); // local +z faces into the room
    const g = new THREE.Group(); scene.add(g); g.position.set(cx, lvY + w.y, cz); g.rotation.y = ry;
    if (!Hs._glass) {
      const c = document.createElement('canvas'); c.width = c.height = 256; const k = c.getContext('2d');
      for (let i = 0; i < 26; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 50; const gr = k.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,110,80,.45)'); gr.addColorStop(1, 'rgba(120,110,80,0)'); k.fillStyle = gr; k.fillRect(x - r, y - r, r * 2, r * 2); }
      for (let i = 0; i < 9; i++) { k.strokeStyle = 'rgba(90,80,60,.3)'; k.lineWidth = 3; k.beginPath(); const x = Math.random() * 256; k.moveTo(x, 0); k.lineTo(x + Math.random() * 20 - 10, 80 + Math.random() * 170); k.stroke(); } // grime streaks
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      Hs._glass = new THREE.MeshStandardMaterial({ color: 0x9fb4c0, map: t, transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 });
      const c2 = document.createElement('canvas'); c2.width = c2.height = 256; const k2 = c2.getContext('2d'); k2.strokeStyle = 'rgba(235,240,245,.85)'; k2.lineWidth = 1.2;
      const cx2 = 120 + Math.random() * 30, cy2 = 110 + Math.random() * 30; for (let i = 0; i < 9; i++) { k2.beginPath(); k2.moveTo(cx2, cy2); let x = cx2, y = cy2; const a = (i / 9) * 6.28 + Math.random() * 0.4; for (let j = 0; j < 6; j++) { x += Math.cos(a + Math.random() * 0.6 - 0.3) * 22; y += Math.sin(a + Math.random() * 0.6 - 0.3) * 22; k2.lineTo(x, y); } k2.stroke(); }
      for (let r = 12; r < 60; r += 16) { k2.beginPath(); for (let a = 0; a < 6.3; a += 0.5) k2.lineTo(cx2 + Math.cos(a) * (r + Math.random() * 6), cy2 + Math.sin(a) * (r + Math.random() * 6)); k2.stroke(); }
      const t2 = new THREE.CanvasTexture(c2); Hs._crack = new THREE.MeshBasicMaterial({ map: t2, transparent: true, depthWrite: false, opacity: 0.8 });
    }
    const W = w.w, Hh = w.h, trim = woodMat(0xc8b89a), dark = woodMat(0x8a7a5a);
    // two panes (double-hung sash) with muntins
    const panes = [[-0.035, Hh / 4], [-0.075, -Hh / 4]].map(([z, y]) => { const m = addMesh(new THREE.PlaneGeometry(W, Hh / 2), Hs._glass, 0, y, z - 0.06, g); m.userData.dynamic = true; return m; }); // kept out of batching so a rock can break them
    if (w.cracked) { const m = addMesh(new THREE.PlaneGeometry(W * 0.9, Hh * 0.45), Hs._crack, 0, Hh / 4, -0.09, g); m.userData.dynamic = true; panes.push(m); }
    const bars = [[W, 0.05, 0.05, 0, 0, -0.08], [0.035, Hh, 0.03, 0, 0, -0.09], [W, 0.035, 0.03, 0, Hh / 4, -0.09], [W, 0.035, 0.03, 0, -Hh / 4, -0.09]];
    bars.forEach(([a, b, c, px, py, pz]) => addMesh(new THREE.BoxGeometry(a, b, c), dark, px, py, pz, g));
    // casing + sill inside, plain trim outside, reveal lining the wall thickness
    [[W + 0.24, 0.12, 0.05, 0, Hh / 2 + 0.06, 0.03], [0.12, Hh + 0.12, 0.05, -W / 2 - 0.06, 0, 0.03], [0.12, Hh + 0.12, 0.05, W / 2 + 0.06, 0, 0.03], [W + 0.36, 0.05, 0.18, 0, -Hh / 2 - 0.04, 0.07]].forEach(([a, b, c, px, py, pz]) => addMesh(new THREE.BoxGeometry(a, b, c), TH.Tex.trim(a > b), px, py, pz, g));
    [[W + 0.16, 0.08, 0.04, 0, Hh / 2 + 0.04, -0.27], [0.08, Hh + 0.08, 0.04, -W / 2 - 0.04, 0, -0.27], [0.08, Hh + 0.08, 0.04, W / 2 + 0.04, 0, -0.27], [W + 0.2, 0.05, 0.1, 0, -Hh / 2 - 0.03, -0.3]].forEach(([a, b, c, px, py, pz]) => addMesh(new THREE.BoxGeometry(a, b, c), TH.Tex.trim(a > b), px, py, pz, g));
    [[W, 0.01, 0.24, 0, Hh / 2, -0.11], [W, 0.01, 0.24, 0, -Hh / 2, -0.11], [0.01, Hh, 0.24, -W / 2, 0, -0.11], [0.01, Hh, 0.24, W / 2, 0, -0.11]].forEach(([a, b, c, px, py, pz]) => addMesh(new THREE.BoxGeometry(a, b, c), TH.Tex.trim(a > b), px, py, pz, g));
    // boards: random gaps so you can still peek outside
    const nail = new THREE.MeshStandardMaterial({ color: 0x5a5048, metalness: 0.8, roughness: 0.5 });
    for (let i = 0; i < (w.boards || 0); i++) {
      const by = -Hh / 2 + 0.2 + (i + Math.random() * 0.4) * ((Hh - 0.3) / Math.max(1, w.boards)), bw = W + 0.35;
      const b = addMesh(TH.Tex.boxUV(new THREE.BoxGeometry(bw, 0.16 + Math.random() * 0.04, 0.03), bw, 0.17, 0.03, 1), woodMat(TH.util.pick([0x7a5c3a, 0x6a4c30, 0x8a6a44])), 0, by, 0.08, g); b.rotation.z = (Math.random() - 0.5) * 0.22;
      [-1, 1].forEach((sd) => { const n = addMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 6), nail, sd * (bw / 2 - 0.08), 0, 0.016, b); n.rotation.x = Math.PI / 2; });
    }
    Hs.windows = Hs.windows || []; Hs.windows.push({ x: cx, y: lvY + w.y, z: cz, ry, open: (w.boards || 0) < 3, level: w.level, w: W, h: Hh, panes, broken: false });
  }


  /* ================= the storm damage: fallen trees, holes in the roof, moonlight ================= */
  const MOON = new THREE.Vector3(-40, 105, 70).normalize(); // direction to the moon (outside.js puts the sprite there)
  // [root, where it hit the roof, where the snapped crown came to rest], plus the holes it punched
  const TREES = [
    { name: 'guest', pts: [[16, 0.2, 24], [13.5, 9.2, 8.5], [12.2, 3.8 + 0.05, 5.6]], roof: { x: 13.3, z: 7.8, w: 4.2, d: 3.8 }, ceil: { x: 12.85, z: 7.1, w: 3.0, d: 2.8 }, floor: { x: 12.2, z: 5.6, w: 1.7, d: 1.6 } },
    { name: 'master', pts: [[-20, 0.2, 25], [-12, 9.3, 8.0], [-10.6, 3.85, 5.0]], roof: { x: -11.8, z: 7.6, w: 4.0, d: 3.6 }, ceil: { x: -11.35, z: 6.6, w: 2.8, d: 2.6 } },
    { name: 'kids', pts: [[-8, 0.25, -27.5], [-8.5, 11.2, -4], [-8.8, 3.85, -7.5]], roof: { x: -8.55, z: -4.8, w: 3.6, d: 3.4 }, ceil: { x: -8.65, z: -6.1, w: 2.6, d: 2.6 } },
  ];
  const LIMB = { x0: -2.9, x1: 1.85, z: -9.3, roof: { x: 0.6, z: -8.6, w: 3.4, d: 3.0 }, ceil: { x: 0.6, z: -9.0, w: 2.4, d: 2.2 } }; // a big limb down across the upstairs hall
  const RIDGE = 4.6, EAVE = 0.8; // roof: ridge height over the wall plates, overhang

  function barkMat() {
    if (Hs._bark) return Hs._bark;
    const PB = TH.Tex.photo.bark; if (PB) return (Hs._bark = new THREE.MeshStandardMaterial({ map: PB, color: 0xc4b8a8, roughness: 1, emissive: 0x2a3248, emissiveMap: PB }));
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const k = c.getContext('2d'); k.fillStyle = '#3a3026'; k.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 90; i++) { const x = Math.random() * 128; k.strokeStyle = `rgba(${Math.random() < 0.5 ? '20,16,12' : '90,78,62'},${0.3 + Math.random() * 0.5})`; k.lineWidth = 1 + Math.random() * 3; k.beginPath(); k.moveTo(x, 0); for (let y = 0; y < 256; y += 16) k.lineTo(x + Math.sin(y * 0.05 + i) * 4, y); k.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); t.encoding = THREE.sRGBEncoding;
    return (Hs._bark = new THREE.MeshStandardMaterial({ map: t, color: 0xb0a090, roughness: 0.95, emissive: 0x2a3248, emissiveMap: t, bumpMap: HI() ? t : null, bumpScale: 0.04 }));
  }
  // a log from a to b, tapering r0 -> r1; colliders wherever it hangs low enough to walk into
  function log(a, b, r0, r1, col) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(r1, r0, len, 12, 4); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + Math.sin(y * 3.1 + p.getX(i) * 9) * 0.06; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals();
    { const uv = g.attributes.uv, ru = Math.max(1, Math.round((2 * Math.PI * r0) / 1.3)), rv = len / 1.6; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv); } // bark at its real size
    const m = addMesh(g, barkMat(), (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    if (col) for (let t = 0; t <= 1.0001; t += 0.25 / Math.max(0.25, len)) {
      const q = A.clone().lerp(B, t), lv = q.y < H - 0.3 ? 0 : 1, above = q.y - lv * H, r = r0 + (r1 - r0) * t;
      if (above < 2.0 && above > -0.5 && Math.abs(q.x) < 26 && q.z > -31 && q.z < 15) TH.Col.addRect(lv, q.x, q.z, r * 2 + 0.1, r * 2 + 0.1, false);
    }
    return m;
  }
  function fallenTree(T) {
    const [r, c, e] = T.pts;
    log(r, c, 0.42, 0.3, true);
    // splintered stump where it snapped on the roof edge
    const dir = new THREE.Vector3(...e).sub(new THREE.Vector3(...c));
    for (let i = 0; i < 9; i++) { const s = addMesh(new THREE.ConeGeometry(0.05, 0.5 + Math.random() * 0.4, 4), woodMat(0x8a6a44), c[0] + (Math.random() - 0.5) * 0.4, c[1] + 0.1, c[2] + (Math.random() - 0.5) * 0.4); s.rotation.set((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6); }
    log(c, e, 0.3, 0.14, true);
    // the crown: bare branches fanning out from the snapped top half, some through the hole, some lying on the floor
    let rs = T.pts[0][0] * 17 + 3; const rnd = () => { rs = (rs * 9301 + 49297) % 233280; return rs / 233280; };
    const C = new THREE.Vector3(...c), E = new THREE.Vector3(...e), D = E.clone().sub(C).normalize();
    for (let i = 0; i < 9; i++) {
      const t = 0.45 + rnd() * 0.55, P = C.clone().lerp(E, t), side = new THREE.Vector3(rnd() - 0.5, rnd() * 0.6 - 0.25, rnd() - 0.5).normalize();
      const len = 0.8 + rnd() * 1.6, Q = P.clone().addScaledVector(D, len * 0.5).addScaledVector(side, len);
      const lvl = P.y < H ? 0 : 1; Q.y = Math.max(Q.y, lvl * H + 0.06);
      log(P.toArray(), Q.toArray(), 0.07, 0.02, false);
      for (let j = 0; j < 3; j++) { const R2 = Q.clone().add(new THREE.Vector3(rnd() - 0.5, rnd() * 0.5, rnd() - 0.5).multiplyScalar(0.9)); R2.y = Math.max(R2.y, lvl * H + 0.04); log(Q.toArray(), R2.toArray(), 0.025, 0.008, false); }
    }
    // root ball, torn out of the lawn
    const rb = addMesh(new THREE.DodecahedronGeometry(1.1, 1), std('roots', { color: 0x3a3024, roughness: 1, emissive: 0x10121a }), r[0], r[1] + 0.6, r[2]); rb.scale.set(1, 1, 0.45);
    rb.lookAt(new THREE.Vector3(...c)); TH.Col.addRect(0, r[0], r[2], 1.6, 1.6, true);
    for (let i = 0; i < 10; i++) { const a = rnd() * 6.28, R0 = new THREE.Vector3(r[0], r[1] + 0.5, r[2]), R1 = R0.clone().add(new THREE.Vector3(Math.cos(a) * 1.3, rnd() * 1.2 - 0.4, Math.sin(a) * 1.3)); log(R0.toArray(), R1.toArray(), 0.06, 0.015, false); }
  }
  // rubble heaped where the ceiling came down: plaster chunks, lath, a busted joist
  function rubble(level, x, z, rad, n) {
    const y = yOf(level), plaster = std('plaster', { color: 0xb8ae96, roughness: 0.95 }), lath = woodMat(0x7a5a3a);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, d = Math.random() * rad, s = 0.05 + Math.random() * 0.16; const c = addMesh(new THREE.DodecahedronGeometry(s, 0), plaster, x + Math.cos(a) * d, y + s * 0.5, z + Math.sin(a) * d); c.rotation.set(Math.random() * 3, Math.random() * 3, 0); }
    for (let i = 0; i < Math.ceil(n / 3); i++) { const a = Math.random() * 6.28, d = Math.random() * rad, b = addMesh(new THREE.BoxGeometry(0.05, 0.02, 0.6 + Math.random() * 0.8), lath, x + Math.cos(a) * d, y + 0.05 + Math.random() * 0.1, z + Math.sin(a) * d); b.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 3, (Math.random() - 0.5) * 0.3); }
  }
  // moonlight falling through a hole: a pale shaft, a pool on the floor, and a cold light in the lighting pool
  function moonShaft(level, hx, hz, topY, power) {
    const floorY = yOf(level), dy = topY - floorY, fx = hx - (MOON.x / MOON.y) * dy, fz = hz - (MOON.z / MOON.y) * dy, len = dy / MOON.y;
    if (!Hs._beamMat) {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128; const k = c.getContext('2d'), img = k.createImageData(64, 128);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) { const v = y / 127, end = Math.min(1, v / 0.12) * Math.min(1, (1 - v) / 0.25), side = Math.pow(Math.sin((x / 63) * Math.PI), 2), i = (y * 64 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = 255 * end * side * (0.55 + 0.45 * v); }
      k.putImageData(img, 0, 0);
      Hs._beamMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: 0x7f97d8, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }); Hs._beamMat.userData.noPBR = true;
      const c2 = document.createElement('canvas'); c2.width = c2.height = 128; const k2 = c2.getContext('2d'); const g2 = k2.createRadialGradient(64, 64, 0, 64, 64, 64); g2.addColorStop(0, 'rgba(255,255,255,.9)'); g2.addColorStop(0.6, 'rgba(255,255,255,.35)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); k2.fillStyle = g2; k2.fillRect(0, 0, 128, 128);
      Hs._poolMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c2), color: 0x6c84c8, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }); Hs._poolMat.userData.noPBR = true;
    }
    // two crossed soft quads along the shaft (god-ray style): they vanish edge-on instead of showing a hard tube
    const bq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), MOON);
    [0, Math.PI / 2, Math.PI / 4].forEach((a, i) => { const b2 = addMesh(new THREE.PlaneGeometry(i === 2 ? 1.2 : 1.9, len), Hs._beamMat, (hx + fx) / 2, (topY + floorY) / 2, (hz + fz) / 2); b2.quaternion.copy(bq).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a)); b2.renderOrder = 5; });
    const pool = addMesh(new THREE.CircleGeometry(1.15, 24), Hs._poolMat, fx, floorY + 0.012, fz); pool.rotation.x = -Math.PI / 2; pool.scale.set(1, 1.35, 1);
    Hs.fixtures.push({ x: fx, y: floorY + 1.3, z: fz, level, power: power || 0.7, flicker: false, moon: true, color: 0x7f9cff, range: 7.5 });
  }
  /* the roof: two pitched planes (ridge running east-west) with ragged holes where the trees went through, gable ends, eaves */
  function roof(W) {
    const yb = 2 * H, s = RIDGE / 12, zE = 12 + EAVE, yE = yb - EAVE * s, Ls = Math.hypot(zE, RIDGE + EAVE * s), xs = 16 + EAVE;
    const holes = TREES.map((t) => t.roof).concat([LIMB.roof]);
    if (!Hs._shingle) {
      const c = document.createElement('canvas'); c.width = c.height = 256; const k = c.getContext('2d'); k.fillStyle = '#2a2622'; k.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 16; r++) for (let q = 0; q < 9; q++) { const v = 30 + Math.random() * 22; k.fillStyle = `rgb(${v + 4},${v},${v - 4})`; k.fillRect(q * 32 + (r % 2) * 16 - 16, r * 16, 30, 14); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
      Hs._shingle = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x161c2c, emissiveMap: t });
      Hs._planks = new THREE.MeshStandardMaterial({ map: TH.Tex.boardWood, color: TH.Tex.photo.planks ? 0x5e564c : 0x2e241a, roughness: 1, side: THREE.DoubleSide }); Hs._planks.userData.noPBR = true;
    }
    [1, -1].forEach((side) => {
      const sh = new THREE.Shape(); sh.moveTo(-xs, 0); sh.lineTo(xs, 0); sh.lineTo(xs, Ls); sh.lineTo(-xs, Ls); sh.lineTo(-xs, 0);
      holes.filter((h) => Math.sign(h.z) === side).forEach((h, hi) => {
        const p = new THREE.Path(), n = 12; let rs = (h.x * 31 + h.z * 7) | 0 || 5; const rnd = () => { rs = (rs * 9301 + 49297) % 233280; return rs / 233280; };
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.65 + rnd() * 0.35, u = h.x + Math.cos(a) * (h.w / 2) * k, z = Math.abs(h.z) + Math.sin(a) * (h.d / 2) * k, v = (zE - z) / zE * Ls; if (i) p.lineTo(u, v); else p.moveTo(u, v); }
        sh.holes.push(p);
      });
      const mk = (mat, off) => {
        const g = new THREE.ShapeGeometry(sh), p = g.attributes.position, uv = g.attributes.uv;
        for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i), f = v / Ls; uv.setXY(i, u / 2.2, v / 2.2); p.setXYZ(i, u, yE + f * (RIDGE + EAVE * s) - off, side * (zE - f * zE)); }
        g.computeVertexNormals(); const m = addMesh(g, mat, 0, 0, 0); m.userData.dynamic = true; (Hs.roofMeshes = Hs.roofMeshes || []).push(m); return m;
      };
      mk(Hs._shingle, 0); mk(Hs._planks, 0.09);
      // exposed rafters and torn shingles around each hole
      holes.filter((h) => Math.sign(h.z) === side).forEach((h) => {
        for (let i = -1; i <= 1; i++) { const x = h.x + i * 0.6 + 0.2, z0 = Math.abs(h.z) + h.d * 0.45, z1 = Math.abs(h.z) - h.d * 0.3, y0 = yb + RIDGE * (1 - z0 / 12) - 0.12, y1 = yb + RIDGE * (1 - z1 / 12) - 0.12 - (i === 0 ? 0.6 : 0);
          const A = new THREE.Vector3(x, y0, side * z0), B = new THREE.Vector3(x, y1, side * z1), r = addMesh(new THREE.BoxGeometry(0.06, 0.16, A.distanceTo(B)), woodMat(0x5a4430), (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); r.lookAt(B); }
        for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, x = h.x + Math.cos(a) * h.w * 0.5, z = Math.abs(h.z) + Math.sin(a) * h.d * 0.5, y = yb + RIDGE * (1 - z / 12) + 0.04; const t = addMesh(new THREE.BoxGeometry(0.34, 0.015, 0.2), Hs._shingle, x, y, side * z); t.rotation.set(Math.random() - 0.5, Math.random() * 3, Math.random() - 0.5); }
      });
    });
    // gable ends (siding) and a ridge board
    [-16, 16].forEach((x) => { const g = new THREE.Shape(); g.moveTo(-12, 0); g.lineTo(12, 0); g.lineTo(0, RIDGE); g.lineTo(-12, 0); const m = addMesh(new THREE.ShapeGeometry(g), W.siding, x, yb, 0); m.rotation.y = Math.PI / 2; m.material = W.siding; m.material.side = THREE.DoubleSide; });
    addMesh(new THREE.BoxGeometry(2 * xs, 0.12, 0.2), lam(0x2a2420), 0, yb + RIDGE + 0.02, 0);
    [1, -1].forEach((sd) => addMesh(new THREE.BoxGeometry(2 * xs, 0.22, 0.05), woodMat(0x4a3a2a), 0, yE - 0.08, sd * zE)); // fascia
  }

  /* ================= BUILD ================= */
  Hs.build = function (sc) {
    scene = sc;
    Hs.h = { addMesh, lam, woodMat, fabricMat, solidMat, furn, yOf, decal, spawn, scene, fixture, candle, wardrobe, bed, trash, phong, rubble, log, barkMat };
    const DT = TH.Details, X = TH.Tex;
    const W = { red: phong(X.wallRed, 0, 0.012, 4), green: phong(X.wallGreen, 0, 0.012, 4), yellow: phong(X.wallYellow, 0, 0.012, 4), tile: phong(X.wallTile || X.tile, 0, 0.02, 40, 0x3a3a36), siding: phong(X.siding, 0, 0.02) };
    const F = { wood: phong(X.floorWood, 0, 0.022, 30, 0x2a2418), carpet: phong(X.carpet, 0, 0.014, 1, 0x000000), tile: phong(X.floorTile || X.tile, X.floorTile !== X.tile ? 0xd8d4cc : 0, 0.02, 45, 0x3a3a36) };
    const ceil = phong(X.ceiling, 0, 0.012, 2);
    Object.assign(W.siding, { emissive: new THREE.Color(0x2a3550), emissiveMap: X.siding, emissiveIntensity: 0.5 }); // moonlit outside faces
    Hs.mats = { W, F, ceil }; Hs.MOON = MOON; Hs.TREES = TREES; Hs.LIMB = LIMB;

    /* ---------- rooms ---------- */
    const R = (id, name, level, x0, x1, z0, z1, floor) => { const r = { id, name, level, x0, x1, z0, z1, floor }; Hs.rooms.push(r); return r; };
    // ground floor
    R('foyer', 'Foyer', 0, -3, 3, 6, 12, 'wood'); R('ghall', 'Grand Hall', 0, -3, 3, -4, 6, 'wood'); R('bhall', 'Back Hall', 0, -3, 3, -12, -4, 'wood');
    R('music', 'Music Room', 0, -16, -10, 4, 12, 'wood'); R('parlor', 'Parlor', 0, -10, -3, 4, 12, 'carpet'); R('library', 'Library', 0, -16, -10, -4, 4, 'wood');
    R('dining', 'Dining Room', 0, -10, -3, -4, 4, 'wood'); R('kitchen', 'Kitchen', 0, -16, -6, -12, -4, 'tile'); R('sstairs', 'Back Stairs', 0, -6, -3, -12, -4, 'wood');
    R('living', 'Living Room', 0, 3, 11, 3, 12, 'carpet'); R('sunroom', 'Sunroom', 0, 11, 16, 3, 12, 'tile'); R('den', 'TV Den', 0, 3, 9, -4, 3, 'carpet');
    R('bath', 'Bathroom', 0, 9, 12, -4, 3, 'tile'); R('pantry', 'Pantry', 0, 12, 16, -4, 3, 'wood'); R('mudroom', 'Mudroom', 0, 3, 8, -12, -4, 'tile');
    R('laundry', 'Laundry Room', 0, 8, 16, -12, -4, 'tile'); R('garage', 'Garage', 0, 16.1, 23, -12, -3, 'concrete');
    // upstairs
    R('uhall', 'Upstairs Hallway', 1, -3, 3, -12, 12, 'carpet'); R('master', 'Master Bedroom', 1, -16, -7, 3, 12, 'carpet'); R('mbath', 'Master Bath', 1, -7, -3, 7, 12, 'tile');
    R('wic', 'Walk-in Closet', 1, -7, -3, 3, 7, 'wood'); R('nursery', 'Nursery', 1, -16, -9, -4, 3, 'wood'); R('sewing', 'Sewing Room', 1, -9, -3, -4, 3, 'wood');
    R('ubath', 'Filthy Bathroom', 1, -16, -11, -12, -4, 'tile'); R('kids', 'Kid’s Bedroom', 1, -11, -6, -12, -4, 'carpet'); R('blanding', 'Back Landing', 1, -6, -3, -12, -4, 'wood');
    R('office', 'Landlord’s Office', 1, 3, 9, 3, 12, 'wood'); R('guest', 'Guest Bedroom', 1, 9, 16, 3, 12, 'carpet'); R('ubath2', 'Upstairs Bath', 1, 3, 8, -4, 3, 'tile');
    R('spare', 'Spare Bedroom', 1, 8, 16, -4, 3, 'carpet'); R('linen', 'Storage Room', 1, 3, 8, -12, -4, 'wood'); R('backbed', 'Back Bedroom', 1, 8, 16, -12, -4, 'carpet');

    /* ---------- stairs (footprints) ---------- */
    const MAIN = { x0: -3, x1: -0.8, zb: 4.5, zt: -0.5 };            // grand staircase, up toward the back
    const BACK = { x0: -5.9, x1: -3.1, zb: -10.8, zt: -5.8 };       // servants' stairs from the kitchen passage
    const CELL = { x0: 6.2, x1: 7.8, zb: -10.5, zt: -5.5 };          // mudroom stairs down to the basement workshop

    /* ---------- floors + ceilings (with every hole cut out) ---------- */
    const fl = (r) => F[r.floor] || F.wood;
    const tr = (k) => TREES.find((t) => t.name === k);
    const holesL0floor = [{ x0: CELL.x0, x1: CELL.x1, z0: CELL.zb, z1: CELL.zt }];
    const holesL1floor = [{ x0: MAIN.x0, x1: MAIN.x1, z0: MAIN.zt, z1: MAIN.zb }, { x0: -6, x1: -3, z0: -12, z1: BACK.zt }, Object.assign({ jag: true, seed: 3 }, tr('guest').floor)];
    const holesL1ceil = TREES.map((t, i) => Object.assign({ jag: true, seed: 11 + i }, t.ceil)).concat([Object.assign({ jag: true, seed: 29 }, LIMB.ceil)]);
    Hs.rooms.filter((r) => r.level === 0 && r.id !== 'garage').forEach((r) => slab(0, r.x0, r.x1, r.z0, r.z1, fl(r), ceil, false, holesL0floor, holesL1floor));
    Hs.rooms.filter((r) => r.level === 1).forEach((r) => slab(1, r.x0, r.x1, r.z0, r.z1, fl(r), ceil, false, holesL1floor, holesL1ceil));
    // the jagged edges of each hole (floor patch above, ceiling patch below)
    { const g = tr('guest').floor; holePatch(Object.assign({ seed: 3 }, g), H + 0.001, F.carpet, false, 2); holePatch(Object.assign({ seed: 3 }, g), H - 0.02, ceil, true, 3); }
    holesL1ceil.forEach((h) => holePatch(h, 2 * H - 0.02, ceil, true, 3));
    // the attic floor seen through the holes: joists and dark insulation over the upstairs ceilings
    subtract({ x0: -16, x1: 16, z0: -12, z1: 12 }, holesL1ceil.map((h) => ({ x0: h.x - h.w / 2, x1: h.x + h.w / 2, z0: h.z - h.d / 2, z1: h.z + h.d / 2 }))).forEach((r) => { const m = plane(r.x0, r.x1, r.z0, r.z1, 2 * H + 0.06, std('attic', { color: 0x2a241c, roughness: 1 }), false, 3); m.userData.dynamic = true; (Hs.roofMeshes = Hs.roofMeshes || []).push(m); });

    /* ---------- windows: openings in the outside walls (out = +1 if outside is the + side of the wall line) ---------- */
    const WIN = (level, axis, k, out, c, y, w, h, boards, cracked) => ({ level, axis, k, out, c, y, w, h: h || 1.5, boards, cracked });
    Hs.WINDOWS = [
      // ground floor
      WIN(0, 'x', 12, 1, -13, 1.75, 1.2, 1.5, 2), WIN(0, 'x', 12, 1, -4.6, 1.75, 1.1, 1.5, 0, true), WIN(0, 'x', 12, 1, 5.6, 1.75, 1.1, 1.5, 3), WIN(0, 'x', 12, 1, 13.5, 1.75, 1.4, 1.6, 1, true),
      WIN(0, 'z', -16, -1, 8, 1.75, 1.2, 1.5, 4), WIN(0, 'z', -16, -1, -0.2, 1.75, 1.2, 1.5, 2), WIN(0, 'z', -16, -1, -9.6, 1.8, 1.1, 1.2, 0),
      WIN(0, 'z', 16, 1, 7.5, 1.75, 1.4, 1.6, 0, true),
      WIN(0, 'x', -12, -1, -11, 1.85, 1.2, 1.2, 0), WIN(0, 'x', -12, -1, -1.6, 1.8, 0.9, 1.3, 2), WIN(0, 'x', -12, -1, 12.6, 1.85, 1.0, 1.2, 1),
      // upstairs
      WIN(1, 'x', 12, 1, -14.2, 1.75, 1.1, 1.5, 1), WIN(1, 'x', 12, 1, -5, 1.95, 0.8, 0.9, 0), WIN(1, 'x', 12, 1, 6, 1.8, 1.1, 1.4, 2), WIN(1, 'x', 12, 1, 12.4, 1.75, 1.1, 1.5, 0, true),
      WIN(1, 'z', -16, -1, 10, 1.75, 1.1, 1.4, 3), WIN(1, 'z', -16, -1, -2.6, 1.75, 1.0, 1.4, 0, true), WIN(1, 'z', -16, -1, -8, 2.0, 0.8, 0.9, 0),
      WIN(1, 'z', 16, 1, 5, 1.8, 1.0, 1.4, 2), WIN(1, 'z', 16, 1, -0.6, 1.75, 1.0, 1.4, 4), WIN(1, 'z', 16, 1, -8, 1.75, 1.0, 1.4, 1),
      WIN(1, 'x', -12, -1, -13.6, 2.0, 0.8, 0.9, 0), WIN(1, 'x', -12, -1, -8.4, 1.75, 1.0, 1.4, 0, true), WIN(1, 'x', -12, -1, 5.6, 1.75, 1.0, 1.4, 2), WIN(1, 'x', -12, -1, 9.6, 1.75, 1.0, 1.4, 0),
    ];

    /* ---------- outside walls ---------- */
    const P = W.red; // interior faces get each room's wallpaper; outside faces get weathered siding
    wallX(0, 12, -16.1, 16.1, P, [{ c: 0, w: 1.15, door: { name: 'Front Door', kind: 'front' } }], 1);
    wallX(0, -12, -16.1, 16.1, P, [{ c: 1, w: 1.0, door: { name: 'Back Door', kind: 'back' } }], -1);
    wallZ(0, -16, -12, 12, P, [], -1);
    wallZ(0, 16, -12, 12, P, [{ c: -5.5, w: 1.0, door: { name: 'Garage Door' } }], 1);
    wallX(1, 12, -16.1, 16.1, P, [{ c: 0, w: 1.0, door: { name: 'Balcony Door' } }], 1);
    wallX(1, -12, -16.1, 16.1, P, [{ c: 0, w: 1.0, door: { name: 'Back Deck Door' } }, { c: 12, w: 1.0, door: { name: 'Deck Door' } }], -1);
    wallZ(1, -16, -12, 12, P, [{ c: 0, w: 1.0, door: { name: 'Side Deck Door' } }], -1);
    wallZ(1, 16, -12, 12, P, [{ c: 8, w: 1.0, door: { name: 'East Deck Door' } }], 1);
    Hs.WINDOWS.forEach(windowUnit);

    /* ---------- ground floor walls ---------- */
    const crawl = (c) => ({ c, w: 0.75, win: [0, 0.72], crawl: true });
    wallZ(0, -3, -12, 12, P, [{ c: 9, w: 1.0, door: { name: 'Parlor Door' } }, { c: -2.5, w: 1.0, door: { name: 'Dining Room Door' } }, { c: -11.2, w: 1.0, door: { name: 'Back Stairs Door' } }]);
    wallZ(0, 3, -12, 12, P, [{ c: 9, w: 2.4 }, { c: 0, w: 1.0, door: { name: 'Den Door' } }, { c: -8, w: 1.0, door: { name: 'Mudroom Door' } }]);
    wallZ(0, -10, -4, 12, P, [{ c: 8, w: 1.0, door: { name: 'Music Room Door' } }, { c: 0, w: 1.0, door: { name: 'Library Door' } }]);
    wallX(0, 4, -16, -3, P, [{ c: -13, w: 1.0, door: { name: 'Music Room Door' } }, { c: -6.5, w: 2.0 }]);
    wallX(0, -4, -16, -3, P, [{ c: -13, w: 1.0, door: { name: 'Kitchen Door' } }, { c: -8, w: 1.3 }]);
    wallZ(0, -6, -12, -4, P, [{ c: -11.2, w: 1.0, door: { name: 'Back Stairs Door' } }]);
    wallX(0, 6, -3, 3, P, [{ c: 0.6, w: 3.0 }]);
    wallX(0, -4, -3, 3, P, [{ c: 1, w: 2.4 }]);
    wallX(0, -4, 3, 16, P, [crawl(5.3), { c: 14, w: 1.0, door: { name: 'Pantry Door' } }]);
    wallX(0, 3, 3, 16, P, [{ c: 5, w: 1.0, door: { name: 'Den Door' } }, { c: 14, w: 1.0, door: { name: 'Pantry Door' } }]);
    wallZ(0, 11, 3, 12, P, [{ c: 7.5, w: 2.4 }]);
    wallZ(0, 9, -4, 3, P, [{ c: -1, w: 1.0, door: { name: 'Bathroom Door' } }]);
    wallZ(0, 12, -4, 3, P, [crawl(0)]);
    wallZ(0, 8, -12, -4, P, [{ c: -11.3, w: 1.0, door: { name: 'Laundry Door' } }]);

    /* ---------- upstairs walls ---------- */
    wallZ(1, -3, -12, 12, P, [{ c: 8, w: 1.0, door: { name: 'Master Bath Door' } }, { c: 5.4, w: 0.9, door: { name: 'Closet Door' } }, { c: -2, w: 1.0, door: { name: 'Sewing Room Door' } }, { c: -4.9, w: 1.0, door: { name: 'Back Landing Door' } }]);
    wallZ(1, -7, 3, 12, P, [{ c: 5, w: 0.9, door: { name: 'Closet Door' } }, { c: 9.5, w: 1.0, door: { name: 'Master Bath Door' } }]);
    wallX(1, 7, -7, -3, P);
    wallX(1, 3, -16, -3, P, [{ c: -12.5, w: 1.0, door: { name: 'Nursery Door' } }]);
    wallZ(1, -9, -4, 3, P, [{ c: 0, w: 1.0, door: { name: 'Nursery Door' } }]);
    wallX(1, -4, -16, -3, P, [{ c: -13.5, w: 1.0, door: { name: 'Bathroom Door' } }, { c: -10, w: 1.0, door: { name: 'Kid’s Room Door' } }, crawl(-7.5)]);
    wallZ(1, -11, -12, -4, P, [{ c: -8, w: 1.0, door: { name: 'Bathroom Door' } }]);
    wallZ(1, -6, -12, -4, P, [{ c: -4.9, w: 1.0, door: { name: 'Kid’s Room Door' } }]);
    wallZ(1, 3, -12, 12, P, [{ c: 8, w: 1.0, door: { name: 'Office Door', lock: 'rusty_key' } }, { c: 0, w: 1.0, door: { name: 'Bathroom Door' } }, { c: -8, w: 1.0, door: { name: 'Storage Room Door' } }]);
    wallZ(1, 9, 3, 12, P);
    wallX(1, 3, 3, 16, P, [{ c: 12.5, w: 1.0, door: { name: 'Guest Room Door' } }]);
    wallZ(1, 8, -12, 3, P, [{ c: -1, w: 1.0, door: { name: 'Bathroom Door' } }, { c: -8, w: 1.0, door: { name: 'Back Bedroom Door' } }]);
    wallX(1, -4, 3, 16, P, [crawl(5), { c: 12, w: 1.0, door: { name: 'Back Bedroom Door' } }]);

    /* ---------- the grand staircase (up toward the back) ---------- */
    TH.Col.addStair(MAIN.x0, MAIN.x1, MAIN.zb, MAIN.zt);
    const stepMat = phong(X.floorWood, 0xcfb79a), N = 19, run = (MAIN.zb - MAIN.zt) / N;
    for (let i = 0; i < N; i++) { const y = ((i + 1) / N) * H, z = MAIN.zb - (i + 0.5) * run; addMesh(new THREE.BoxGeometry(2.2, y, run + 0.01), stepMat, -1.9, y / 2, z); addMesh(new THREE.BoxGeometry(2.24, 0.03, 0.04), stepMat, -1.9, y - 0.015, z + run / 2); }
    // ground floor: a turned balustrade up the open side (you step on at the bottom, not over the side)
    { const rail = woodMat(0x3b2414), L = Math.hypot(MAIN.zb - MAIN.zt, H);
      for (let z = MAIN.zt + 0.2; z < MAIN.zb - 0.3; z += 0.28) { const y = TH.util.clamp((z - MAIN.zb) / (MAIN.zt - MAIN.zb), 0, 1) * H; addMesh(new THREE.CylinderGeometry(0.022, 0.026, 0.9, 8), rail, -0.86, y + 0.45, z); }
      const hr = addMesh(new THREE.BoxGeometry(0.07, 0.07, L), rail, -0.86, H / 2 + 0.92, (MAIN.zb + MAIN.zt) / 2); hr.rotation.x = Math.atan2(H, MAIN.zb - MAIN.zt);
      addMesh(new THREE.CylinderGeometry(0.06, 0.07, 1.15, 10), rail, -0.86, 0.58, MAIN.zb - 0.15); addMesh(new THREE.SphereGeometry(0.08, 10, 8), rail, -0.86, 1.2, MAIN.zb - 0.15); // newel post
      TH.Col.addBox(0, -0.95, MAIN.zt - 0.1, -0.75, MAIN.zb - 0.7, false); TH.Col.addBox(0, MAIN.x0, MAIN.zt - 0.12, MAIN.x1, MAIN.zt + 0.08, false);
      // upstairs: railing round the stairwell
      const r2 = lam(0x3b2414);
      addMesh(new THREE.BoxGeometry(0.08, 0.08, MAIN.zb - MAIN.zt), r2, MAIN.x1, H + 1.0, (MAIN.zb + MAIN.zt) / 2); addMesh(new THREE.BoxGeometry(MAIN.x1 - MAIN.x0, 0.08, 0.08), r2, (MAIN.x0 + MAIN.x1) / 2, H + 1.0, MAIN.zb);
      for (let z = MAIN.zt; z <= MAIN.zb; z += 0.25) addMesh(new THREE.BoxGeometry(0.05, 1, 0.05), r2, MAIN.x1, H + 0.5, z);
      for (let x = MAIN.x0 + 0.1; x <= MAIN.x1; x += 0.25) addMesh(new THREE.BoxGeometry(0.05, 1, 0.05), r2, x, H + 0.5, MAIN.zb);
      TH.Col.addBox(1, MAIN.x1 - 0.1, MAIN.zt, MAIN.x1 + 0.1, MAIN.zb + 0.1, false); TH.Col.addBox(1, MAIN.x0, MAIN.zb - 0.1, MAIN.x1, MAIN.zb + 0.1, false); }
    { const c = addMesh(new THREE.PlaneGeometry(2.2, 5), ceil, -1.9, 2 * H - 0.02, 2); c.rotation.x = Math.PI / 2; }
    // a closed stringer down the open side of a flight, so you see a painted board and not the stacked step blocks
    function skirt(x, zb, zt, yb, yt, mat) {
      const g = new THREE.BufferGeometry(), k = 0.28, p = [x, yb, zb, x, yb + k, zb, x, yt + k, zt, x, yb, zb, x, yt + k, zt, x, yb, zt], L = Math.abs(zt - zb);
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, k, L, yt - yb + k, 0, 0, L, yt - yb + k, L, 0], 2)); g.computeVertexNormals();
      if (!Hs._skirtM) { Hs._skirtM = woodMat(0x3b2414); Hs._skirtM.side = THREE.DoubleSide; }
      addMesh(g, mat || Hs._skirtM, 0, 0, 0);
    }
    // the open side of the grand staircase is papered like the rest of the hall (it was a flat, unlit dark-wood triangle that read as a black hole),
    // with a dark wood stringer along the top edge under the treads
    { const m = paperFor(0, 'z', -0.775, 1, 1, Hs.mats.W.red).clone(); m.side = THREE.DoubleSide; skirt(-0.775, MAIN.zb, MAIN.zt, 0, H - 0.2, m);
      const L = Math.abs(MAIN.zt - MAIN.zb), ang = Math.atan2(H, L), len = Math.hypot(H, L), sg = new THREE.BoxGeometry(0.05, 0.3, len + 0.3);
      const st = addMesh(sg, woodMat(0x4a2e1a), -0.79, H / 2 + 0.05, (MAIN.zb + MAIN.zt) / 2); st.rotation.x = ang * Math.sign(MAIN.zb - MAIN.zt); }
    skirt(CELL.x0 - 0.005, CELL.zb, CELL.zt, -H, 0); // the basement side of the mudroom stairs

    /* ---------- the servants' stairs (kitchen passage up to the back landing) ---------- */
    TH.Col.addStair(BACK.x0, BACK.x1, BACK.zb, BACK.zt);
    { const runB = (BACK.zt - BACK.zb) / N; for (let i = 0; i < N; i++) { const y = ((i + 1) / N) * H, z = BACK.zb + (i + 0.5) * runB; addMesh(new THREE.BoxGeometry(BACK.x1 - BACK.x0, y, runB + 0.01), stepMat, (BACK.x0 + BACK.x1) / 2, y / 2, z); }
      TH.Col.addBox(0, -6, BACK.zt - 0.05, -3, BACK.zt + 0.15, false); // you can't walk "under" the top of the flight
      const rail = woodMat(0x3b2414), L = Math.hypot(BACK.zt - BACK.zb, H);
      [BACK.x0 + 0.05, BACK.x1 - 0.05].forEach((x) => { const r = addMesh(new THREE.CylinderGeometry(0.025, 0.025, L, 6), rail, x, H / 2 + 0.9, (BACK.zb + BACK.zt) / 2); r.rotation.x = Math.PI / 2 - Math.atan2(H, BACK.zt - BACK.zb); });
      const c = addMesh(new THREE.PlaneGeometry(3, 6.2), ceil, -4.5, 2 * H - 0.02, -8.9); c.rotation.x = Math.PI / 2; }

    /* ---------- the mudroom stairs down to the basement ---------- */
    TH.Col.addStair(CELL.x0, CELL.x1, CELL.zb, CELL.zt, -H, 0);
    { const nn = 17, runC = (CELL.zt - CELL.zb) / nn, cx = (CELL.x0 + CELL.x1) / 2, w = CELL.x1 - CELL.x0;
      for (let i = 0; i < nn; i++) { const y = -H + ((i + 1) / nn) * H, z = CELL.zb + (i + 0.5) * runC; addMesh(new THREE.BoxGeometry(w, y + H, runC + 0.01), stepMat, cx, (y - H) / 2, z); }
      const strM = woodMat(0x4a3424), L = Math.hypot(CELL.zt - CELL.zb, H);
      [CELL.x0 - 0.04, CELL.x1 + 0.04].forEach((x) => { const s2 = addMesh(new THREE.BoxGeometry(0.06, 0.3, L), strM, x, -H / 2 - 0.1, (CELL.zb + CELL.zt) / 2); s2.rotation.x = Math.atan2(H, CELL.zt - CELL.zb); });
      // the stairwell walls going down, and a rail round the opening at the top
      const block = std('block', { color: 0x6a6660, roughness: 0.95 });
      const rM = woodMat(0x3b2414);
      [[CELL.x0 - 0.08, 'z'], [CELL.x1 + 0.08, 'z']].forEach(([x]) => { addMesh(new THREE.BoxGeometry(0.06, 0.06, CELL.zt - CELL.zb), rM, x, 0.95, (CELL.zb + CELL.zt) / 2); for (let z = CELL.zb; z <= CELL.zt; z += 0.3) addMesh(new THREE.BoxGeometry(0.04, 0.95, 0.04), rM, x, 0.47, z); });
      addMesh(new THREE.BoxGeometry(w + 0.2, 0.06, 0.06), rM, cx, 0.95, CELL.zb - 0.06);
      TH.Col.addBox(0, CELL.x0 - 0.12, CELL.zb - 0.1, CELL.x0 - 0.02, CELL.zt, false); TH.Col.addBox(0, CELL.x1 + 0.02, CELL.zb - 0.1, CELL.x1 + 0.12, CELL.zt, false); TH.Col.addBox(0, CELL.x0 - 0.1, CELL.zb - 0.12, CELL.x1 + 0.1, CELL.zb - 0.02, false);
      TH.Col.addBox(-1, CELL.x0 - 0.12, CELL.zb + 0.6, CELL.x0 - 0.02, CELL.zt + 0.6, true); TH.Col.addBox(-1, CELL.x1 + 0.02, CELL.zb + 0.6, CELL.x1 + 0.12, CELL.zt + 0.6, true); TH.Col.addBox(-1, CELL.x0, CELL.zt - 0.05, CELL.x1, CELL.zt + 0.6, true); }
    Hs.CELL = CELL; Hs.MAIN = MAIN; Hs.BACK = BACK;
    Hs.groundHoles = [{ x0: CELL.x0 - 0.15, x1: CELL.x1 + 0.15, z0: CELL.zb - 0.1, z1: CELL.zt }, { x0: -9.4, x1: -7.4, z0: -17, z1: -13 }];

    // where there's floor to walk on, per level (Tim's route planner uses this; walls/furniture are handled by collision)
    Hs.walkAreas = [{ level: 0, x0: -16.1, x1: 16.1, z0: -12.1, z1: 12.1 }, { level: 0, x0: 16, x1: 23.1, z0: -12.1, z1: -2.9 }, { level: 1, x0: -16.1, x1: 16.1, z0: -12.1, z1: 12.1 }];
    TH.Col.addBox(0, -16, 12.1, 16, 16, false); // the front lawn: you only get out there through the front door (the escape)

    /* ---------- the storm: trees through the roof, the roof itself ---------- */
    TREES.forEach(fallenTree);
    roof(W);
    // the hole in the guest-room floor: fenced off by the wreckage (you'd fall through), rubble in the sunroom under it
    { const g = tr('guest').floor; TH.Col.addRect(1, g.x, g.z, g.w + 0.3, g.d + 0.3, false); rubble(1, g.x, g.z, 1.3, 16); rubble(0, g.x + 0.4, g.z - 0.3, 1.2, 26); TH.Col.addRect(0, g.x + 0.3, g.z - 0.2, 1.7, 1.5, false); }
    rubble(1, -10.8, 5.4, 1.0, 14); rubble(1, -8.9, -7.3, 1.0, 14); rubble(1, 0.4, -9.4, 1.3, 16); TH.Col.addRect(1, -10.8, 5.4, 1.3, 1.3, false); TH.Col.addRect(1, -8.9, -7.3, 1.3, 1.3, false);
    // the fallen limb across the upstairs hall (vault it, or squeeze past at the east end)
    log([LIMB.x0 - 0.3, H + 0.55, LIMB.z + 0.25], [LIMB.x1, H + 0.32, LIMB.z - 0.15], 0.26, 0.17, false);
    log([LIMB.x0 + 1.4, H + 0.6, LIMB.z + 0.1], [LIMB.x0 + 2.2, 2 * H + 1.2, LIMB.z + 0.6], 0.18, 0.12, false); // the end still up through the ceiling
    for (let i = 0; i < 6; i++) log([LIMB.x0 + 0.6 + i * 0.7, H + 0.45, LIMB.z], [LIMB.x0 + 0.9 + i * 0.7, H + 0.9 + Math.random() * 0.5, LIMB.z + (Math.random() - 0.5) * 1.6], 0.05, 0.015, false);
    TH.Col.addBox(1, LIMB.x0 - 0.2, LIMB.z - 0.35, LIMB.x1, LIMB.z + 0.35, false);
    // moonlight through every hole
    TREES.forEach((t) => moonShaft(1, t.ceil.x, t.ceil.z, 2 * H, 0.62)); moonShaft(1, LIMB.ceil.x, LIMB.ceil.z, 2 * H, 0.5);
    { const g = tr('guest').floor; moonShaft(0, g.x, g.z, H, 0.5); }

    /* ---------- outside the front ---------- */
    addMesh(new THREE.BoxGeometry(3, 0.15, 1.6), lam(0x5d5248), 0, 0.07, 13); // porch step
    { const g = new THREE.Group(); scene.add(g); g.position.set(5, 0, 17); addMesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), lam(0x3a2d22), 0, 0.6, 0, g);
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const k = c.getContext('2d'); k.fillStyle = '#d8cfb8'; k.fillRect(0, 0, 256, 128); k.fillStyle = '#b3261e'; k.font = '800 34px "Barlow Condensed", sans-serif'; k.textAlign = 'center'; k.fillText('FOR RENT', 128, 48); k.fillStyle = '#222'; k.font = '600 22px "Barlow Condensed", sans-serif'; k.fillText('TIM WRIGHT PROPERTIES', 128, 84); k.fillText('NO REFUNDS', 128, 112);
      addMesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }), 0, 1.3, 0, g); }

    /* ================= furniture: ground floor ================= */
    Hs.toilets = [];
    // Foyer
    DT.table(0, -2.3, 11.55, 1.0, 0.38, 0.8, 0x3e2a1c); spawn(0, -2.3, 0.82, 11.55, 'on the foyer table'); candle(0, -1.95, 11.55, 0.8, 1, 0.38);
    fixture(0, 0, 9, { flicker: true, power: 0.32 });
    trash(0, 2.1, 10.6, 3);
    // Grand hall
    DT.table(0, 2.7, 4.3, 0.4, 1.0, 0.8, 0x3e2a1c); spawn(0, 2.7, 0.82, 4.0, 'on the hall table'); candle(0, 2.7, 4.75, 0.8, 3, 0.45);
    fixture(0, 1.2, -1.8, { dead: true });
    // Back hall
    furn(0, -2.62, -9.5, 0.42, 1.4, 0.5, 0x4a3020); spawn(0, -2.62, 0.52, -9.7, 'on the bench in the back hall');
    fixture(0, 0, -8, { flicker: true, power: 0.3 });
    // Music room
    furn(0, -12.3, 11.1, 1.1, 0.7, 0.75, 0x3a2414); spawn(0, -12.45, 0.77, 11.1, 'on the gramophone table');
    wardrobe(0, -15.55, 5.4, Math.PI / 2, 'armoire');
    candle(0, -14.9, 11.55, 1.32, 3, 0.4);
    frame(0, -10.12, 5.6, -Math.PI / 2, 'music room portrait');
    // Parlor
    furn(0, -7.5, 11.6, 1.8, 0.6, 1.15, 0x4a4440); furn(0, -7.5, 11.72, 2.2, 0.4, 0.1, 0x4a3a2a, { y: 1.15, noCol: true }); spawn(0, -7.1, 1.27, 11.65, 'on the parlor mantel');
    addMesh(new THREE.BoxGeometry(0.9, 0.62, 0.1), lam(0x080605), -7.5, 0.36, 11.28);
    candle(0, -8.2, 11.66, 1.25, 1, 0.36); candle(0, -6.6, 11.66, 1.25, 1, 0.36);
    DT.table(0, -7.5, 9.8, 1.1, 0.55, 0.45, 0x3a2616); spawn(0, -7.3, 0.47, 9.8, 'on the parlor coffee table');
    DT.couch(0, -7.5, 8.2, 2.3, 0, 0x6a2a3a);
    frame(0, -3.12, 6.6, -Math.PI / 2, 'parlor portrait');
    // Library
    DT.table(0, -13.2, 0.3, 1.4, 0.7, 0.76, 0x4a2a14, { drawers: true }); spawn(0, -13.5, 0.78, 0.4, 'on the library desk'); DT.chair(0, -13.2, -0.5, 0);
    candle(0, -12.7, 0.5, 0.78, 1, 0.4);
    frame(0, -10.12, 2.5, -Math.PI / 2, 'library portrait');
    // Dining room
    DT.table(0, -6.5, 0.6, 2.6, 1.05, 0.76, 0x4a2f1c); spawn(0, -7.2, 0.78, 0.7, 'on the dining table');
    [[-7.5, -0.2, 0], [-5.5, -0.2, 0], [-7.5, 1.4, Math.PI], [-6.5, 1.4, Math.PI]].forEach(([x, z, r]) => DT.chair(0, x, z, r));
    DT.chair(0, -4.8, 2.4, 2.2, true);
    candle(0, -6.5, 0.6, 0.76, 3, 0.5);
    furn(0, -9.65, 2.4, 0.6, 1.8, 2.1, 0x3a2414); // china cabinet
    furn(0, -3.4, 1.6, 0.5, 1.6, 0.9, 0x3a2414); spawn(0, -3.4, 0.92, 1.3, 'on the sideboard');
    { if (!Hs._news) { const c = document.createElement('canvas'); c.width = 256; c.height = 320; const k = c.getContext('2d'); k.fillStyle = '#d8ceb0'; k.fillRect(0, 0, 256, 320); k.fillStyle = '#1a1814'; k.font = '900 30px "Barlow Condensed", serif'; k.fillText('THE DAILY LEDGER', 12, 36); k.fillRect(10, 44, 236, 2); k.font = '700 18px "Barlow Condensed", serif'; k.fillText('STORM FELLS TREES ON', 12, 70); k.fillText('WRIGHT RENTAL', 12, 90); for (let col = 0; col < 3; col++) for (let y = 104; y < 310; y += 6) k.fillRect(12 + col * 80, y, 70 - Math.random() * 12, 2); const gr = k.createRadialGradient(180, 220, 4, 180, 220, 60); gr.addColorStop(0, 'rgba(120,80,30,.4)'); gr.addColorStop(1, 'rgba(120,80,30,0)'); k.fillStyle = gr; k.fillRect(0, 0, 256, 320); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; Hs._news = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); }
      for (let i = 0; i < 7; i++) { const n = addMesh(new THREE.BoxGeometry(0.3, 0.012, 0.38), Hs._news, -5.6 + (Math.random() - 0.5) * 0.04, 0.767 + i * 0.012, 0.45 + (Math.random() - 0.5) * 0.04); n.rotation.y = (Math.random() - 0.5) * 0.3; } }
    // Kitchen: counters under the back window, fridge on the west wall, island in the middle
    const KZ = -12; // back wall
    furn(0, -12.0, KZ + 0.41, 7.2, 0.62, 0.9, 0x5a4a38); spawn(0, -13.6, 0.94, KZ + 0.4, 'on the kitchen counter');
    addMesh(new THREE.BoxGeometry(7.26, 0.04, 0.66), lam(0x7a766a), -12.0, 0.92, KZ + 0.42);
    addMesh(new THREE.BoxGeometry(0.8, 0.05, 0.5), lam(0x2a2a2a), -11, 0.95, KZ + 0.45); // sink, under the window
    furn(0, -7.95, KZ + 0.41, 0.76, 0.64, 0.93, 0x8a8a80); // stove
    furn(0, -14.2, KZ + 0.27, 2.6, 0.34, 0.75, 0x4a3a2a, { y: 1.45, noCol: true }); furn(0, -8.4, KZ + 0.27, 1.8, 0.34, 0.75, 0x4a3a2a, { y: 1.45, noCol: true }); // upper cabinets either side of the window
    furn(0, -11.5, -7.8, 1.8, 1.0, 0.92, 0x5a4a38); spawn(0, -11.2, 0.94, -7.8, 'on the kitchen island');
    trash(0, -7, -5, 5); trash(0, -15.2, -11.2, 2);
    vent(0, -15.88, -9.6, Math.PI / 2, 'kitchen');
    { // under-sink cabinet with real hinged doors
      const doorM = woodMat(0x6a4a2a), knobM = new THREE.MeshStandardMaterial({ color: 0xb0aca0, metalness: 0.9, roughness: 0.3 }), doors = [], dz = KZ + 0.735;
      [[-11.61, 1], [-10.39, -1]].forEach(([hx, side]) => { const p = new THREE.Group(); p.position.set(hx, 0, dz); p.userData.dynamic = true; scene.add(p); addMesh(new THREE.BoxGeometry(0.6, 0.68, 0.02), doorM, side * 0.3, 0.44, 0, p); addMesh(new THREE.BoxGeometry(0.02, 0.12, 0.03), knobM, side * 0.54, 0.6, 0.02, p); addMesh(new THREE.PlaneGeometry(0.56, 0.62), new THREE.MeshBasicMaterial({ color: 0x0a0806 }), side * 0.3, 0.44, -0.012, p).rotation.y = Math.PI; doors.push({ p, side }); });
      addMesh(new THREE.PlaneGeometry(1.18, 0.66), new THREE.MeshBasicMaterial({ color: 0x080605 }), -11, 0.44, dz - 0.008);
      Hs.cabinets.push({ level: 0, x: -11, z: dz + 0.06, y: 0.3, name: 'under-sink cabinet', doors, spawn: { x: -11, y: 0.06, z: dz - 0.38 } });
    }
    fixture(0, -11, -8, { flicker: true, power: 0.4 });
    // Back stairs passage
    candle(0, -4.5, -11.78, 1.1, 1, 0.3); furn(0, -4.5, -11.78, 0.5, 0.3, 0.06, 0x3a2414, { y: 1.04, noCol: true });
    // Living room
    furn(0, 9, 11.6, 1.8, 0.6, 1.15, 0x5a524a); furn(0, 9, 11.72, 2.2, 0.4, 0.1, 0x4a3a2a, { y: 1.15, noCol: true }); spawn(0, 9.5, 1.27, 11.65, 'on the living room mantel');
    addMesh(new THREE.BoxGeometry(0.9, 0.62, 0.1), lam(0x080605), 9, 0.36, 11.28);
    DT.couch(0, 8.4, 8.4, 2.3, 0, 0x5a3d66); DT.table(0, 8.4, 9.9, 1.2, 0.55, 0.45, 0x3a2616); spawn(0, 8.2, 0.47, 9.9, 'on the coffee table');
    { const ar = furn(0, 4.2, 10.8, 1.0, 1.0, 0.9, 0x5a3a2a, { mat: fabricMat(0x4a3a5a) }); ar.rotation.set(0.4, 0.5, 1.2); ar.position.y = 0.5; }
    candle(0, 9.9, 11.66, 1.25, 1, 0.38);
    frame(0, 8, 3.12, 0, 'living room portrait');
    // Sunroom: the tree came through here
    furn(0, 15.2, 10.6, 0.9, 0.9, 0.5, 0x8a6a40); spawn(0, 15.2, 0.52, 10.6, 'on the wicker table in the sunroom');
    // TV den: a 1960s console television, still on, hissing static
    DT.couch(0, 6, 0.9, 2.3, Math.PI, 0x6a5a2a);
    DT.table(0, 6, -1.3, 1.0, 0.5, 0.42, 0x4a3020); spawn(0, 5.8, 0.44, -1.3, 'on the den coffee table');
    DT.tv(0, 7.3, -3.52, 0); spawn(0, 7.0, 0.98, -3.55, 'on top of the television');
    // Bathroom
    toilet(0, 11.55, -2.0, -Math.PI / 2); Hs.toilets.push({ level: 0, x: 10.95, z: -2.0 });
    sink(0, 9.4, -3.6, Math.PI / 2); spawn(0, 9.4, 0.86, -3.45, 'on the bathroom sink');
    tub(0, 10.45, 2.45, true, 'shower', { x: 0, z: -1 });
    candle(0, 11.8, -3.75, 0.0, 1, 0.3);
    // Pantry
    shelving(0, 15.65, -0.6, 0.55, 6.4, 2.0, [0.08, 0.52, 1.02, 1.52, 1.99], '-x', 0x5a4a38); spawn(0, 15.65, 1.02, 0.5, 'on the pantry shelves'); spawn(0, 15.65, 0.52, -2.2, 'on the bottom pantry shelf');
    fixture(0, 14, -0.5, { dead: true });
    // Mudroom
    furn(0, 3.55, -4.6, 0.6, 0.6, 0.45, 0x4a3020); spawn(0, 3.55, 0.47, -4.6, 'on the mudroom stool');
    fixture(0, 5, -7.5, { flicker: true, power: 0.28 });
    // Laundry
    furn(0, 9.7, -11.55, 0.75, 0.75, 0.9, 0xd8d4c8); furn(0, 10.5, -11.55, 0.75, 0.75, 0.9, 0xc8c4b8); spawn(0, 10.5, 0.92, -11.55, 'on top of the dryer');
    wardrobe(0, 8.45, -7.2, Math.PI / 2, 'metal locker');
    trash(0, 13.5, -7, 3);
    vent(0, 13.6, -11.88, 0, 'laundry');
    fixture(0, 11.5, -8, { flicker: true, power: 0.42 });

    /* ================= furniture: upstairs ================= */
    // Upstairs hall
    DT.table(1, 2.7, 10.5, 0.38, 1.0, 0.8, 0x3e2a1c); spawn(1, 2.7, 0.82, 10.6, 'on the upstairs hall table'); candle(1, 2.7, 10.15, 0.8, 1, 0.34);
    fixture(1, 0.8, 1.5, { flicker: true, power: 0.28 }); fixture(1, 0.8, -5.5, { dead: true });
    // Master bedroom (a tree is in it)
    bed(1, -10.4, 10.85, 1.65, 2.1, Math.PI, true, 'big bed');
    spawn(1, -12.3, 0.62, 11.62, 'on the nightstand'); candle(1, -12.05, 11.62, 0.6, 1, 0.36);
    spawn(1, -15.62, 0.87, 6.2, 'on the master dresser');
    frame(1, -7.12, 7.1, -Math.PI / 2, 'master bedroom portrait');
    // Walk-in closet
    wardrobe(1, -5, 6.55, Math.PI, 'closet');
    shelving(1, -6.7, 6.42, 0.5, 1.05, 1.9, [0.08, 0.55, 1.0, 1.45, 1.89], '+x', 0x3a2a1c); spawn(1, -6.7, 1.0, 6.42, 'on the closet shelf'); // in the corner, clear of the bedroom door
    // Master bath
    tub(1, -5, 11.2, true, 'clawfoot tub', { x: 0, z: -1 }); toilet(1, -6.55, 7.6, Math.PI / 2); Hs.toilets.push({ level: 1, x: -5.95, z: 7.6 });
    sink(1, -3.4, 10.9, -Math.PI / 2); spawn(1, -3.42, 0.86, 10.65, 'on the master bath sink');
    candle(1, -3.32, 11.5, 0.86, 1, 0.3);
    // Nursery
    wardrobe(1, -9.45, 1.75, -Math.PI / 2, 'nursery wardrobe'); // between the sewing-room door and the corner, clear of every door
    furn(1, -14.6, 1.9, 1.3, 0.75, 0.9, 0xd8d0c0, { noCol: false }); // crib
    furn(1, -15.4, -3.4, 0.9, 0.5, 0.5, 0x8a5a3a); spawn(1, -15.4, 0.52, -3.4, 'on the toy chest');
    vent(1, -15.88, -1.5, Math.PI / 2, 'nursery');
    fixture(1, -12.5, -1, { flicker: true, power: 0.22 });
    // Sewing room
    DT.table(1, -5.2, 2.55, 1.3, 0.6, 0.76, 0x6a4a2a); spawn(1, -5.5, 0.78, 2.55, 'on the sewing table'); DT.lamp(1, -4.6, 2.6, 0.78, 0x3a5a3a);
    // Kid's bedroom (a tree is in it too)
    bed(1, -10.2, -10.9, 1.05, 1.95, 0, true, 'kid’s bed');
    DT.table(1, -6.9, -11.4, 1.1, 0.55, 0.75, 0x6a4a2a); spawn(1, -6.9, 0.77, -11.4, 'on the kid’s desk');
    // Filthy bathroom
    toilet(1, -15.45, -6.5, Math.PI / 2); Hs.toilets.push({ level: 1, x: -14.85, z: -6.5 });
    sink(1, -11.4, -10.2, -Math.PI / 2); spawn(1, -11.4, 0.86, -9.95, 'on the bathroom sink');
    tub(1, -13.3, -11.25, true, 'shower curtain', { x: 0, z: 1 });
    fixture(1, -13.5, -8, { flicker: true, power: 0.26 });
    Hs.drips = [{ x: -12.5, z: -6, level: 1 }, { x: 13.5, z: 6.5, level: 0 }, { x: -9.5, z: -8, level: 0 }, { x: 0.4, z: -9.2, level: 1 }];
    // Back landing
    candle(1, -4.5, -4.22, 1.1, 1, 0.3); furn(1, -4.5, -4.22, 0.5, 0.3, 0.06, 0x3a2414, { y: 1.04, noCol: true });
    // Landlord's office (locked)
    DT.table(1, 6.3, 10.6, 1.6, 0.8, 0.76, 0x4a2a14, { drawers: true }); DT.chair(1, 6.3, 9.8, Math.PI); Hs.officeDesk = { x: 6.3, y: H + 0.78, z: 10.35 };
    furn(1, 8.55, 4.0, 0.6, 0.6, 1.3, 0x6a6a64); // filing cabinet
    { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const k = c.getContext('2d'); k.fillStyle = '#f4f0e0'; k.fillRect(0, 0, 128, 64); k.fillStyle = '#b3261e'; k.font = '700 18px "Barlow Condensed", sans-serif'; k.fillText('RENT LEDGER', 8, 24); k.fillStyle = '#333'; k.fillRect(8, 34, 100, 2); k.fillRect(8, 44, 80, 2);
      addMesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c) }), 6.8, H + 0.79, 10.7).rotation.x = -Math.PI / 2; }
    DT.lamp(1, 5.6, 10.8, 0.78, 0x2a5a3a);
    // Guest bedroom (the big tree)
    bed(1, 14.6, 10.85, 1.45, 2.05, Math.PI, true, 'guest bed');
    spawn(1, 9.38, 0.77, 10.2, 'on the guest room chest');
    // Upstairs bath (Jack-and-Jill)
    tub(1, 5.5, 2.45, true, 'bathtub', { x: 0, z: -1 }); toilet(1, 7.45, -3.0, -Math.PI / 2); Hs.toilets.push({ level: 1, x: 6.85, z: -3.0 });
    sink(1, 3.4, -2.6, Math.PI / 2); spawn(1, 3.42, 0.86, -2.35, 'on the bathroom sink');
    candle(1, 3.32, -3.3, 0.86, 1, 0.28);
    // Spare bedroom
    bed(1, 15.1, 0.5, 1.05, 1.95, Math.PI, true, 'spare bed');
    vent(1, 15.88, -2.5, -Math.PI / 2, 'spare room');
    spawn(1, 10, 0.03, -2.8, 'on the floor of the spare room');
    fixture(1, 11.5, -0.5, { dead: true });
    // Storage room
    shelving(1, 6.2, -11.6, 3.2, 0.5, 1.02, [0.08, 0.54, 1.0], '+z', 0x3a2a1c); /* kept low so it doesn't cover the window */ spawn(1, 6.5, 1.0, -11.6, 'on the storage shelves');
    // Back bedroom (you wake up here)
    bed(1, 9.6, -10.9, 1.45, 2.05, 0, true, 'bed');
    spawn(1, 15.62, 0.87, -8.9, 'on the dresser'); candle(1, 15.62, -8.1, 0.87, 1, 0.42);
    spawn(1, 10.65, 0.62, -11.65, 'on the nightstand');

    /* ---------- portraits along the halls (easy to knock off if you hug the walls) ---------- */
    frame(0, -2.88, 7.3, Math.PI / 2, 'foyer portrait'); frame(0, 2.88, 2.6, -Math.PI / 2, 'hall portrait'); frame(0, -2.88, -7.2, Math.PI / 2, 'back hall portrait');
    frame(1, 2.88, 5.4, -Math.PI / 2, 'hallway portrait'); frame(1, -2.88, -8.2, Math.PI / 2, 'landing portrait');

    /* ---------- decals: graffiti, holes ---------- */
    const G = TH.Tex.graffiti;
    decal(G('TIM WRIGHT\nOWES ME $', '#c8372d', 1.8), -2.88, 1.7, 10.9, Math.PI / 2);
    decal(G('RENT IS DUE', '#d9b44a', 1.6), 6.6, 1.9, 3.12, 0); // between the den door and the portrait
    decal(G('DON’T EAT\nTHE CEREAL', '#7cc4d9', 2), -6.12, 1.6, -8, -Math.PI / 2);
    decal(G('HE HEARS\nEVERYTHING', '#c8372d', 2.2), 2.88, H + 1.7, -2.4, -Math.PI / 2);
    decal(G('IIII', '#e8e0d0', 1.2), -15.88, H + 1.5, -6, Math.PI / 2);
    decal(G('NO REFUNDS', '#7c8f4e', 1.8), 14.5, H + 1.7, 3.12, 0);
    decal(G('THE TREES\nWERE A SIGN', '#c8c0b0', 1.8), -9.12, H + 1.6, -2.3, -Math.PI / 2);
    [[-2.88, 0.6, 3, Math.PI / 2, 0.3], [3.9, 1.2, 11.88, Math.PI, 0.4], [-7, H + 0.8, 3.12, 0, 0.35], [15.88, H + 1.2, 6, -Math.PI / 2, 0.45], [-3.7, 0.5, 11.88, Math.PI, 0.28], [-12, 0.7, -3.88, Math.PI, 0.3]].forEach(([x, y, z, ry, r]) => decal(TH.Tex.hole(r), x, y, z, ry));

    /* ---------- creaky floorboards ---------- */
    Hs.creaks = [{ x: 0, z: 8.2, level: 0, r: 1.0 }, { x: 1.4, z: 2, level: 0, r: 0.9 }, { x: 0, z: -6.5, level: 0, r: 0.9 }, { x: -5.6, z: -2.6, level: 0, r: 0.9 }, { x: -9, z: -6, level: 0, r: 0.9 },
      { x: 6, z: 6, level: 0, r: 0.9 }, { x: 4.6, z: -2.2, level: 0, r: 0.8 }, { x: 11.5, z: -6.5, level: 0, r: 0.9 }, { x: -13, z: 8, level: 0, r: 0.8 },
      { x: 1.6, z: 2, level: 1, r: 0.9 }, { x: 0.5, z: -6, level: 1, r: 0.9 }, { x: 0, z: 9, level: 1, r: 0.8 }, { x: -12.5, z: 7.6, level: 1, r: 0.8 }, { x: -12, z: -1.5, level: 1, r: 0.8 },
      { x: -6, z: 0, level: 1, r: 0.8 }, { x: 11, z: 9, level: 1, r: 0.8 }, { x: 11, z: 0, level: 1, r: 0.8 }, { x: 11.5, z: -6.5, level: 1, r: 0.8 }, { x: -9.5, z: -10, level: 1, r: 0.8 }];
    { const cm = new THREE.MeshLambertMaterial({ color: 0x1a1008, transparent: true, opacity: 0.35 }); Hs.creaks.forEach((c) => { const m = addMesh(new THREE.PlaneGeometry(1.2, 0.5), cm, c.x, yOf(c.level) + 0.004, c.z); m.rotation.x = -Math.PI / 2; }); }

    if (TH.Garage) TH.Garage.build(scene);
    if (TH.Shortcuts) TH.Shortcuts.build(scene);
    if (TH.Openables) TH.Openables.build(scene);
    if (TH.Grounds) TH.Grounds.build(scene);
    if (TH.Details) TH.Details.build();
    Hs.buildNav();
  };

  /* ---------- Tim's waypoint graph, worked out from the finished house: one node per room, one per doorway or opening,
     one at each end of every staircase. (He plans actual footsteps on TH.Grid; this graph is for his rounds and for
     carrying sound round corners.) ---------- */
  Hs.buildNav = function () {
    const N = (Hs.nav.nodes = {}), E = (Hs.nav.edges = []), C = TH.Col, rooms = Hs.rooms;
    const free = (x, z, lv, r) => !C.boxes[lv].some((b) => !b.off && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);
    const roomNode = {};
    rooms.forEach((rm) => {
      const cx = (rm.x0 + rm.x1) / 2, cz = (rm.z0 + rm.z1) / 2; let best = null;
      for (let rr = 0; rr < 6 && !best; rr += 0.25) for (let a = 0; a < 6.28 && !best; a += 0.5) { const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr; if (x > rm.x0 + 0.4 && x < rm.x1 - 0.4 && z > rm.z0 + 0.4 && z < rm.z1 - 0.4 && free(x, z, rm.level, 0.45) && !C.stairAt(x, z, rm.level * H)) best = { x, z }; }
      best = best || { x: cx, z: cz };
      const id = 'r' + rm.id; N[id] = { id, x: best.x, z: best.z, level: rm.level, room: rm }; roomNode[rm.id + '@' + rm.level] = id;
    });
    const at = (x, z, lv) => { const r = Hs.roomAt(x, z, lv); return r ? roomNode[r.id + '@' + r.level] : null; };
    const link = (a, b) => { if (a && b && a !== b && !E.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) E.push([a, b]); };
    // doors
    TH.Doors.list.forEach((d, i) => {
      const id = 'd' + i; N[id] = { id, x: d.x, z: d.z, level: d.level };
      const nx = d.axis === 'x' ? 0 : 0.5, nz = d.axis === 'x' ? 0.5 : 0;
      const a = at(d.x - nx, d.z - nz, d.level), b = at(d.x + nx, d.z + nz, d.level); link(a, id); link(id, b);
    });
    // open boundaries between rooms (arches, the decks running into each other, the shed doorway, basement openings)
    let on = 0;
    rooms.forEach((A) => {
      const lv = A.level, edges = [[A.x0, A.z0, A.x1, A.z0, 0, -1], [A.x0, A.z1, A.x1, A.z1, 0, 1], [A.x0, A.z0, A.x0, A.z1, -1, 0], [A.x1, A.z0, A.x1, A.z1, 1, 0]];
      edges.forEach(([x0, z0, x1, z1, ox, oz]) => {
        const len = Math.hypot(x1 - x0, z1 - z0), runs = []; let cur = null;
        for (let t = 0.3; t < len - 0.3; t += 0.25) {
          const px = x0 + ((x1 - x0) * t) / len, pz = z0 + ((z1 - z0) * t) / len, ix = px - ox * 0.45, iz = pz - oz * 0.45, qx = px + ox * 0.45, qz = pz + oz * 0.45;
          const B = Hs.roomAt(qx, qz, lv), inA = Hs.roomAt(ix, iz, lv);
          const ok = B && inA === A && B !== A && C.walkable(ix, iz, qx, qz, lv, 0.22) && !C.stairAt(px, pz, lv * H);
          if (ok && cur && cur.B === B) { cur.t1 = t; cur.px = px; cur.pz = pz; } else if (ok) { cur = { B, t0: t, t1: t, sx: px, sz: pz, px, pz }; runs.push(cur); } else cur = null;
        }
        runs.filter((r) => r.t1 - r.t0 >= 0.45).forEach((r) => {
          const mx = (r.sx + r.px) / 2, mz = (r.sz + r.pz) / 2, a = roomNode[A.id + '@' + lv], b = roomNode[r.B.id + '@' + lv];
          const dup = Object.values(N).some((n) => n.open && n.level === lv && Math.hypot(n.x - mx, n.z - mz) < 1.2);
          if (dup) return;
          const id = 'o' + on++; N[id] = { id, x: mx, z: mz, level: lv, open: true }; link(a, id); link(id, b);
        });
      });
    });
    // staircases
    C.stairs.forEach((s, i) => {
      const cx = (s.x0 + s.x1) / 2, out = Math.sign(s.zb - s.zt) || 1, b = { x: cx, z: s.zb + out * 0.55 }, t = { x: cx, z: s.zt - out * 0.55 };
      N['sb' + i] = { id: 'sb' + i, x: b.x, z: b.z, level: s.lb }; N['st' + i] = { id: 'st' + i, x: t.x, z: t.z, level: s.lt };
      link(at(b.x, b.z, s.lb), 'sb' + i); link('sb' + i, 'st' + i); link('st' + i, at(t.x, t.z, s.lt));
    });
    // his rounds: every room big enough to walk into
    Hs.patrol = Object.values(N).filter((n) => n.room && (n.room.x1 - n.room.x0) * (n.room.z1 - n.room.z0) > 7 && !['cellar', 'sstairs'].includes(n.room.id)).map((n) => n.id);
  };

  // the roof only needs drawing when you could actually see it: from outside, or looking up through one of the holes
  Hs.update = function () {
    const c = TH.camera; if (!c || !Hs.roofMeshes) return; const p = c.getWorldPosition ? c.getWorldPosition(Hs._cp || (Hs._cp = new THREE.Vector3())) : c.position;
    const inside = p.x > -16.1 && p.x < 16.1 && p.z > -12.1 && p.z < 12.1 && p.y < 2 * H;
    const near = TREES.some((t) => Math.hypot(p.x - t.ceil.x, p.z - t.ceil.z) < 7) || Math.hypot(p.x - LIMB.ceil.x, p.z - LIMB.ceil.z) < 7;
    const show = !inside || (p.y > H && near);
    if (show !== Hs._roofOn) { Hs._roofOn = show; Hs.roofMeshes.forEach((m) => (m.visible = show)); }
  };

  Hs.roomAt = function (x, z, level) { return Hs.rooms.find((r) => r.level === level && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1); };
})();
