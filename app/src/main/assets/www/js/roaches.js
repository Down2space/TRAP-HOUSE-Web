/* TRAP HOUSE — cockroaches (instanced, cheap on phones) and ceiling drips. Roaches flee from you and burst out of vents/cabinets. */
(function () {
  'use strict';
  const TH = window.TH;
  const up = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1);

  const R = (TH.Roaches = {
    list: [], surfaces: [],
    init(scene) {
      const H = TH.House.H;
      // floors of every room, the kitchen counter, and a few grimy walls
      TH.House.rooms.forEach((r) => { if (r.id !== 'stairs' && r.id !== 'balcony') this.surfaces.push({ kind: 'floor', level: r.level, x0: r.x0 + 0.3, x1: r.x1 - 0.3, z0: r.z0 + 0.3, z1: r.z1 - 0.3, y: r.level * H + 0.012, w: r.id === 'kitchen' || r.id === 'ubath' || r.id === 'bath' ? 3 : 1 }); });
      this.surfaces.push({ kind: 'floor', level: 0, x0: -11.4, x1: -4.3, z0: -9.85, z1: -9.35, y: 0.955, w: 2 });
      this.surfaces.push({ kind: 'wall', level: 0, axis: 'x', k: -11.89, n: [1, 0, 0], a0: -9, a1: 1, y0: 0.4, y1: 2.6, w: 2 });
      this.surfaces.push({ kind: 'wall', level: 1, axis: 'z', k: -9.89, n: [0, 0, 1], a0: -11.5, a1: -6, y0: H + 0.4, y1: H + 2.6, w: 2 });
      this.surfaces.push({ kind: 'wall', level: 0, axis: 'z', k: -9.89, n: [0, 0, 1], a0: 7.5, a1: 11.5, y0: 0.4, y1: 2.6, w: 1 });
      this.surfaces.push({ kind: 'wall', level: 1, axis: 'x', k: 2.89, n: [-1, 0, 0], a0: -9, a1: -3, y0: H + 0.4, y1: H + 2.4, w: 1 });
      const pool = []; this.surfaces.forEach((s) => { for (let i = 0; i < s.w; i++) pool.push(s); });
      const count = TH.settings.quality === 'low' ? 70 : 120;
      const geo = new THREE.SphereGeometry(1, 6, 4); geo.scale(0.032, 0.014, 0.055);
      this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x3a1e0c }), count);
      this.mesh.frustumCulled = false; scene.add(this.mesh);
      for (let i = 0; i < count; i++) { const s = TH.util.pick(pool); this.list.push(this.placeOn({ s, h: Math.random() * 6.28, sp: 0, wait: Math.random() * 3, flee: 0 }, s)); }
    },
    placeOn(r, s) {
      r.s = s;
      if (s.kind === 'floor') { r.a = s.x0 + Math.random() * (s.x1 - s.x0); r.b = s.z0 + Math.random() * (s.z1 - s.z0); }
      else { r.a = s.a0 + Math.random() * (s.a1 - s.a0); r.b = s.y0 + Math.random() * (s.y1 - s.y0); }
      return r;
    },
    // a bunch of roaches pour out of a point and scatter
    burst(x, y, z, n, level) {
      const floor = this.surfaces.find((s) => s.kind === 'floor' && s.level === level && x >= s.x0 - 0.5 && x <= s.x1 + 0.5 && z >= s.z0 - 0.5 && z <= s.z1 + 0.5 && Math.abs(s.y - y) < 1);
      if (!floor) return;
      const cand = this.list.filter((r) => r.s.kind === 'floor'); TH.util.shuffle(cand);
      cand.slice(0, n).forEach((r, i) => {
        r.s = floor; r.a = TH.util.clamp(x, floor.x0, floor.x1); r.b = TH.util.clamp(z, floor.z0, floor.z1);
        r.h = (i / n) * 6.28 + Math.random() * 0.5; r.flee = 1.6 + Math.random(); r.wait = 0;
      });
      TH.Audio.play('roach', { x, y, z }, 10);
    },
    update(dt, t) {
      const P = TH.Player, pl = P.level();
      let skitter = false;
      this.list.forEach((r, i) => {
        const s = r.s;
        // flee if the player is close (floor roaches only feel footsteps)
        if (s.kind === 'floor' && s.level === pl) {
          const dx = r.a - P.pos.x, dz = r.b - P.pos.z, d = dx * dx + dz * dz;
          if (d < 2.6 && r.flee <= 0) { r.flee = 1.2; r.h = Math.atan2(dx, dz) + (Math.random() - 0.5); r.wait = 0; if (d < 1) skitter = true; }
        }
        if (r.flee > 0) { r.flee -= dt; r.sp = 1.3; }
        else if (r.wait > 0) { r.wait -= dt; r.sp = 0; }
        else { r.sp = 0.35; r.h += (Math.random() - 0.5) * dt * 7; if (Math.random() < dt * 0.4) r.wait = 0.5 + Math.random() * 3; }
        if (r.sp > 0) {
          r.a += Math.sin(r.h) * r.sp * dt; r.b += Math.cos(r.h) * r.sp * dt;
          const lo0 = s.kind === 'floor' ? s.x0 : s.a0, hi0 = s.kind === 'floor' ? s.x1 : s.a1, lo1 = s.kind === 'floor' ? s.z0 : s.y0, hi1 = s.kind === 'floor' ? s.z1 : s.y1;
          if (r.a < lo0 || r.a > hi0) { r.a = TH.util.clamp(r.a, lo0, hi0); r.h = -r.h; }
          if (r.b < lo1 || r.b > hi1) { r.b = TH.util.clamp(r.b, lo1, hi1); r.h = Math.PI - r.h; }
        }
        if (s.kind === 'floor') { pos.set(r.a, s.y, r.b); up.set(0, 1, 0); fwd.set(Math.sin(r.h), 0, Math.cos(r.h)); }
        else {
          up.set(s.n[0], s.n[1], s.n[2]);
          const along = Math.sin(r.h), vert = Math.cos(r.h);
          if (s.axis === 'x') { pos.set(s.k, r.b, r.a); fwd.set(0, vert, along); } else { pos.set(r.a, r.b, s.k); fwd.set(along, vert, 0); }
        }
        right.crossVectors(up, fwd).normalize();
        m4.makeBasis(right, up, fwd); m4.setPosition(pos); m4.scale(scl);
        this.mesh.setMatrixAt(i, m4);
      });
      this.mesh.instanceMatrix.needsUpdate = true;
      if (skitter && Math.random() < 0.08) TH.Audio.play('roach');
    },
  });

  /* Ceiling drips with puddles */
  TH.Drips = {
    list: [],
    init(scene) {
      const H = TH.House.H;
      TH.House.drips.forEach((d) => {
        const top = d.level * H + H - 0.05, bottom = d.level * H + 0.01;
        const drop = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshPhongMaterial({ color: 0x8aa0a0, shininess: 80 }));
        drop.scale.y = 1.6; scene.add(drop);
        const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), new THREE.MeshPhongMaterial({ color: 0x1c2224, shininess: 90, specular: 0x667777, transparent: true, opacity: 0.85 }));
        puddle.rotation.x = -Math.PI / 2; puddle.position.set(d.x, bottom + 0.003, d.z); scene.add(puddle);
        this.list.push({ d, drop, top, bottom, t: Math.random() * 2 });
      });
    },
    update(dt) {
      this.list.forEach((k) => {
        k.t += dt; const period = 1.8, f = k.t % period;
        const fall = Math.max(0, f - 1.2) / 0.6;
        k.drop.position.set(k.d.x, k.top - fall * fall * (k.top - k.bottom), k.d.z);
        if (k.last > f && f < 0.1) TH.Audio.play('drip', { x: k.d.x, y: k.bottom, z: k.d.z }, 9);
        k.last = f;
      });
    },
  };
})();
