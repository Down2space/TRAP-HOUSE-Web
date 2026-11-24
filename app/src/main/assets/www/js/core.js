/* TRAP HOUSE — core: namespace, event bus, helpers, settings, difficulty table, synthesised + positional audio */
(function () {
  'use strict';
  const TH = (window.TH = window.TH || {});
  TH.VERSION = '0.1.0';

  TH.Bus = {
    h: {},
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); },
    emit(e, ...a) { (this.h[e] || []).forEach((f) => { try { f(...a); } catch (err) { console.error(err); } }); },
  };

  TH.util = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    damp: (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt)),
    angleLerp(a, b, t) { const T = Math.PI * 2; const d = ((((b - a + Math.PI) % T) + T) % T) - Math.PI; return a + d * t; },
    shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    isTouch: ('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer: coarse)').matches),
  };

  /* Difficulty modes. locks = what's on the front door. */
  TH.DIFF = {
    practice: { label: 'Practice', blurb: 'No enemy. Learn the house and the puzzles.', enemy: false, patrol: 0, chase: 0, hear: 0, sight: 0, locks: ['boards', 'combo', 'padlock'], dark: 1 },
    easy: { label: 'Easy', blurb: 'Slower tenant with worse ears. Easier to lose.', enemy: true, patrol: 1.5, chase: 2.8, hear: 0.75, sight: 11, locks: ['boards', 'combo', 'padlock'], dark: 1 },
    normal: { label: 'Normal', blurb: 'The way it’s meant to be played.', enemy: true, patrol: 1.8, chase: 3.2, hear: 1, sight: 14, locks: ['boards', 'combo', 'padlock'], dark: 1 },
    hard: { label: 'Hard', blurb: 'Faster, sharper ears, a chain on the door.', enemy: true, patrol: 2.1, chase: 3.6, hear: 1.3, sight: 16, locks: ['boards', 'combo', 'padlock', 'chain'], dark: 0.85 },
    nightmare: { label: 'Nightmare', blurb: 'Aggressive tenant. The lights barely work.', enemy: true, patrol: 2.5, chase: 4.0, hear: 1.6, sight: 18, locks: ['boards', 'combo', 'padlock', 'chain'], dark: 0.5 },
  };

  TH.state = { mode: 'menu', day: 1, maxDays: 5, hidden: false, caught: false, startTime: 0, diff: 'normal' };

  const DEFAULTS = { sens: 1, invertY: false, joySize: 1, swapSides: false, quality: TH.util.isTouch ? 'high' : 'ultra', volume: 0.8, gfxVersion: 2, showFps: false, difficulty: 'normal', haptics: true };
  TH.settings = Object.assign({}, DEFAULTS, {
    load() { try { const s = JSON.parse(localStorage.getItem('traphouse.settings') || '{}'); if ((s.gfxVersion || 1) < 2) { delete s.quality; s.gfxVersion = 2; } Object.assign(this, s); } catch (e) { /* storage blocked */ } },
    save() {
      const o = {}; Object.keys(DEFAULTS).forEach((k) => (o[k] = this[k]));
      try { localStorage.setItem('traphouse.settings', JSON.stringify(o)); } catch (e) { /* storage blocked */ }
      TH.Bus.emit('settings');
    },
  });
  TH.settings.load();
  /* phone vibration (Android browsers; iPhones ignore it). Heartbeats closer than ~3 m buzz harder. */
  TH.haptic = (pat, d) => { try { if (!TH.settings.haptics || !navigator.vibrate || TH.state.mode !== 'play') return; if (d != null && d < 3) pat = pat.map((x, i) => (i % 2 ? x : x * 1.8)); navigator.vibrate(pat); } catch (e) { /* not allowed */ } };

  /* ---------- Audio: everything synthesised, positional sounds panned around the listener ---------- */
  TH.Audio = {
    ctx: null, master: null, noiseBuf: null, drone: null,
    init() {
      if (this.ctx) return;
      try {
        const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
        this.master = this.ctx.createGain(); this.master.gain.value = TH.settings.volume; this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = b;
        this.load('door', 'sfx/door-open.mp3'); this.load('tim', 'sfx/tim-lines.mp3'); this.load('sfx', 'sfx/sfx.mp3'); this.load('ouch', 'sfx/ouch.mp3');
        // the house's reverb: a short, dark, boxy room tail
        try {
          const sr = this.ctx.sampleRate, n = Math.floor(sr * 1.3), ir = this.ctx.createBuffer(2, n, sr);
          for (let ch = 0; ch < 2; ch++) { const d2 = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += ((Math.random() * 2 - 1) - lp) * 0.35; d2[i] = lp * Math.exp(-t * 4.2) * (i < sr * 0.012 ? i / (sr * 0.012) : 1); } }
          this.verb = this.ctx.createConvolver(); this.verb.buffer = ir; const vg = this.ctx.createGain(); vg.gain.value = 0.55; this.verb.connect(vg); vg.connect(this.master);
        } catch (e) { this.verb = null; }
      } catch (e) { this.ctx = null; }
    },
    bufs: {}, _routes: {}, _bus: null,
    load(name, url) {
      try { fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((a) => a && new Promise((ok, no) => this.ctx.decodeAudioData(a, ok, no))).then((b) => { if (b) this.bufs[name] = b; }).catch(() => {}); } catch (e) {}
    },
    /* Recorded effects (sfx/sfx.mp3): real door, glass, footstep, drop, drawer, cloth and toilet recordings, each [start, length].
       Sources and licences: sfx/CREDITS.txt. A random take is used each time (never the same take twice running). */
    SFX: {"doorShut": [[0.2, 0.5863]], "glass": [[1.0363, 0.5329], [1.8192, 0.7926], [2.8617, 0.6743]], "dropHard": [[3.7861, 0.1437], [4.1797, 0.1304]], "dropSoft": [[4.5601, 0.3664], [5.1765, 0.2773], [5.7038, 0.3685]], "dropMetal": [[6.3222, 0.2455], [6.8177, 0.237], [7.3047, 0.2453], [7.8, 0.2369]], "stepWood": [[8.2869, 0.1571], [8.694, 0.1579]], "stepHard": [[9.102, 0.2805], [9.6324, 0.2805], [10.1629, 0.2611]], "chestOpen": [[10.674, 0.5574]], "chestClose": [[11.4814, 0.6266]], "pry": [[12.358, 0.2803], [12.8884, 0.266], [13.4044, 0.2801]], "metalClick": [[13.9345, 0.1873]], "debris": [[14.3718, 0.2188], [14.8406, 0.2671]], "steelOpen": [[15.3577, 0.2055]], "steelClose": [[15.8132, 0.5457]], "cloth": [[16.6089, 0.4932], [17.3521, 0.5075], [18.1096, 0.4612], [18.8208, 0.4051]], "flush": [[19.4759, 3.7143]], "yelp": [[23.4402, 0.1833]]},
    _lastTake: {},
    fx(name, vol, o) {
      const b = this.bufs.sfx, takes = this.SFX[name]; if (!b || !takes || vol <= 0.001) return false;
      o = o || {}; let i = Math.floor(Math.random() * takes.length); if (takes.length > 1 && i === this._lastTake[name]) i = (i + 1) % takes.length; this._lastTake[name] = i;
      const [off, len] = takes[i], c = this.ctx, src = c.createBufferSource(), g = c.createGain();
      src.buffer = b; src.playbackRate.value = (o.rate || 1) * (0.95 + Math.random() * 0.1); g.gain.value = vol;
      let head = g; if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); head = f; }
      src.connect(g); head.connect(this._out(0));
      src.start(c.currentTime + (o.delay || 0), off, len); return true;
    },
    surface(x, z, lv) { const r = TH.House && TH.House.roomAt ? TH.House.roomAt(x, z, lv) : null; return TH.Col && TH.Col.stairAt(x, z, lv * TH.Col.H) ? 'wood' : (r ? r.floor : 'wood'); },
    // a recorded sample, gently varied in pitch each time so repeats don't sound copy-pasted
    sample(name, vol, pan, rate) {
      const b = this.bufs[name]; if (!b || vol <= 0.001) return false;
      const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = b; s.playbackRate.value = rate || 0.94 + Math.random() * 0.12;
      g.gain.value = vol; s.connect(g); g.connect(this._out(pan)); s.start(); return true;
    },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    setVolume(v) { if (this.master) this.master.gain.value = v; },
    /* ---------- house acoustics ----------
       Every positional sound is worked out against the real house:
       - in the open: inverse-distance falloff + a little high-end lost to the air
       - behind walls: heavily muffled (low-passed) and quieter per wall it goes through
       - around corners: the sound also travels the walkable route (doorways, hall, stairs); it comes from the
         doorway it leaks out of, is duller for every turn, and much duller/quieter through each shut door
       - another floor: boomy and muffled through the floorboards, or via the stairwell
       - hiding in a wardrobe or under a bed muffles everything a bit
       Direction is 3D (HRTF) where the device supports it, and distant sounds get more of the house's reverb. */
    // a voice is loudest and brightest straight out of the mouth: ~-7 dB and much duller behind the head, in between at the sides
    directivity(p, tx, tz, ty) {
      if (p.fx === undefined) return null;
      const dx = tx - p.x, dz = tz - p.z, dy = (ty === undefined ? p.y : ty) - p.y, m = Math.hypot(dx, dz, dy) || 1;
      const c = (dx * p.fx + dz * p.fz + dy * (p.fy || 0)) / m, q = (1 + c) / 2; // 1 = facing you, 0 = back turned
      return { g: 0.45 + 0.55 * Math.pow(q, 1.3), lp: 3200 + 14800 * Math.pow(q, 1.6) };
    },
    falloff(d) { return Math.min(1, 1.4 * Math.pow(1.2 / Math.max(1.2, d), 0.85)); },
    air(d) { return 18000 * Math.exp(-d / 28); },
    route(sx, sz, slv, lx, lz, llv) {
      const N = TH.Nav; if (!N || !N.adj || !TH.House.nav) return null;
      const a = N.nearest(sx, sz, slv), b = N.nearest(lx, lz, llv); if (!a || !b) return null;
      const now = performance.now(); if (!this._routesT || now - this._routesT > 3000) { this._routes = {}; this._routesT = now; } // locks change, so routes go stale
      const key = a.id + '>' + b.id; let p = this._routes[key];
      if (p === undefined) { p = N.path(a.id, b.id) || null; this._routes[key] = p; }
      if (!p) return null;
      let len = Math.hypot(a.x - sx, a.z - sz) + Math.hypot(b.x - lx, b.z - lz), closed = 0, turns = 0;
      for (let k = 0; k < p.length; k++) {
        const n = p[k];
        if (k) len += Math.hypot(n.x - p[k - 1].x, n.z - p[k - 1].z) + Math.abs(n.level - p[k - 1].level) * TH.House.H;
        if (n.door && !n.door.open) closed++;
        if (k > 0 && k < p.length - 1) { const ax = n.x - p[k - 1].x, az = n.z - p[k - 1].z, bx = p[k + 1].x - n.x, bz = p[k + 1].z - n.z; const c = (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1); if (c < 0.7) turns++; }
      }
      // where you hear it coming from: the last point on the route you can see from where you stand
      let ap = b; for (let k = p.length - 1; k >= 0; k--) { if (p[k].level === llv && TH.Col.los(lx, lz, p[k].x, p[k].z, llv)) ap = p[k]; else break; }
      const f0 = Math.hypot(a.x - sx, a.z - sz) > 0.4 ? a : (p[1] || a); // where the sound first heads when it leaves the source
      return { len, closed, turns, ax: ap.x, az: ap.z, alv: ap.level, fx: f0.x, fz: f0.z };
    },
    spatial(p, range) {
      const L = TH.Player; if (!L || !p || !L.camera) return null;
      const C = TH.Col, H = TH.House.H, cp = L.camPos(), llv = L.level();
      const slv = p.level !== undefined ? p.level : C.levelOf(Math.max(0, (p.y || 0) - 0.6));
      const sy = p.y !== undefined ? p.y : slv * H + 1;
      const d3 = Math.hypot(p.x - cp.x, p.z - cp.z, (sy - cp.y) * 1.2);
      let g, lp, ox = p.x, oy = sy, oz = p.z, muff = 0;
      if (slv === llv) {
        const walls = C.wallsBetween(p.x, p.z, cp.x, cp.z, llv);
        if (walls === 0) { g = this.falloff(d3); lp = this.air(d3); const dv = this.directivity(p, cp.x, cp.z, cp.y); if (dv) { g *= dv.g; lp = Math.min(lp, dv.lp); } }
        else {
          const dW = this.directivity(p, cp.x, cp.z, cp.y) || { g: 1, lp: 1e9 };
          const gW = this.falloff(d3) * Math.pow(0.3, walls) * dW.g, lpW = Math.min(700 / Math.sqrt(walls), dW.lp * 0.25);
          const r = this.route(p.x, p.z, slv, cp.x, cp.z, llv);
          const dR = (r && this.directivity(p, r.fx, r.fz)) || { g: 1, lp: 1e9 }; // which way he faces relative to the doorway the sound leaves by
          const gR = r ? this.falloff(r.len) * Math.pow(0.4, r.closed) * Math.pow(0.82, Math.max(0, r.turns - 1)) * dR.g : 0;
          if (gR > gW) { g = Math.hypot(gR, gW * 0.6); lp = Math.min(this.air(r.len), 5200 / (1 + 0.55 * r.turns), r.closed ? 1100 / r.closed : 1e9, dR.lp * 0.5); ox = r.ax * 0.75 + p.x * 0.25; oz = r.az * 0.75 + p.z * 0.25; }
          else { g = gW; lp = lpW; }
          muff = 1;
        }
        if (range) { const d = Math.max(d3, 0); g *= Math.max(0, 1 - Math.pow(d / (range * 1.15), 3)); }
      } else {
        // through the floor (boomy) or round by the stairwell, whichever carries better
        const gF = this.falloff(d3 + 1.5) * 0.32 * (p.fx !== undefined ? 0.8 : 1);
        const r = this.route(p.x, p.z, slv, cp.x, cp.z, llv), dR = (r && this.directivity(p, r.fx, r.fz)) || { g: 1, lp: 1e9 };
        const gR = r ? this.falloff(r.len) * Math.pow(0.4, r.closed) * Math.pow(0.82, r.turns) * 0.8 * dR.g : 0;
        if (gR > gF) { g = Math.hypot(gR, gF * 0.6); lp = Math.min(this.air(r.len), 3000 / (1 + 0.5 * r.turns)); ox = r.ax; oz = r.az; oy = r.alv * H + 1.2; }
        else { g = gF; lp = 380; }
        muff = 1;
        if (range) g *= Math.max(0, 1 - Math.pow((d3 + 2) / (range * 1.15), 3));
      }
      if (TH.state.hidden && L.hideSpot) { g *= L.hideSpot.type === 'closet' ? 0.7 : 0.85; lp = Math.min(lp, L.hideSpot.type === 'closet' ? 1600 : 3200); }
      // direction in the listener's frame
      const dx = ox - cp.x, dy = oy - cp.y, dz = oz - cp.z, yaw = L.yaw;
      const rx = dx * Math.cos(yaw) - dz * Math.sin(yaw), fz = -dx * Math.sin(yaw) - dz * Math.cos(yaw), m = Math.hypot(rx, dy, fz) || 1;
      return { g, lp: Math.max(220, Math.min(18000, lp)), dir: { x: rx / m, y: dy / m, z: -fz / m }, pan: TH.util.clamp(rx / m, -1, 1) * 0.85, wet: TH.util.clamp(0.08 + d3 / 40 + muff * 0.12, 0.08, 0.55) };
    },
    /* ---------- Tim Wright's voice ----------
       His recorded lines live in one file; each line is [start, length] in seconds. A shuffled deck decides the order:
       never the same line twice in a row, nothing from the last few lines, and each new deck is reshuffled until its
       order shares as few back-to-back pairs as possible with what he's said before, so he never falls into a pattern. */
    TIM: [[0.4, 2.26], [3.06, 2.09], [5.55, 3.22], [9.17, 2.17], [11.74, 1.95], [14.09, 1.12], [15.61, 1.62], [17.63, 1.19], [19.22, 1.36], [20.98, 2.84], [24.22, 6.55], [31.17, 2.58], [34.15, 2.24]],
    _deck: [], _said: [], _pairs: {}, voiceNode: null,
    nextLine() {
      const n = this.TIM.length, recent = this._said.slice(-Math.min(4, n - 1));
      if (!this._deck.length) {
        let best = null, bestScore = 1e9;
        for (let tries = 0; tries < 60; tries++) {
          const d = TH.util.shuffle([...Array(n).keys()]);
          let sc = recent.includes(d[0]) ? 50 : 0, prev = this._said[this._said.length - 1];
          for (const k of d) { if (prev !== undefined) sc += this._pairs[prev + '>' + k] || 0; prev = k; }
          sc += recent.slice(-2).includes(d[1]) ? 10 : 0;
          if (sc < bestScore) { bestScore = sc; best = d; }
          if (sc === 0) break;
        }
        this._deck = best;
      }
      // pick the first line in the deck that isn't one of the last few he said
      let i = this._deck.findIndex((k) => !recent.includes(k)); if (i < 0) i = 0;
      const k = this._deck.splice(i, 1)[0], prev = this._said[this._said.length - 1];
      if (prev !== undefined) this._pairs[prev + '>' + k] = (this._pairs[prev + '>' + k] || 0) + 1;
      this._said.push(k); if (this._said.length > 40) this._said.shift();
      return k;
    },
    speaking() { return !!this.voiceNode; },
    // he says a line from where he's standing; it keeps tracking him (and the walls between you) while he talks
    say(posFn, range) {
      if (!this.ctx || !this.bufs.tim || this.voiceNode) return false;
      const k = this.nextLine(), [off, len] = this.TIM[k], c = this.ctx;
      const src = c.createBufferSource(); src.buffer = this.bufs.tim; src.playbackRate.value = 0.97 + Math.random() * 0.05;
      const f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), pn = c.createPanner(), g = c.createGain(), dry = c.createGain(), wet = c.createGain();
      f.type = f2.type = 'lowpass'; f.Q.value = 0.6; f2.Q.value = 0.5; pn.panningModel = TH.settings.quality === 'low' ? 'equalpower' : 'HRTF'; pn.distanceModel = 'linear'; pn.rolloffFactor = 0;
      src.connect(f); f.connect(f2); f2.connect(pn); pn.connect(g); g.connect(dry); dry.connect(this.master); if (this.verb) { g.connect(wet); wet.connect(this.verb); }
      const upd = (first) => {
        const s = this.spatial(posFn(), range || 34), t = c.currentTime, tc = first ? 0.001 : 0.05;
        const gain = s ? s.g * 1.15 : 0;
        g.gain.setTargetAtTime(gain, t, tc); f.frequency.setTargetAtTime(s ? s.lp : 400, t, tc); f2.frequency.setTargetAtTime(s ? (s.lp < 1500 ? s.lp * 1.4 : 20000) : 600, t, tc);
        if (s) { const d = s.dir; if (pn.positionX) { pn.positionX.setTargetAtTime(d.x, t, tc); pn.positionY.setTargetAtTime(d.y, t, tc); pn.positionZ.setTargetAtTime(d.z, t, tc); } else pn.setPosition(d.x, d.y, d.z); dry.gain.setTargetAtTime(1 - s.wet * 0.45, t, tc); wet.gain.setTargetAtTime(s.wet, t, tc); }
      };
      upd(true);
      const iv = setInterval(() => upd(false), 60);
      this.voiceNode = src;
      src.onended = () => { clearInterval(iv); [src, f, f2, pn, g, dry, wet].forEach((nd) => { try { nd.disconnect(); } catch (e) {} }); if (this.voiceNode === src) this.voiceNode = null; };
      src.start(c.currentTime + 0.02, off, len);
      return true;
    },
    hush() { if (this.voiceNode) { try { this.voiceNode.stop(); } catch (e) {} } },

    // per-sound chain: low-pass → 3D panner → dry to the speakers + a send into the house reverb
    chain(s) {
      const c = this.ctx, f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = s.lp; f.Q.value = 0.6;
      let head = f, nodes = [f];
      if (s.lp < 1500) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = s.lp * 1.4; f2.Q.value = 0.5; f.connect(f2); head = f2; nodes.push(f2); } // steeper roll-off through walls
      let out;
      if (c.createPanner) {
        const pn = c.createPanner(); pn.panningModel = TH.settings.quality === 'low' ? 'equalpower' : 'HRTF'; pn.distanceModel = 'linear'; pn.rolloffFactor = 0; pn.refDistance = 1; pn.maxDistance = 1e4;
        if (pn.positionX) { pn.positionX.value = s.dir.x; pn.positionY.value = s.dir.y; pn.positionZ.value = s.dir.z; } else pn.setPosition(s.dir.x, s.dir.y, s.dir.z);
        out = pn;
      } else { out = c.createStereoPanner ? c.createStereoPanner() : c.createGain(); if (out.pan) out.pan.value = s.pan; }
      head.connect(out); nodes.push(out);
      const dry = c.createGain(); dry.gain.value = 1 - s.wet * 0.45; out.connect(dry); dry.connect(this.master); nodes.push(dry);
      if (this.verb) { const w = c.createGain(); w.gain.value = s.wet; out.connect(w); w.connect(this.verb); nodes.push(w); }
      setTimeout(() => nodes.forEach((n) => { try { n.disconnect(); } catch (e) {} }), 4500);
      return f;
    },
    _out(pan) {
      if (this._bus) return this._bus;
      if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; p.connect(this.master); return p; }
      return this.master;
    },
    tone(freq, dur, type, vol, slideTo, pan, delay) {
      if (!this.ctx || vol <= 0.001) return; const t = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this._out(pan)); o.start(t); o.stop(t + dur + 0.05);
    },
    noise(dur, vol, freq, q, pan, type, delay) {
      if (!this.ctx || vol <= 0.001) return; const t = this.ctx.currentTime + (delay || 0);
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = q || 1;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this._out(pan)); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    play(name, pos, range) {
      if (!this.ctx) return;
      const s = pos ? this.spatial(pos, range) : null;
      // his footsteps are heavy: they carry through walls and floors much better than voices or small noises, and they keep enough
      // of their crack and knock that a phone speaker (which can't play the low thud) still picks them up
      if (s && name === 'enemyStep') { s.g = Math.min(1, s.g * (s.lp < 2500 ? 2.2 : 1.25)); s.lp = Math.max(s.lp, 1400); }
      if (s && s.g < 0.01) return; const v = s ? s.g : 1, p = 0;
      this._bus = s ? this.chain(s) : null; this._pos = pos || null;
      try { this._play(name, v, p); } finally { this._bus = null; }
    },
    _play(name, v, p) {
      switch (name) {
        case 'step': { const P = TH.Player, f = this.surface(P.pos.x, P.pos.z, P.level()); if (this.fx(f === 'tile' || f === 'concrete' ? 'stepHard' : f === 'grass' ? 'dropSoft' : 'stepWood', f === 'carpet' ? 0.1 : f === 'grass' ? 0.08 : 0.17, f === 'carpet' ? { lp: 900 } : f === 'grass' ? { lp: 700, rate: 1.4 } : null)) break; } this.noise(0.07, 0.045 * v, 300 + Math.random() * 150, 0.9, p); break;
        case 'run': { const P = TH.Player, f = this.surface(P.pos.x, P.pos.z, P.level()); if (this.fx(f === 'tile' || f === 'concrete' ? 'stepHard' : 'stepWood', f === 'carpet' ? 0.16 : 0.28, f === 'carpet' ? { lp: 1100, rate: 1.05 } : { rate: 1.05 })) break; } this.noise(0.08, 0.075 * v, 260 + Math.random() * 120, 0.9, p); break;
        case 'creakBoard': this.tone(170 + Math.random() * 40, 0.5, 'sawtooth', 0.05 * v, 120, p); this.noise(0.4, 0.05 * v, 500, 4, p); break;
        case 'door': if (this.sample('door', (this._pos && this._pos.quiet ? 0.25 : 0.7) * v, p, this._pos && this._pos.quiet ? 0.85 : undefined)) break; this.tone(110 + Math.random() * 40, 0.55, 'sawtooth', 0.045 * v, 210, p); this.noise(0.5, 0.05 * v, 900, 6, p); break;
        case 'doorShut': if (this.fx('doorShut', (this._pos && this._pos.quiet ? 0.2 : 0.85) * v, this._pos && this._pos.quiet ? { lp: 1500 } : null)) break; this.noise(0.18, 0.35 * v, 160, 0.8, p, 'lowpass'); break;
        case 'locked': if (this.fx('metalClick', 0.55 * v, { rate: 0.8 })) { this.fx('metalClick', 0.45 * v, { rate: 0.75, delay: 0.13 }); break; } this.noise(0.08, 0.25 * v, 1400, 3, p); this.noise(0.08, 0.2 * v, 900, 3, p, null, 0.1); break;
        case 'unlock': if (this.fx('metalClick', 0.7 * v, { rate: 1.3 })) { this.tone(1200, 0.04, 'square', 0.03 * v, null, p, 0.05); break; } this.tone(1200, 0.05, 'square', 0.06 * v, null, p); this.noise(0.15, 0.3 * v, 400, 2, p, null, 0.08); break;
        case 'pickup': this.tone(560, 0.07, 'triangle', 0.08); this.tone(840, 0.1, 'triangle', 0.07, null, 0, 0.06); break;
        case 'deny': this.tone(170, 0.18, 'sawtooth', 0.06, 110); break;
        case 'dropSmall': if (this.fx('dropHard', 0.5 * v, { rate: 1.3 })) break; this.tone(2400, 0.12, 'sine', 0.08 * v, null, p); this.tone(3100, 0.09, 'sine', 0.05 * v, null, p, 0.07); break;
        case 'dropWood': if (this.fx('dropSoft', 0.6 * v, { lp: 2200 })) break; this.noise(0.12, 0.3 * v, 380, 1, p); break;
        case 'dropMetal': if (this.fx('dropMetal', 0.9 * v)) { [520, 1190, 1870].forEach((f, i) => this.tone(f, 1.1 - i * 0.25, 'sine', (0.06 / (i + 1)) * v, null, p)); break; } [520, 1190, 1870, 2650].forEach((f, i) => this.tone(f, 1.4 - i * 0.25, 'sine', (0.16 / (i + 1)) * v, null, p)); this.noise(0.06, 0.4 * v, 3000, 1, p); break;
        case 'glass': if (this.fx('glass', 1.0 * v)) { this.noise(0.12, 0.08 * v, 5000, 2, p, null, 0.05); break; } for (let i = 0; i < 7; i++) this.noise(0.1 + Math.random() * 0.2, 0.35 * v, 3000 + Math.random() * 4000, 3, p, null, i * 0.035); break;
        case 'frame': if (this.fx('debris', 0.8 * v)) { this.fx('dropHard', 0.7 * v, { delay: 0.07, rate: 0.85 }); break; } this.noise(0.2, 0.4 * v, 300, 1, p); this.noise(0.25, 0.2 * v, 2600, 2, p, null, 0.08); break;
        case 'vent': for (let i = 0; i < 3; i++) this.tone(1800 + i * 200, 0.08, 'square', 0.03 * v, 1200, p, i * 0.12); break;
        case 'cabinet': if (this.fx('chestOpen', 0.7 * v)) break; this.tone(240, 0.3, 'sawtooth', 0.03 * v, 170, p); break;
        case 'fridge': this.noise(0.22, 0.18 * v, 700, 0.7, p, 'lowpass'); this.noise(0.5, 0.05 * v, 2400, 1.5, p, null, 0.05); this.tone(120, 0.9, 'sine', 0.025 * v, null, p, 0.1); break; // seal pops, hum
        case 'fridgeShut': this.noise(0.15, 0.3 * v, 220, 0.8, p, 'lowpass'); this.tone(90, 0.12, 'sine', 0.12 * v, 60, p); break;
        case 'drawer': if (this.fx('chestOpen', 0.45 * v, { rate: 1.2 })) break; this.noise(0.32, 0.1 * v, 650 + Math.random() * 200, 1.2, p); this.noise(0.05, 0.12 * v, 1600, 2, p, null, 0.28); break;
        case 'drawerShut': if (this.fx('chestClose', 0.5 * v, { rate: 1.2 })) break; this.noise(0.12, 0.08 * v, 700, 1.2, p); this.noise(0.08, 0.25 * v, 300, 1, p, 'lowpass', 0.1); break;
        case 'pry': if (this.fx('pry', 0.7 * v, { rate: 0.85 })) break; this.tone(170, 0.4, 'sawtooth', 0.04 * v, 120, p); break;
        case 'cloth': this.fx('cloth', 0.45 * v); break;
        case 'steelOpen': this.fx('steelOpen', 0.6 * v); break;
        case 'steelClose': this.fx('steelClose', 0.6 * v); break;
        case 'flush': this.fx('flush', 1.0 * v); break;
        case 'trapSnap': this.fx('metalClick', 1.0 * v, { rate: 1.7 }); this.fx('dropHard', 0.8 * v, { rate: 1.5, delay: 0.01 }); this.tone(1800, 0.25, 'triangle', 0.05 * v, 900, p, 0.02); break; // spring bar slamming down
        case 'trapSet': this.fx('metalClick', 0.5 * v, { rate: 1.4 }); this.fx('metalClick', 0.35 * v, { rate: 1.9, delay: 0.18 }); break;
        case 'yelp': if (this.sample('ouch', 0.95 * v, p, 0.98 + Math.random() * 0.05)) break; if (!this.fx('yelp', 0.9 * v, { rate: 1.05 + Math.random() * 0.1 })) this.tone(520, 0.3, 'sawtooth', 0.08 * v, 300, p); break;
        // Tim: a low, throaty grunt (two vocal formants over a falling buzz, plus breath)
        case 'grunt': {
          const c = this.ctx, t = c.currentTime, o = c.createOscillator(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(), g2 = c.createGain();
          const f0 = 78 + Math.random() * 30, len = 0.28 + Math.random() * 0.25, out = this._out(p);
          o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * 1.18, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.78, t + len);
          f1.type = 'bandpass'; f1.frequency.value = 480 + Math.random() * 120; f1.Q.value = 5; f2.type = 'bandpass'; f2.frequency.value = 1050 + Math.random() * 200; f2.Q.value = 7;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + len); g2.gain.value = 0.45;
          o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g2); g2.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.05);
          this.noise(len * 0.9, 0.05 * v, 700, 0.8, p, 'lowpass'); break; }
        case 'sling': this.tone(220, 0.12, 'triangle', 0.08, 90); this.noise(0.08, 0.15, 1800, 1.5); this.fx('metalClick', 0.15, { rate: 0.6 }); break; // rubber twang + snap
        case 'thwack': if (this.fx('dropHard', 0.9 * v, { rate: 0.9 })) { this.noise(0.1, 0.15 * v, 600, 1, p, 'lowpass'); break; } this.noise(0.15, 0.4 * v, 500, 1, p); break;
        case 'zap': for (let i = 0; i < 14; i++) this.noise(0.03 + Math.random() * 0.04, 0.22, 2500 + Math.random() * 3500, 4, (Math.random() - 0.5) * 0.4, null, i * 0.06 + Math.random() * 0.03); this.tone(58, 0.9, 'sawtooth', 0.12, 55); this.tone(116, 0.9, 'square', 0.04, 110); break; // crackling arcs over a mains buzz
        case 'handle': this.fx('metalClick', 0.55 * v, { rate: 0.85 + Math.random() * 0.3 }); this.fx('metalClick', 0.4 * v, { rate: 0.7 + Math.random() * 0.2, delay: 0.09 }); this.noise(0.12, 0.05 * v, 900, 2, p); break; // the knob rattling
        case 'keys': for (let i = 0; i < 4; i++) this.fx('metalClick', (0.25 + Math.random() * 0.2) * v, { rate: 1.9 + Math.random() * 0.8, delay: i * 0.07 + Math.random() * 0.03 }); break; // a ring of keys
        case 'roach': this.noise(0.25, 0.05 * v, 5000, 2, p); break;
        case 'static': this.noise(2.3, 0.3 * v, 3400, 0.4, p); this.noise(2.3, 0.18 * v, 1100, 0.5, p); this.tone(7800, 2.2, 'sine', 0.012 * v, null, p); break; // a TV tuned to nothing, turned all the way up
        case 'drip': this.tone(1500, 0.08, 'sine', 0.05 * v, 700, p); break;
        case 'enemyStep': { v *= 1.35; const q = this._pos, f = q ? this.surface(q.x, q.z, TH.Col.levelOf(Math.max(0, (q.y || 0) + 0.3))) : 'wood';
          // the knock of a heavy heel and the floor giving under him: mid frequencies you can hear on a phone, not just the bass thud
          this.noise(0.07, 0.16 * v, f === 'carpet' ? 520 : 720, 1.4, p, 'bandpass'); this.noise(0.05, 0.07 * v, 1700, 2, p, 'bandpass', 0.012);
          if (f !== 'tile' && f !== 'concrete' && Math.random() < 0.3) this.tone(180 + Math.random() * 60, 0.22, 'sawtooth', 0.022 * v, 130, p, 0.03); // a board creaks under his weight
          if (this.fx(f === 'tile' || f === 'concrete' ? 'stepHard' : 'stepWood', (f === 'carpet' ? 0.85 : 1.05) * v, { rate: 0.8, lp: f === 'carpet' ? 2200 : 5000 })) { this.tone(62, 0.16, 'sine', 0.22 * v, 42, p); break; } }
          this.tone(70, 0.18, 'sine', 0.35 * v, 45, p); this.noise(0.1, 0.12 * v, 220, 1, p); break;
        case 'growl': this.tone(65, 0.9, 'sawtooth', 0.12 * v, 52, p); this.noise(0.9, 0.12 * v, 300, 1.5, p, 'lowpass'); break;
        case 'mumble': for (let i = 0; i < 4; i++) this.tone(110 + Math.random() * 60, 0.15, 'triangle', 0.06 * v, 90, p, i * 0.17); break;
        case 'sting': [98, 104, 147, 156, 208].forEach((f) => this.tone(f, 1.8, 'sawtooth', 0.07)); this.noise(1.2, 0.3, 200, 0.6, 0, 'lowpass'); break;
        case 'heart': this.tone(55, 0.12, 'sine', 0.3); this.tone(50, 0.12, 'sine', 0.22, null, 0, 0.18); break;
        case 'crank': this.tone(70 + Math.random() * 10, 0.18, 'sawtooth', 0.12, 50); this.noise(0.16, 0.2, 260, 1.5); break;
        case 'engine': this.startEngine(); break;
        case 'thud': if (this.fx('dropHard', 1.0, { rate: 0.6 })) { this.fx('debris', 0.6, { delay: 0.04 }); this.tone(60, 0.3, 'sine', 0.25, 35); break; } this.tone(60, 0.35, 'sine', 0.4, 35); this.noise(0.25, 0.4, 180, 0.8, 0, 'lowpass'); break;
        case 'climb': this.tone(300 + Math.random() * 80, 0.08, 'square', 0.03, 180); this.noise(0.06, 0.08, 1200, 2); break;
        case 'crawl': this.noise(0.4, 0.06, 700, 0.6); break;
        // a cheap wind-up radio: a tinny note of an old tune through a lot of static (the note comes in on the position object)
        case 'radio': { const q = this._pos || {}; const f = q.note || 440; this.tone(f, 0.22, 'square', 0.035 * v, null, p); this.tone(f * 0.5, 0.22, 'triangle', 0.03 * v, null, p); this.noise(0.24, 0.025 * v, 2600, 0.6, p); break; }
        case 'wind': for (let i = 0; i < 6; i++) this.fx('metalClick', 0.18 * v, { rate: 2.2 + Math.random() * 0.4, delay: i * 0.07 }); break; // ratchet of the wind-up key
        case 'fire': this.noise(0.12 + Math.random() * 0.2, (0.08 + Math.random() * 0.1) * v, 900 + Math.random() * 2400, 0.7, p); if (Math.random() < 0.4) this.noise(0.03, 0.2 * v, 3500, 3, p, null, Math.random() * 0.1); this.noise(0.5, 0.06 * v, 140, 0.5, p, 'lowpass'); break;
        case 'whoosh': this.noise(1.2, 0.5 * v, 300, 0.4, p, 'lowpass'); this.noise(0.9, 0.25 * v, 1800, 0.6, p); this.tone(60, 1.0, 'sine', 0.2 * v, 40, p); break;
        case 'rockThrow': this.noise(0.18, 0.12, 1200, 1.2); break;
        case 'win': [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.08, null, 0, i * 0.12)); break;
      }
    },
    // idling V8: two detuned saws + a low-pass that opens with the revs
    startEngine() {
      if (!this.ctx || this.eng) return; const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = 38; o2.frequency.value = 38.7; f.type = 'lowpass'; f.frequency.value = 300; lfo.frequency.value = 9; lg.gain.value = 0.06; lfo.connect(lg); lg.connect(g.gain);
      g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.16, c.currentTime + 0.3); o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); o.start(); o2.start(); lfo.start();
      this.eng = { o, o2, f, g, lfo };
    },
    rev(speed) { if (!this.eng) return; const k = 38 + speed * 6; this.eng.o.frequency.value = k; this.eng.o2.frequency.value = k * 1.02; this.eng.f.frequency.value = 300 + speed * 90; },
    stopEngine() { if (!this.eng) return; const e = this.eng; e.g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5); setTimeout(() => { try { e.o.stop(); e.o2.stop(); e.lfo.stop(); } catch (er) { /* stopped */ } }, 1600); this.eng = null; },
    setChase(on) {
      if (!this.ctx) return;
      if (on && !this.drone) {
        const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = 55; o2.type = 'sawtooth'; o2.frequency.value = 58.3;
        lfo.frequency.value = 3.2; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain);
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        g.gain.value = 0.0; g.gain.linearRampToValueAtTime(0.09, this.ctx.currentTime + 0.6);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); o.start(); o2.start(); lfo.start();
        this.drone = { o, o2, lfo, g };
      } else if (!on && this.drone) {
        const d = this.drone; d.g.gain.cancelScheduledValues(this.ctx.currentTime); d.g.gain.setValueAtTime(d.g.gain.value, this.ctx.currentTime);
        d.g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.5); setTimeout(() => { try { d.o.stop(); d.o2.stop(); d.lfo.stop(); } catch (e) { /* stopped */ } }, 2700);
        this.drone = null;
      }
    },
  };
})();
