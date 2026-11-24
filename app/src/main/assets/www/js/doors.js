/* TRAP HOUSE — doors, locks and the front-door escape locks.
   TH.Doors.create({ x, z, level, axis, w, name, lock?: itemId, kind?: 'front'|'back' }) */
(function () {
  'use strict';
  const TH = window.TH;
  // front door locks
  const LOCK_INFO = {
    boards: { item: 'crowbar', label: 'Nailed boards', verb: 'PRY OFF THE BOARDS', hold: 2.6, noise: 14, needs: 'CROWBAR NEEDED' },
    combo: { label: 'Combination lock', verb: 'DIAL THE COMBINATION', needs: 'NEEDS A 4-DIGIT CODE' },
    padlock: { item: 'padlock_key', label: 'Padlock', verb: 'UNLOCK THE PADLOCK', noise: 5, needs: 'PADLOCK KEY NEEDED' },
    chain: { item: 'wire_cutters', label: 'Chain', verb: 'CUT THE CHAIN', hold: 1.2, noise: 9, needs: 'WIRE CUTTERS NEEDED' },
    deadbolt: { item: 'front_key', label: 'Deadbolt', verb: 'UNLOCK THE DEADBOLT', noise: 5, needs: 'KEY NEEDED' },
  };
  const canDo = (k) => (k === 'combo' ? true : TH.Inventory.has(LOCK_INFO[k].item)); // you can always try a code
  const nextLock = (d) => d.locks.find((k) => k !== 'combo' && canDo(k)) || (d.locks.includes('combo') ? 'combo' : d.locks[0]);
  TH.LOCK_INFO = LOCK_INFO;

  const D = (TH.Doors = {
    list: [],
    reset() { this.list = []; },

    // door materials, shared: inside doors wear flaking black paint over bare wood (grain runs up the door), outside doors are weathered painted boards
    doorMats(ext) {
      this._dm = this._dm || {}; const key = ext ? 'ext' : 'int'; if (this._dm[key]) return this._dm[key];
      const t = ext ? TH.Tex.pclone('timber', 1, 1) : TH.Tex.pclone('paintwood', 1, 1, Math.PI / 2);
      const leaf = new THREE.MeshPhongMaterial({ map: t, color: t ? (ext ? 0xd0c8c0 : 0xc8c0b8) : ext ? 0x4a2416 : 0x5a3a24, shininess: 6, specular: 0x111111 });
      const panel = new THREE.MeshPhongMaterial({ map: t, color: t ? (ext ? 0xa8a098 : 0x9a948c) : ext ? 0x3a1a0e : 0x4a2e1c, shininess: 4, specular: 0x0a0a0a });
      return (this._dm[key] = { leaf, panel, scan: !!t });
    },

    create(o) {
      const H = TH.House.H, y0 = o.level * H;
      const w = o.w - 0.06, h = 2.17;
      const pivot = new THREE.Group();
      // hinge sits at the low end of the opening
      if (o.axis === 'x') pivot.position.set(o.x - o.w / 2 + 0.03, y0, o.z); else pivot.position.set(o.x, y0, o.z - o.w / 2 + 0.03);
      TH.scene.add(pivot); pivot.userData.dynamic = true;
      const front = o.kind === 'front';
      const ext = front || o.kind === 'back', M = this.doorMats(ext);
      const mat = M.leaf, lg = new THREE.BoxGeometry(o.axis === 'x' ? w : 0.07, h, o.axis === 'x' ? 0.07 : w);
      if (M.scan) TH.Tex.boxUV(lg, o.axis === 'x' ? w : 0.07, h, o.axis === 'x' ? 0.07 : w, 1.8);
      const leaf = new THREE.Mesh(lg, mat);
      if (o.axis === 'x') leaf.position.set(w / 2, h / 2, 0); else leaf.position.set(0, h / 2, w / 2);
      pivot.add(leaf);
      // panels + knob
      const panel = M.panel;
      [0.55, 1.5].forEach((py) => { const pg = new THREE.BoxGeometry(o.axis === 'x' ? w * 0.7 : 0.09, 0.6, o.axis === 'x' ? 0.09 : w * 0.7); if (M.scan) TH.Tex.boxUV(pg, o.axis === 'x' ? w * 0.7 : 0.09, 0.6, o.axis === 'x' ? 0.09 : w * 0.7, 1.8); const p = new THREE.Mesh(pg, panel); p.position.copy(leaf.position); p.position.y = py; pivot.add(p); });
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshLambertMaterial({ color: 0xb8913a }));
      knob.scale.set(1, 1, 1);
      if (o.axis === 'x') knob.position.set(w - 0.12, 1.0, 0); else knob.position.set(0, 1.0, w - 0.12);
      const knob2 = knob.clone(); if (o.axis === 'x') { knob.position.z = 0.06; knob2.position.z = -0.06; } else { knob.position.x = 0.06; knob2.position.x = -0.06; }
      pivot.add(knob, knob2);

      const col = o.axis === 'x' ? TH.Col.addRect(o.level, o.x, o.z, o.w, 0.12, true) : TH.Col.addRect(o.level, o.x, o.z, 0.12, o.w, true);
      const d = {
        name: o.name || 'Door', x: o.x, z: o.z, level: o.level, axis: o.axis, w: o.w, pivot, leaf, col, kind: o.kind || 'door',
        open: false, angle: 0, target: 0, lock: o.lock || null, jam: 0,
        locks: front ? null : undefined, lockMeshes: {}, knobs: [knob, knob2],
      };
      if (o.kind === 'back') d.lock = 'chained';
      if (front) this.front = d;
      this.list.push(d);
      return d;
    },

    // Builds the lock hardware on the front door for this difficulty
    setupFront(locks) {
      const d = this.front; if (!d) return; TH._dirty = true;
      Object.values(d.lockMeshes).forEach((m) => m.parent && m.parent.remove(m));
      d.locks = locks.slice(); d.lockMeshes = {};
      const H = TH.House.H;
      const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.95, roughness: 0.3 }), steel = new THREE.MeshStandardMaterial({ color: 0xa8aeb6, metalness: 0.95, roughness: 0.32 }), dark = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.8, roughness: 0.5 });
      const add = (p, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; p.add(o); return o; };
      const boardM = new THREE.MeshStandardMaterial({ map: TH.Tex.photo.planks || TH.Tex.wood, color: TH.Tex.photo.planks ? 0xd8ccbc : 0x9a7a54, roughness: 0.9 }), nailM = new THREE.MeshStandardMaterial({ color: 0x6a645c, metalness: 0.8, roughness: 0.45 });
      locks.forEach((k, i) => {
        const g = new THREE.Group(); d.pivot.add(g);
        if (k === 'boards') { // planks nailed across the inside of the door and into the frame
          g.position.set(d.w / 2, 0, -0.075);
          [0.55, 1.2, 1.85].forEach((y, j) => { const b = add(g, TH.Tex.boxUV(new THREE.BoxGeometry(d.w + 0.5, 0.15, 0.03), d.w + 0.5, 0.15, 0.03, 2), boardM, 0, y, 0); b.rotation.z = (j - 1) * 0.12 + (Math.random() - 0.5) * 0.06;
            [-1, -0.35, 0.35, 1].forEach((t) => { const n = add(b, new THREE.CylinderGeometry(0.009, 0.009, 0.012, 8), nailM, t * (d.w / 2 + 0.18), 0.02, -0.016); n.rotation.x = Math.PI / 2; }); });
          d.lockMeshes[k] = g; return;
        }
        g.position.set(d.w * 0.82, { combo: 1.42, padlock: 1.02, chain: 1.72, deadbolt: 1.22 }[k], -0.045);
        if (k === 'combo') { // brass combination padlock on a hasp with four number wheels
          add(g, new THREE.BoxGeometry(0.16, 0.04, 0.008), dark, 0.07, 0.04, -0.004);
          const st = add(g, new THREE.TorusGeometry(0.014, 0.004, 6, 10, Math.PI), steel, 0.13, 0.04, -0.012); st.rotation.y = Math.PI / 2;
          const body = new THREE.Group(); body.position.set(0.13, -0.01, -0.018); g.add(body);
          add(body, new THREE.BoxGeometry(0.075, 0.075, 0.03), brass, 0, -0.025, 0);
          add(body, new THREE.TorusGeometry(0.022, 0.005, 8, 16, Math.PI), steel, 0, 0.012, 0);
          for (let w = 0; w < 4; w++) { const wh = add(body, new THREE.CylinderGeometry(0.008, 0.008, 0.014, 10), dark, -0.026 + w * 0.017, -0.035, -0.017); wh.rotation.x = Math.PI / 2; }
        }
        if (k === 'deadbolt') {
          add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.012, 20), brass, 0, 0, -0.006).rotation.x = Math.PI / 2;      // rose
          add(g, new THREE.BoxGeometry(0.018, 0.06, 0.02), brass, 0, 0, -0.02);                                           // thumb turn
          add(g, new THREE.BoxGeometry(0.11, 0.035, 0.022), brass, 0.09, 0, -0.008);                                      // bolt housing
          add(g, new THREE.BoxGeometry(0.03, 0.024, 0.024), steel, 0.155, 0, -0.008);                                     // bolt thrown into the frame
          add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.004, 10), dark, 0, 0.03, -0.014).rotation.x = Math.PI / 2;  // keyhole
        }
        if (k === 'padlock') {
          add(g, new THREE.BoxGeometry(0.16, 0.04, 0.008), dark, 0.07, 0.04, -0.004);                                    // hasp plate
          const st = add(g, new THREE.TorusGeometry(0.014, 0.004, 6, 10, Math.PI), steel, 0.13, 0.04, -0.012); st.rotation.y = Math.PI / 2; // staple
          const body = new THREE.Group(); body.position.set(0.13, -0.005, -0.016); g.add(body);
          add(body, new THREE.BoxGeometry(0.07, 0.06, 0.028), brass, 0, -0.02, 0);
          add(body, new THREE.CylinderGeometry(0.014, 0.014, 0.07, 14), brass, 0, -0.05, 0).rotation.z = Math.PI / 2;
          add(body, new THREE.TorusGeometry(0.022, 0.005, 8, 16, Math.PI), steel, 0, 0.01, 0);                           // shackle
          add(body, new THREE.BoxGeometry(0.006, 0.014, 0.003), dark, 0, -0.03, -0.015);                                 // keyway
        }
        if (k === 'chain') {
          add(g, new THREE.BoxGeometry(0.12, 0.03, 0.008), steel, 0.2, 0, -0.004);                                       // track on the frame side
          for (let j = 0; j < 9; j++) { const t = j / 8, l = add(g, new THREE.TorusGeometry(0.014, 0.004, 6, 12), steel, 0.2 - t * 0.2, -Math.sin(t * Math.PI) * 0.05, -0.012); l.scale.set(1.3, 1, 1); l.rotation.set(0, j % 2 ? Math.PI / 2 : 0, 0); }
          add(g, new THREE.BoxGeometry(0.03, 0.05, 0.008), steel, -0.005, 0, -0.004);
        }
        d.lockMeshes[k] = g;
      });
    },

    // removed locks drop to the floor and bounce
    fallers: [],
    drop(mesh) {
      mesh.updateMatrixWorld(true); const p = new THREE.Vector3(), q = new THREE.Quaternion(); mesh.getWorldPosition(p); mesh.getWorldQuaternion(q);
      mesh.parent.remove(mesh); TH.scene.add(mesh); mesh.position.copy(p); mesh.quaternion.copy(q);
      this.fallers.push({ m: mesh, v: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.8, -0.9), spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), floor: 0.02, t: 0 });
    },

    nearestDoor(x, z, level, maxD) {
      let best = null, bd = maxD || 1;
      this.list.forEach((d) => { if (d.level !== level) return; const dd = Math.hypot(d.x - x, d.z - z); if (dd < bd) { bd = dd; best = d; } });
      return best;
    },
    // are you pointing right at one of this door's handles? (within ~12 cm of it at the distance you're standing)
    aimedAtHandle(d) {
      const P = TH.Player, cp = P.camPos(), v = this._v || (this._v = new THREE.Vector3());
      const f = { x: -Math.sin(P.yaw) * Math.cos(P.pitch), y: Math.sin(P.pitch), z: -Math.cos(P.yaw) * Math.cos(P.pitch) };
      for (const k of d.knobs || []) {
        k.getWorldPosition(v); const dx = v.x - cp.x, dy = v.y - cp.y, dz = v.z - cp.z, dist = Math.hypot(dx, dy, dz) || 1;
        if (dist > 1.9) continue;
        const ang = Math.acos(Math.min(1, (dx * f.x + dy * f.y + dz * f.z) / dist));
        if (ang < Math.atan(0.12 / dist)) return true;
      }
      return false;
    },
    swingRoom(d) {
      if (d.room) return d.room; const C = TH.Col, hx = d.pivot.position.x, hz = d.pivot.position.z, w = d.w - 0.06, room = {};
      for (const s of [1, -1]) { let maxA = 1.75;
        outer: for (let a = 0.3; a <= 1.75; a += 0.05) { const th = s * a, dir = d.axis === 'x' ? [Math.cos(th), -Math.sin(th)] : [Math.sin(th), Math.cos(th)];
          for (let t = 0.25; t <= w; t += 0.1) { const px = hx + dir[0] * t, pz = hz + dir[1] * t;
            for (const b of C.boxes[d.level]) { if (b === d.col) continue; if (px > b.x0 - 0.08 && px < b.x1 + 0.08 && pz > b.z0 - 0.08 && pz < b.z1 + 0.08) { maxA = a - 0.06; break outer; } } } }
        room[s] = maxA; }
      return (d.room = room);
    },
    isLocked(d) { return !!d.lock || (d.locks && d.locks.length > 0); },

    // opener: {x,z} of whoever opens it, so the door swings away from them
    setOpen(d, open, opener, silent) {
      if (d.open === open) return;
      // you swing it shut while he's in the doorway: it smashes into him, bounces back open, and he goes down for a few seconds
      const E = TH.Enemy;
      if (!open && silent !== 'soft' && opener && opener !== E.pos && E.active && !(E.stunT > 0) && E.level() === d.level && Math.hypot(E.pos.x - d.x, E.pos.z - d.z) < 0.95) {
        TH.Audio.play('doorShut', { x: d.x, y: d.level * TH.House.H + 1, z: d.z }, 30); TH.Audio.play('thwack', { x: d.x, y: d.level * TH.House.H + 1.4, z: d.z, level: d.level }, 30);
        d.target = d.target * 0.3; E.stun(3.5, 'door'); TH.Noise.emit(d.x, d.z, d.level, 40, 'a door slamming into someone'); return;
      }
      d.open = open;
      if (open) {
        const side = d.axis === 'x' ? Math.sign((opener ? opener.z : d.z) - d.z) || 1 : Math.sign((opener ? opener.x : d.x) - d.x) || 1;
        // rotate away from the opener
        let sg = d.axis === 'x' ? side : -side; const rm = this.swingRoom(d);
        if (rm[sg] < 1.2 && rm[-sg] > rm[sg]) sg = -sg; // something in the way on that side: swing the other way
        d.target = sg * Math.min(1.75, Math.max(0.9, rm[sg]));
      } else d.target = 0;
      d.soft = silent === 'soft';
      if (silent === 'soft') { // eased open/shut while crouched: a faint creak only you can hear, nothing that carries to him
        TH.Audio.play(open ? 'door' : 'doorShut', { x: d.x, y: d.level * TH.House.H + 1, z: d.z, quiet: true }, 6);
      } else if (!silent) {
        TH.Audio.play(open ? 'door' : 'doorShut', { x: d.x, y: d.level * TH.House.H + 1, z: d.z }, 24);
        if (opener !== TH.Enemy.pos) TH.Noise.emit(d.x, d.z, d.level, open ? 48 : 58, open ? 'a door opening' : 'a door slamming'); // doors carry through the whole house // he doesn't react to his own doors
      }
    },

    update(dt) {
      this.fallers = this.fallers.filter((f) => {
        f.t += dt; f.v.y -= 9.8 * dt; f.m.position.addScaledVector(f.v, dt);
        f.m.rotation.x += f.spin.x * dt; f.m.rotation.y += f.spin.y * dt; f.m.rotation.z += f.spin.z * dt;
        if (f.m.position.y < f.floor) { f.m.position.y = f.floor; f.v.y = -f.v.y * 0.35; f.v.x *= 0.6; f.v.z *= 0.6; f.spin.multiplyScalar(0.5); if (Math.abs(f.v.y) > 0.4) TH.Audio.play('dropSmall', f.m.position, 10); }
        return f.t < 2.5;
      });
      this.list.forEach((d) => {
        d.angle += (d.target - d.angle) * (1 - Math.exp(-(d.soft ? 2.2 : 6) * dt)); // eased doors swing slowly
        d.pivot.rotation.y = d.angle;
        d.col.off = Math.abs(d.angle) > 0.35; // passable once it's mostly open
      });
    },

    // Interaction registration for every door
    register() {
      this.list.forEach((d) => {
        const y = d.level * TH.House.H;
        TH.Interact.add({
          x: d.x, z: d.z, level: d.level, r: 2.0, y: y + 1.2, // anywhere on the door opens/closes it
          get hold() { return d.kind === 'front' && d.locks.length && canDo(nextLock(d)) ? LOCK_INFO[nextLock(d)].hold || 0 : 0; },
          onTick: () => { if (d.kind === 'front' && nextLock(d) === 'boards' && Math.random() < 0.09) TH.Audio.play('pry', { x: d.x, y: 1.2, z: d.z }, 14); },
          prompt: () => {
            if (d.kind === 'front') {
              if (d.locks.length) { const k = nextLock(d); return canDo(k) ? LOCK_INFO[k].verb : `FRONT DOOR · ${d.locks.length} LOCK${d.locks.length > 1 ? 'S' : ''}`; }
              return 'OPEN THE FRONT DOOR';
            }
            if (d.lock === 'chained') return 'BACK DOOR';
            if (d.lock) return TH.Inventory.has(d.lock) ? 'UNLOCK DOOR' : 'LOCKED';
            if (d.playerLock) return 'UNLOCK DOOR';
            return d.open ? 'CLOSE DOOR' : 'OPEN DOOR';
          },
          short: () => (d.open ? 'CLOSE' : d.kind === 'front' && d.locks.length ? ({ boards: 'PRY', combo: 'DIAL', padlock: 'UNLOCK', chain: 'CUT', deadbolt: 'UNLOCK' })[nextLock(d)] : d.lock && TH.Inventory.has(d.lock) ? 'UNLOCK' : 'OPEN'),
          check: () => {
            if (d.kind === 'front' && d.locks.length && !canDo(nextLock(d))) return LOCK_INFO[nextLock(d)].needs + ' · ' + d.locks.map((k) => LOCK_INFO[k].label).join(' + ');
            if (d.lock === 'chained') return 'CHAINED SHUT FROM OUTSIDE';
            if (d.lock && !TH.Inventory.has(d.lock)) return 'LOCKED';
            return null;
          },
          use: () => {
            const P = TH.Player.pos;
            if (d.kind === 'front') {
              if (d.locks.length) {
                const k = nextLock(d);
                const done = () => {
                  d.locks = d.locks.filter((x) => x !== k);
                  const m = d.lockMeshes[k]; if (m) this.drop(m);
                  TH.Audio.play(k === 'boards' ? 'dropWood' : 'unlock'); if (k === 'boards') TH.Audio.play('frame', { x: d.x, y: 1, z: d.z }, 20);
                  TH.Noise.emit(d.x, d.z, d.level, LOCK_INFO[k].noise || 5, k === 'boards' ? 'boards ripping off a door' : 'metal clinking');
                  TH.UI.toast(`${LOCK_INFO[k].label} off${d.locks.length ? ` · ${d.locks.length} to go` : ' · The door is free'}`);
                  TH.Bus.emit('lockRemoved', k);
                };
                if (k === 'combo') { TH.UI.openCombo((ok) => { if (ok) done(); }); return; }
                done(); return;
              }
              this.setOpen(d, true, P);
              TH.Game.escape('door');
              return;
            }
            if (d.lock) {
              TH.Audio.play('unlock'); TH.UI.toast(`Unlocked the ${d.name}`); d.lock = null; TH.Bus.emit('doorUnlocked', d);
              this.setOpen(d, true, P); return;
            }
            if (d.playerLock) { d.playerLock = false; TH.Audio.play('unlock', { x: d.x, y: d.level * TH.House.H + 1, z: d.z }, 10); TH.Noise.emit(d.x, d.z, d.level, 3, 'a lock clicking'); TH.UI.toast('Unlocked'); return; }
            if (TH.Player.crouch) this.setOpen(d, !d.open, P, 'soft'); else this.setOpen(d, !d.open, P);
            if (!d.open && !this._lockHint) { this._lockHint = true; setTimeout(() => TH.UI.toast('Point right at the handle to lock it'), 900); }
          },
        });
        // lock it behind you: aim low at the handle. He has keys, but it takes him a while to get through.
        if (d.kind === 'door' && !d.lock) TH.Interact.add({
          x: d.x, z: d.z, level: d.level, r: 1.9, // only when the pointer is right on the handle
          prompt: () => (!d.open && !d.playerLock && Math.abs(d.angle) < 0.05 && this.aimedAtHandle(d) ? 'LOCK THE DOOR' : null), short: 'LOCK', bias: () => -4,
          use: () => { d.playerLock = true; TH.Audio.play('unlock', { x: d.x, y: y + 1, z: d.z }, TH.Player.crouch ? 5 : 10); if (!TH.Player.crouch) TH.Noise.emit(d.x, d.z, d.level, 3, 'a lock clicking'); TH.UI.toast('Locked · it’ll slow him down'); },
        });
      });
    },
  });
})();
