/* TRAP HOUSE — collision per floor, stairs, line of sight. Floors: level -1 (basement), 0 (ground/yard) and 1 (upstairs/deck). */
(function () {
  'use strict';
  const TH = window.TH;

  const C = (TH.Col = {
    H: 3.4,                 // floor-to-floor height
    boxes: Object.assign([[], []], { '-1': [] }), // per level (-1, 0, 1): { x0, z0, x1, z1, sight, off }
    stairs: [],

    reset() { this.boxes = [[], []]; this.boxes[-1] = []; this.stairs = []; },
    addBox(level, x0, z0, x1, z1, sight) {
      const b = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), sight: sight !== false, off: false, level };
      this.boxes[level].push(b); return b;
    },
    // centre/size helper
    addRect(level, cx, cz, w, d, sight) { return this.addBox(level, cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, sight); },
    // a flight of stairs running along z: bottom end at zBottom (height yb), top end at zTop (height yt)
    addStair(x0, x1, zBottom, zTop, yb, yt) { yb = yb === undefined ? 0 : yb; yt = yt === undefined ? this.H : yt; const s = { x0, x1, zb: zBottom, zt: zTop, yb, yt, lb: this.levelOf(yb + 0.1), lt: this.levelOf(yt + 0.1) }; this.stairs.push(s); return s; },

    levelOf(y) { return y > this.H * 0.5 ? 1 : y < -this.H * 0.5 ? -1 : 0; },
    // the flight of stairs at (x, z) — only one you could actually be on at height y (stairwells stack over each other on different floors)
    stairAt(x, z, y) {
      for (const s of this.stairs) if (x >= s.x0 && x <= s.x1 && z <= Math.max(s.zb, s.zt) && z >= Math.min(s.zb, s.zt) && (y === undefined || (y > Math.min(s.yb, s.yt) - 0.6 && y < Math.max(s.yb, s.yt) + 0.6))) return s;
      return null;
    },
    groundY(x, z, y) {
      const s = this.stairAt(x, z, y);
      if (s) { const t = TH.util.clamp((z - s.zb) / (s.zt - s.zb), 0, 1); return s.yb + t * (s.yt - s.yb); }
      return this.levelOf(y) * this.H;
    },

    resolve(pos, r, y) {
      const list = this.boxes[this.levelOf(y)];
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < list.length; i++) {
          const b = list[i]; if (b.off) continue;
          if (pos.x < b.x0 - r || pos.x > b.x1 + r || pos.z < b.z0 - r || pos.z > b.z1 + r) continue;
          const cx = Math.max(b.x0, Math.min(pos.x, b.x1)), cz = Math.max(b.z0, Math.min(pos.z, b.z1));
          const dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
          if (d < r) {
            if (d > 1e-5) { pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; }
            else {
              const pl = pos.x - b.x0 + r, pr = b.x1 + r - pos.x, pb = pos.z - b.z0 + r, pf = b.z1 + r - pos.z, m = Math.min(pl, pr, pb, pf);
              if (m === pl) pos.x = b.x0 - r; else if (m === pr) pos.x = b.x1 + r; else if (m === pb) pos.z = b.z0 - r; else pos.z = b.z1 + r;
            }
          }
        }
      }
    },

    // true when nothing sight-blocking sits between a and b on that level
    // how many sound-blocking things (walls, shut doors, tall furniture) a straight line passes through
    wallsBetween(ax, az, bx, bz, level) {
      const dx = bx - ax, dz = bz - az; let n = 0;
      for (const b of this.boxes[level]) {
        if (b.off || !b.sight) continue;
        if ((ax > b.x0 && ax < b.x1 && az > b.z0 && az < b.z1) || (bx > b.x0 && bx < b.x1 && bz > b.z0 && bz < b.z1)) continue;
        let t0 = 0, t1 = 1;
        if (Math.abs(dx) < 1e-9) { if (ax <= b.x0 || ax >= b.x1) continue; } else { let ta = (b.x0 - ax) / dx, tb = (b.x1 - ax) / dx; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 >= t1) continue; }
        if (Math.abs(dz) < 1e-9) { if (az <= b.z0 || az >= b.z1) continue; } else { let ta = (b.z0 - az) / dz, tb = (b.z1 - az) / dz; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 >= t1) continue; }
        n += Math.min(b.x1 - b.x0, b.z1 - b.z0) > 0.5 ? 0.5 : 1; // furniture only half-blocks
      }
      return n;
    },
    // can something of radius r walk in a straight line from a to b on this floor without bumping into anything?
    walkable(ax, az, bx, bz, level, r) {
      const dx = bx - ax, dz = bz - az;
      for (const b of this.boxes[level]) {
        if (b.off) continue;
        const x0 = b.x0 - r, x1 = b.x1 + r, z0 = b.z0 - r, z1 = b.z1 + r;
        if (ax > x0 && ax < x1 && az > z0 && az < z1) continue; // already touching it: let collision sort that out
        let t0 = 0, t1 = 1;
        if (Math.abs(dx) < 1e-9) { if (ax <= x0 || ax >= x1) continue; } else { let ta = (x0 - ax) / dx, tb = (x1 - ax) / dx; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 >= t1) continue; }
        if (Math.abs(dz) < 1e-9) { if (az <= z0 || az >= z1) continue; } else { let ta = (z0 - az) / dz, tb = (z1 - az) / dz; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 >= t1) continue; }
        return false;
      }
      return true;
    },
    // true if the segment passes all the way through a wall/door (enters and exits a thin solid box)
    crossesWall(ax, az, bx, bz, level) {
      const dx = bx - ax, dz = bz - az;
      for (const b of this.boxes[level]) {
        if (b.off || Math.min(b.x1 - b.x0, b.z1 - b.z0) > 0.5) continue;
        let t0 = 0, t1 = 1;
        if (Math.abs(dx) < 1e-9) { if (ax <= b.x0 || ax >= b.x1) continue; } else { let ta = (b.x0 - ax) / dx, tb = (b.x1 - ax) / dx; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 >= t1) continue; }
        if (Math.abs(dz) < 1e-9) { if (az <= b.z0 || az >= b.z1) continue; } else { let ta = (b.z0 - az) / dz, tb = (b.z1 - az) / dz; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 >= t1) continue; }
        if (t0 > 1e-6 && t1 < 1 - 1e-6) return true;
      }
      return false;
    },
    los(ax, az, bx, bz, level) {
      const dx = bx - ax, dz = bz - az;
      for (const b of this.boxes[level]) {
        if (b.off || !b.sight) continue;
        let t0 = 0, t1 = 1;
        if (Math.abs(dx) < 1e-6) { if (ax < b.x0 || ax > b.x1) continue; }
        else { let ta = (b.x0 - ax) / dx, tb = (b.x1 - ax) / dx; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) continue; }
        if (Math.abs(dz) < 1e-6) { if (az < b.z0 || az > b.z1) continue; }
        else { let ta = (b.z0 - az) / dz, tb = (b.z1 - az) / dz; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) continue; }
        if (t1 > 0.001 && t0 < 0.999) return false;
      }
      return true;
    },
  });
})();
