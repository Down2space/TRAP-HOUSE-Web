/* TRAP HOUSE — Tim's 3D model: the mannequin scan (models/tim.json) on a full skeleton (models/tim_rig.json: body, arms,
   every finger in three joints, feet and toes, with skin weights built offline from the mesh).
   enemy.js still decides what he's doing — its old block body is hidden but keeps being posed (walk, chase, kneel, stun,
   the grab in the kill cam and on the tapes). Every frame, just before anything is drawn, this reads those joint angles as
   intent and builds a natural pose from them: heel-to-toe feet that stay flat on the floor, hips and chest swinging against
   each other, elbows that bend more as the arm swings forward, a wrist that trails the swing, loosely curled fingers that
   splay and claw when he reaches for you and close tight when he grabs, a head that keeps its eyes level, and breathing. */
(function () {
  'use strict';
  const TH = window.TH;
  const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

  // the rotation that carries a bone's bind frame (e1 = its hinge, e2 = pointing back up the bone) onto the block frame (x, y)
  function restMap(e1, e2) {
    const a = e1.clone().normalize(), b = e2.clone().sub(a.clone().multiplyScalar(e2.dot(a))).normalize(), c = a.clone().cross(b);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, b, c)).invert();
  }

  TH.TimScan = {
    ready: false, status: 'loading', mesh: null, rig: null,
    scale: 1.053, // the scan stands 2.09 m in his hunch; this brings him to 2.2 m, the old block Tim's height (Dylan is 1.78 m)
    load() {
      if (!THREE.GLTFLoader) { this.status = 'loader missing'; return; }
      let tries = 0;
      const fail = (e) => { this.status = 'failed (' + ((e && (e.message || e.type)) || 'network') + ')'; if (tries < 4) setTimeout(go, 3000 * tries); };
      const done = () => { if (this.mesh.geometry.attributes.position.count !== this.rig.n) { this.status = 'rig does not match the model'; return; } this.ready = true; this.status = 'loaded'; this.attach(); };
      const go = () => {
        tries++;
        const rig = this.rig ? Promise.resolve(this.rig) : fetch('models/tim_rig.json').then((r) => { if (!r.ok) throw new Error('rig ' + r.status); return r.json(); });
        rig.then((rj) => {
          this.rig = rj; if (this.mesh) return done();
          new THREE.GLTFLoader().load('models/tim.json', (gl) => { gl.scene.traverse((o) => { if (o.isMesh && !this.mesh) this.mesh = o; }); if (!this.mesh) { this.status = 'empty file'; return; } done(); }, undefined, fail);
        }).catch(fail);
      };
      go();
    },

    attach() {
      const E = TH.Enemy, m = E && E.model; if (!this.ready || !m || m.scan) return;
      const R = this.rig, src = this.mesh, geo = src.geometry.clone(), n = R.n;
      const bi = Uint8Array.from(atob(R.idx), (c) => c.charCodeAt(0)), bw = Uint8Array.from(atob(R.w), (c) => c.charCodeAt(0));
      const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) { SI[i] = bi[i]; SW[i] = bw[i] / 255; }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
      const bones = R.bones.map(([name]) => { const b = new THREE.Bone(); b.name = name; return b; });
      R.bones.forEach(([, p, pos], i) => { const q = p < 0 ? [0, 0, 0] : R.bones[p][2]; bones[i].position.set(pos[0] - q[0], pos[1] - q[1], pos[2] - q[2]); if (p >= 0) bones[p].add(bones[i]); });
      const mat = src.material.clone(); mat.skinning = true; if (mat.map) mat.map.encoding = THREE.sRGBEncoding; mat.userData.noPBR = true;
      const skin = new THREE.SkinnedMesh(geo, mat); skin.frustumCulled = false; skin.castShadow = true; skin.receiveShadow = true;
      const g = new THREE.Group(); g.name = 'timScan'; g.scale.setScalar(this.scale); g.position.z = 0.10 * this.scale;
      g.add(bones[0]); g.add(skin); m.root.add(g); g.updateMatrixWorld(true); skin.bind(new THREE.Skeleton(bones));
      m.body.traverse((o) => { if (o.isMesh || o.isSprite) o.visible = false; }); // the old block body (and its plank) is never drawn again
      const B = R.B, maps = {};
      // rest maps: the bind frame of each limb segment -> the block's frame (bone hanging down -y, hinge about x, forward +z)
      for (const s of ['R', 'L']) {
        const A = R.arms[s], sh = V3(A.sh), el = V3(A.el), wr = V3(A.wr), u = el.clone().sub(sh), f = wr.clone().sub(el);
        const e1 = u.clone().cross(f).normalize().negate(); // the elbow's hinge, oriented so a bend is a forward swing in the block frame
        maps['up' + s] = restMap(e1, u.clone().negate()); maps['fore' + s] = restMap(e1, f.clone().negate());
        const G = R.legs[s], hip = V3(G.hip), knee = V3(G.knee), ank = V3(G.ank);
        const fd = V3(G.fdir).setY(0).normalize(), down = ank.clone().sub(hip).normalize();
        const kh = fd.clone().cross(down).normalize(); // the knee's hinge: square to the way his foot points (his feet turn out in the scan)
        maps['thigh' + s] = restMap(kh, knee.clone().sub(hip).negate()); maps['shin' + s] = restMap(kh, ank.clone().sub(knee).negate());
        maps['toeAxis' + s] = V3(G.fdir).cross(Y).normalize();
      }
      const fingers = {}; for (const s of ['R', 'L']) fingers[s] = R.fingers[s].map((f) => ({ b: f.b, ax: f.axes.map(V3) }));
      // the eye glints sit in his sockets
      if (m.glowMat) [-1, 1].forEach((sd) => { const sp = new THREE.Sprite(m.glowMat); sp.scale.set(0.045, 0.045, 1); sp.position.set(sd * 0.035, 0.058, 0.088); /* deep in the sockets: brow and cheekbones hide it from the side */ bones[B.head].add(sp); });
      m.scan = { g, skin, bones, B, maps, fingers, par: R.bones.map((b) => b[1]), rest0: bones[B.hips].position.clone(), Qm: bones.map(() => new THREE.Quaternion()), t0: performance.now() };
      if (TH.Linear) TH.Linear.fix(g);
    },

    // a kneel that fits his legs: [thigh, knee] for the back leg (knee on the floor, shin flat behind) and the front leg (foot planted)
    kneelPose(S) {
      const R = this.rig, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const G = R.legs.L, LT = d(G.hip, G.knee), LS = d(G.knee, G.ank), hipY = (0.40 / this.scale);
      const thB = 0.1, back = [thB, Math.PI / 2 - thB + 0.04];
      const dz = 0.55, dy = G.ank[1] - hipY, D = Math.min(LT + LS - 0.01, Math.max(LS - LT + 0.01, Math.hypot(dz, dy)));
      const phi = Math.atan2(dz, -dy), atHip = Math.acos((LT * LT + D * D - LS * LS) / (2 * LT * D)), atKnee = Math.acos((LT * LT + LS * LS - D * D) / (2 * LT * LS));
      return { hipY, back, front: [-(phi + atHip), Math.PI - atKnee], LT, LS };
    },

    // ---- the creepy layer. While he stands on his rounds with no idea you're there, every few seconds he slips into
    //      something wrong: a slow backbend until his head hangs upside down, his head tipped flat onto a shoulder, an owl-turn
    //      to look straight behind him, a deep fold with his arms dangling, a fit of twitches, or one hand held up in front of
    //      his face while the fingers crawl. On top of that, at any time, his head jerks and his fingers twitch.
    ACTS: { backbend: [5, 8, 3], tilt: [4, 7, 2], owl: [4, 6, 1.5], fold: [4, 7, 1.5], twitch: [2, 3.5, 1.5], hand: [4, 7, 1.5] },
    creep(S, t, dt, idleOK, chase, calm) {
      const C = S.creep || (S.creep = { act: null, e: 0, T: 0, dur: 0, cool: 3 + Math.random() * 4, tw: { t: -9, r: 0, y: 0, p: 0 }, side: 1, ft: 0 });
      const P = this._P || (this._P = {}); for (const k of ['lean', 'back', 'twist', 'hp', 'hr', 'hy', 'jaw', 'th', 'kn', 'hipZ', 'hipX', 'sway', 'fing']) P[k] = 0;
      P.al = P.al || {}; P.el = P.el || {}; P.wf = P.wf || {}; P.fy = P.fy || {}; P.sh = P.sh || {}; P.fc = P.fc || {};
      for (const s of ['R', 'L']) { P.al[s] = 0; P.el[s] = 0; P.wf[s] = 0; P.fy[s] = 0; P.sh[s] = 0; P.fc[s] = 0; }
      // choose and run an idle act
      if (idleOK && !C.act) { C.cool -= dt; if (C.cool <= 0) { const w = [['backbend', 3], ['tilt', 2], ['owl', 1.5], ['fold', 1.5], ['twitch', 1.5], ['hand', 1.5]]; let r = Math.random() * w.reduce((q, x) => q + x[1], 0); C.act = w.find((x) => (r -= x[1]) < 0)[0]; const A = this.ACTS[C.act]; C.dur = A[0] + Math.random() * (A[1] - A[0]); C.T = 0; C.side = Math.random() < 0.5 ? 1 : -1; } }
      if (C.act) { C.T += dt; const A = this.ACTS[C.act], tgt = idleOK && C.T < C.dur ? 1 : 0; C.e += (tgt - C.e) * Math.min(1, dt * (tgt ? 1.6 / A[2] * 1.5 : 3)); if (!tgt && C.e < 0.01) { C.act = null; C.e = 0; C.cool = 4 + Math.random() * 7; } }
      const e = C.e * C.e * (3 - 2 * C.e), sd = C.side, n = (f, o) => Math.sin(t * f + o) * 0.5 + Math.sin(t * f * 2.3 + o * 1.7) * 0.3; // slow wandering noise
      if (C.act === 'backbend') { // arches back until he's looking at the world upside down, knees bent, arms hanging back, mouth open
        P.back = 1.45 * e; P.hp = 0.55 * e + n(1.3, 1) * 0.06 * e; P.hr = n(0.7, 2) * 0.25 * e; P.jaw = 0.38 * e; P.th = -0.42 * e; P.kn = 0.78 * e; P.hipZ = 0.11 * e;
        P.sway = n(0.6, 0) * 0.07 * e; for (const s of ['R', 'L']) { P.al[s] = 0.55 * e; P.el[s] = -0.25 * e; P.wf[s] = 0.5 * e; P.fc[s] = (0.25 + 0.2 * Math.sin(t * 3 + (s === 'R' ? 0 : 1))) * e; }
      } else if (C.act === 'tilt') { // head tipped right over onto one shoulder, that shoulder hunched up to meet it
        P.hr = sd * 1.05 * e + n(2.1, 3) * 0.05 * e; P.hy = sd * 0.2 * e; P.hp = -0.15 * e; P.jaw = 0.12 * e; P.sh[sd > 0 ? 'R' : 'L'] = 0.22 * e; P.twist = sd * 0.1 * e;
      } else if (C.act === 'owl') { // looks straight behind himself, the turn running down his whole spine
        const k = Math.min(1, C.T / 1.8); P.hy = sd * 1.6 * e * (k * k * (3 - 2 * k)); P.twist = sd * 0.55 * e; P.hp = 0.1 * e; P.jaw = 0.05 * e;
      } else if (C.act === 'fold') { // folds forward at the waist, arms swinging loose, head craned up to keep watching
        P.lean = 1.05 * e; P.hp = -0.85 * e; P.kn = 0.35 * e; P.th = -0.15 * e; P.hipZ = -0.06 * e; P.jaw = 0.18 * e;
        for (const s of ['R', 'L']) { P.al[s] = Math.sin(t * 1.7 + (s === 'R' ? 0 : 0.9)) * 0.22 * e; P.el[s] = 0.1 * e; P.fc[s] = 0.15 * e; }
      } else if (C.act === 'twitch') { // a fit of sharp jerks through the head and hands
        const st = Math.floor(t * 7), h = (x) => { const v = Math.sin(x * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) - 0.5; };
        P.hr = h(st) * 0.9 * e; P.hy = h(st + 17) * 0.8 * e; P.hp = h(st + 31) * 0.5 * e; P.jaw = Math.max(0, h(st + 47)) * 0.6 * e; P.twist = h(st + 5) * 0.2 * e;
        for (const s of ['R', 'L']) { P.fc[s] = h(st + (s === 'R' ? 3 : 9)) * 1.0 * e; P.wf[s] = h(st + 11) * 0.6 * e; P.sh[s] = Math.max(0, h(st + 23)) * 0.3 * e; }
      } else if (C.act === 'hand') { // raises one hand in front of his face and watches the fingers crawl
        const s = sd > 0 ? 'R' : 'L'; P.al[s] = -0.9 * e; P.el[s] = -1.5 * e; P.fy[s] = -sd * 0.8 * e; P.wf[s] = (-0.45 + 0.35 * Math.sin(t * 0.9)) * e; P.sh[s] = 0.08 * e;
        P.hr = -sd * 0.35 * e; P.hy = sd * 0.25 * e; P.hp = 0.15 * e; P.jaw = 0.1 * e; P.fing = e;
      }
      // twitches, any time (more often when he's hunting you): the head snaps a little and eases back
      const tw = C.tw; if (t - tw.t > (chase ? 1.2 : 3) + Math.random() * (chase ? 2.5 : 6) && !calm) { tw.t = t; tw.r = (Math.random() - 0.5) * 0.55; tw.y = (Math.random() - 0.5) * 0.5; tw.p = (Math.random() - 0.5) * 0.3; }
      const ta = t - tw.t, tk = ta < 0.06 ? ta / 0.06 : Math.exp(-(ta - 0.06) * 4);
      P.hr += tw.r * tk; P.hy += tw.y * tk; P.hp += tw.p * tk;
      P.hr += 0.16 + 0.04 * Math.sin(t * 0.8); // his head is always cocked a little to one side
      // the fingers never quite stop
      C.ft = (C.ft || 0) + dt; P.tick = t;
      return P;
    },

    // build the pose from the block body's joint angles (called right before every render)
    sync() {
      const E = TH.Enemy, m = E && E.model, S = m && m.scan; if (!S || !m.root.visible) return;
      const { bones, B, maps, Qm, par } = S, qa = this._qa || (this._qa = new THREE.Quaternion());
      const t = (performance.now() - S.t0) / 1000, dt = Math.min(0.1, Math.max(0.001, t - (S.lt === undefined ? t - 0.016 : S.lt))); S.lt = t;
      const rx = (a) => qa.setFromAxisAngle(X, a), ry = (a) => qa.setFromAxisAngle(Y, a), rz = (a) => qa.setFromAxisAngle(Z, a);
      const chase = E.state === 'chase', stun = E.stunT > 0, kneel = E.kneelT > 0 && !stun;
      const v = S.v = (S.v || 0) + (Math.max(0, E.speed || 0) - (S.v || 0)) * Math.min(1, dt * 4); // speed, eased so starts and stops roll in
      const a = Math.min(1, v / 1.3), run = Math.min(1, Math.max(0, (v - 2.0) / 1.8)); const runS = run * run * (3 - 2 * run);
      const G = (pm, c, w) => { let d = Math.abs(pm - c); d = Math.min(d, 2 * Math.PI - d); return Math.exp(-(d * d) / (w * w)); }; // smooth bump on the stride cycle
      const wrap = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const ph = E.phase || 0, sw = Math.sin(ph), cw = Math.cos(ph);
      const grab = m.armL.rotation.x < -1.45 && m.armR.rotation.x < -1.4; // the catch (kill cam / tapes)
      const kk = Math.max(0, kneel ? Math.min(1, (1.2 - E.kneelT) * 4, E.kneelT * 4) : stun ? Math.min(1, E._stunIn || 0) : 0);
      const idleOK = E.state === 'patrol' && v < 0.25 && kk === 0 && !grab && !stun;
      const P = this.creep(S, t, dt, idleOK, chase, grab || kk > 0);
      const posed = kk > 0 || grab || stun; // the only times the block's torso angle is used
      const lean = (posed ? (m.torso.rotation.x - 0.22) * (1 - 0.6 * kk) : 0) + 0.06 + runS * 0.06 * a + P.lean;
      // his resting hunch: he folds forward through the belly and the ribs, from the belly button up to the shoulders; the neck and head
      // stay upright on top, so he looks straight ahead (eased off in a backbend)
      const hunch = 0.42 * (1 - 0.5 * kk) * Math.max(0, 1 - P.back * 1.2), tuck = hunch * 0.3; // the pelvis tucks under as the back rounds

      // ---- pelvis and a five-piece spine: the bend, the twist against the hips and the sway are spread through every segment,
      //      so his back curls and unwinds instead of hinging in one place
      const yaw = sw * (0.12 + 0.07 * runS) * a;                            // hips swing forward with the leg
      const roll = -cw * 0.045 * a * (1 - 0.5 * runS), shift = -cw * 0.022 * a * (1 - runS); // weight onto the planted leg, the free hip drops
      const br = S.br = (S.br || 0) + dt * (chase ? 3.4 : stun ? 2.6 : 1.45) * (1 + 0.6 * runS), breathe = Math.sin(br), depth = chase ? 1.8 : stun ? 1.4 : 1;
      const hipTilt = 0.03 * a + 0.04 * runS * a + (stun ? 0.1 : 0) + Math.cos(2 * ph) * 0.02 * a - P.back * 0.12;
      const hips = Qm[B.hips].identity().multiply(ry(yaw)).multiply(rz(roll + P.sway)).multiply(rx(hipTilt - tuck));
      const SP = [['spine1', 0.12, 0.15, 0.25, 0.1, 0.22], ['spine2', 0.18, 0.25, 0.3, 0.16, 0.3], ['spine3', 0.22, 0.3, 0.3, 0.22, 0.3], ['chest', 0.25, 0.3, 0.25, 0.26, 0.24], ['upperChest', 0.23, 0.22, 0.15, 0.26, 0.1]];
      let prevQ = hips;
      for (const [nm, kl, ky, kr, kb, kh] of SP) {
        const b = B[nm], extra = nm === 'chest' ? breathe * 0.012 * depth : nm === 'upperChest' ? -breathe * 0.006 * depth : 0;
        Qm[b].copy(prevQ).multiply(rx(lean * kl - hipTilt * kl * 0.8 + extra - P.back * kb + hunch * kh)).multiply(ry(-yaw * ky * 1.2 + P.twist * ky)).multiply(rz(-roll * kr * 1.15 - P.sway * kr));
        prevQ = Qm[b];
      }
      const hy = m.head.rotation.y * (1 - Math.min(1, Math.abs(P.hy) * 2)) + P.hy, hr = P.hr, hx = m.head.rotation.x - P.hp - (lean - P.lean) * 0.35 + P.lean * 0.2 + Math.cos(2 * ph) * 0.02 * a;
      Qm[B.neck1].copy(Qm[B.upperChest]).multiply(rx(-lean * 0.22 - breathe * 0.004 - P.back * 0.12 - hunch * 0.5)).multiply(ry(hy * 0.2 + yaw * 0.15)).multiply(rz(roll * 0.2 + hr * 0.3));
      Qm[B.neck2].copy(Qm[B.neck1]).multiply(rx(-lean * 0.23 + hx * 0.3 - P.back * 0.1 - hunch * 0.3)).multiply(ry(hy * 0.3 + yaw * 0.1)).multiply(rz(hr * 0.3));
      Qm[B.head].copy(Qm[B.neck2]).multiply(ry(hy * 0.5)).multiply(rz(hr * 0.4)).multiply(rx(hx * 0.7 - hunch * 0.15 + tuck));
      // jaw: hangs a touch open; gapes and works when he's after you, drops in the grab, slack when stunned
      const jt = grab ? 0.42 : P.jaw > 0.06 ? P.jaw : chase ? 0.26 + 0.12 * Math.sin(t * 6.5) : stun ? 0.22 : 0.05 + 0.025 * Math.sin(t * 0.6);
      S.jaw = (S.jaw || 0) + (jt - (S.jaw || 0)) * Math.min(1, dt * 8); bones[B.jaw].quaternion.setFromAxisAngle(X, S.jaw);
      // ribs and belly breathe: the chest swells, then the belly a moment later
      const b2 = Math.sin(br - 0.7);
      bones[B.ribs].scale.set(1 + 0.025 * breathe * depth, 1 + 0.008 * breathe * depth, 1 + 0.05 * breathe * depth);
      bones[B.belly].scale.set(1 + 0.015 * b2 * depth, 1, 1 + 0.05 * b2 * depth);

      // ---- arms: upper arm from the block's swing, a natural hang outward, the elbow bending more as the arm comes forward
      const out = { R: 0.15, L: -0.05 }; // the scan's shoulders aren't level with each other, so the hang evens the hands out
      const up = this._t1 || (this._t1 = new THREE.Quaternion()), fore = this._t2 || (this._t2 = new THREE.Quaternion());
      for (const s of ['R', 'L']) {
        const arm = s === 'R' ? m.armR : m.armL, side = s === 'R' ? 1 : -1, pSide = s === 'L' ? ph : ph + Math.PI;
        const own = !(grab || kk > 0), al = (own ? -0.14 - Math.sin(pSide) * a * (0.26 + 0.24 * runS) : arm.rotation.x) + P.al[s]; // arms hang a little forward, always
        const fwd = Math.max(0, -al), swingV = ((S['pa' + s] === undefined ? al : S['pa' + s]) - al) / dt; S['pa' + s] = al;
        // collarbone: the shoulder rides forward and up as the arm comes forward, and lifts with each breath
        const prot = Math.max(-0.12, Math.min(0.25, -al * 0.12)) + hunch * 0.2, elev = 0.1 * fwd + breathe * 0.015 * depth + (grab ? 0.1 : 0) - (stun ? 0.08 : 0) + P.sh[s];
        Qm[B['clav' + s]].copy(Qm[B.upperChest]).multiply(rz(side * elev)).multiply(ry(-side * prot));
        up.copy(Qm[B['clav' + s]]).multiply(rx(al)).multiply(rz(out[s] + (grab ? -side * 0.18 : 0)));
        Qm[B['up' + s]].copy(up).multiply(maps['up' + s]);
        const el = (own ? -0.38 - runS * a * 0.45 : arm.userData.elbow.rotation.x) - 0.12 - Math.max(0, -(al - P.al[s])) * 0.35 * (own ? 1 - runS * 0.6 : 0.4) + P.el[s];
        fore.copy(up).multiply(rx(el)).multiply(ry(-side * 0.3 + P.fy[s])); // the forearm turns the palm a little back toward the leg
        Qm[B['fore' + s]].copy(fore).multiply(maps['fore' + s]);
        const lag = Math.max(-0.35, Math.min(0.35, swingV * 0.05));
        const wf = 0.18 + lag + (grab ? -0.2 : 0) + (stun ? 0.4 : 0) + P.wf[s];
        Qm[B['hand' + s]].copy(fore).multiply(rx(wf)).multiply(rz(side * 0.06)).multiply(maps['fore' + s]);
        // fingers (local): loosely curled hanging, splayed and clawing as he reaches, closed tight in the grab, limp when stunned
        S.fingers[s].forEach((F, k) => {
          const j = k * 1.7 + (s === 'R' ? 0 : 0.9);
          let c0 = -0.05 + Math.sin(t * 0.7 + j) * 0.04, c1 = 0.22 + Math.sin(t * 0.9 + j) * 0.05, c2 = 0.25;
          if (chase) { const cl = Math.sin(t * 4 + k * 0.6 + (s === 'R' ? 1.4 : 0)); c0 += 0.1 * cl; c1 += 0.15 * cl; c2 += 0.12 * cl; }
          if (grab) { c0 = 0.95; c1 = 1.05; c2 = 0.7; }
          if (stun) { c0 = 0.25; c1 = 0.35; c2 = 0.2; }
          c0 += P.fc[s] * 0.6; c1 += P.fc[s]; c2 += P.fc[s] * 0.7;
          if (P.fing > 0 && (P.fing && (s === (S.creep.side > 0 ? 'R' : 'L')))) { const w = Math.sin(t * 3.2 - k * 0.9); c0 += P.fing * 0.45 * w; c1 += P.fing * 0.6 * (0.5 + 0.5 * w); c2 += P.fing * 0.4 * (0.5 + 0.5 * w); } // the fingers crawl one after another
          const ftw = Math.sin(t * 0.37 + k * 2.1 + (s === 'R' ? 0 : 4)); if (ftw > 0.985 && !grab) { c1 += 0.5; c2 += 0.4; } // now and then a single finger twitches
          if (k === 0) { c0 *= 0.5; c1 *= 0.6; c2 *= 0.6; }
          bones[F.b[0]].quaternion.setFromAxisAngle(F.ax[0], c0); bones[F.b[1]].quaternion.setFromAxisAngle(F.ax[1], c1); bones[F.b[2]].quaternion.setFromAxisAngle(F.ax[2], c2);
        });
      }

      // ---- legs: the block's hip and knee, plus a soft knee on the planted leg, and heel-to-toe feet that stay on the floor
      const thigh = this._t3 || (this._t3 = new THREE.Quaternion()), shin = this._t4 || (this._t4 = new THREE.Quaternion());
      // down on one knee (setting a trap, or knocked down by the taser): his thighs are short and his shins long, so the block's
      // angles would sink his front foot through the floor; solve it instead — back knee resting on the floor, front foot flat
      const KN = S.kneel || (S.kneel = this.kneelPose(S)), CR = { th: -0.1, kn: 0.22 }; // his crouch: knees never quite straighten
      // hip height: cancel the block's own bob/drop and use a smooth one — high at mid-stance when walking, low at landing when running
      const bob = (Math.cos(2 * ph) * (0.018 * (1 - runS) - 0.04 * runS)) * a, rootOff = m.root.position.y - (E.y || 0);
      bones[B.hips].position.copy(S.rest0); bones[B.hips].position.x += shift * (1 - kk) / this.scale; bones[B.hips].position.z += P.hipZ / this.scale;
      { const LT = KN.LT, LS = KN.LS, th0 = P.th + CR.th * (1 - kk), kn0 = P.kn + CR.kn * (1 - kk); bones[B.hips].position.y -= (LT + LS) - (LT * Math.cos(th0) + LS * Math.cos(th0 + kn0)); } bones[B.hips].position.y += (bob * (1 - kk) - rootOff) / this.scale + kk * (KN.hipY - S.rest0.y);
      for (const s of ['R', 'L']) {
        const p = s === 'L' ? ph : ph + Math.PI, pm = wrap(p), PI = Math.PI;
        // stride cycle (pm): 0 mid-stance, pi/2 leg back / toe-off, pi mid-swing, 3pi/2 leg forward / heel strike
        const thW = 0.36 * Math.sin(p), knW = 0.08 + 0.72 * G(pm, 0.9 * PI, 0.38 * PI) + 0.12 * G(pm, 1.65 * PI, 0.22 * PI);
        const thR = 0.56 * Math.sin(p) - 0.2 - 0.12 * G(pm, 1.25 * PI, 0.3 * PI), knR = 0.22 + 1.12 * G(pm, 0.95 * PI, 0.42 * PI) + 0.26 * G(pm, 1.62 * PI, 0.2 * PI);
        let th = a * (thW + (thR - thW) * runS) + P.th + tuck + CR.th * (1 - kk), kn = a * (knW + (knR - knW) * runS) + P.kn + CR.kn * (1 - kk);
        if (kk > 0) { const K = s === 'R' ? KN.back : KN.front; th += (K[0] - th) * kk; kn += (K[1] - kn) * kk; }
        thigh.copy(hips).multiply(ry((s === 'R' ? 1 : -1) * 0.09)).multiply(rx(th)).multiply(rz((s === 'R' ? 1 : -1) * 0.02)); // a slight natural toe-out
        Qm[B['thigh' + s]].copy(thigh).multiply(maps['thigh' + s]);
        shin.copy(thigh).multiply(rx(kn)); Qm[B['shin' + s]].copy(shin).multiply(maps['shin' + s]);
        // the walk cycle (pm): 0 mid-stance, pi/2 leg back / toe-off, pi mid-swing, 3pi/2 leg forward / heel strike
        const toeOff = G(pm, 0.62 * PI, 0.2 * PI) * a, swingUp = G(pm, PI, 0.25 * PI) * a, strike = G(pm, 1.5 * PI, 0.16 * PI) * a;
        let ank = -(th + kn) * (1 - 0.25 * runS * G(pm, PI, 0.5 * PI)) + toeOff * (0.45 + 0.25 * runS) - swingUp * 0.2 - strike * 0.22 * (1 - runS * 0.6), toe = toeOff * (0.6 + 0.2 * runS);
                if (kk > 0 && s === 'R') { ank += (0.25 - ank) * kk; toe = 0.9 * kk; } // back foot: up on the balls, toes bent flat // the knee on the floor: toes tucked under
        Qm[B['foot' + s]].copy(shin).multiply(rx(ank)).multiply(maps['shin' + s]);
        bones[B['toe' + s]].quaternion.setFromAxisAngle(maps['toeAxis' + s], toe);
      }

      // ---- model-space rotations -> each bone's own rotation
      const qi = this._qi || (this._qi = new THREE.Quaternion());
      const local = (b) => { const p = par[b]; bones[b].quaternion.copy(p < 0 ? Qm[b] : qi.copy(Qm[p]).invert().multiply(Qm[b])); };
      [B.hips, B.spine1, B.spine2, B.spine3, B.chest, B.upperChest, B.neck1, B.neck2, B.head, B.clavR, B.clavL].forEach(local);
      for (const s of ['R', 'L']) ['up', 'fore', 'hand', 'thigh', 'shin', 'foot'].forEach((k) => local(B[k + s]));
      S.g.updateMatrixWorld(true);
    },
  };

  // run just before the scene is drawn, whoever draws it (the game, the security tapes, the kill cam)
  const hook = () => { const sc = TH.scene; if (!sc || sc.__timHook) return !!sc; const prev = sc.onBeforeRender; sc.onBeforeRender = function () { TH.TimScan.sync(); if (prev) prev.apply(this, arguments); }; sc.__timHook = true; return true; };
  const wait = setInterval(() => { if (TH.Enemy && TH.Enemy.model && hook()) { clearInterval(wait); TH.TimScan.attach(); } }, 200);
  TH.TimScan.load();
})();
