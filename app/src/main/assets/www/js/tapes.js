/* TRAP HOUSE — security cameras.
   Every room has a little CCTV camera up in a corner. The whole game is recorded (you, him, every door), and at the end
   you sit at the guard's desk: a wall of night-vision monitors playing it back.
     - evicted after five days  → the tapes open on each time he caught you
     - got out                   → a time-lapse of the whole run, every camera at once
   Tap a monitor to fill the screen with it; tap again to go back to the wall. */
(function () {
  'use strict';
  const TH = window.TH, U = TH.util;
  const $ = (id) => document.getElementById(id);

  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  const FS = `
    uniform sampler2D map; uniform float time; uniform float seed; uniform float hot; uniform float live; varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      uv.x += (rand(vec2(floor(uv.y * 70.0), floor(time * 14.0) + seed)) - 0.5) * 0.004;            // line jitter
      float roll = step(0.985, fract(uv.y * 0.6 - time * 0.11 + seed)) * 0.25;                      // slow rolling bar
      vec3 c = texture2D(map, uv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      l = 1.0 - exp(-l * 7.0);                                                                        // night-vision gain
      vec3 col = mix(vec3(l) * vec3(0.72, 1.0, 0.78), sqrt(max(c, 0.0)) * 1.4, 0.18);
      col *= 0.86 + 0.14 * sin(uv.y * 520.0);                                                         // scanlines
      col += (rand(uv * vec2(731.0, 513.0) + fract(time * 7.0)) - 0.5) * 0.12 + roll;                // grain
      vec2 d = uv - 0.5; col *= 1.0 - dot(d, d) * 1.4;                                                // lens vignette
      col = mix(col, col * vec3(1.25, 0.75, 0.7), hot * 0.35);                                        // red tint while he's on screen
      col *= live;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`;

  // rooms with no camera of their own are watched by a neighbour's (the back stairs are seen from the landing above)
  const ALIAS = { 'Back Stairs': 'Back Landing' };
  // places with no ceiling corner to hang from get a mount of their own: [lens position, aim point, the surface it's bolted to]
  const SPECIAL = {
    // decks: bolted to the house wall under the upper floor, looking out along the boards
    // (the long front and back decks get one at each end: a post halfway along hides the far half from either one)
    'Front Deck': (r, H, V) => [[V(-14.6, H + 2.5, 12.4), V(2, H + 0.3, 15.3), V(0, 0, 1), 'WEST'], [V(14.6, H + 2.5, 12.4), V(-2, H + 0.3, 15.3), V(0, 0, 1), 'EAST']],
    'West Deck': (r, H, V) => [V(-16.4, H + 2.5, 10.6), V(-18.9, H + 0.3, -2), V(-1, 0, 0)],
    'Back Deck': (r, H, V) => [[V(-14.6, H + 2.5, -12.4), V(2, H + 0.3, -15.3), V(0, 0, -1), 'WEST'], [V(14.6, H + 2.5, -12.4), V(-2, H + 0.3, -15.3), V(0, 0, -1), 'EAST']],
    'East Deck': (r, H, V) => [V(16.4, H + 2.5, -1.4), V(18.9, H + 0.3, 10), V(1, 0, 0)],
    'Garage Roof': (r, H, V) => [V(16.4, H + 2.5, -11.85), V(20.5, H + 0.2, -6.5), V(1, 0, 0)],
    // the yard: hung under the edge of the back deck, watching the lawn and the gate
    // (and a second one on a pole by the back fence, close enough to read the gate: the chain, the bolt and the lock's light)
    Backyard: (r, H, V) => [[V(3.1, H - 0.56, -14.45), V(3.1, 0.4, -25), V(0, -1, 0), 'LAWN'], [V(4.4, 2.5, -26.0), V(3.1, 0.9, -30), V(-0.309, 0, -0.951), 'GATE']],
    // the cellar shaft: on the side wall near the bottom, looking up the steps at the sky
    'Cellar Steps': (r, H, V) => [V(r.x1 - 0.2, -H + 2.45, r.z1 - 0.45), V((r.x0 + r.x1) / 2 - 0.3, -1.5, r.z0 + 0.6), V(-1, 0, 0)],
  };

  const T = (TH.Tapes = {
    frames: [], marks: [], t: 0, acc: 0, cams: [], built: false, active: false,

    /* ---------------- the cameras in the house ---------------- */
    // Where each camera hangs. Worked out once with bake() (a slow raycast of the real house: the actual ceiling height, the
    // real walls, and which corner sees the most of the floor), then written down here so the game doesn't stall at start.
    BAKED: {
      "Garden Shed@0": [[18.31,2.21,-26.51,20,0.6,-27.9,"","f3f3f3ffffffff"]],
      "Foyer@0": [[-2.64,3.25,6.36,0,0.6,9,"","fffff7fffffffffffffffffffffffffffff9"]],
      "Grand Hall@0": [[2.64,3.05,-3.64,0,0.6,1,"","fffffffffffffffffffff0ff0ff0ff0ff0ff0ff0ff0ff0ff8ff0ffeffcff"]],
      "Back Hall@0": [[-2.64,3.25,-4.36,0,0.6,-8,"","ffffffffffffffffffffffffffffffffffffffffffffffff"]],
      "Music Room@0": [[-10.36,3.25,11.64,-13,0.6,8,"","effeffeffefffffffffffffffffffffffffffffffffff8ff"]],
      "Parlor@0": [[-3.36,3.25,4.36,-6.5,0.6,8,"","ffffffffffffffffffffffffffffffffffffffbffffffffffffff0ef"]],
      "Library@0": [[-10.36,3.25,3.64,-13,0.6,0,"","fffffffffffffffefffffffffffffffffffffffffffff0ff"]],
      "Dining Room@0": [[-3.36,3.25,3.64,-6.5,0.6,0,"","ffffffffffffffffffffffffffffffffffffffbfffeffbfffeffffff"]],
      "Kitchen@0": [[-6.36,3.25,-4.36,-11,0.6,-8,"","bffffeffffffffffffffffffffffffffffffffffffffffffffeffffeffffffffffffffffffffffff"]],
      "Living Room@0": [[10.64,3.25,3.36,7,0.6,7.5,"","ffffffffffffffffffffeffffffffffffffffffffffffffffffffffffffffffffffffb3c"]],
      "Sunroom@0": [[15.64,3.25,3.36,13.5,0.6,7.5,"","fffffffffffffffffffffffffffffffffffffffffffff"]],
      "TV Den@0": [[3.36,3.25,-3.64,6,0.6,-0.5,"","ffffffffffffffffffffffffffffffffffffffffff"]],
      "Bathroom@0": [[9.36,3.25,-3.64,10.5,0.6,-0.5,"","fffffffffffffffffffff"]],
      "Pantry@0": [[12.36,3.25,2.64,14,0.6,-0.5,"","fffff7fffffff7ffffffffffffff"]],
      "Mudroom@0": [[3.36,3.25,-4.36,5.5,0.6,-8,"","ffffffffffffffffffffffffffffffffffffffff"]],
      "Laundry Room@0": [[15.64,3.25,-4.36,12,0.6,-8,"","fff3ffffffffffffffffffffffffffffefffefffefffffffffffffffffffffff"]],
      "Garage@0": [[22.64,3.11,-11.64,19.55,0.6,-7.5,"","0effffffffffffffffffffffbfbfe0ff3cff0ff3cffffffffffffffffffffff"]],
      "Upstairs Hallway@1": [[2.64,6.65,-11.64,0,4,-4.8,"BACK","ffffffffffffffffff9ffeffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"],[-2.64,6.65,11.64,0,4,4.8,"FRONT","7ff7fd7ff7ff7ff7ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"]],
      "Master Bedroom@1": [[-7.36,6.65,11.64,-11.5,4,7.5,"","f7ffff9ffffefff7ffffbfffffffffffffffffffffffffffffffffffffffffffffffffffffff3efff"]],
      "Master Bath@1": [[-6.64,6.65,7.36,-5,4,9.5,"","ffffffffffffffffffff"]],
      "Walk-in Closet@1": [[-3.36,6.65,3.36,-5,4,5,"","0c8dffffffffff3e"]],
      "Nursery@1": [[-15.64,6.65,2.64,-12.5,4,-0.5,"","effbfffeffffffffffffffffffffffffffffffdff7fffdfff"]],
      "Sewing Room@1": [[-3.36,6.65,-3.64,-6,4,-0.5,"","fffffdfffffffffffffffffffffffffffffffffffe"]],
      "Filthy Bathroom@1": [[-15.64,6.65,-4.36,-13.5,4,-8,"","ffffffffffffffffffffffffffffffffffffffff"]],
      "Kid’s Bedroom@1": [[-6.36,6.65,-11.64,-8.5,4,-8,"","ffffffffffffffffffffffffffffdf7ffefbf7ef"]],
      "Back Landing@1": [[-5.64,6.65,-11.64,-4.5,4,-8,"","ffffffffffffffffffffffff"]],
      "Landlord’s Office@1": [[3.36,6.65,3.36,6,4,7.5,"","fffff7ff7ffffffffffffff7ff7ff7ff7ffffffffffffffffdff5f"]],
      "Guest Bedroom@1": [[9.36,6.65,3.36,12.5,4,7.5,"","fffffffffffffff7ffffff3cff3fffdff7eff3ffb9ffdcff6ffffff7fffffff"]],
      "Upstairs Bath@1": [[3.36,6.65,-3.64,5.5,4,-0.5,"","fffffffffffffffffffffffffffffffffff"]],
      "Spare Bedroom@1": [[15.64,6.65,2.64,12,4,-0.5,"","ffffffffffffffffffffffffffffffffffffffffffffcfffffffffff"]],
      "Storage Room@1": [[3.36,6.65,-11.64,5.5,4,-8,"","fffffffcf3ffffffffffffffffffffffffffffff"]],
      "Back Bedroom@1": [[8.36,6.65,-4.36,12,4,-8,"","ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"]],
      "Furnace Room@-1": [[-15.74,-0.42,-2.64,-13.5,-3.25,-0.5,"","ffffffffffffffffffff36f89"]],
      "Basement@-1": [[-15.74,-0.19,-12.64,-9.05,-3.25,-8.47,"BACK","ffffffffffffffffffff7ffffff7ffffff7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff838ffff038ffff030ffff070ffff070efff070efff070cfff0f0cfff0608fff0608fff"],[-2.36,-0.19,1.74,-9.05,-3.25,-2.43,"FRONT","ffffff3ffffff3ffffff3ffffff3ffffff3fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffff8ffffff0ffffff0cfffff00fffff00cffff00cffff00cffff00cffff00cffff00cffff00cffff00cffff00cffff00cffff00000ff"]],
      "Basement Workshop@-1": [[-1.64,-0.19,-5.36,3.05,-3.25,-8.55,"","fffffffffffffffffffffffffffff1ffff0ffff0ffff1ffff0ffff1ffff1ffff1fffff"]],
    },
    build() {
      if (this.built) return; this.built = true;
      const Hs = TH.House, H = Hs.H, V = (x, y, z) => new THREE.Vector3(x, y, z);
      Hs.rooms.forEach((r) => {
        if (ALIAS[r.name]) return;
        const out = /yard|shed|deck|roof|cellar/i.test(r.id + r.name);
        if (SPECIAL[r.name]) { let m = SPECIAL[r.name](r, H, V); if (!Array.isArray(m[0])) m = [m]; m.forEach(([pos, target, n, tag]) => this.add(r, pos, target, n, true, tag)); return; }
        if (/deck|roof/i.test(r.id + r.name) || (r.x1 - r.x0) * (r.z1 - r.z0) < 2.5) return;
        const bk = this.BAKED[r.name + '@' + r.level];
        if (bk) { bk.forEach((q) => { this.add(r, V(q[0], q[1], q[2]), V(q[3], q[4], q[5]), null, out, q[6] || null); this.cams[this.cams.length - 1].seen = q[7] || null; }); return; }
        // not in the table (the layout changed since the bake): the corner farthest from the middle, just under the ceiling
        const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, x = cx < 0 ? r.x0 + 0.3 : r.x1 - 0.3, z = cz < 0 ? r.z0 + 0.3 : r.z1 - 0.3;
        this.add(r, V(x, r.level * H + H - 0.3, z), V(cx, r.level * H + 0.6, cz), null, out);
      });
      // the hardware: one instanced draw for every body, bracket and red light in the house
      const n = this.cams.length, dummy = new THREE.Object3D();
      const body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.085, 0.2), new THREE.MeshStandardMaterial({ color: 0xd8d6cc, roughness: 0.55, metalness: 0.2 }), n);
      const hood = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.015, 0.23), new THREE.MeshStandardMaterial({ color: 0xc8c6bc, roughness: 0.6 }), n);
      const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.025, 0.22), new THREE.MeshStandardMaterial({ color: 0x5a5a58, roughness: 0.5, metalness: 0.6 }), n);
      const glass = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14), new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.1, metalness: 0.5 }), n);
      const ledM = new THREE.MeshBasicMaterial({ color: 0xff2a1a }); ledM.userData.noPBR = true; ledM.toneMapped = false;
      const led = new THREE.InstancedMesh(new THREE.SphereGeometry(0.008, 6, 4), ledM, n);
      this.cams.forEach((c, i) => {
        dummy.position.copy(c.pos); dummy.lookAt(c.target); dummy.updateMatrix(); body.setMatrixAt(i, dummy.matrix);
        dummy.translateY(0.05); dummy.updateMatrix(); hood.setMatrixAt(i, dummy.matrix); dummy.translateY(-0.05);
        const back = c.wallN ? c.pos.clone().addScaledVector(c.wallN, -0.24) : c.pos.clone().addScaledVector(c.dir, -0.18); const m = new THREE.Object3D(); m.position.copy(back); m.lookAt(c.pos); m.position.y += 0.02; m.updateMatrix(); arm.setMatrixAt(i, m.matrix);
        dummy.translateZ(0.1); dummy.rotateX(Math.PI / 2); dummy.updateMatrix(); glass.setMatrixAt(i, dummy.matrix); dummy.rotateX(-Math.PI / 2);
        dummy.translateY(0.03); dummy.translateX(0.035); dummy.updateMatrix(); led.setMatrixAt(i, dummy.matrix);
      });
      [body, hood, arm, glass, led].forEach((m) => { m.userData.dynamic = true; m.frustumCulled = false; TH.scene.add(m); });
      // the yard's gate camera stands on its own pole by the back fence
      this.cams.filter((c) => / · GATE$/.test(c.name)).forEach((c) => {
        const b = c.pos.clone().addScaledVector(c.wallN, -0.24), pm = new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 0.7, metalness: 0.5 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, c.pos.y + 0.2, 10), pm); pole.position.set(b.x, (c.pos.y + 0.2) / 2, b.z);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), pm); cap.position.set(b.x, c.pos.y + 0.22, b.z);
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.08), pm); box.position.set(b.x, 1.3, b.z); box.lookAt(c.target.x, 1.3, c.target.z); // junction box
        [pole, cap, box].forEach((m) => { m.castShadow = true; TH.scene.add(m); });
        if (TH.Col && TH.Col.addBox) TH.Col.addBox(0, b.x - 0.08, b.z - 0.08, b.x + 0.08, b.z + 0.08, false);
      });
      this.led = led; TH.Linear.fix(body); TH.Linear.fix(hood); TH.Linear.fix(arm);
      this.cam = new THREE.PerspectiveCamera(78, 16 / 9, 0.05, 60);
    },
    add(r, pos, target, wallN, out, tag) {
      const dir = target.clone().sub(pos).normalize(), Hs = TH.House;
      const fix = (Hs.fixtures || []).map((f) => ({ f, s: Math.hypot(f.x - target.x, f.z - target.z) + (f.level === r.level ? 0 : 9) })).sort((a, b) => a.s - b.s).slice(0, 6).map((q) => q.f);
      this.cams.push({ n: this.cams.length + 1, room: r, name: r.name + (tag ? ' · ' + tag : ''), pos, lens: pos.clone().addScaledVector(dir, 0.17), target, dir, wallN, fix, out, rt: null, last: -1 });
    },
    // the camera that has you: the one for your room (the closer one, where a long room has two)
    roomCam(x, z, lv) {
      const r = TH.House.roomAt(x, z, lv);
      if (!r) { // between rooms (the deck steps, a doorway): whichever camera is closest
        const y = lv * TH.House.H + 1; let best = null, bd = 10; this.cams.forEach((c) => { const d = Math.hypot(c.pos.x - x, c.pos.z - z, (c.pos.y - y) * 1.5); if (d < bd) { bd = d; best = c; } }); return best;
      }
      // your room's cameras, plus the next room's when you're in a doorway; one that can actually see you beats the nearest
      const names = new Set([ALIAS[r.name] || r.name]);
      [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]].forEach(([dx, dz]) => { const q = TH.House.roomAt(x + dx, z + dz, lv); if (q && q !== r) names.add(ALIAS[q.name] || q.name); });
      let best = null, bd = 1e9;
      this.cams.forEach((c) => {
        if (!names.has(c.room.name)) return; const own = c.room.name === (ALIAS[r.name] || r.name), inside = x >= c.room.x0 && x <= c.room.x1 && z >= c.room.z0 && z <= c.room.z1;
        const sees = inside ? this.seesSpot(c, x, z) : null, d = Math.hypot(c.pos.x - x, c.pos.z - z) + (sees === false ? 100 : 0) + (!own && sees !== true ? 60 : 0);
        if (d < bd) { bd = d; best = c; }
      });
      return best;
    },
    // dev tool: re-derive BAKED from the real geometry. Slow (seconds); run by hand after changing the house, never in play.
    // Each entry: [x, y, z, aimX, aimY, aimZ, label, seen] where `seen` is a hex bitmap of the 0.5 m floor cells this lens can see.
    bake() {
      const Hs = TH.House, H = Hs.H, V = (x, y, z) => new THREE.Vector3(x, y, z), out = {}, S = 0.5;
      const doorNear = (x, z, lv) => TH.Doors.list.some((d) => d.level === lv && Math.hypot(d.x - x, d.z - z) < 1.0);
      const skip = new Set(); if (TH.Enemy.model) TH.Enemy.model.root.traverse((o) => skip.add(o)); (TH.Items.world || []).forEach((w) => w.mesh.traverse((o) => skip.add(o)));
      if (TH.Replay.man) TH.Replay.man.g.traverse((o) => skip.add(o));
      const solids = []; TH.scene.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || skip.has(o) || (o.material && (o.material.transparent || o.material.opacity < 1 || o.material.visible === false))) return; let p = o; while (p) { if (!p.visible) return; p = p.parent; } solids.push(o); });
      const ray = new THREE.Raycaster(), cast = (from, dir, far, all) => { ray.set(from, dir.clone().normalize()); ray.far = far; const h = ray.intersectObjects(solids, false); return all ? h : h[0] || null; };
      const broad = (o) => { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); return Math.min(b.max.x - b.min.x, b.max.z - b.min.z) > 0.4; }; // a ceiling, not a curtain rod
      Hs.rooms.forEach((r) => {
        if (ALIAS[r.name] || SPECIAL[r.name] || /deck|roof/i.test(r.id + r.name)) return;
        const area = (r.x1 - r.x0) * (r.z1 - r.z0); if (area < 2.5) return;
        const isOut = /yard|shed/i.test(r.id + r.name), base = r.level * H, lx = r.x1 - r.x0, lz = r.z1 - r.z0, alongX = lx >= lz;
        const nx = Math.max(1, Math.round(lx / S)), nz = Math.max(1, Math.round(lz / S)), cells = [];
        for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) cells.push(V(r.x0 + (ix + 0.5) * lx / nx, base + 1.1, r.z0 + (iz + 0.5) * lz / nz));
        const sees = (lens) => cells.map((p) => { const d = p.clone().sub(lens), L = d.length(), h = cast(lens, d, L); return !h || h.distance > L - 0.15; });
        const mount = (ex, ez, sx, sz) => { // hang a camera in this corner: under the real ceiling, 26 cm off the real walls
          let x = ex - sx * 0.32, z = ez - sz * 0.32;
          const hits = cast(V(x, base + (isOut ? 1.2 : 1.9), z), V(0, 1, 0), 8, true).filter((h) => h.point.y > base + (isOut ? 1.5 : 2.1) && (r.level < 0 || broad(h.object)));
          let y = hits[0] ? hits[0].point.y - 0.13 : base + Math.min(H, 2.9) - 0.3; y = Math.min(y, base + 2 * H - 0.4);
          let walled = 0; const wx = cast(V(x, y - 0.1, z), V(sx, 0, 0), 1.2), wz = cast(V(x, y - 0.1, z), V(0, 0, sz), 1.2);
          if (wx) { x += sx * (wx.distance - 0.26); walled++; } if (wz) { z += sz * (wz.distance - 0.26); walled++; }
          return { pos: V(x, y, z), walled };
        };
        const corners = [[r.x0, r.z0, -1, -1], [r.x1, r.z0, 1, -1], [r.x0, r.z1, -1, 1], [r.x1, r.z1, 1, 1]].map((c) => Object.assign(mount(...c), { c }));
        const ty = base + (r.level < 0 ? 0.15 : 0.6), res = [];
        const pick = (cands, sub, want) => { // the corner that sees the most of `want` (cells still uncovered), aimed at the middle of `sub`
          let best = null; const cx = (sub.x0 + sub.x1) / 2, cz = (sub.z0 + sub.z1) / 2;
          cands.forEach((k) => {
            const tgt = V(cx, ty, cz), lens = k.pos.clone().addScaledVector(tgt.clone().sub(k.pos).normalize(), 0.17), vis = sees(lens);
            const gain = vis.filter((v, i) => v && want[i]).length;
            const score = gain * 10 + Math.hypot(cx - k.pos.x, cz - k.pos.z) * 0.6 - (doorNear(k.pos.x, k.pos.z, r.level) ? 4 : 0) - (2 - k.walled) * 25;
            if (!best || score > best.score) best = { score, k, tgt, vis };
          });
          return best;
        };
        const label = (k) => { const dx = k.pos.x - (r.x0 + r.x1) / 2, dz = k.pos.z - (r.z0 + r.z1) / 2; return Math.abs(dx) / lx > Math.abs(dz) / lz ? (dx < 0 ? 'WEST' : 'EAST') : (dz > 0 ? 'FRONT' : 'BACK'); };
        const inHalf = (e) => cells.map((p) => (alongX ? (e === 0 ? p.x < r.x0 + lx * 0.6 : p.x > r.x0 + lx * 0.4) : (e === 0 ? p.z < r.z0 + lz * 0.6 : p.z > r.z0 + lz * 0.4)));
        let chosen = [];
        if (Math.max(lx, lz) > 11) { // a long room: one camera at each end, each watching from its end to just past the middle
          [0, 1].forEach((e) => {
            const sub = alongX ? { x0: r.x0 + lx * (e ? 0.4 : 0), x1: r.x0 + lx * (e ? 1 : 0.6), z0: r.z0, z1: r.z1 } : { x0: r.x0, x1: r.x1, z0: r.z0 + lz * (e ? 0.4 : 0), z1: r.z0 + lz * (e ? 1 : 0.6) };
            chosen.push(pick(corners.filter((k) => (alongX ? k.c[2] : k.c[3]) === (e ? 1 : -1)), sub, inHalf(e)));
          });
        } else {
          const one = pick(corners, r, cells.map(() => true)); chosen.push(one);
          const cover = one.vis.filter(Boolean).length / cells.length;
          if (area > 20 && cover < 0.75) { // big room with a blind side (a staircase in the way): a second camera for what the first can't see
            const two = pick(corners.filter((k) => k !== one.k), r, one.vis.map((v) => !v));
            if (two.vis.filter((v, i) => v && !one.vis[i]).length >= cells.length * 0.12) chosen.push(two);
          }
        }
        chosen.forEach((b) => {
          let hex = ''; for (let i = 0; i < b.vis.length; i += 4) hex += ((b.vis[i] ? 1 : 0) | (b.vis[i + 1] ? 2 : 0) | (b.vis[i + 2] ? 4 : 0) | (b.vis[i + 3] ? 8 : 0)).toString(16);
          const q = [b.k.pos.x, b.k.pos.y, b.k.pos.z, b.tgt.x, b.tgt.y, b.tgt.z].map((v) => Math.round(v * 100) / 100);
          q.push(chosen.length > 1 ? label(b.k) : '', hex); res.push(q);
        });
        out[r.name + '@' + r.level] = res;
      });
      return out;
    },
    // can this camera see the spot (from its baked visibility map)? null when it has no map
    seesSpot(c, x, z) {
      if (!c.seen) return null; const r = c.room, S = 0.5, nx = Math.max(1, Math.round((r.x1 - r.x0) / S)), nz = Math.max(1, Math.round((r.z1 - r.z0) / S));
      const ix = Math.min(nx - 1, Math.max(0, Math.floor((x - r.x0) / ((r.x1 - r.x0) / nx)))), iz = Math.min(nz - 1, Math.max(0, Math.floor((z - r.z0) / ((r.z1 - r.z0) / nz)))), i = iz * nx + ix;
      const d = parseInt(c.seen[i >> 2], 16); return isNaN(d) ? null : !!(d & (1 << (i & 3)));
    },

    /* ---------------- recording ---------------- */
    reset() { this.frames = []; this.marks = []; this.t = 0; this.acc = 0; this._lastDoors = null; this._lastProps = null; this.itemLog = new Map(); },
    record(dt) {
      const st = TH.state; if (this.led) this.led.visible = (performance.now() / 1000) % 1.2 < 0.6;
      if (st.mode !== 'play' || st.cinematic || st.replay || this.active) return;
      if (!st.caught) this.hidCatch = false;
      this.t += dt; this.acc += dt; if (this.acc < 0.2) return; this.acc = 0;
      const P = TH.Player, E = TH.Enemy, D = TH.Doors.list;
      let doors = null; const cur = D.map((d) => Math.round(d.angle * 50) / 50);
      if (!this._lastDoors || cur.some((a, i) => a !== this._lastDoors[i])) { doors = cur; this._lastDoors = cur; }
      const pr = this.props().map((v) => Math.round(v * 100) / 100); let props = null;
      if (!this._lastProps || pr.some((v, i) => v !== this._lastProps[i])) { props = pr; this._lastProps = pr; }
      const X = TH.Extras; if (X && X.fires) X.fires.forEach((f) => { if (f.tapeT == null) f.tapeT = this.t; });
      if (!this.itemLog) this.itemLog = new Map(); (TH.Items.world || []).forEach((w) => { let e = this.itemLog.get(w.mesh); if (!e) this.itemLog.set(w.mesh, (e = { from: this.t })); e.to = this.t; }); // when each item was lying around
      this.frames.push({ props, t: this.t, day: st.day, px: P.pos.x, pz: P.pos.z, py: P.y, yaw: P.yaw, cr: !!P.crouch, pt: Math.round(P.pitch * 100) / 100, hd: TH.Inventory.heldId(), ak: (this._A = TH.Act.now()).k, aT: this._A.t, hid: !!st.hidden || (st.caught && this.hidCatch), ex: E.pos.x, ez: E.pos.z, ey: E.y, face: E.face, sp: E.speed || 0, st: E.state, on: !!E.active, cg: !!st.caught, tv: !!st.travel, doors });
    },
    // things the endings move: the back gate, the car and its garage door, the hood
    propObjs() { const g = TH.Grounds && TH.Grounds.gate, G = TH.Garage, B = TH.Grounds && TH.Grounds.breaker; return [g && g.pivot.rotation, 'y', G && G.car && G.car.position, 'x', G && G.car && G.car.position, 'z', G && G.car && G.car.rotation, 'y', G && G.door && G.door.position, 'y', G && G.door && G.door.rotation, 'x', G && G.blob && G.blob.position, 'x', G && G.blob && G.blob.position, 'z', G && G.hood && G.hood.rotation, 'x', g && g.bolt.position, 'y', g && g.ledM.color, 'r', g && g.ledM.color, 'g', g && g.chain.position, 'x', g && g.chain.position, 'y', g && g.chain.position, 'z', g && g.chain.rotation, 'x', g && g.chain.rotation, 'z', B && B.handle.rotation, 'x']; }, // + the back gate's bolt, lock light and chain, and the breaker
    props() { const o = this.propObjs(), v = []; for (let i = 0; i < o.length; i += 2) v.push(o[i] ? o[i][o[i + 1]] : 0); return v; },
    setProps(v) { const o = this.propObjs(); for (let i = 0; i < o.length; i += 2) if (o[i] && v && v[i / 2] != null) o[i][o[i + 1]] = v[i / 2]; },
    mark(kind, extra) { this.marks.push(Object.assign({ t: this.t, day: TH.state.day, kind }, extra || {})); },

    /* ---------------- the monitor wall ---------------- */
    open(how) {
      if (!this.frames.length) { TH.UI.toast('Nothing on the tapes'); return; }
      this.build(); this.active = true; this.how = how;
      // door snapshots: every frame points at the latest one
      let last = this.frames[0].doors || TH.Doors.list.map(() => 0); this.frames.forEach((f) => { if (f.doors) last = f.doors; f.dRef = last; });
      let lp = this.frames[0].props || this.props(); this.frames.forEach((f) => { if (f.props) lp = f.props; f.pRef = lp; }); this._propsNow = this.props();
      this._itemAdded = []; const live = new Set((TH.Items.world || []).map((w) => w.mesh));
      (this.itemLog || new Map()).forEach((e, m) => { e.vis0 = m.visible; e.end = live.has(m) ? Infinity : e.to + 0.2; if (!m.parent) { TH.scene.add(m); this._itemAdded.push(m); } });
      this.len = this.frames[this.frames.length - 1].t;
      this.catches = this.marks.filter((m) => m.kind === 'caught');
      if (TH.Replay.man && !TH.Replay.man.rig && TH.Avatar && TH.Avatar.ready) { TH.scene.remove(TH.Replay.man.g); TH.Replay.man = null; }
      if (!TH.Replay.man) TH.Replay.build();
      // cotton glows under infrared: lighten your clothes so you read on the monitors as clearly as he does
      const mats = new Set(); TH.Replay.man.g.traverse((o) => o.isMesh && mats.add(o.material)); this._manCol = [...mats].map((m) => [m, m.color.getHex()]); mats.forEach((m) => { const hsl = {}; m.color.getHSL(hsl); if (hsl.l < 0.25 && m.metalness < 0.5) m.color.multiplyScalar(2.2); }); // just the dark clothes
      this._prevE = TH.Enemy.state; const fl = TH.Lights.fill; this._fill = { i: fl.intensity, d: fl.distance, c: fl.color.getHex(), p: fl.position.clone() }; TH.scene.add(fl); fl.color.setHex(0xe8f0ff); TH.camera.visible = false;
      this._hidden = ['over', 'win', 'daycard', 'hud'].filter((k) => !$(k).hidden); this._hidden.forEach((k) => ($(k).hidden = true));
      this.ui();
      if (how === 'deaths' && this.catches.length) { this.layout = 'action'; this.speed = 1; this.reel = 0; this.T = Math.max(0, this.catches[0].t - 9); }
      else { this.layout = 'all'; this.speed = 16; this.reel = -1; this.T = 0; }
      this.full = null; this.paused = false; this.syncButtons();
      TH.Audio.hush && TH.Audio.hush();
    },
    close() {
      this.active = false; const el = $('tapes'); if (el) el.remove();
      TH.Replay.man.g.visible = false; TH.Replay.posePlayer(TH.Replay.man, {}); (this._manCol || []).forEach(([m, c]) => m.color.setHex(c)); TH.Enemy.state = this._prevE; const fl = TH.Lights.fill, f0 = this._fill; TH.camera.add(fl); fl.position.copy(f0.p); fl.intensity = f0.i; fl.distance = f0.d; fl.color.setHex(f0.c); TH.camera.visible = true;
      TH.Doors.list.forEach((d) => (d.pivot.rotation.y = d.angle));
      if (this.itemLog) this.itemLog.forEach((e, m) => (m.visible = e.vis0)); (this._itemAdded || []).forEach((m) => TH.scene.remove(m)); this._itemAdded = [];
      this.setProps(this._propsNow); const X = TH.Extras; if (X && X.fires) X.fires.forEach((f) => (f.g.visible = true));
      (this._hidden || []).forEach((k) => ($(k).hidden = false));
      TH.renderer.setRenderTarget(null);
    },
    ui() {
      const el = document.createElement('div'); el.id = 'tapes';
      el.innerHTML = `
        <style>
          #tapes{position:fixed;inset:0;z-index:45;font-family:var(--ui);color:#b8f0c0;pointer-events:none;-webkit-user-select:none;user-select:none}
          #tapes .bar{position:absolute;left:0;right:0;display:flex;align-items:center;gap:6px;padding:6px max(10px,env(safe-area-inset-right)) 6px max(10px,env(safe-area-inset-left));background:#050605;pointer-events:auto;flex-wrap:wrap}
          #tapes .top{top:0;padding-top:max(6px,env(safe-area-inset-top))} #tapes .bot{bottom:0;padding-bottom:max(6px,env(safe-area-inset-bottom))}
          #tapes .ttl{font-weight:800;letter-spacing:.16em;font-size:14px;color:#d23a2e;margin-right:6px;white-space:nowrap}
          #tapes .clk{font:600 14px var(--type);color:#b8f0c0;letter-spacing:.06em;white-space:nowrap;margin-right:auto}
          #tapes button{font:800 13px var(--ui);letter-spacing:.08em;background:#101410;color:#b8f0c0;border:1px solid #2a3a2c;border-radius:3px;padding:5px 9px;min-height:30px}
          #tapes button.on{background:#b8f0c0;color:#050605}
          #tapes .track{position:relative;flex:1;min-width:120px;height:26px}
          #tapes .track input{position:absolute;inset:0;width:100%;margin:0;accent-color:#b8f0c0}
          #tapes .mk{position:absolute;top:2px;width:3px;height:8px;background:#d23a2e;pointer-events:none;border-radius:1px}
          #tapes .dk{position:absolute;top:0;font:700 9px var(--ui);color:#6f8a72;pointer-events:none;transform:translateX(-50%)}
          #tapes .cells{position:absolute;inset:0;pointer-events:none}
          #tapes .cell{position:absolute;pointer-events:auto;outline:1px solid #1c241d;cursor:pointer}
          #tapes .cell.hot{outline:2px solid #d23a2e} #tapes .cell.you{outline:2px solid #d9b44a}
          #tapes .cell span{position:absolute;left:4px;top:3px;font:700 9px var(--ui);letter-spacing:.08em;color:#c8f8d0;text-shadow:0 1px 2px #000;white-space:nowrap;overflow:hidden;max-width:calc(100% - 8px)}
          #tapes .cell i{position:absolute;right:5px;top:4px;width:6px;height:6px;border-radius:50%;background:#d23a2e;animation:recb 1.2s steps(1) infinite}
          #tapes.big .cell span{font-size:15px;left:10px;top:8px} #tapes.big .cell i{width:10px;height:10px;right:12px;top:10px}
          @keyframes recb{50%{opacity:0}}
        </style>
        <div class="bar top"><span class="ttl">● SECURITY FEED</span><span class="clk" id="tp-clock"></span>
          <button data-l="all">ALL CAMS</button><button data-l="action">SPLIT</button><button data-l="you">FOLLOW ME</button><button data-l="tim">FOLLOW TIM</button><button id="tp-x">✕ CLOSE</button></div>
        <div class="cells" id="tp-cells"></div>
        <div class="bar bot"><button id="tp-play">❚❚</button><button data-s="1">1×</button><button data-s="4">4×</button><button data-s="16">16×</button><button data-s="64">64×</button><button id="tp-catch">NEXT CATCH ▸</button>
          <div class="track" id="tp-track"><input type="range" id="tp-seek" min="0" step="0.1"></div></div>`;
      document.body.appendChild(el); this.el = el;
      const seek = $('tp-seek'); seek.max = this.len.toFixed(1);
      const track = $('tp-track');
      this.catches.forEach((m) => { const s = document.createElement('div'); s.className = 'mk'; s.style.left = `calc(${(m.t / this.len) * 100}% - 1px)`; track.appendChild(s); });
      let lastDay = 0; this.frames.forEach((f) => { if (f.day !== lastDay) { lastDay = f.day; const s = document.createElement('div'); s.className = 'dk'; s.style.left = (f.t / this.len) * 100 + '%'; s.textContent = 'D' + f.day; track.appendChild(s); } });
      seek.addEventListener('input', () => { this.T = +seek.value; this.reel = -1; });
      $('tp-x').onclick = () => this.close();
      $('tp-play').onclick = () => { this.paused = !this.paused; this.syncButtons(); };
      $('tp-catch').onclick = () => { const n = this.catches.find((m) => m.t - 9 > this.T + 0.5) || this.catches[0]; if (n) { this.T = Math.max(0, n.t - 9); this.reel = this.catches.indexOf(n); this.speed = 1; this.paused = false; if (!this.full) this.layout = 'action'; this.syncButtons(); } };
      el.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { this.speed = +b.dataset.s; this.syncButtons(); }));
      el.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => { this.layout = b.dataset.l; this.full = null; this.syncButtons(); }));
      ['pointerdown', 'touchstart'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
    },
    syncButtons() {
      if (!this.el) return;
      this.el.querySelectorAll('[data-s]').forEach((b) => b.classList.toggle('on', +b.dataset.s === this.speed));
      this.el.querySelectorAll('[data-l]').forEach((b) => b.classList.toggle('on', !this.full && b.dataset.l === this.layout));
      $('tp-play').textContent = this.paused ? '▶' : '❚❚'; $('tp-catch').hidden = !this.catches.length;
      this._cellKey = null;
    },

    /* the state of the house at tape time T */
    pose(T, dt, t) {
      const F = this.frames; let lo = 0, hi = F.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (F[m].t <= T) lo = m; else hi = m - 1; }
      const a = F[lo], b = F[Math.min(F.length - 1, lo + 1)], jump = b.day !== a.day || Math.hypot(b.px - a.px, b.pz - a.pz) > 2.5 || Math.hypot(b.ex - a.ex, b.ez - a.ez) > 2.5;
      const u = jump || b === a ? 0 : U.clamp((T - a.t) / Math.max(1e-3, b.t - a.t), 0, 1), L = (p, q) => p + (q - p) * u;
      const M = TH.Replay.man, E = TH.Enemy;
      const R = TH.Replay, ok = (p, q) => q.day === p.day && Math.hypot(q.px - p.px, q.pz - p.pz) <= 2.5, tr = jump ? { px: a.px, pz: a.pz, sp: 0 } : R.track(F, lo, u, ok);
      const dT = this._lastT == null ? 0 : T - this._lastT; this._lastT = T; // smoothed playback (a seek or a jump starts it fresh)
      const S = R.settle(M, U.angleLerp(a.yaw, b.yaw, u), L(a.pt || 0, b.pt || 0), tr.sp, dT), sp = S.sp;
      M.g.visible = !a.hid && !a.tv; M.g.position.set(tr.px, L(a.py, b.py), tr.pz); M.g.rotation.y = S.yaw; /* in a vent you're off camera */
      R.stepPhase(M, sp * Math.min(Math.abs(dT), 0.5), sp, a.cr);
      R.posePlayer(M, { ph: M.phase, sp, cr: L(+!!a.cr, +!!b.cr), cg: a.cg, pitch: S.pitch, look: S.look, held: a.hd, ak: a.ak, aT: a.ak ? a.aT + (T - a.t) : 0, t: T });
      E.model.root.visible = a.on; E.pos.set(L(a.ex, b.ex), 0, L(a.ez, b.ez)); E.y = L(a.ey, b.ey); E.face = U.angleLerp(a.face, b.face, u); E.state = a.st === 'capture' ? 'chase' : a.st; E.stunT = 0;
      E.animate(Math.min(0.1, dt * Math.min(this.speed, 4)), L(a.sp, b.sp), t);
      if (a.cg) { const m = E.model; m.armL.rotation.x = -1.6; m.armR.rotation.x = -1.5; }
      const dr = a.dRef; TH.Doors.list.forEach((d, i) => (d.pivot.rotation.y = dr[i] || 0));
      this.setProps(a.pRef);
      if (this.itemLog) this.itemLog.forEach((e, m) => (m.visible = e.vis0 && T >= e.from - 0.25 && T <= e.end));
      const X = TH.Extras; if (X && X.fires) X.fires.forEach((f) => { const on = f.tapeT != null && T >= f.tapeT; f.g.visible = on; if (on && X.animFire) X.animFire(f, Math.min(0.05, dt)); });
      return { a, px, pz, plv: TH.Col.levelOf(a.py + 0.1), ex: E.pos.x, ez: E.pos.z, elv: TH.Col.levelOf(E.y + 0.1) };
    },

    // render one camera into its own small screen
    shoot(c, big) {
      const R = TH.renderer, w = big ? 960 : this.layout === 'action' ? 512 : 256, h = Math.round(w * 9 / 16);
      let rt = big ? this.bigRT : c.rt; // one full-screen buffer shared by every camera, so tapping through them all doesn't eat the phone's memory
      if (!rt || rt.width !== w) { if (rt) rt.dispose(); rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true }); if (big) this.bigRT = rt; else c.rt = rt; }
      const ir = TH.Lights.fill, gc = / · GATE$/.test(c.name); ir.position.copy(c.lens); ir.intensity = gc ? 2.6 : c.out ? 1.6 : 0.9; ir.distance = gc ? 12 : c.out ? 18 : 11; // the infrared floodlight round the lens
      const L = TH.Lights.pool; L.forEach((l, i) => { const f = i === 0 && l.castShadow ? null : c.fix[l.castShadow ? i - 1 : i]; /* the shadow light's map was baked for where you stood: leave it dark */ if (!f) { l.intensity = 0; return; } l.position.set(f.x, f.y, f.z); l.distance = f.range || 13; l.color.setHex(f.color || 0xffd8a0); l.intensity = 1.4 * Math.max(0.35, f.cur != null ? f.cur : f.power) * (TH.Lights.k || 1); });
      const cam = this.cam; cam.position.copy(c.lens); cam.lookAt(c.target); cam.updateMatrixWorld();
      R.setRenderTarget(rt); R.clear(); R.render(TH.scene, cam);
      c.last = this.fc;
      return rt;
    },
    mat(c) {
      if (!c.mat) c.mat = new THREE.ShaderMaterial({ uniforms: { map: { value: null }, time: { value: 0 }, seed: { value: Math.random() * 10 }, hot: { value: 0 }, live: { value: 1 } }, vertexShader: VS, fragmentShader: FS, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
      return c.mat;
    },

    frame(dt, t) {
      const R = TH.renderer; this.fc = (this.fc || 0) + 1;
      if (!this.paused) this.T = Math.min(this.len, this.T + dt * this.speed);
      // the death reel: each catch from a few seconds before, then on to the next one
      if (this.reel >= 0 && this.catches[this.reel] && this.T > this.catches[this.reel].t + 2.5) {
        this.reel++; if (this.catches[this.reel]) this.T = Math.max(0, this.catches[this.reel].t - 9); else { this.reel = -1; this.paused = true; this.syncButtons(); }
      }
      if (this.T >= this.len && !this.paused) { this.paused = true; this.syncButtons(); }
      const S = this.pose(this.T, dt, t);
      const youCam = this.roomCam(S.px, S.pz, S.plv), himCam = S.a.on ? this.roomCam(S.ex, S.ez, S.elv) : null;
      // which monitors are on the wall
      let list;
      /* follow mode: one full-screen feed that cuts to whichever camera has you (or Tim) in view. It holds a shot for a moment
         before cutting so a doorway doesn't make it flicker, but cuts straight away if the current camera loses sight. */
      let fol = null;
      if (!this.full && (this.layout === 'you' || this.layout === 'tim')) {
        const tim = this.layout === 'tim' && himCam, want = tim ? himCam : youCam, tx = tim ? S.ex : S.px, tz = tim ? S.ez : S.pz, tl = tim ? S.elv : S.plv;
        const cur = this._fol, key = this.layout;
        if (!cur || this._folKey !== key || Math.abs(this.T - (this._folT || 0)) > 3) { this._fol = want; this._folHold = 0; }
        else if (want && want !== cur) {
          const lost = cur.room.level !== tl || this.seesSpot(cur, tx, tz) === false || Math.hypot(cur.pos.x - tx, cur.pos.z - tz) > 16;
          this._folHold = (this._folHold || 0) + Math.abs(this.T - (this._folT || 0)); if (lost || this._folHold > 0.6) { this._fol = want; this._folHold = 0; }
        } else this._folHold = 0;
        this._folKey = key; this._folT = this.T; fol = this._fol || youCam;
      }
      const big = !!this.full || !!fol;
      if (this.full) list = [this.full];
      else if (fol) list = [fol];
      else if (this.layout === 'action') {
        list = []; [youCam, himCam].forEach((c) => c && !list.includes(c) && list.push(c));
        const near = this.cams.filter((c) => !list.includes(c)).map((c) => ({ c, d: Math.min(c.room.level === S.plv ? Math.hypot(c.target.x - S.px, c.target.z - S.pz) : 99, c.room.level === S.elv ? Math.hypot(c.target.x - S.ex, c.target.z - S.ez) : 99) })).sort((x, y) => x.d - y.d);
        while (list.length < 4 && near.length) list.push(near.shift().c);
      } else list = this.cams;
      // grid
      const top = this.el.querySelector('.top').offsetHeight, bot = this.el.querySelector('.bot').offsetHeight, W = innerWidth, Hh = innerHeight - top - bot, n = list.length;
      let cols = 1, bestA = 0; for (let k = 1; k <= n; k++) { const rows = Math.ceil(n / k), cw = W / k, ch = Hh / rows, a = Math.min(cw, ch * 16 / 9); if (a > bestA) { bestA = a; cols = k; } }
      const rows = Math.ceil(n / cols), cw = Math.min(W / cols, (Hh / rows) * 16 / 9), ch = cw * 9 / 16, ox = (W - cw * cols) / 2, oy = top + (Hh - ch * rows) / 2;
      // refresh screens: the ones you or he are on every frame, the rest a few at a time (security cameras are choppy anyway)
      const pri = list.filter((c) => c === youCam || c === himCam);
      pri.forEach((c) => { if (!big || c === list[0]) this.shoot(c, big); });
      if (big) { if (!pri.includes(list[0])) this.shoot(list[0], true); }
      else { const rest = list.filter((c) => !pri.includes(c)).sort((x, y) => x.last - y.last); const budget = this.layout === 'action' ? (TH.util.isTouch ? 2 : 4) : TH.util.isTouch ? 3 : 5; rest.slice(0, budget).forEach((c) => this.shoot(c, false)); }
      // composite the wall
      if (!this.wall) { this.wall = new THREE.Scene(); this.oc = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1); this.quads = []; }
      const oc = this.oc; oc.left = 0; oc.right = W; oc.top = 0; oc.bottom = innerHeight; oc.updateProjectionMatrix();
      while (this.quads.length < n) { const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), null); q.scale.y = -1; this.wall.add(q); this.quads.push(q); }
      this.quads.forEach((q, i) => { q.visible = i < n; });
      list.forEach((c, i) => {
        const q = this.quads[i], m = this.mat(c), x = ox + (i % cols) * cw, y = oy + Math.floor(i / cols) * ch, gap = n > 1 ? 2 : 0;
        q.material = m; const src = big ? this.bigRT : c.rt; m.uniforms.map.value = src ? src.texture : null; m.uniforms.time.value = t; m.uniforms.hot.value = c === himCam ? 1 : 0; m.uniforms.live.value = m.uniforms.map.value ? 1 : 0;
        q.position.set(x + cw / 2, y + ch / 2, 0); q.scale.set(cw - gap, -(ch - gap), 1);
      });
      R.setRenderTarget(null); R.setScissorTest(false); R.setClearColor(0x020302, 1); R.clear(); R.render(this.wall, oc);
      // labels and tap targets
      const key = list.map((c) => c.n).join(',') + '|' + Math.round(cw) + '|' + Math.round(ox) + '|' + Math.round(oy);
      const cells = $('tp-cells');
      if (key !== this._cellKey) {
        this._cellKey = key; cells.innerHTML = ''; this.el.classList.toggle('big', big || n <= 4);
        list.forEach((c, i) => {
          const d = document.createElement('div'); d.className = 'cell'; d.dataset.n = c.n;
          d.style.cssText = `left:${ox + (i % cols) * cw}px;top:${oy + Math.floor(i / cols) * ch}px;width:${cw}px;height:${ch}px`;
          d.innerHTML = `<span>${n > 12 ? '' : 'CAM '}${String(c.n).padStart(2, '0')} · ${c.name.toUpperCase()}${fol ? (this.layout === 'tim' && himCam ? ' · FOLLOWING TIM' : ' · FOLLOWING YOU') : ''}</span><i></i>`;
          d.onclick = () => { if (fol) return; this.full = this.full ? null : c; this.syncButtons(); };
          cells.appendChild(d);
        });
      }
      cells.querySelectorAll('.cell').forEach((d) => { const c = this.cams[+d.dataset.n - 1]; d.classList.toggle('hot', c === himCam); d.classList.toggle('you', c === youCam && c !== himCam); });
      // clock: each night starts at 2:00 AM
      const f0 = this.frames.find((f) => f.day === S.a.day), secs = Math.floor(this.T - (f0 ? f0.t : 0)) + 2 * 3600, hh = Math.floor(secs / 3600), mm = Math.floor(secs / 60) % 60, ss = secs % 60;
      $('tp-clock').textContent = `DAY ${S.a.day} · ${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')} AM${this.speed > 1 && !this.paused ? '  ▸▸ ' + this.speed + '×' : ''}${S.a.cg ? '  · CAUGHT' : ''}`;
      const seek = $('tp-seek'); if (document.activeElement !== seek) seek.value = this.T.toFixed(1);
    },
  });

  // hook into the game: a fresh tape every run, marks for every catch and the way out
  const G = TH.Game, start0 = G.start.bind(G), caught0 = G.caught.bind(G), fin0 = G.finishEscape.bind(G);
  G.start = function (d) { start0(d); T.build(); T.reset(); };
  G.caught = function (h) { if (!TH.state.caught) { T.mark('caught'); T.hidCatch = !!TH.state.hidden; } return caught0(h); }; // dragged out of a hiding spot: you stay off camera, not standing inside the wardrobe
  G.finishEscape = function (r) { T.mark('escape', { route: r }); return fin0(r); };

  // buttons on the end screens
  const addBtn = (sib, id, label, how) => { const row = $(sib) && $(sib).parentElement; if (!row || $(id)) return; const b = document.createElement('button'); b.className = 'btn ghost'; b.id = id; b.textContent = label; b.onclick = () => T.open(how); row.appendChild(b); };
  addBtn('btn-over-again', 'btn-over-tapes', '▶ Security tapes', 'deaths');
  addBtn('btn-win-again', 'btn-win-tapes', '▶ Security time-lapse', 'timelapse');
})();
