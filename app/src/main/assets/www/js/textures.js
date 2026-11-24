/* TRAP HOUSE — procedural textures (no image files). Seamless tiling, multi-octave noise, real-world scale:
   wallpaper repeats every 1.3 m, floorboards are ~12 cm wide, tiles ~15 cm. Colour maps double as bump maps. */
(function () {
  'use strict';
  const TH = window.TH;

  function canvas(n, m) { const c = document.createElement('canvas'); c.width = n; c.height = m || n; return [c, c.getContext('2d', { willReadFrequently: true })]; }
  const rnd = (a, b) => a + Math.random() * (b - a);

  // periodic value noise → seamless when the canvas tiles
  function tileNoise(n, cells, oct) {
    const out = new Float32Array(n * n); let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const P = cells << o, lat = new Float32Array(P * P); for (let i = 0; i < lat.length; i++) lat[i] = Math.random();
      const s = P / n;
      for (let y = 0; y < n; y++) {
        const fy = y * s, iy = Math.floor(fy), ty = fy - iy, vy = ty * ty * (3 - 2 * ty), y0 = (iy % P) * P, y1 = ((iy + 1) % P) * P;
        for (let x = 0; x < n; x++) {
          const fx = x * s, ix = Math.floor(fx), tx = fx - ix, vx = tx * tx * (3 - 2 * tx), x0 = ix % P, x1 = (ix + 1) % P;
          const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1];
          out[y * n + x] += amp * (a + (b - a) * vx + (c - a) * vy + (a - b - c + d) * vx * vy);
        }
      }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }
  // paint noise into the canvas: base colour × brightness variation
  function noiseFill(g, n, rgb, cells, oct, var_, tint) {
    const N = tileNoise(n, cells, oct), img = g.getImageData(0, 0, n, n), d = img.data;
    for (let i = 0; i < n * n; i++) {
      const k = 1 + (N[i] - 0.5) * var_;
      d[i * 4] = Math.min(255, rgb[0] * k + (tint ? tint[0] * (N[i] - 0.5) : 0)); d[i * 4 + 1] = Math.min(255, rgb[1] * k + (tint ? tint[1] * (N[i] - 0.5) : 0)); d[i * 4 + 2] = Math.min(255, rgb[2] * k + (tint ? tint[2] * (N[i] - 0.5) : 0)); d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  // multiply an existing canvas by fine grain
  function grain(g, n, amount, cells) {
    const N = tileNoise(n, cells || n / 4, 2), img = g.getImageData(0, 0, n, n), d = img.data;
    for (let i = 0; i < n * n; i++) { const k = 1 + (N[i] - 0.5) * amount; d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k; }
    g.putImageData(img, 0, 0);
  }
  // draw something wrapped at the edges so it tiles
  // make any painted canvas tile without a visible seam: near its edges it fades into a copy of itself shifted by half,
  // so blotches, cracks and stains that ran off one edge no longer stop dead where the next tile starts
  function seamless(c) {
    const w = c.width, h = c.height, k = c.getContext('2d'), src = k.getImageData(0, 0, w, h).data, out = k.createImageData(w, h), o = out.data, bw = w / 4, bh = h / 4;
    for (let y = 0; y < h; y++) { const ay = Math.min(1, Math.min(y, h - 1 - y) / bh), sy = (y + (h >> 1)) % h;
      for (let x = 0; x < w; x++) { const ax = Math.min(1, Math.min(x, w - 1 - x) / bw); let a = Math.min(ax, ay); a = a * a * (3 - 2 * a);
        const i = (y * w + x) * 4, j = (sy * w + ((x + (w >> 1)) % w)) * 4;
        o[i] = src[i] * a + src[j] * (1 - a); o[i + 1] = src[i + 1] * a + src[j + 1] * (1 - a); o[i + 2] = src[i + 2] * a + src[j + 2] * (1 - a); o[i + 3] = src[i + 3] * a + src[j + 3] * (1 - a); } }
    k.putImageData(out, 0, 0); return c;
  }
  TH.seamless = seamless;
  function wrap(n, x, y, r, fn) { for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) if (x + ox > -r && x + ox < n + r && y + oy > -r && y + oy < n + r) fn(x + ox, y + oy); }
  function stains(g, n, size, count, color, alpha) {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * n, y = Math.random() * n, r = rnd(size * 0.35, size);
      wrap(n, x, y, r, (px, py) => {
        const gr = g.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, `rgba(${color},${alpha * 0.6})`); gr.addColorStop(0.75, `rgba(${color},${alpha})`); gr.addColorStop(0.9, `rgba(${color},${alpha * 0.4})`); gr.addColorStop(1, `rgba(${color},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, 6.283); g.fill();
      });
    }
  }
  function tex(c) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = TH.settings.quality === 'low' ? 2 : 8; t.encoding = THREE.sRGBEncoding; return t; }

  // photo-scanned material sets in tex/: <name>_d.jpg colour (1024; _s.jpg 512 on Low), _n.jpg normal, _r.jpg roughness
  const PHOTOS = ['bark', 'planks', 'peelwall', 'floor', 'plaster', 'rust', 'timber', 'paintwood', 'barrel', 'boards', 'gdoor', 'stone', 'gravel', 'concrete', 'ground', 'grass', 'teddy', 'jacq', 'wtile', 'ftile', 'siding', 'mwood', 'linen', 'bluemetal', 'rustsheet'];
  // organic surfaces (no grid of boards or tiles) get the anti-repeat shader so you never see the same peel / rust blotch twice
  const ANTI = new Set(['peelwall', 'plaster', 'rust', 'rustsheet', 'grass', 'ground', 'gravel', 'concrete', 'stone', 'bark']);

  /* Anti-tiling: the texture is read twice at different random offsets and the two are blended by a low-frequency noise,
     so neighbouring tiles never match (Inigo Quilez's "texture repetition" trick). Needs WebGL2 for textureGrad. */
  const ANTI_GLSL = `
float atH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float atN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(atH(i), atH(i + vec2(1.0, 0.0)), f.x), mix(atH(i + vec2(0.0, 1.0)), atH(i + vec2(1.0, 1.0)), f.x), f.y); }
vec2 atA; vec2 atB; float atW; vec2 atDX; vec2 atDY;
void atSetup(vec2 uv){ float k = atN(uv * 1.35 + 7.3) * 9.0 + atN(uv * 3.3 + 1.7) * 1.4; float ia = floor(k), f = fract(k);
  atA = uv + vec2(atH(vec2(ia, 1.3)), atH(vec2(ia, 7.9))); atB = uv + vec2(atH(vec2(ia + 1.0, 1.3)), atH(vec2(ia + 1.0, 7.9))); atW = smoothstep(0.32, 0.68, f);
  atDX = dFdx(uv); atDY = dFdy(uv); }
vec4 atTex(sampler2D s){ return mix(textureGrad(s, atA, atDX, atDY), textureGrad(s, atB, atDX, atDY), atW); }
`;

  const T = (TH.Tex = {
    photo: {}, nrm: new Map(), rgh: new Map(), antiSet: new Set(),
    // fetch the scanned textures before the house is built (missing files just fall back to the painted canvases)
    load() {
      // phones get the 512 px colour maps unless they're on Ultra (keeps video memory in check)
      const low = TH.settings.quality === 'low', small = low || (TH.util.isTouch && TH.settings.quality !== 'ultra'), L = new THREE.TextureLoader(), cache = {};
      const one = (url, srgb) => new Promise((res) => L.load(url, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = low ? 2 : 8; if (srgb) t.encoding = THREE.sRGBEncoding; res(t); }, undefined, () => res(null)));
      const extra = (k, kind) => cache[k + kind] || (cache[k + kind] = one(`tex/${k}_${kind}.jpg`, false));
      return Promise.all(PHOTOS.map(async (k) => {
        const [d, n, r] = await Promise.all([one(`tex/${k}_${small ? 's' : 'd'}.jpg`, true), low ? null : extra(k, 'n'), low ? null : extra(k, 'r')]);
        if (!d) return; T.photo[k] = d; if (n) T.nrm.set(d, n); if (r) T.rgh.set(d, r); if (ANTI.has(k)) T.antiSet.add(d);
      }));
    },
    // a copy of a scanned texture with its own repeat/rotation (shares the image and the normal/roughness maps)
    pclone(k, rx, ry, rot) {
      const src = T.photo[k]; if (!src) return null; const t = src.clone(); t.needsUpdate = true; t.repeat.set(rx || 1, ry || rx || 1);
      if (rot) { t.center.set(0.5, 0.5); t.rotation = rot; }
      if (T.nrm.has(src)) T.nrm.set(t, T.nrm.get(src)); if (T.rgh.has(src)) T.rgh.set(t, T.rgh.get(src)); if (T.antiSet.has(src)) T.antiSet.add(t); return t;
    },
    // give a material the normal + roughness maps that belong with its colour map
    dress(m) {
      if (!m || !m.userData || m.userData.dressed) return; m.userData.dressed = true;
      if (m.map && T.antiSet.has(m.map)) T.anti(m);
      const n = m.map && T.nrm.get(m.map); if (!n || !('normalMap' in m)) return;
      const k = m.userData.nScale || 1; m.normalMap = n; m.normalScale.set(k, k); m.bumpMap = null;
      const r = T.rgh.get(m.map); if (r && m.isMeshStandardMaterial) { m.roughnessMap = r; m.roughness = Math.max(m.roughness, 0.9); }
      m.needsUpdate = true;
    },
    // patch a material's shader so its colour / normal / roughness / emissive maps are read with anti-tiling
    anti(m) {
      if (m._anti) return; m._anti = true;
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        if (prev) prev(sh, r);
        if (!r.capabilities.isWebGL2) return; // WebGL1 phones: plain tiling
        let f = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + ANTI_GLSL);
        f = f.replace('#include <map_fragment>', '#ifdef USE_MAP\n atSetup(vUv);\n vec4 texelColor = mapTexelToLinear(atTex(map));\n diffuseColor *= texelColor;\n#endif');
        const C = THREE.ShaderChunk, sub = (inc, from, to) => { f = f.replace('#include <' + inc + '>', C[inc].split(from).join(to)); };
        sub('normal_fragment_maps', 'texture2D( normalMap, vUv )', 'atTex( normalMap )');
        sub('roughnessmap_fragment', 'texture2D( roughnessMap, vUv )', 'atTex( roughnessMap )');
        sub('emissivemap_fragment', 'texture2D( emissiveMap, vUv )', 'atTex( emissiveMap )');
        sh.fragmentShader = f;
      };
      m.customProgramCacheKey = () => 'anti1';
      m.needsUpdate = true;
    },
    // shift a box's UVs by its place in the world, so neighbouring wall pieces don't start their texture at the same spot
    shiftUV(geo, du, dv) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv); uv.needsUpdate = true; return geo; },
    // painted door / window trim: solid boards, white paint over the grain, which runs along each piece (vertical on the sides, along the head)
    trim(horizontal) {
      const key = horizontal ? '_trimH' : '_trimV'; if (T[key]) return T[key];
      if (!T._trimC) {
        const W = 64, Hh = 1024, [c, g] = canvas(W, Hh), [b, h] = canvas(W, Hh);
        g.fillStyle = '#e4ded2'; g.fillRect(0, 0, W, Hh); h.fillStyle = '#808080'; h.fillRect(0, 0, W, Hh);
        for (let i = 0; i < 26; i++) { const x = rnd(0, W), a = rnd(0.03, 0.08), wd = rnd(0.6, 2.2); g.strokeStyle = `rgba(120,100,70,${a})`; g.lineWidth = wd; h.strokeStyle = `rgba(0,0,0,${a * 2.2})`; h.lineWidth = wd + 0.5;
          for (const k of [g, h]) { k.beginPath(); k.moveTo(x, 0); for (let y = 0; y <= Hh; y += 32) k.lineTo(x + Math.sin(y * 0.004 + i) * 3, y); k.stroke(); } } // grain telegraphing through the paint
        const dirt = g.createLinearGradient(0, 0, 0, Hh); dirt.addColorStop(0, 'rgba(70,58,40,0)'); dirt.addColorStop(0.82, 'rgba(70,58,40,0.06)'); dirt.addColorStop(1, 'rgba(60,48,32,0.32)'); g.fillStyle = dirt; g.fillRect(0, 0, W, Hh); // scuffed near the floor
        for (let i = 0; i < 9; i++) { const y = rnd(0, Hh), x = Math.random() < 0.5 ? rnd(0, 6) : rnd(W - 6, W), r = rnd(1.5, 5); g.fillStyle = 'rgba(96,70,44,.75)'; g.beginPath(); g.ellipse(x, y, r * 0.6, r * 2, 0, 0, 6.3); g.fill(); h.fillStyle = 'rgba(0,0,0,.4)'; h.beginPath(); h.ellipse(x, y, r * 0.6, r * 2, 0, 0, 6.3); h.fill(); } // chips on the edges
        for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(80,70,50,${rnd(0.05, 0.15)})`; g.fillRect(rnd(0, W), rnd(0, Hh), rnd(1, 3), rnd(2, 8)); }
        T._trimC = { c, b };
      }
      const mk = (src) => { const t = new THREE.CanvasTexture(src); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (horizontal) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; } return t; };
      const map = mk(T._trimC.c); map.encoding = THREE.sRGBEncoding;
      return (T[key] = new THREE.MeshPhongMaterial({ map, bumpMap: TH.tier && TH.tier.hi() ? mk(T._trimC.b) : null, bumpScale: 0.01, color: 0xffffff, shininess: 34, specular: 0x2a2a28 }));
    },
    dressAll(root) { root.traverse((o) => { if (o.material) [].concat(o.material).forEach(T.dress); }); },
    // turn a plain metal material into rusted steel
    rusty(m, tint, key, rx, ry) {
      const t = rx ? T.pclone(key || 'rust', rx, ry) : T.photo[key || 'rust']; if (!t || !m) return m;
      m.map = t; if (m.emissive && m.emissive.getHex() && !m.emissiveMap) m.emissiveMap = t;
      m.color.setHex(tint || 0xbab2aa); if (m.isMeshStandardMaterial) { m.metalness = Math.min(m.metalness, 0.45); m.roughness = 1; }
      m.needsUpdate = true; return m;
    },
    // an oak barrel: bellied staves and iron hoops (scanned), plank lid
    barrel() {
      if (!T._barrel) {
        const H0 = 0.9, R0 = 0.31, pts = [];
        for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(R0 * (0.84 + 0.16 * Math.sin(Math.PI * t)), t * H0)); }
        const side = new THREE.LatheGeometry(pts, 28), uv = side.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 2);
        const lid = new THREE.CircleGeometry(R0 * 0.84 - 0.012, 28); lid.rotateX(-Math.PI / 2);
        const rim = new THREE.TorusGeometry(R0 * 0.84 - 0.006, 0.012, 6, 28); rim.rotateX(Math.PI / 2);
        const P = T.photo;
        T._barrel = { side, lid, rim, H0,
          sideM: new THREE.MeshStandardMaterial({ map: P.barrel || T.wood, color: P.barrel ? 0xe0d8d0 : 0x5a3a20, roughness: 1, side: THREE.DoubleSide }),
          lidM: new THREE.MeshStandardMaterial({ map: P.planks || T.wood, color: 0x8a7a68, roughness: 1 }) };
      }
      const B = T._barrel, g = new THREE.Group();
      g.add(new THREE.Mesh(B.side, B.sideM));
      const lid = new THREE.Mesh(B.lid, B.lidM); lid.position.y = B.H0 - 0.025; g.add(lid);
      const rim = new THREE.Mesh(B.rim, B.sideM); rim.position.y = B.H0 - 0.006; g.add(rim);
      return g;
    },
    make() {
      const hi = TH.settings.quality === 'ultra', N = hi ? 1024 : 512, s = N / 512;

      /* Damask wallpaper: printed motif, paper texture, stains, tide-marks, seams, scuffs */
      const wallpaper = (base, ink, light) => {
        const [c, g] = canvas(N);
        noiseFill(g, N, base, 4, 5, 0.18);
        // pattern tile: symmetric fleur
        const tile = 128 * s, [pc, pg] = canvas(tile);
        pg.fillStyle = ink; pg.strokeStyle = ink; pg.lineWidth = 1.5 * s;
        const fleur = (cx, cy, sc) => {
          pg.save(); pg.translate(cx, cy); pg.scale(sc * s, sc * s);
          for (const m of [1, -1]) {
            pg.save(); pg.scale(m, 1); pg.beginPath(); pg.moveTo(0, -30); pg.bezierCurveTo(14, -22, 18, -6, 6, 2); pg.bezierCurveTo(16, 8, 20, 22, 4, 28); pg.lineTo(0, 30); pg.closePath(); pg.fill();
            pg.beginPath(); pg.moveTo(8, -10); pg.bezierCurveTo(26, -18, 30, 4, 16, 6); pg.stroke();
            pg.beginPath(); pg.arc(20, 18, 3, 0, 6.28); pg.fill(); pg.restore();
          }
          pg.beginPath(); pg.ellipse(0, -36, 3, 6, 0, 0, 6.28); pg.fill(); pg.restore();
        };
        fleur(tile / 2, tile / 2, 1); fleur(0, 0, 0.5); fleur(tile, 0, 0.5); fleur(0, tile, 0.5); fleur(tile, tile, 0.5);
        pg.fillStyle = light; for (let i = 0; i < tile; i += 16 * s) pg.fillRect(i, 0, 1 * s, tile);
        g.fillStyle = g.createPattern(pc, 'repeat'); g.globalAlpha = 0.55; g.fillRect(0, 0, N, N); g.globalAlpha = 1;
        // paper seams every half-metre-ish strip
        for (let x = 0; x < N; x += N / 2) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, 0, 2 * s, N); g.fillStyle = 'rgba(255,240,210,.08)'; g.fillRect(x + 2 * s, 0, 1 * s, N); }
        stains(g, N, 130 * s, 4, '92,70,30', 0.22);           // water damage
        stains(g, N, 50 * s, 7, '60,45,20', 0.16);
        for (let i = 0; i < 4; i++) { const x = rnd(0, N), y = rnd(0, N), r = rnd(40, 90) * s; wrap(N, x, y, r, (px, py) => { g.strokeStyle = 'rgba(90,65,25,.28)'; g.lineWidth = 2 * s; g.beginPath(); g.ellipse(px, py, r, r * 0.7, rnd(0, 3), 0, 6.28); g.stroke(); }); } // tide-marks
        for (let i = 0; i < 9; i++) { const x = rnd(0, N); const gr = g.createLinearGradient(0, 0, 0, N); gr.addColorStop(0, 'rgba(70,52,22,.35)'); gr.addColorStop(rnd(0.3, 1), 'rgba(70,52,22,0)'); g.fillStyle = gr; g.fillRect(x, 0, rnd(1.5, 4) * s, N); } // drips
        for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(30,20,10,${rnd(0.05, 0.15)})`; g.lineWidth = rnd(0.5, 2) * s; const x = rnd(0, N), y = rnd(0, N); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-30, 30) * s, y + rnd(-6, 6) * s); g.stroke(); } // scuffs
        grain(g, N, 0.12, N / 2);
        return tex(c);
      };
      T.wallGreen = wallpaper([118, 130, 98], 'rgba(60,72,46,.85)', 'rgba(230,220,170,.15)');
      T.wallRed = wallpaper([140, 82, 70], 'rgba(92,44,38,.8)', 'rgba(240,200,160,.12)');
      T.wallYellow = wallpaper([172, 156, 108], 'rgba(120,100,58,.75)', 'rgba(255,248,220,.15)');
      T.wallBlue = wallpaper([92, 108, 128], 'rgba(40,52,72,.8)', 'rgba(230,236,250,.12)');
      // other vintage papers share the same ageing (stains, tide-marks, seams) as the damask
      const aged = (g, N) => {
        for (let x = 0; x < N; x += N / 2) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, 0, 2 * s, N); }
        stains(g, N, 130 * s, 4, '92,70,30', 0.2); stains(g, N, 50 * s, 6, '60,45,20', 0.14);
        for (let i = 0; i < 8; i++) { const x = rnd(0, N); const gr = g.createLinearGradient(0, 0, 0, N); gr.addColorStop(0, 'rgba(70,52,22,.3)'); gr.addColorStop(rnd(0.3, 1), 'rgba(70,52,22,0)'); g.fillStyle = gr; g.fillRect(x, 0, rnd(3, 10) * s, N); }
        grain(g, N, 0.12, N / 2);
      };
      // Regency stripe: broad sage and cream bands with a fine gold pinstripe
      T.wallStripe = (() => { const [c, g] = canvas(N); noiseFill(g, N, [186, 182, 150], 4, 5, 0.14);
        const band = N / 8; for (let x = 0; x < N; x += band * 2) { g.fillStyle = 'rgba(86,104,72,.62)'; g.fillRect(x, 0, band, N); g.fillStyle = 'rgba(176,140,60,.55)'; g.fillRect(x + band + band * 0.45, 0, 2 * s, N); g.fillRect(x - 3 * s, 0, 1.5 * s, N); }
        aged(g, N); return tex(c); })();
      // cabbage-rose floral on a dusty pink ground
      T.wallFloral = (() => { const [c, g] = canvas(N); noiseFill(g, N, [184, 150, 140], 4, 5, 0.15);
        const tile = 128 * s, [pc, pg] = canvas(tile);
        const rose = (x, y, r) => { for (let i = 5; i > 0; i--) { pg.fillStyle = `rgba(${120 + i * 14},${50 + i * 8},${58 + i * 8},.85)`; pg.beginPath(); for (let a = 0; a < 6.28; a += 0.9) pg.ellipse(x + Math.cos(a + i) * r * 0.25, y + Math.sin(a + i) * r * 0.25, r * i / 5, r * i / 6, a, 0, 6.28); pg.fill(); } };
        const leaf = (x, y, a) => { pg.save(); pg.translate(x, y); pg.rotate(a); pg.fillStyle = 'rgba(70,92,58,.8)'; pg.beginPath(); pg.ellipse(0, 0, 12 * s, 5 * s, 0, 0, 6.28); pg.fill(); pg.restore(); };
        leaf(tile * 0.35, tile * 0.6, 0.6); leaf(tile * 0.65, tile * 0.4, -0.8); leaf(tile * 0.15, tile * 0.1, 2); leaf(tile * 0.85, tile * 0.9, -2.4);
        rose(tile * 0.5, tile * 0.5, 16 * s); rose(0, 0, 9 * s); rose(tile, 0, 9 * s); rose(0, tile, 9 * s); rose(tile, tile, 9 * s);
        g.fillStyle = g.createPattern(pc, 'repeat'); g.globalAlpha = 0.7; g.fillRect(0, 0, N, N); g.globalAlpha = 1; aged(g, N); return tex(c); })();
      // art-deco fans in gold on deep teal
      T.wallDeco = (() => { const [c, g] = canvas(N); noiseFill(g, N, [42, 82, 84], 4, 5, 0.15);
        const tile = 128 * s, [pc, pg] = canvas(tile); pg.strokeStyle = 'rgba(206,170,96,.85)'; pg.lineWidth = 2 * s;
        const fan = (x, y) => { for (let r = 10; r <= 60; r += 10) { pg.beginPath(); pg.arc(x, y, r * s, Math.PI, 2 * Math.PI); pg.stroke(); } for (let a = 0; a <= 6; a++) { const t = Math.PI + a * Math.PI / 6; pg.beginPath(); pg.moveTo(x, y); pg.lineTo(x + Math.cos(t) * 60 * s, y + Math.sin(t) * 60 * s); pg.stroke(); } };
        fan(tile / 2, tile * 0.55); fan(0, tile * 1.05); fan(tile, tile * 1.05); fan(0, tile * 0.05); fan(tile, tile * 0.05);
        g.fillStyle = g.createPattern(pc, 'repeat'); g.globalAlpha = 0.75; g.fillRect(0, 0, N, N); g.globalAlpha = 1; aged(g, N); return tex(c); })();
      // tartan plaid in tobacco browns and bottle green (a study/office paper)
      T.wallPlaid = (() => { const [c, g] = canvas(N); noiseFill(g, N, [120, 92, 62], 4, 5, 0.14);
        const u = N / 8; for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(40,62,44,.38)'; g.fillRect(i * u, 0, u * 0.35, N); g.fillRect(0, i * u, N, u * 0.35); g.fillStyle = 'rgba(190,150,80,.35)'; g.fillRect(i * u + u * 0.6, 0, 2 * s, N); g.fillRect(0, i * u + u * 0.6, N, 2 * s); g.fillStyle = 'rgba(30,20,12,.18)'; g.fillRect(i * u + u * 0.8, 0, u * 0.08, N); g.fillRect(0, i * u + u * 0.8, N, u * 0.08); }
        aged(g, N); return tex(c); })();

      /* Oak floorboards: 16 boards per 2 m, staggered joints, grain, nail holes, worn finish */
      { const [c, g] = canvas(N); const rows = 16, rh = N / rows;
        for (let r = 0; r < rows; r++) {
          let x = -rnd(0, N); const y = r * rh;
          while (x < N) {
            const len = rnd(0.45, 0.9) * N, l = rnd(30, 42), sat = rnd(32, 48), hue = rnd(24, 32);
            const draw = (px) => {
              g.fillStyle = `hsl(${hue},${sat}%,${l}%)`; g.fillRect(px, y, len, rh);
              for (let k = 0; k < 7; k++) { g.strokeStyle = `rgba(60,35,15,${rnd(0.1, 0.3)})`; g.lineWidth = rnd(0.5, 1.6) * s; g.beginPath(); const gy = y + rnd(1, rh - 1); g.moveTo(px, gy); for (let q = 0; q <= len; q += 20 * s) g.lineTo(px + q, gy + Math.sin(q * 0.02 + k) * rnd(0.3, 1.6) * s); g.stroke(); }
              if (Math.random() < 0.35) { const kx = px + rnd(20, len - 20), ky = y + rh / 2; g.strokeStyle = 'rgba(55,30,12,.45)'; for (let q = 2; q < 9; q += 2) { g.beginPath(); g.ellipse(kx, ky, q * 2 * s, q * 0.6 * s, 0, 0, 6.28); g.stroke(); } }
              g.fillStyle = 'rgba(20,12,6,.75)'; g.fillRect(px, y, 2 * s, rh);
              g.fillStyle = 'rgba(15,10,5,.6)'; [[6, 0.3], [6, 0.7], [len - 8, 0.3], [len - 8, 0.7]].forEach(([nx, ny]) => g.fillRect(px + nx * s, y + rh * ny, 2 * s, 2 * s));
            };
            draw(x); if (x + len > N) draw(x - N); if (x < 0) draw(x + N);
            x += len;
          }
          g.fillStyle = 'rgba(15,8,4,.8)'; g.fillRect(0, y + rh - 1.5 * s, N, 1.5 * s);
        }
        stains(g, N, 110 * s, 3, '25,15,6', 0.22); stains(g, N, 30 * s, 4, '15,10,5', 0.25);
        for (let i = 0; i < 120; i++) { g.strokeStyle = `rgba(255,235,200,${rnd(0.04, 0.12)})`; g.lineWidth = 0.7 * s; const x = rnd(0, N), y = rnd(0, N); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-40, 40) * s, y + rnd(-10, 10) * s); g.stroke(); } // scratches
        grain(g, N, 0.15, N / 2); T.floorWood = tex(c); }

      /* Carpet: dense fibre noise, traffic wear, stains */
      { const [c, g] = canvas(N); noiseFill(g, N, [128, 66, 58], 8, 6, 0.35); grain(g, N, 0.35, N);
        stains(g, N, 140 * s, 3, '50,38,18', 0.22); stains(g, N, 40 * s, 4, '30,20,10', 0.25); stains(g, N, 90 * s, 2, '190,170,140', 0.08);
        T.carpet = tex(c); }

      /* Bathroom/kitchen tile: 13 tiles per 2 m, uneven glaze, dirty grout, chips */
      { const [c, g] = canvas(N); g.fillStyle = '#3f3a30'; g.fillRect(0, 0, N, N); const k = 13, ts = N / k, gap = 2.2 * s;
        for (let ty = 0; ty < k; ty++) for (let tx = 0; tx < k; tx++) {
          const l = rnd(66, 78); const x = tx * ts + gap, y = ty * ts + gap, w = ts - gap * 2;
          const gr = g.createLinearGradient(x, y, x + w, y + w); gr.addColorStop(0, `hsl(46,${rnd(10, 22)}%,${l + 4}%)`); gr.addColorStop(1, `hsl(44,${rnd(10, 22)}%,${l - 6}%)`);
          g.fillStyle = gr; g.fillRect(x, y, w, w);
          g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, w, 1.5 * s); g.fillRect(x, y, 1.5 * s, w);
          if (Math.random() < 0.06) { g.fillStyle = '#4a4436'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(5, 14) * s, y); g.lineTo(x, y + rnd(5, 14) * s); g.fill(); }
          if (Math.random() < 0.05) { g.strokeStyle = 'rgba(40,35,25,.6)'; g.lineWidth = s; g.beginPath(); g.moveTo(x + rnd(0, w), y); g.lineTo(x + rnd(0, w), y + w); g.stroke(); }
        }
        stains(g, N, 100 * s, 5, '120,92,30', 0.3); stains(g, N, 50 * s, 6, '30,40,18', 0.3); grain(g, N, 0.12, N / 2); T.tile = tex(c); }

      /* Plaster ceiling with cracks and water rings */
      { const [c, g] = canvas(N); noiseFill(g, N, [196, 188, 166], 6, 6, 0.16);
        for (let i = 0; i < 4; i++) { const x = rnd(0, N), y = rnd(0, N), r = rnd(50, 130) * s; wrap(N, x, y, r, (px, py) => { for (let q = 0; q < 4; q++) { g.strokeStyle = `rgba(120,85,30,${0.3 - q * 0.05})`; g.lineWidth = 2.5 * s; g.beginPath(); g.ellipse(px, py, r - q * 9 * s, r * 0.8 - q * 8 * s, 0.4, 0, 6.28); g.stroke(); } g.fillStyle = 'rgba(130,95,40,.18)'; g.beginPath(); g.ellipse(px, py, r * 0.8, r * 0.6, 0.4, 0, 6.28); g.fill(); }); }
        for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(60,50,40,.35)'; g.lineWidth = s; g.beginPath(); let x = rnd(0, N), y = rnd(0, N); g.moveTo(x, y); for (let q = 0; q < 14; q++) { x += rnd(-14, 14) * s; y += rnd(4, 14) * s; g.lineTo(x, y); } g.stroke(); }
        T.ceiling = tex(c); }

      // Exterior siding, dead lawn
      { const [c, g] = canvas(512); noiseFill(g, 512, [82, 80, 74], 4, 4, 0.3); for (let y = 0; y < 512; y += 21) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, y, 512, 3); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, y + 3, 512, 4); } stains(g, 512, 60, 4, '20,25,10', 0.18); T.siding = tex(c); }
      { const [c, g] = canvas(512); noiseFill(g, 512, [70, 66, 40], 8, 6, 0.6, [40, 40, 0]); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${140 + rnd(0, 40)},${125 + rnd(0, 30)},70,.35)`; g.fillRect(rnd(0, 512), rnd(0, 512), 1, rnd(2, 5)); } T.lawn = tex(c); T.lawn.repeat.set(30, 30); }

      // Mattress ticking
      { const [c, g] = canvas(256); noiseFill(g, 256, [190, 180, 150], 4, 4, 0.12); for (let i = 0; i < 256; i += 12) { g.fillStyle = 'rgba(70,90,120,.18)'; g.fillRect(i, 0, 3, 256); } stains(g, 256, 60, 4, '120,85,25', 0.5); T.mattress = tex(c); }

      // Furniture wood (tinted per piece)
      { const [c, g] = canvas(512); noiseFill(g, 512, [216, 196, 162], 2, 3, 0.1);
        for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(90,55,25,${rnd(0.06, 0.28)})`; g.lineWidth = rnd(0.5, 2.5); g.beginPath(); const y = rnd(0, 512); g.moveTo(0, y); for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x * 0.012 + i) * rnd(1, 6)); g.stroke(); }
        for (let i = 0; i < 5; i++) { const x = rnd(30, 480), y = rnd(30, 480); g.strokeStyle = 'rgba(80,45,20,.35)'; for (let r = 3; r < 18; r += 3) { g.beginPath(); g.ellipse(x, y, r * 2.4, r, 0, 0, 6.3); g.stroke(); } }
        grain(g, 512, 0.08, 256); T.wood = tex(c); }
      // Upholstery weave
      { const [c, g] = canvas(256); noiseFill(g, 256, [200, 186, 172], 8, 4, 0.2);
        for (let y = 0; y < 256; y += 3) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, y, 256, 1); } for (let x = 0; x < 256; x += 3) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x, 0, 1, 256); }
        stains(g, 256, 50, 5, '70,55,25', 0.4); T.fabric = tex(c); }
      // Persian rug
      { const [c, g] = canvas(512); noiseFill(g, 512, [112, 38, 36], 16, 4, 0.3);
        const gold = '#c9a25a', navy = '#22304e';
        g.strokeStyle = gold; g.lineWidth = 18; g.strokeRect(26, 26, 460, 460); g.strokeStyle = navy; g.lineWidth = 10; g.strokeRect(56, 56, 400, 400);
        for (let i = 0; i < 22; i++) { g.fillStyle = i % 2 ? gold : navy; g.beginPath(); g.arc(70 + i * 18.5, 40, 5, 0, 6.28); g.fill(); g.beginPath(); g.arc(70 + i * 18.5, 472, 5, 0, 6.28); g.fill(); }
        g.fillStyle = navy; g.beginPath(); g.moveTo(256, 96); g.lineTo(416, 256); g.lineTo(256, 416); g.lineTo(96, 256); g.fill();
        g.fillStyle = gold; g.beginPath(); g.moveTo(256, 150); g.lineTo(362, 256); g.lineTo(256, 362); g.lineTo(150, 256); g.fill();
        g.fillStyle = '#8a2c26'; g.beginPath(); g.arc(256, 256, 44, 0, 6.28); g.fill();
        for (let a = 0; a < 6.28; a += 0.785) { g.fillStyle = gold; g.beginPath(); g.ellipse(256 + Math.cos(a) * 70, 256 + Math.sin(a) * 70, 10, 5, a, 0, 6.28); g.fill(); }
        grain(g, 512, 0.4, 512); stains(g, 512, 80, 5, '30,20,8', 0.45);
        T.rug = new THREE.CanvasTexture(c); T.rug.encoding = THREE.sRGBEncoding; T.rug.anisotropy = 8; }
      // Cobweb
      { const [c, g] = canvas(256); g.strokeStyle = 'rgba(235,235,225,.6)'; g.lineWidth = 1;
        for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 256, Math.sin(a) * 256); g.stroke(); }
        for (let r = 18; r < 256; r += rnd(14, 24)) { g.beginPath(); for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI / 2, rr = r + Math.sin(i * 3) * 4; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i) g.quadraticCurveTo(Math.cos(a - 0.08) * (rr - 6), Math.sin(a - 0.08) * (rr - 6), x, y); else g.moveTo(x, y); } g.stroke(); }
        T.cobweb = new THREE.CanvasTexture(c); }
      // Black mould
      { const [c, g] = canvas(256); for (let i = 0; i < 160; i++) { const x = 128 + rnd(-90, 90) * Math.random(), y = 128 + rnd(-90, 90) * Math.random(), r = rnd(3, 22); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(18,26,10,.7)'); gr.addColorStop(1, 'rgba(18,26,10,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
        T.mold = new THREE.CanvasTexture(c); T.mold.encoding = THREE.sRGBEncoding; }
      // scanned materials take over from the painted ones where we have them
      { const P = T.photo;
        T.deckWood = P.floor || T.floorWood;         // the first plank scan now lives outside: decks, porch, shed floor
        if (P.boards) T.floorWood = P.boards;        // worn floorboards indoors
        T.boardWood = P.planks || T.wood;            // nailed boards, roof sheathing
        if (P.siding) T.siding = P.siding; else if (P.planks) T.siding = P.planks; // weatherboard siding
        T.floorTile = P.ftile || T.tile; T.wallTile = T.pclone('wtile', 0.45) || T.tile; // bathroom wall tile at a real ~6 cm size
        if (P.jacq) T.fabric = P.jacq;               // upholstery (tinted per piece)
        if (P.linen) T.mattress = P.linen;          // ticking / bed linen
        T.wallPeel = T.pclone('peelwall', 0.62); T.wallPlaster = T.pclone('plaster', 0.7); // walls: one tile spans ~2 m
        // the papered walls and the ceilings pick up the cracks and lifting paint of the plaster scans
        const pn = P.peelwall && T.nrm.get(P.peelwall), cn = P.plaster && T.nrm.get(P.plaster);
        if (pn) ['wallGreen', 'wallRed', 'wallYellow', 'wallBlue', 'wallStripe', 'wallFloral', 'wallDeco', 'wallPlaid'].forEach((k) => T.nrm.set(T[k], pn));
        if (cn) T.nrm.set(T.ceiling, cn); }
      // Soft contact shadow (used under furniture and along wall bases)
      { const [c, g] = canvas(128); const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(0.6, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); T.blob = new THREE.CanvasTexture(c); }
      { const [c, g] = canvas(4, 64); const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 64); T.edge = new THREE.CanvasTexture(c); }
    },

    // Rugs drawn at their real size, so the pattern is never stretched.
    // Area rugs get the full design; long hall runners use a repeating tile with continuous side borders.
    rugFor(w, d) {
      const key = w.toFixed(2) + 'x' + d.toFixed(2); this._rugs = this._rugs || {}; if (this._rugs[key]) return this._rugs[key];
      const runner = Math.max(w, d) / Math.min(w, d) > 2.2;
      const ppm = runner ? 240 : Math.min(256, 1024 / Math.max(w, d));   // pixels per metre
      const tileLen = 1.4, W = Math.round(w * ppm), H = Math.round((runner ? tileLen : d) * ppm);
      const [c, g] = canvas(W, H);
      const gold = '#c9a25a', navy = '#22304e', red = '#8a2c26', cream = '#d9c9a0';
      const P = ppm / 100; // drawing unit = 1 cm
      // field: wool texture
      const N = Math.max(W, H); { const [nc, ng] = canvas(N); noiseFill(ng, N, [112, 38, 36], Math.max(4, Math.round(N / 32)), 4, 0.3); g.drawImage(nc, 0, 0); }
      const rect = (x, y, ww, hh, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.strokeRect(x, y, ww, hh); };
      const dots = (x0, y0, x1, y1, step, col) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 0; i <= n; i++) { g.fillStyle = i % 2 ? col : cream; g.beginPath(); g.arc(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 1.6 * P, 0, 6.28); g.fill(); } };
      const motif = (cx, cy, r) => { // small repeating flower
        g.fillStyle = navy; g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.fill();
        g.fillStyle = gold; g.beginPath(); g.arc(cx, cy, r * 0.35, 0, 6.28); g.fill();
      };
      const medallion = (cx, cy, rx, ry) => {
        g.fillStyle = navy; g.beginPath(); g.moveTo(cx, cy - ry); g.lineTo(cx + rx, cy); g.lineTo(cx, cy + ry); g.lineTo(cx - rx, cy); g.fill();
        g.fillStyle = gold; g.beginPath(); g.moveTo(cx, cy - ry * 0.68); g.lineTo(cx + rx * 0.68, cy); g.lineTo(cx, cy + ry * 0.68); g.lineTo(cx - rx * 0.68, cy); g.fill();
        g.fillStyle = red; g.beginPath(); g.ellipse(cx, cy, rx * 0.28, ry * 0.28, 0, 0, 6.28); g.fill();
        for (let a = 0; a < 6.28; a += 0.785) { g.fillStyle = cream; g.beginPath(); g.ellipse(cx + Math.cos(a) * rx * 0.45, cy + Math.sin(a) * ry * 0.45, 2.5 * P, 1.4 * P, a, 0, 6.28); g.fill(); }
      };
      const b1 = 7 * P, b2 = 15 * P; // border widths (cm)
      if (!runner) {
        g.fillStyle = gold; g.fillRect(0, 0, W, b1); g.fillRect(0, H - b1, W, b1); g.fillRect(0, 0, b1, H); g.fillRect(W - b1, 0, b1, H);
        rect(b2, b2, W - 2 * b2, H - 2 * b2, navy, 4 * P);
        dots(b1 + 4 * P, b1 + 4 * P, W - b1 - 4 * P, b1 + 4 * P, 9 * P, navy); dots(b1 + 4 * P, H - b1 - 4 * P, W - b1 - 4 * P, H - b1 - 4 * P, 9 * P, navy);
        dots(b1 + 4 * P, b1 + 4 * P, b1 + 4 * P, H - b1 - 4 * P, 9 * P, navy); dots(W - b1 - 4 * P, b1 + 4 * P, W - b1 - 4 * P, H - b1 - 4 * P, 9 * P, navy);
        for (let y = b2 + 22 * P; y < H - b2 - 10 * P; y += 30 * P) for (let x = b2 + 22 * P; x < W - b2 - 10 * P; x += 30 * P) motif(x, y, 4 * P);
        const m = Math.min(W, H); medallion(W / 2, H / 2, Math.min(W * 0.3, m * 0.4), Math.min(H * 0.3, m * 0.4));
        [[b2, b2, 1, 1], [W - b2, b2, -1, 1], [b2, H - b2, 1, -1], [W - b2, H - b2, -1, -1]].forEach(([x, y, sx, sy]) => { g.fillStyle = navy; g.beginPath(); g.moveTo(x, y); g.lineTo(x + sx * m * 0.18, y); g.lineTo(x, y + sy * m * 0.18); g.fill(); });
      } else {
        // runner tile: borders on the long sides only, one medallion per tile (tiles along v)
        g.fillStyle = gold; g.fillRect(0, 0, b1, H); g.fillRect(W - b1, 0, b1, H);
        g.strokeStyle = navy; g.lineWidth = 4 * P; g.beginPath(); g.moveTo(b2, 0); g.lineTo(b2, H); g.moveTo(W - b2, 0); g.lineTo(W - b2, H); g.stroke();
        dots(b1 + 4 * P, 0, b1 + 4 * P, H, 9 * P, navy); dots(W - b1 - 4 * P, 0, W - b1 - 4 * P, H, 9 * P, navy);
        medallion(W / 2, H / 2, (W - 2 * b2) * 0.38, (W - 2 * b2) * 0.5);
        [H * 0.08, H * 0.92].forEach((y) => motif(W / 2, y, 5 * P));
      }
      stains(g, Math.min(W, H), Math.min(W, H) * 0.2, 3, '30,20,8', 0.35);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
      if (runner) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, Math.max(w, d) / tileLen); }
      return (this._rugs[key] = t);
    },

    // Make texture repeat per-metre on a BoxGeometry, so stretching never happens
    boxUV(geo, w, h, d, scale) {
      scale = scale || 2;
      const uv = geo.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / scale, uv.getY(i) * dims[f][1] / scale); }
      uv.needsUpdate = true; return geo;
    },

    graffiti(text, color, w) {
      const [c, g] = canvas(512); g.clearRect(0, 0, 512, 512);
      g.font = '700 74px "Permanent Marker", "Comic Sans MS", cursive'; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = color; g.shadowBlur = 6;
      const lines = text.split('\n'); lines.forEach((l, i) => g.fillText(l, 256, 256 + (i - (lines.length - 1) / 2) * 86));
      g.shadowBlur = 0; for (let i = 0; i < 12; i++) { const x = rnd(80, 430); g.fillRect(x, rnd(260, 320), rnd(2, 4), rnd(20, 90)); }
      for (let i = 0; i < 300; i++) g.fillRect(rnd(40, 470), rnd(150, 360), 1.5, 1.5); // overspray
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      const m = new THREE.MeshPhongMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, shininess: 2 });
      return new THREE.Mesh(new THREE.PlaneGeometry(w, w), m);
    },
    hole(r) {
      const [c, g] = canvas(256); const gr = g.createRadialGradient(128, 128, 20, 128, 128, 124);
      gr.addColorStop(0, 'rgba(5,4,3,1)'); gr.addColorStop(0.55, 'rgba(12,10,8,.97)'); gr.addColorStop(0.66, 'rgba(170,160,138,.95)'); gr.addColorStop(0.8, 'rgba(120,110,90,.5)'); gr.addColorStop(1, 'rgba(120,110,90,0)');
      g.fillStyle = gr; g.beginPath(); for (let a = 0; a < 6.3; a += 0.2) g.lineTo(128 + Math.cos(a) * rnd(88, 124), 128 + Math.sin(a) * rnd(88, 124)); g.fill();
      g.strokeStyle = 'rgba(30,25,20,.6)'; for (let i = 0; i < 6; i++) { g.beginPath(); const a = rnd(0, 6.3); g.moveTo(128 + Math.cos(a) * 80, 128 + Math.sin(a) * 80); g.lineTo(128 + Math.cos(a) * rnd(110, 128), 128 + Math.sin(a) * rnd(110, 128)); g.stroke(); }
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      return new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshPhongMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    },
  });
})();
