/* TRAP HOUSE — the Tenant. Patrol, hearing, sight, chase, search, capture. Navigates the house's waypoint graph.
   He does NOT know where you are unless he sees you or hears you. */
(function () {
  'use strict';
  const TH = window.TH, U = TH.util;

  /* ---------- Noise system ---------- */
  TH.Noise = {
    emit(x, z, level, radius, desc) {
      if (radius <= 0) return;
      TH.Bus.emit('noise', { x, z, level, radius, desc });
      if (TH.Enemy.active) TH.Enemy.hear({ x, z, level, radius, desc });
    },
  };

  /* ---------- Navigation ---------- */
  const Nav = (TH.Nav = {
    adj: {},
    build() {
      const N = TH.House.nav.nodes; this.adj = {};
      Object.keys(N).forEach((k) => (this.adj[k] = []));
      TH.House.nav.edges.forEach(([a, b]) => { this.adj[a].push(b); this.adj[b].push(a); });
      // link door nodes to their door objects
      Object.values(N).forEach((n) => { if (n.id[0] === 'd') n.door = TH.Doors.nearestDoor(n.x, n.z, n.level, 0.5); });
    },
    passable(id) { const n = TH.House.nav.nodes[id]; return !(n.door && TH.Doors.isLocked(n.door)); },
    nearest(x, z, level) {
      const N = Object.values(TH.House.nav.nodes).filter((n) => n.level === level && this.passable(n.id));
      N.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
      for (const n of N) if (TH.Col.los(x, z, n.x, n.z, level)) return n;
      return N[0];
    },
    path(fromId, toId) {
      const N = TH.House.nav.nodes; if (fromId === toId) return [N[fromId]];
      const open = new Set([fromId]), came = {}, g = { [fromId]: 0 }, f = { [fromId]: 0 };
      const hdist = (a, b) => Math.hypot(N[a].x - N[b].x, N[a].z - N[b].z) + Math.abs(N[a].level - N[b].level) * 4;
      while (open.size) {
        let cur = null; open.forEach((k) => { if (cur === null || f[k] < f[cur]) cur = k; });
        if (cur === toId) { const out = [N[cur]]; while (came[cur]) { cur = came[cur]; out.unshift(N[cur]); } return out; }
        open.delete(cur);
        for (const nb of this.adj[cur]) {
          if (!this.passable(nb)) continue;
          const ng = g[cur] + hdist(cur, nb);
          if (g[nb] === undefined || ng < g[nb]) { came[nb] = cur; g[nb] = ng; f[nb] = ng + hdist(nb, toId); open.add(nb); }
        }
      }
      return null;
    },
  });


  /* ---------- Walkable grid: Tim plans real routes (round furniture, through doorways, up and down the stairs)
     instead of walking at walls. 25 cm cells, a body-width clearance, 8-way A*, then the route is pulled taut. ---------- */
  const Grid = (TH.Grid = {
    S: 0.25, X0: -22.2, Z0: -31.2, X1: 27.2, Z1: 15.4, R: 0.34, built: false, LEVELS: [-1, 0, 1],
    build() {
      const C = TH.Col, S = this.S; this.W = Math.ceil((this.X1 - this.X0) / S); this.D = Math.ceil((this.Z1 - this.Z0) / S);
      const doorCols = new Map(); TH.Doors.list.forEach((d) => d.col && doorCols.set(d.col, d));
      // every flight of stairs: its footprint (kept out of the flat grids) and the landing just off each end
      this.stairs = C.stairs.map((st) => { const cx = (st.x0 + st.x1) / 2, out = Math.sign(st.zb - st.zt) || 1;
        return { st, cx, bot: { x: cx, z: st.zb + out * 0.55, lv: st.lb }, top: { x: cx, z: st.zt - out * 0.55, lv: st.lt }, len: Math.abs(st.zt - st.zb) + 1.1 }; });
      this.cells = {}; this.doorAt = {};
      for (const lv of this.LEVELS) {
        const a = new Uint8Array(this.W * this.D), dm = new Map(), boxes = C.boxes[lv] || [], R2 = this.R * this.R;
        // stamp each box onto the cells it covers (much faster than testing every box for every cell on a big house)
        const stamp = (b, door) => {
          const i0 = Math.max(0, Math.floor((b.x0 - this.R - this.X0) / S)), i1 = Math.min(this.W - 1, Math.floor((b.x1 + this.R - this.X0) / S));
          const j0 = Math.max(0, Math.floor((b.z0 - this.R - this.Z0) / S)), j1 = Math.min(this.D - 1, Math.floor((b.z1 + this.R - this.Z0) / S));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const x = this.X0 + (i + 0.5) * S, z = this.Z0 + (j + 0.5) * S, dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1);
            if (dx * dx + dz * dz >= R2) continue; const k = j * this.W + i;
            if (door) { if (!a[k]) { a[k] = 2; dm.set(k, door); } } else { a[k] = 1; dm.delete(k); }
          }
        };
        boxes.forEach((b) => { const d = doorCols.get(b); if (!(d && d.kind === 'door')) stamp(b, null); });
        boxes.forEach((b) => { const d = doorCols.get(b); if (d && d.kind === 'door') stamp(b, d); });
        for (let j = 0; j < this.D; j++) for (let i = 0; i < this.W; i++) {
          const x = this.X0 + (i + 0.5) * S, z = this.Z0 + (j + 0.5) * S, k = j * this.W + i;
          if (this.inStair(x, z, lv)) { a[k] = 1; dm.delete(k); continue; }
          if (!a[k] && !this.onFloor(x, z, lv)) a[k] = 1; // no floor there (outside the house upstairs, outside the basement…)
        }
        this.cells[lv] = a; this.doorAt[lv] = dm;
      }
      this.comp = {}; this.compKey = null; this.built = true;
    },
    onFloor(x, z, lv) { return (TH.House.walkAreas || []).some((q) => q.level === lv && x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1); }, // is there any floor here on this level?
    inStair(x, z, lv) { return TH.Col.stairs.some((s) => (lv === undefined || s.lb === lv || s.lt === lv) && x > s.x0 - 0.05 && x < s.x1 + 0.05 && z > Math.min(s.zb, s.zt) - 0.05 && z < Math.max(s.zb, s.zt) + 0.05); },
    stairOf(x, z, lv) { return (this.stairs || []).find((g) => { const s = g.st; return (lv === undefined || s.lb === lv || s.lt === lv) && x >= s.x0 - 0.05 && x <= s.x1 + 0.05 && z >= Math.min(s.zb, s.zt) - 0.05 && z <= Math.max(s.zb, s.zt) + 0.05; }); },
    cellXZ(k) { return { x: this.X0 + ((k % this.W) + 0.5) * this.S, z: this.Z0 + (Math.floor(k / this.W) + 0.5) * this.S }; },
    idx(x, z) { const i = Math.floor((x - this.X0) / this.S), j = Math.floor((z - this.Z0) / this.S); return i < 0 || j < 0 || i >= this.W || j >= this.D ? -1 : j * this.W + i; },
    free(lv, k) { if (k < 0 || !this.cells[lv]) return false; const v = this.cells[lv][k]; if (v === 0) return true; if (v === 2) { const d = this.doorAt[lv].get(k); return !TH.Doors.isLocked(d); } return false; },
    // connected areas per floor (recomputed when a lock changes)
    compOf(lv, k) {
      const key = TH.Doors.list.map((d) => (TH.Doors.isLocked(d) ? 1 : 0)).join('');
      if (key !== this.compKey) { this.comp = {}; this.compKey = key; }
      if (!this.comp[lv]) {
        const c = new Int32Array(this.W * this.D).fill(-1); let id = 0;
        for (let s = 0; s < c.length; s++) { if (c[s] >= 0 || !this.free(lv, s)) continue; const q = [s]; c[s] = id;
          while (q.length) { const k2 = q.pop(), i = k2 % this.W, j = (k2 / this.W) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= this.W || nj >= this.D) continue; const nk = nj * this.W + ni; if (c[nk] < 0 && this.free(lv, nk)) { c[nk] = id; q.push(nk); } } }
          id++; }
        this.comp[lv] = c;
      }
      return k < 0 ? -1 : this.comp[lv][k];
    },
    snap(lv, x, z) { // nearest free cell
      let k = this.idx(x, z); if (this.free(lv, k)) return k;
      const i0 = Math.floor((x - this.X0) / this.S), j0 = Math.floor((z - this.Z0) / this.S);
      for (let r = 1; r < 10; r++) { let best = -1, bd = 1e9;
        for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) { if (i < 0 || j < 0 || i >= this.W || j >= this.D) continue; const kk = j * this.W + i; if (!this.free(lv, kk)) continue; const d = (i - i0) ** 2 + (j - j0) ** 2; if (d < bd) { bd = d; best = kk; } }
        if (best >= 0) return best; }
      return -1;
    },
    // nearest free cell that isn't behind a wall from (x,z): a noise in the kitchen sends him into the kitchen, not the room behind it
    snapSameSide(lv, x, z) {
      const k0 = this.idx(x, z); if (this.free(lv, k0)) return k0;
      const i0 = Math.floor((x - this.X0) / this.S), j0 = Math.floor((z - this.Z0) / this.S), cand = [];
      for (let j = j0 - 10; j <= j0 + 10; j++) for (let i = i0 - 10; i <= i0 + 10; i++) { if (i < 0 || j < 0 || i >= this.W || j >= this.D) continue; const k = j * this.W + i; if (this.free(lv, k)) cand.push([(i - i0) ** 2 + (j - j0) ** 2, k]); }
      cand.sort((a, b) => a[0] - b[0]);
      for (const [, k] of cand) { const c = this.center(k); if (!TH.Col.wallsBetween(x, z, c.x, c.z, lv)) return k; }
      return cand.length ? cand[0][1] : -1;
    },
    // a few free spots inside a room, to look around
    pointsIn(room, n) {
      if (!this.built) this.build();
      const out = []; for (let t = 0; t < 60 && out.length < n; t++) { const x = room.x0 + 0.7 + Math.random() * (room.x1 - room.x0 - 1.4), z = room.z0 + 0.7 + Math.random() * (room.z1 - room.z0 - 1.4); if (this.free(room.level, this.idx(x, z))) out.push({ x, z }); }
      return out;
    },
    center(k) { return { x: this.X0 + ((k % this.W) + 0.5) * this.S, z: this.Z0 + (Math.floor(k / this.W) + 0.5) * this.S }; },
    clear(lv, ax, az, bx, bz) { // straight walk along free cells?
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (this.S * 0.4));
      for (let i = 1; i <= n; i++) { const t = i / n; if (!this.free(lv, this.idx(ax + (bx - ax) * t, az + (bz - az) * t))) return false; }
      return true;
    },
    astar(lv, sx, sz, gx, gz) {
      const s = this.snap(lv, sx, sz), g = this.snapSameSide(lv, gx, gz); if (s < 0 || g < 0) return null;
      if (s === g) return [{ x: gx, z: gz }];
      const W = this.W, N = W * this.D, gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
      const gi = g % W, gj = (g / W) | 0, h = (k) => { const di = Math.abs((k % W) - gi), dj = Math.abs(((k / W) | 0) - gj); return (Math.max(di, dj) + 0.414 * Math.min(di, dj)); };
      const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
      gs[s] = 0; push(s, h(s)); let found = false, iter = 0;
      while (heap.length && iter++ < 120000) {
        const k = pop(); if (closed[k]) continue; closed[k] = 1; if (k === g) { found = true; break; }
        const i = k % W, j = (k / W) | 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= this.D) continue;
          const nk = nj * W + ni; if (closed[nk] || !this.free(lv, nk)) continue;
          if (di && dj && (!this.free(lv, j * W + ni) || !this.free(lv, nj * W + i))) continue; // no cutting corners
          const ng = gs[k] + (di && dj ? 1.414 : 1);
          if (ng < gs[nk]) { gs[nk] = ng; came[nk] = k; push(nk, ng + h(nk)); }
        }
      }
      if (!found) return null;
      const cells = []; for (let k = g; k >= 0; k = came[k]) cells.unshift(k);
      const pts = cells.map((k) => this.center(k)); pts[pts.length - 1] = { x: gx, z: gz };
      const out = []; let cur = { x: sx, z: sz }, i = 0;
      while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !this.clear(lv, cur.x, cur.z, pts[j].x, pts[j].z)) j--; out.push(pts[j]); cur = pts[j]; i = j; }
      if (!out.length) out.push(pts[pts.length - 1]);
      return out;
    },
    /* A full route between any two places: flat stretches are walked on the grid; to change floor (or to get between
       areas a floor doesn't connect, like the house and the backyard) it picks the cheapest chain of staircases. */
    route(sx, sz, slv, gx, gz, glv) {
      if (!this.built) this.build();
      const nodes = [], key = (lv, x, z) => lv + ':' + this.compOf(lv, this.snap(lv, x, z));
      const S0 = { x: sx, z: sz, lv: slv, area: null }, G0 = { x: gx, z: gz, lv: glv, area: null };
      const sSt = this.stairOf(sx, sz, slv), gSt = this.stairOf(gx, gz, glv);
      if (!sSt) S0.area = key(slv, sx, sz); if (!gSt) G0.area = key(glv, gx, gz);
      this.ok = true;
      if (sSt && sSt === gSt) return [{ x: sSt.cx, z: gz }, { x: gx, z: gz }]; // both on the same flight of stairs
      if (!sSt && !gSt && S0.area === G0.area) { const p = this.astar(slv, sx, sz, gx, gz); if (!p) this.ok = false; return p || [{ x: gx, z: gz }]; }
      // graph: start, goal and both landings of every staircase
      nodes.push(S0, G0); const land = [];
      this.stairs.forEach((g) => { const b = { x: g.bot.x, z: g.bot.z, lv: g.bot.lv, area: key(g.bot.lv, g.bot.x, g.bot.z), stair: g, end: 'bot' }, t = { x: g.top.x, z: g.top.z, lv: g.top.lv, area: key(g.top.lv, g.top.x, g.top.z), stair: g, end: 'top' }; b.other = t; t.other = b; land.push(b, t); nodes.push(b, t); });
      const cost = (a, b) => {
        if (a.stair && b === a.other) return a.stair.len;
        const onA = a === S0 ? sSt : a === G0 ? gSt : null, onB = b === S0 ? sSt : b === G0 ? gSt : null;
        if (onA && b.stair === onA) return Math.abs(a.z - b.z) + 0.5; // already on that flight: walk to its end
        if (onB && a.stair === onB) return Math.abs(a.z - b.z) + 0.5;
        if (onA || onB) return Infinity;
        if (a.area && a.area === b.area) return Math.hypot(a.x - b.x, a.z - b.z) * 1.3;
        return Infinity;
      };
      const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = nodes.map(() => false); dist[0] = 0;
      for (;;) { let u = -1; for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i; if (u < 0 || u === 1) break; done[u] = true;
        for (let v = 0; v < nodes.length; v++) { if (done[v]) continue; const c = cost(nodes[u], nodes[v]); if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; } } }
      if (dist[1] === Infinity) { const p = slv === glv && !sSt && !gSt ? this.astar(slv, sx, sz, gx, gz) : null; if (!p) this.ok = false; return p || [{ x: gx, z: gz }]; } // no way there (a locked room, a sealed-off corner)
      const chain = []; for (let v = 1; v >= 0; v = prev[v]) chain.unshift(nodes[v]);
      const out = [];
      for (let i = 1; i < chain.length; i++) {
        const a = chain[i - 1], b = chain[i];
        if (a.stair && b === a.other) { out.push({ x: a.stair.cx, z: a.end === 'bot' ? a.stair.st.zb : a.stair.st.zt }, { x: b.stair.cx, z: b.end === 'bot' ? b.stair.st.zb : b.stair.st.zt }, { x: b.x, z: b.z }); continue; }
        if ((a === S0 && sSt) || (b === G0 && gSt)) { out.push({ x: (sSt || gSt).cx, z: a.z }, { x: b.x, z: b.z }); continue; }
        const p = this.astar(a.lv, a.x, a.z, b.x, b.z); if (p) out.push(...p); else { out.push({ x: b.x, z: b.z }); this.ok = false; }
      }
      return out;
    },
  });

  /* ---------- the enemy ---------- */
  function buildModel() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const P = (c, extra) => new THREE.MeshPhongMaterial(Object.assign({ color: c, shininess: 12, specular: 0x1a1a1a }, extra || {}));
    const skin = P(0xa89c88, { shininess: 25 }), skinDark = P(0x86786a), pants = P(0x37383c, { map: TH.Tex.fabric, shininess: 4 }), shirt = P(0xcfc5a6, { map: TH.Tex.fabric, shininess: 4 }), stain = P(0x7a6a3a), boot = P(0x2a221c, { shininess: 30 });
    const add = (p, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; p.add(o); return o; };
    const limb = (r0, r1, len) => { const g = new THREE.CylinderGeometry(r1, r0, len, 10); g.translate(0, -len / 2, 0); return g; };
    // legs: hip → knee → ankle
    const mkLeg = (x) => {
      const hip = new THREE.Group(); hip.position.set(x, 1.02, 0); body.add(hip);
      add(hip, limb(0.095, 0.075, 0.5), pants); add(hip, new THREE.SphereGeometry(0.075, 10, 8), pants, 0, -0.5, 0);
      const knee = new THREE.Group(); knee.position.y = -0.5; hip.add(knee);
      add(knee, limb(0.072, 0.055, 0.47), pants);
      const f = add(knee, new THREE.BoxGeometry(0.12, 0.08, 0.28), boot, 0, -0.5, 0.06); f.geometry.translate(0, 0, 0);
      hip.userData.knee = knee; return hip;
    };
    const legL = mkLeg(-0.11), legR = mkLeg(0.11);
    // pelvis + torso (tapered, pot-bellied)
    add(body, new THREE.CylinderGeometry(0.19, 0.17, 0.22, 12), pants, 0, 1.04, 0);
    const torso = new THREE.Group(); torso.position.y = 1.12; body.add(torso);
    const prof = [[0.17, 0], [0.205, 0.12], [0.215, 0.26], [0.2, 0.42], [0.22, 0.55], [0.17, 0.64], [0.07, 0.68]].map(([r, y]) => new THREE.Vector2(r, y));
    const chest = add(torso, new THREE.LatheGeometry(prof, 16), shirt); chest.scale.set(1.15, 1, 0.8);
    add(torso, new THREE.SphereGeometry(0.11, 10, 8), stain, 0.05, 0.22, 0.15).scale.set(1, 0.7, 0.12);
    add(torso, new THREE.SphereGeometry(0.08, 10, 8), stain, -0.08, 0.4, 0.15).scale.set(1, 0.8, 0.1);
    add(torso, new THREE.CylinderGeometry(0.06, 0.07, 0.12, 10), skin, 0, 0.72, 0.01); // neck
    [-1, 1].forEach((sd) => add(torso, new THREE.SphereGeometry(0.075, 10, 8), skin, sd * 0.22, 0.58, 0)); // bare shoulders
    // long arms: shoulder → elbow → hand
    const mkArm = (x) => {
      const sh = new THREE.Group(); sh.position.set(x, 0.57, 0); torso.add(sh);
      add(sh, limb(0.055, 0.045, 0.4), skin);
      const el = new THREE.Group(); el.position.y = -0.4; sh.add(el); add(el, new THREE.SphereGeometry(0.046, 8, 6), skin);
      add(el, limb(0.044, 0.034, 0.38), skin);
      const hand = add(el, new THREE.BoxGeometry(0.07, 0.13, 0.04), skinDark, 0, -0.44, 0.01);
      for (let i = 0; i < 4; i++) add(el, limb(0.009, 0.007, 0.08), skinDark, -0.024 + i * 0.016, -0.5, 0.012).rotation.x = 0.3;
      sh.userData.elbow = el; return sh;
    };
    const armL = mkArm(-0.25), armR = mkArm(0.25);
    const plank = add(armR.userData.elbow, new THREE.BoxGeometry(0.09, 0.9, 0.035), P(0x6a4a2a, { map: TH.Tex.wood }), 0, -0.72, 0.04); plank.rotation.x = 0.1;
    const nail = add(armR.userData.elbow, new THREE.CylinderGeometry(0.004, 0.004, 0.06, 4), P(0x777777), 0.03, -1.12, 0.08); nail.rotation.z = 1.4; // nail
    // head: elongated skull, sunken eyes, grin, ears
    const head = new THREE.Group(); head.position.set(0, 0.86, 0.03); torso.add(head);
    add(head, new THREE.SphereGeometry(0.12, 16, 12), skin, 0, 0.06, 0).scale.set(0.95, 1.22, 1.05);
    add(head, new THREE.SphereGeometry(0.1, 12, 10), skin, 0, -0.03, 0.03).scale.set(0.9, 0.8, 1); // jaw
    [-1, 1].forEach((sd) => { add(head, new THREE.SphereGeometry(0.03, 8, 6), skinDark, sd * 0.042, 0.075, 0.095).scale.set(1.2, 0.8, 0.5); add(head, new THREE.SphereGeometry(0.03, 8, 6), skin, sd * 0.118, 0.04, 0).scale.set(0.4, 1, 0.8); });
    // milky, clouded cataract eyes: a pale glaze over a ghost of an iris, veined at the edges. They catch the light.
    const ec = document.createElement('canvas'); ec.width = 128; ec.height = 64; const ek = ec.getContext('2d');
    const eg = ek.createRadialGradient(64, 32, 2, 64, 32, 64); eg.addColorStop(0, '#f4f8f8'); eg.addColorStop(0.35, '#dfe6e8'); eg.addColorStop(1, '#a9b2b0'); ek.fillStyle = eg; ek.fillRect(0, 0, 128, 64);
    ek.strokeStyle = 'rgba(120,135,150,.35)'; ek.lineWidth = 5; ek.beginPath(); ek.ellipse(64, 32, 13, 13, 0, 0, 6.29); ek.stroke(); // the iris, barely there
    ek.fillStyle = 'rgba(150,160,170,.22)'; ek.beginPath(); ek.arc(64, 32, 5, 0, 6.29); ek.fill();
    for (let i = 0; i < 9; i++) { const x = 64 + (Math.random() - 0.5) * 30, y = 32 + (Math.random() - 0.5) * 22, r = 4 + Math.random() * 9, cg = ek.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, 'rgba(255,255,255,.55)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); ek.fillStyle = cg; ek.fillRect(x - r, y - r, r * 2, r * 2); } // the cloud
    ek.strokeStyle = 'rgba(150,30,30,.55)'; ek.lineWidth = 0.8; for (let i = 0; i < 16; i++) { let x = Math.random() < 0.5 ? 20 + Math.random() * 14 : 94 + Math.random() * 14, y = Math.random() * 64; ek.beginPath(); ek.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (64 - x) * 0.15 + (Math.random() - 0.5) * 6; y += (Math.random() - 0.5) * 8; ek.lineTo(x, y); } ek.stroke(); } // veins
    const et = new THREE.CanvasTexture(ec); et.encoding = THREE.sRGBEncoding;
    const eyeMat = new THREE.MeshBasicMaterial({ map: et, color: 0xdfe8ec }); eyeMat.userData.noPBR = true;
    const gc = document.createElement('canvas'); gc.width = gc.height = 64; const gk = gc.getContext('2d'), gg = gk.createRadialGradient(32, 32, 0, 32, 32, 32); gg.addColorStop(0, 'rgba(230,240,255,1)'); gg.addColorStop(0.3, 'rgba(190,210,240,.35)'); gg.addColorStop(1, 'rgba(160,180,220,0)'); gk.fillStyle = gg; gk.fillRect(0, 0, 64, 64);
    const glowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.25, toneMapped: false }); glowMat.userData.noPBR = true;
    [-1, 1].forEach((sd) => { const e = add(head, new THREE.SphereGeometry(0.021, 16, 12), eyeMat, sd * 0.043, 0.074, 0.097); e.rotation.y = -Math.PI / 2; e.scale.set(1, 0.92, 1); e.castShadow = false;
      const gl = new THREE.Sprite(glowMat); gl.scale.set(0.115, 0.115, 1); gl.position.set(sd * 0.043, 0.074, 0.122); head.add(gl); });
    add(head, new THREE.ConeGeometry(0.018, 0.05, 6), skin, 0, 0.035, 0.125).rotation.x = Math.PI / 2;
    add(head, new THREE.BoxGeometry(0.1, 0.022, 0.02), P(0x1a0c08), 0, -0.035, 0.112);
    for (let i = 0; i < 7; i++) add(head, new THREE.BoxGeometry(0.011, 0.016, 0.01), P(0xd8cc90, { shininess: 50 }), -0.039 + i * 0.013, -0.03, 0.118);
    torso.rotation.x = 0.22;
    // The old block-built Tim is gone: only his invisible skeleton stays (it drives the real Tim's pose). Every block, sphere and sprite
    // is swapped for an empty joint at the same spot, so nothing of him can ever be drawn.
    const strip = (o) => { o.children.slice().forEach(strip); if (!o.isMesh && !o.isSprite) return o;
      const j = new THREE.Object3D(); j.position.copy(o.position); j.quaternion.copy(o.quaternion); j.scale.copy(o.scale); o.children.slice().forEach((c) => j.add(c));
      const p = o.parent; if (p) { p.add(j); p.remove(o); } if (o.geometry) o.geometry.dispose(); return j; };
    strip(root); const plankJ = armR.userData.elbow.children.find((c) => Math.abs(c.position.y + 0.72) < 1e-3) || new THREE.Object3D();
    return { root, body, torso, legL, legR, armL, armR, head, eyeMat, glowMat, plank: plankJ, nail: new THREE.Object3D() };
  }


  const E = (TH.Enemy = {
    active: false, model: null, pos: new THREE.Vector3(), y: 0, face: 0, state: 'patrol', path: [], target: null,
    wait: 0, phase: 0, seeT: 0, lostT: 0, lastSeen: null, knowsHide: null, speed: 0, stepAcc: 0, stuckT: 0, lastP: { x: 0, z: 0 },
    visionT: 0, sees: false, alertCool: 0, mumbleT: 4,

    init(scene) { this.model = buildModel(); scene.add(this.model.root); this.model.root.visible = false; },
    level() { return TH.Col.levelOf(this.y); },
    spawn(sp) {
      this.diff = TH.DIFF[TH.state.diff];
      this.active = !!this.diff.enemy; this.model.root.visible = this.active;
      this.pos.set(sp.x, 0, sp.z); this.y = sp.level * TH.House.H; this.unwedge(true); this.state = 'patrol'; this.path = []; this.target = null;
      this.wait = 3; this.stunT = 0; this.doorWork = null; this.gruntT = 8 + Math.random() * 12; this.mumbleT = 4 + Math.random() * 10; TH.Audio.hush(); this.lastSeen = null; this.knowsHide = null; this.sees = false; this.seeT = 0; this.speed = 0;
      TH.Audio.setChase(false); TH.Bus.emit('enemyState', 'patrol');
    },
    // if he's ended up inside furniture or a wall (a bad spawn, a door swinging into him), step him to the nearest clear floor
    unwedge(force) {
      const G = TH.Grid; if (!G.built) G.build(); const lv = this.level();
      if (!force && G.free(lv, G.idx(this.pos.x, this.pos.z))) return false;
      if (TH.Col.stairAt(this.pos.x, this.pos.z, this.y)) return false;
      const k = G.snap(lv, this.pos.x, this.pos.z); if (k < 0) return false;
      const c = G.cellXZ(k); if (Math.hypot(c.x - this.pos.x, c.z - this.pos.z) < 0.05 || Math.hypot(c.x - this.pos.x, c.z - this.pos.z) > 3) return false;
      this.pos.x = c.x; this.pos.z = c.z; return true;
    },
    setState(s) { if (this.state !== s) { this.state = s; TH.Bus.emit('enemyState', s); TH.Audio.setChase(s === 'chase'); } },

    // somewhere well away from you: never your floor, never in sight, and a long walk from where you wake up
    farSpawn() {
      const P = TH.Player, G = TH.Grid; if (!G.built) G.build();
      const cand = TH.House.enemySpawns;
      const scored = cand.filter((c) => c.level !== P.level()).map((c) => {
        const r = G.route(P.pos.x, P.pos.z, P.level(), c.x, c.z, c.level); let len = 0, px = P.pos.x, pz = P.pos.z;
        r.forEach((q) => { len += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; }); return { c, len };
      });
      if (!scored.length) return TH.util.pick(TH.House.enemySpawns);
      const best = Math.max(...scored.map((s) => s.len)), far = scored.filter((s) => s.len >= Math.max(14, best * 0.6));
      return TH.util.pick(far.length ? far : scored).c;
    },
    goTo(x, z, level) {
      const G = TH.Grid, lv = this.level();
      let path = G.route(this.pos.x, this.pos.z, lv, x, z, level);
      if (!G.ok) { // can't get there (locked room, sealed-off corner): head for the closest spot he CAN reach, then look around from there
        path = null;
        outer: for (const r of [0.8, 1.6, 2.6, 3.8, 5.5]) for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2, cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r;
          if (!G.free(level, G.idx(cx, cz))) continue;
          const p = G.route(this.pos.x, this.pos.z, lv, cx, cz, level); if (G.ok) { path = p; break outer; }
        }
        if (!path) path = [];
      }
      this.path = path; this.target = { x, z, level };
    },

    hear(n) {
      if (!this.active || this.stunT > 0 || this.state === 'chase' || this.state === 'capture') return;
      if (this.earDist(n) > n.radius * this.diff.hear * 0.9) return; // he hears what's reasonably close; muffled noises through several walls get lost
      this.setState('investigate'); this.wait = 0;
      this.goTo(n.x, n.z, n.level);
      const room = TH.House.roomAt(n.x, n.z, n.level); this.noiseRoom = room || null; this.roomLooks = room ? TH.Grid.pointsIn(room, 1 + (Math.random() < 0.5 ? 1 : 0)) : [];
      n.room = room ? room.name : null;
      if (this.alertCool <= 0) { TH.Audio.play('growl', this.headPos(), 30); this.alertCool = 6; this.talk(0.45, 0.6 + Math.random() * 1.2); }
      TH.UI.heard(n.desc, n.room);
    },
    headPos() { return this.mouth(); },
    /* How far a noise "sounds" from his ears, using the same acoustics you hear: straight through an open room,
       much further through walls, and round by the doorways (shut doors make it a lot further). */
    earDist(n) {
      const C = TH.Col, lv = this.level(), d = Math.hypot(n.x - this.pos.x, n.z - this.pos.z);
      let best;
      if (n.level === lv) { const w = C.wallsBetween(n.x, n.z, this.pos.x, this.pos.z, lv); if (!w) return d; best = d * (1 + 1.6 * w); }
      else best = d * 2 + 4;
      const r = TH.Audio.route ? TH.Audio.route(n.x, n.z, n.level, this.pos.x, this.pos.z, lv) : null;
      if (r) best = Math.min(best, r.len * Math.pow(1.5, r.closed) * (1 + 0.1 * r.turns));
      return best;
    },
    // his actual mouth: tracks the head (which turns while he searches) and which way his face is pointing
    mouth() {
      const h = this.model && this.model.head; const out = this._mouth || (this._mouth = { v: new THREE.Vector3(), d: new THREE.Vector3() });
      if (!h || !h.updateWorldMatrix) return { x: this.pos.x, y: this.y + 1.9, z: this.pos.z, level: this.level(), fx: Math.sin(this.face), fz: Math.cos(this.face) };
      h.updateWorldMatrix(true, false);
      const p = h.localToWorld(out.v.set(0, -0.035, 0.12)); h.getWorldDirection(out.d);
      const m = Math.hypot(out.d.x, out.d.z) || 1;
      return { x: p.x, y: p.y, z: p.z, level: this.level(), fx: out.d.x / m, fz: out.d.z / m, fy: out.d.y };
    },
    // Tim talks to himself / to you. Lines come from the recorded deck; falls back to the old mumble if it isn't loaded.
    talk(chance, delay) {
      if (Math.random() > (chance === undefined ? 1 : chance)) return;
      const go = () => { if (!this.active || TH.state.mode !== 'play') return; if (!TH.Audio.say(() => this.headPos(), 34) && !TH.Audio.speaking()) TH.Audio.play('mumble', this.headPos(), 22); };
      if (delay) setTimeout(go, delay * 1000); else go();
      this.mumbleT = 9 + Math.random() * 16; // he never talks on a fixed beat
    },

    /* Can he actually grab you? Arm's reach (1 m), same floor, nothing solid between his body and yours (no grabbing
       through a wall, a shut door or round a corner), and he has to be facing you. */
    canGrab() {
      const P = TH.Player, lv = this.level(); if (P.level() !== lv) return false;
      const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz); if (d > 1.0) return false;
      if (TH.Col.wallsBetween(this.pos.x, this.pos.z, P.pos.x, P.pos.z, lv) > 0 || TH.Col.crossesWall(this.pos.x, this.pos.z, P.pos.x, P.pos.z, lv)) return false;
      if (d > 0.35 && (dx * Math.sin(this.face) + dz * Math.cos(this.face)) / d < 0.5) { // not facing you yet: he turns toward you first
        this.face = U.angleLerp(this.face, Math.atan2(dx, dz), 0.35); return false; }
      return true;
    },
    canSeePlayer() {
      const P = TH.Player; if (TH.state.hidden || !P.active || this.blindT > 0) return false; // blindT: you just slipped away through a shortcut
      if (P.level() !== this.level()) return false;
      const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      const range = this.diff.sight * (P.crouch ? 0.6 : 1) * (this.state === 'chase' ? 1.15 : 1);
      if (d > range) return false;
      const fx = Math.sin(this.face), fz = Math.cos(this.face);
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (d > 1.6 && dot < (this.state === 'chase' ? 0.15 : 0.45)) return false; // a forward cone, a bit wider while he's running you down
      return TH.Col.los(this.pos.x, this.pos.z, P.pos.x, P.pos.z, this.level());
    },

    update(dt, t) {
      if (!this.active) return;
      const P = TH.Player, m = this.model;
      this.alertCool -= dt; if (this.blindT > 0) this.blindT -= dt;
      if (TH.state.caught || TH.state.mode !== 'play' || TH.state.cinematic) { this.animate(dt, 0); return; }
      // knocked down (slingshot, taser, a door in the face): on his knees, can't see you, can't grab you
      if (this.stunT > 0) {
        this.stunT -= dt; this.sees = false; this.seeT = 0; this.speed = 0; this.animate(dt, 0, t);
        if (this.stunT <= 0) { // back up, furious, and heads for where you were
          TH.Audio.play('growl', this.mouth(), 34); TH.Audio.play('grunt', this.mouth(), 24);
          const ls = this.lastSeen || { x: this.pos.x, z: this.pos.z, level: this.level() }; this.setState('search'); this.goTo(ls.x, ls.z, ls.level); this.searchRoom(ls); this.searchFor = null; this.wait = 0; this.blindT = 0.6;
        }
        return;
      }

      // vision, a few times a second
      this.visionT -= dt;
      if (this.visionT <= 0) {
        this.visionT = 0.12;
        this.sees = this.canSeePlayer();
        if (this.sees) {
          this.seeT += 0.12; this.lostT = 0; this.lastSeen = { x: P.pos.x, z: P.pos.z, level: P.level() };
          if (this.state !== 'chase' && this.seeT > (this.state === 'investigate' ? 0.15 : 0.35)) {
            this.setState('chase'); this.chaseT = 0; this.hunch = { easy: 2.5, normal: 3.5, hard: 4.5, nightmare: 6 }[TH.state.diff] || 3.5; TH.Audio.play('growl', this.headPos(), 40); TH.UI.spotted(); this.talk(0.6, 0.5 + Math.random() * 0.8);
          }
        } else { this.seeT = Math.max(0, this.seeT - 0.06); }
      }

      let spMax = this.diff.patrol;
      const lv = this.level();
      if (this.state === 'chase') {
        this.chaseT = (this.chaseT || 0) + dt; spMax = this.diff.chase * (1 + 0.03 * (TH.state.day - 1)) * (this.chaseT > 12 ? Math.max(0.75, 1 - (this.chaseT - 12) * 0.025) : 1); // winded after a long run
        if (this.sees) {
          const G = TH.Grid; if (!G.built) G.build();
          const direct = P.level() === lv && !TH.Col.stairAt(P.pos.x, P.pos.z, P.y) && !TH.Col.stairAt(this.pos.x, this.pos.z, this.y) && G.clear(lv, this.pos.x, this.pos.z, P.pos.x, P.pos.z);
          if (direct) this.path = [{ x: P.pos.x, z: P.pos.z }];
          else { this.trackT = (this.trackT || 0) - dt; if (this.trackT <= 0 || !this.path.length) { this.trackT = 0.35; this.goTo(P.pos.x, P.pos.z, P.level()); } }
        }
        else {
          this.lostT += dt;
          if (this.knowsHide && TH.state.hidden) { const h = this.knowsHide; this.setState('search'); this.goTo(h.enter.x, h.enter.z, h.level); this.searchFor = h; }
          else if (TH.state.hidden || this.lostT > this.hunch) this.loseTrack();
          else if (this.lostT < 1.0) { // the first moment after you duck out of view: he saw which way you broke, so he follows
            this.trackT = (this.trackT || 0) - dt;
            if (this.trackT <= 0) { this.trackT = 0.5; this.goTo(P.pos.x, P.pos.z, P.level()); }
          } else if (this.lastSeen && (!this.path.length || this._lsGo !== this.lastSeen)) { this._lsGo = this.lastSeen; this.goTo(this.lastSeen.x, this.lastSeen.z, this.lastSeen.level); } // then only to where he last saw you
        }
        // capture
        const inWall = TH.state.travel && TH.state.travel.t > 0.3; // once you're into a hole/hatch he can't reach you
        if (!TH.state.hidden && !inWall && this.canGrab()) { this.capture(); return; }
      } else if (this.state === 'search' || this.state === 'investigate') {
        spMax = this.diff.patrol * 1.45;
        if (!this.path.length && this.roomLooks && this.roomLooks.length && !(this.wait > 0)) {
          const q = this.roomLooks.shift(); this.lookPause = 0.8 + Math.random() * 1.2; this.goTo(q.x, q.z, this.noiseRoom.level); // poke around the room the noise came from
        }
        if (!this.path.length) {
          if (this.searchFor && TH.state.hidden && TH.Player.hideSpot === this.searchFor) { this.capture(true); return; } // pulled out of the hiding spot
          if (this.wait <= 0) this.wait = this.state === 'search' ? 2 + Math.random() * 2 : 3 + Math.random() * 3;
          this.wait -= dt; this.face += Math.sin(t * 1.3) * dt * 1.6; // looking around
          this.mumbleT -= dt * 0.7; if (this.mumbleT <= 0) this.talk(0.8);
          this.gruntT -= dt * 1.3; if (this.gruntT <= 0) { this.gruntT = 6 + Math.random() * 10; if (!TH.Audio.speaking()) TH.Audio.play('grunt', this.mouth(), 20); }
          if (this.wait <= 0.05) {
            // he came to check a noise and found nothing: before he moves on, he kneels and sets a mousetrap right here
            if (this.state === 'investigate' && TH.Traps) { TH.Traps.setBy(this); this.wait = 1.6; this.kneelT = 1.2; }
            else this.wait = 1;
            this.setState('patrol'); this.searchFor = null;
          }
        }
      } else { // patrol
        if (!this.path.length) {
          this.wait -= dt;
          if (this.wait <= 0) {
            const nodes = TH.House.patrol.filter((id) => Nav.passable(id));
            // unpredictable: sometimes heads toward the player's floor
            let id = U.pick(nodes);
            if (Math.random() < 0.15) { const same = nodes.filter((k) => TH.House.nav.nodes[k].level === P.level()); if (same.length) id = U.pick(same); }
            const n = TH.House.nav.nodes[id]; this.goTo(n.x, n.z, n.level);
            this.wait = 1.5 + Math.random() * 4;
          }
        }
        this.mumbleT -= dt; if (this.mumbleT <= 0) this.talk(1);
        this.gruntT -= dt; if (this.gruntT <= 0) { this.gruntT = 10 + Math.random() * 20; if (!TH.Audio.speaking()) TH.Audio.play('grunt', this.mouth(), 20); }
      }

      // a shut door in his way: on his rounds he works the handle for a couple of seconds first; in a chase he barges
      // straight through. If you've locked it, he has to find the key on his ring and unlock it, which buys you time.
      if (this.doorWork) {
        const w = this.doorWork, d = w.d, mp = { x: d.x, y: d.level * TH.House.H + 1, z: d.z };
        w.t += dt; this.face = U.angleLerp(this.face, Math.atan2(d.x - this.pos.x, d.z - this.pos.z), 1 - Math.exp(-8 * dt));
        if (d.open || !this.active) { this.doorWork = null; }
        else {
          w.tick -= dt;
          if (w.tick <= 0) {
            const unlocking = d.playerLock && w.t > w.handle;
            TH.Audio.play(unlocking ? 'keys' : 'handle', mp, 14); w.tick = unlocking ? 0.45 + Math.random() * 0.3 : 0.32 + Math.random() * 0.2;
            if (unlocking && !w.grunted) { w.grunted = true; TH.Audio.play('grunt', this.mouth(), 22); }
          }
          if (w.t >= w.need) {
            if (d.playerLock) { d.playerLock = false; TH.Audio.play('unlock', mp, 14); }
            TH.Doors.setOpen(d, true, this.pos, false); this.doorWork = null;
            if (Math.random() < 0.5) TH.Audio.play('grunt', this.mouth(), 22);
          }
        }
        this.speed = U.damp(this.speed, 0, 10, dt); this.animate(dt, this.speed, t);
        if (this.state === 'chase') { const inWall = TH.state.travel && TH.state.travel.t > 0.3; if (!TH.state.hidden && !inWall && this.canGrab()) this.capture(); }
        return;
      }

      // follow path
      let moving = false;
      if (this.path.length) {
        const p = this.path[0];
        const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz);
        const nx = this.path[1], G = TH.Grid; // only cut a corner when the next leg is genuinely clear from where he stands
        if (d < (this.path.length === 1 ? 0.6 : 0.2) || (nx && d < 0.7 && G.built && !TH.Col.stairAt(this.pos.x, this.pos.z, this.y) && G.clear(this.level(), this.pos.x, this.pos.z, nx.x, nx.z))) this.path.shift();
        else {
          moving = true;
          this.face = U.angleLerp(this.face, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
          const sp = Math.min(spMax, d * 4 + 0.6);
          // simple obstacle avoidance: if he's pushing into furniture, veer around it for a moment
          let mx = dx / d, mz = dz / d;
          if (this.detourT > 0) { this.detourT -= dt; const a = this.detourSide * 1.15, c = Math.cos(a), s2 = Math.sin(a); const nx = mx * c - mz * s2, nz = mx * s2 + mz * c; mx = nx; mz = nz; }
          const bx = this.pos.x, bz = this.pos.z, by = this.y, bl = this.level();
          this.pos.x += mx * sp * dt; this.pos.z += mz * sp * dt;
          // open doors in the way
          const door = TH.Doors.nearestDoor(this.pos.x, this.pos.z, this.level(), 1.3);
          if (door && !door.open && !TH.Doors.isLocked(door) && door.kind !== 'front' && this.doorAhead(door, mx, mz)) {
            this.pos.x = bx; this.pos.z = bz; // stop at the door
            const chase = this.state === 'chase', handle = chase ? 0.3 : 1.8 + Math.random() * 0.6;
            this.doorWork = { d: door, t: 0, tick: 0, handle, need: handle + (door.playerLock ? 3.2 + Math.random() * 1.3 : 0) };
            if (!chase && Math.random() < 0.4) TH.Audio.play('grunt', this.mouth(), 20);
          }
          TH.Col.resolve(this.pos, 0.37, this.y); // his body stays out of walls and furniture (just wider than the route planner's clearance, so planned paths never grind along a rail)
          const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz);
          this.blockT = moved < sp * dt * 0.35 ? (this.blockT || 0) + dt : 0;
          if (this.blockT > 0.25 && !(this.detourT > 0)) { this.detourT = 0.6; this.detourSide = (this.detourSide || 1) * -1; this.blockT = 0; }
          this.y = U.damp(this.y, TH.Col.groundY(this.pos.x, this.pos.z, this.y), 16, dt);
          // no teleporting: he can't pass through a wall or a shut door, jump further than a stride, or change floors anywhere but the stairs
          const jump = Math.hypot(this.pos.x - bx, this.pos.z - bz) > spMax * dt + 0.35;
          const nearStair = (x, z) => TH.Col.stairs.some((q) => x > q.x0 - 0.6 && x < q.x1 + 0.6 && z > Math.min(q.zb, q.zt) - 0.9 && z < Math.max(q.zb, q.zt) + 0.9); // stepping on/off the end of a flight
          const offStairs = this.level() !== bl && !TH.Col.stairAt(this.pos.x, this.pos.z, this.y) && !TH.Col.stairAt(bx, bz, by) && !nearStair(this.pos.x, this.pos.z) && !nearStair(bx, bz);
          if (jump || offStairs || TH.Col.crossesWall(bx, bz, this.pos.x, this.pos.z, bl)) { this.pos.x = bx; this.pos.z = bz; this.y = by; this.detourT = 0.6; this.detourSide = (this.detourSide || 1) * -1;
            if (this.target && !(this.replanT > 0)) { this.replanT = 1; this.goTo(this.target.x, this.target.z, this.target.level); } } // that leg runs through a wall: plan a fresh route
          if (this.replanT > 0) this.replanT -= dt;
          // stuck? re-plan
          this.stuckT += dt;
          if (this.stuckT > 1.6) {
            const still = Math.hypot(this.pos.x - this.lastP.x, this.pos.z - this.lastP.z) < 0.5;
            this.hardStuck = still ? (this.hardStuck || 0) + 1 : 0;
            if (still && this.hardStuck >= 2) { this.unwedge(true); this.hardStuck = 0; } // ~3 s wedged: step clear before trying again
            if (still && this.target) this.goTo(this.target.x, this.target.z, this.target.level);
            this.stuckT = 0; this.lastP.x = this.pos.x; this.lastP.z = this.pos.z; }
        }
      }
      this.speed = U.damp(this.speed, moving ? spMax : 0, 8, dt);
      this.animate(dt, this.speed, t);

      // heavy footsteps you can hear through the house
      if (this.speed > 0.3) { this.stepAcc += this.speed * dt; if (this.stepAcc > 1.25) { this.stepAcc = 0; TH.Audio.play('enemyStep', { x: this.pos.x, y: this.y + 0.05, z: this.pos.z, level: TH.Col.levelOf(this.y + 0.3) }, this.state === 'chase' ? 40 : 30); /* his floor, given outright: worked out from foot height it landed a floor too low upstairs and in the basement, so you heard him as if through the ceiling */ TH.Bus.emit('tstep', { x: this.pos.x, y: this.y, z: this.pos.z, chase: this.state === 'chase' }); } }
    },

    animate(dt, speed, t) {
      const m = this.model; this.phase += dt * (2.5 + speed * 2.2);
      const a = Math.min(1, speed / 3), s = Math.sin(this.phase) * 0.7 * a;
      m.legL.rotation.x = s; m.legR.rotation.x = -s;
      m.legL.userData.knee.rotation.x = Math.max(0, -Math.cos(this.phase)) * 0.9 * a; m.legR.userData.knee.rotation.x = Math.max(0, Math.cos(this.phase)) * 0.9 * a;
      m.armL.userData.elbow.rotation.x = this.state === 'chase' ? -0.5 : -0.25; m.armR.userData.elbow.rotation.x = this.state === 'chase' ? -0.9 : -0.3;
      m.armL.rotation.x = this.state === 'chase' ? -1.2 + s * 0.3 : -s * 0.6;
      m.armR.rotation.x = this.state === 'chase' ? -0.6 - s * 0.4 : s * 0.6;
      m.torso.rotation.x = this.state === 'chase' ? 0.38 : 0.22;
      m.head.rotation.y = this.state === 'search' || (this.state === 'patrol' && speed < 0.2) ? Math.sin((t || 0) * 0.9) * 0.6 : 0;
      // the clouded eyes: dull and pale on his rounds, brighter when he's listening for you, a cold glare when he has you
      m.eyeMat.color.setHex(this.state === 'chase' ? 0xffffff : this.state === 'patrol' ? 0xe2eaee : 0xf4f8fa);
      m.glowMat.opacity = (this.state === 'chase' ? 1.0 : this.state === 'patrol' ? 0.38 : 0.62) * (0.85 + Math.random() * 0.15);
      m.root.position.set(this.pos.x, this.y + Math.abs(Math.cos(this.phase)) * 0.04 * a, this.pos.z);
      if (this.kneelT > 0 && !(this.stunT > 0)) { // down on one knee, setting a trap
        this.kneelT -= dt; const k = Math.min(1, (1.2 - this.kneelT) * 4, this.kneelT * 4);
        m.legL.rotation.x = -1.3 * k; m.legL.userData.knee.rotation.x = 1.6 * k; m.legR.rotation.x = 0.3 * k; m.legR.userData.knee.rotation.x = 1.4 * k;
        m.torso.rotation.x = 0.22 + 0.6 * k; m.armR.rotation.x = -0.9 * k; m.armL.rotation.x = -0.5 * k; m.root.position.y = this.y - 0.38 * k;
      }
      if (this.stunT > 0) {
        const k = Math.min(1, (this._stunIn = (this._stunIn || 0) + dt * 4)), sw = Math.sin(performance.now() / 300) * 0.12;
        m.legL.rotation.x = -1.4 * k; m.legL.userData.knee.rotation.x = 1.9 * k; m.legR.rotation.x = 0.2 * k; m.legR.userData.knee.rotation.x = 1.5 * k;
        m.torso.rotation.x = 0.22 + 0.55 * k; m.armL.rotation.x = 0.3 * k; m.armR.rotation.x = 0.1 * k; m.head.rotation.y = sw; m.head.rotation.x = 0.35 * k + sw * 0.5;
        m.root.position.y = this.y - 0.42 * k; m.eyeMat.color.setHex(0x6a7074); m.glowMat.opacity = 0.05;
      } else { this._stunIn = 0; if (m.head.rotation.x) m.head.rotation.x = 0; }
      m.root.rotation.y = this.face;
    },

    // is this door actually in front of him, on the way he's walking? (he ignores shut doors he's just walking past)
    doorAhead(d, mx, mz) {
      const b = d.col; if (!b) return true;
      const ax = this.pos.x, az = this.pos.z, ex = ax + mx * 1.4, ez = az + mz * 1.4, dx = ex - ax, dz = ez - az;
      let t0 = 0, t1 = 1;
      if (Math.abs(dx) < 1e-9) { if (ax < b.x0 - 0.05 || ax > b.x1 + 0.05) return false; } else { let ta = (b.x0 - 0.05 - ax) / dx, tb = (b.x1 + 0.05 - ax) / dx; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return false; }
      if (Math.abs(dz) < 1e-9) { if (az < b.z0 - 0.05 || az > b.z1 + 0.05) return false; } else { let ta = (b.z0 - 0.05 - az) / dz, tb = (b.z1 + 0.05 - az) / dz; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return false; }
      return true;
    },

    // gives up the chase: walks to where he last saw you and checks a spot or two around it, then back to his rounds
    loseTrack() {
      const ls = this.lastSeen; this.searchFor = null; this.wait = 0; this._lsGo = null;
      if (!ls) { this.setState('patrol'); return; }
      this.setState('search'); this.goTo(ls.x, ls.z, ls.level); this.searchRoom(ls);
      if (Math.random() < 0.5) this.talk(0.7, 0.4);
    },
    searchRoom(ls) {
      const room = TH.House.roomAt(ls.x, ls.z, ls.level); this.noiseRoom = room || null;
      this.roomLooks = room && TH.Grid.pointsIn ? TH.Grid.pointsIn(room, 1 + (Math.random() < 0.4 ? 1 : 0)) : [];
    },

    stun(sec, why) {
      if (!this.active) return;
      this.stunT = Math.max(this.stunT || 0, sec); this.doorWork = null; this.path = []; TH.Audio.hush();
      TH.Audio.play('grunt', this.mouth(), 26); setTimeout(() => TH.Audio.play('grunt', this.mouth(), 22), 350 + Math.random() * 300);
      TH.Audio.play('thud', null); TH.Audio.setChase(false);
      TH.UI.toast(why === 'door' ? 'The door smashes into him!' : why === 'taser' ? 'He seizes up and drops.' : 'Right in the head!');
      TH.Bus.emit('enemyStunned', why);
    },

    // Called when the player hides: if he's watching, he remembers the spot
    onPlayerHide(spot) {
      if (!this.active || !spot) { this.knowsHide = null; return; }
      const d = Math.hypot(spot.x - this.pos.x, spot.z - this.pos.z);
      this.knowsHide = this.state === 'chase' && (this.sees || this.lostT < 0.4) && spot.level === this.level() && d < 14 && TH.Col.los(this.pos.x, this.pos.z, spot.enter.x, spot.enter.z, spot.level) ? spot : null;
    },

    capture(fromHide) {
      this.setState('capture'); this.doorWork = null; TH.Audio.play('grunt', this.mouth(), 20);
      this.face = Math.atan2(TH.Player.pos.x - this.pos.x, TH.Player.pos.z - this.pos.z);
      this.animate(0, 0, 0);
      TH.Game.caught(fromHide);
    },
  });
  TH.Bus.on('hide', (s) => E.onPlayerHide(s));
  // squeezing through a hole, dropping through the floor or vaulting the banister shakes him off: he searches where you vanished
  TH.Bus.on('shortcut', () => { if (E.active && E.state === 'chase') { E.seeT = 0; E.blindT = 3; const P = TH.Player; const ls = E.lastSeen || { x: P.pos.x, z: P.pos.z, level: P.level() }; E.setState('search'); E.goTo(ls.x, ls.z, ls.level); E.searchRoom(ls); E.searchFor = null; E.wait = 0; } });
})();
