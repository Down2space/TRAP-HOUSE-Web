/* TRAP HOUSE — puzzle logic + randomised item placement.
   Front-door chain (Normal): Screwdriver → vent → Rusty Key → Landlord's Office → Front Door Key
                              Knock portraits off the walls → one hides the Padlock Key. The combination's hiding place changes every game.
   Hard/Nightmare add a chain: Wire Cutters spawn somewhere in the house. */
(function () {
  'use strict';
  const TH = window.TH, U = TH.util;

  TH.Puzzles = {
    setup() {
      const Hs = TH.House, diff = TH.DIFF[TH.state.diff];
      if (TH.Extras && TH.Extras.snapSpawns) TH.Extras.snapSpawns();
      TH.Items.clear();

      // 1) random surfaces for loose items
      const spots = U.shuffle(Hs.spawnPoints.slice());
      const cab = Hs.cabinets[0];
      const loose = ['screwdriver', 'crowbar', 'spark_plug', 'pan', 'pan', 'bottle', 'bottle', 'slingshot', 'taser_body'];
      loose.push('wire_cutters'); // always somewhere in the house: the back-gate chain needs them (and the front-door chain on Hard+)
      loose.push('oil_can', 'newspapers'); // the gate's rusted bolt needs the oil; the fire needs the paper
      const notes = U.shuffle(TH.NOTE_TEXTS.slice()).slice(0, 4);
      // the screwdriver is never hidden in the cabinet on Easy so the chain stays gentle
      const cabinetItem = TH.state.diff === 'easy' ? 'pan' : U.pick(['screwdriver', 'pan', 'bottle']);
      cab.contents = cabinetItem; loose.splice(loose.indexOf(cabinetItem), 1);
      // the fridge and drawers: a bottle in the fridge, a note tucked in one random drawer
      if (TH.Openables) {
        TH.Openables.reset();
        const fr = TH.Openables.list.find((o) => o.main), bi = loose.indexOf('bottle');
        if (fr && bi >= 0) { fr.contents = { id: 'bottle' }; loose.splice(bi, 1); }
        const drs = TH.Openables.list.filter((o) => o.kind === 'drawer');
        if (drs.length && notes.length) U.pick(drs).contents = { id: 'note', extra: notes.pop() };
        const free = drs.filter((o) => !o.contents); if (free.length) U.pick(free).contents = { id: 'taser_battery' }; else loose.push('taser_battery'); // the taser's battery is tucked in a drawer somewhere
      }
      loose.forEach((id) => { const s = spots.pop(); TH.Items.place(id, s.x, s.y, s.z, s.level); });
      notes.forEach((n) => { const s = spots.pop(); if (s) TH.Items.place('note', s.x, s.y, s.z, s.level, n); });

      // 2) office key in one random vent (others hold roaches, or nothing)
      const keyVent = U.pick(Hs.vents);
      Hs.vents.forEach((v) => { v.open = false; v.fallT = -1; v.cover.position.set(0, 0, 0); v.cover.rotation.set(0, 0, 0); v.cover.visible = true; v.screws.forEach((sc) => { sc.visible = true; sc.position.z = 0.022; sc.rotation.y = 0; }); v.contents = v === keyVent ? 'rusty_key' : null; v.extra = null; });

      // 3) Tim's car keys on the desk in the locked office; the gas can on a floor somewhere
      const d = Hs.officeDesk; TH.Items.place('car_keys', d.x - 0.4, d.y, d.z, 1);
      const gas = U.pick([[13.2, 0, -1.6, 0], [3.2, 0, -9.6, -1], [19.4, 0, -27.6, 0], [12.4, 0, -9.6, 0], [4.6, 0, -6.6, 1], [-1.6, 0, -10.8, 0], [-11.2, 0, 5.2, 0], [-14.2, 0, -10.4, -1]]);
      TH.Items.place('gas_can', gas[0], gas[3] * Hs.H, gas[2], gas[3]);
      if (TH.Garage) TH.Garage.register();
      if (TH.Grounds && TH.Grounds.register) TH.Grounds.register();
      if (TH.Shortcuts) TH.Shortcuts.register();
      if (TH.Openables) TH.Openables.register();
      if (TH.Weapons) TH.Weapons.register();
      if (TH.Details && TH.Details.register) TH.Details.register();
      (TH.House.toilets || []).forEach((t) => {
        let last = -99;
        TH.Interact.add({ x: t.x, z: t.z, level: t.level, y: t.level * TH.House.H + 0.5, r: 1.4, prompt: () => 'FLUSH THE TOILET', short: 'FLUSH',
          use: () => { const now = performance.now() / 1000; if (now - last < 6) { TH.UI.toast('Still refilling…'); return; } last = now;
            TH.Audio.play('flush', { x: t.x, y: t.level * TH.House.H + 0.5, z: t.z }, 30); TH.Noise.emit(t.x, t.z, t.level, 45, 'a toilet flushing'); TH.UI.noisePulse(2); TH.UI.toast('That’ll bring him running.'); } });
      });

      // 4) the combination for the front door, and the portraits: padlock key / the code / roaches
      TH.state.code = String(1000 + Math.floor(Math.random() * 9000)); TH.state.knowsCode = false; TH.state.codeParts = 0;
      /* where the code is hidden changes every game: behind a portrait, folded in a drawer, taped inside a vent, a receipt left lying around,
         or torn in half with the two pieces in different places */
      const c = TH.state.code, cv = U.pick(['portrait', 'drawer', 'vent', 'receipt', 'split']); TH.state.codeClue = cv;
      const codeNote = (title, extra) => ({ title, body: `FRONT DOOR LOCK\n\n${c.split('').join('   ')}\n\n${extra || '(don’t tell Tim)'}`, code: true });
      const freeDrawer = () => { const f = TH.Openables ? TH.Openables.list.filter((o) => o.kind === 'drawer' && !o.contents) : []; return f.length ? U.pick(f) : null; };
      const putLoose = (n) => { const s = spots.pop(); if (s) TH.Items.place('note', s.x, s.y, s.z, s.level, n); };
      const putDrawer = (n) => { const d = freeDrawer(); if (d) d.contents = { id: 'note', extra: n }; else putLoose(n); };
      const putVent = (n) => { const v = U.pick(Hs.vents.filter((x) => !x.contents)); if (v) { v.contents = 'note'; v.extra = n; } else putLoose(n); };
      if (cv === 'drawer') putDrawer(codeNote('folded up at the back of the drawer'));
      if (cv === 'vent') putVent(codeNote('taped inside the vent', '(he’ll never fit his hand in here)'));
      if (cv === 'receipt') putLoose({ title: 'HARDWARE STORE RECEIPT', body: `1 × COMBINATION PADLOCK, BRASS\n   factory code: ${c}\n1 × DROP BOLT\n1 × MAGNETIC GATE LOCK\n1 × 100 FT CHAIN\n\nTOTAL  $212.40\n\nthank you for shopping, Tim`, code: true });
      if (cv === 'split') {
        const half = (k) => ({ title: 'torn note · ' + (k === 1 ? 'left half' : 'right half'), body: k === 1 ? `FRONT DOOR LO—\n\n${c[0]}   ${c[1]}   —\n\n(the rest is torn off)` : `—CK\n\n—   ${c[2]}   ${c[3]}\n\n(the other half is somewhere else)`, codePart: k });
        const where = U.shuffle([putLoose, putDrawer, putVent]); where[0](half(1)); where[1](half(2));
      }
      const roles = U.shuffle(['key', cv === 'portrait' ? 'code' : 'roaches', 'roaches']), order = U.shuffle(Hs.frames.slice());
      Hs.frames.forEach((f) => { const ri = order.indexOf(f); f.role = roles[ri] || null; f.bumpT = 0; f.knocked = false; f.group.position.set(f.x, f.level * Hs.H + 1.7, f.z); f.group.rotation.set(0, f.ry, 0); f.nook.visible = false; f.fallT = -1; });

      TH.Doors.setupFront(diff.locks);
      if (TH.Extras) TH.Extras.setupRun();
      this.register();
    },

    register() {
      const Hs = TH.House, IS = TH.Interact;

      Hs.frames.forEach((f) => {
        IS.add({
          x: f.x2, z: f.z2, level: f.level, y: f.level * Hs.H + 1.7, r: 1.9,
          prompt: () => (f.knocked ? null : 'KNOCK PORTRAIT OFF THE WALL'), short: 'KNOCK OFF',
          inspect: () => 'Somebody’s grandmother. The frame sits a little off the wall.',
          use: () => this.knockFrame(f),
        });
      });

      Hs.vents.forEach((v) => {
        const y = v.level * Hs.H + 0.45;
        const it = IS.add({
          x: v.front.x, z: v.front.z, level: v.level, y, r: 1.7, hold: 1.6,
          prompt: () => (v.open ? null : 'UNSCREW VENT COVER'), short: 'UNSCREW',
          check: () => (TH.Inventory.has('screwdriver') ? null : 'SCREWDRIVER NEEDED'),
          inspect: () => 'Four rusty screws. Something rattles inside.',
          onTick: (p) => { if (Math.random() < 0.08) TH.Audio.play('vent', { x: v.x, y, z: v.z }, 12); v.screws.forEach((sc, i) => { const q = TH.util.clamp(p * 4 - i, 0, 1); sc.rotation.y = q * 12; sc.position.z = 0.022 + q * 0.03; sc.visible = q < 1; }); }, // screws back out one by one
          use: () => {
            v.open = true; IS.remove(it);
            v.fallT = 0; v.screws.forEach((sc) => (sc.visible = false));
            TH.Audio.play('dropMetal', { x: v.x, y, z: v.z }, 14); TH.Noise.emit(v.x, v.z, v.level, 5, 'a vent cover clattering');
            if (v.contents) {
              const fx = Math.sin(v.ry), fz = Math.cos(v.ry);
              TH.Items.place(v.contents, v.x + fx * 0.1, v.level * Hs.H + 0.28, v.z + fz * 0.1, v.level, v.contents === 'note' ? v.extra : undefined);
              TH.UI.toast(v.contents === 'note' ? 'A note was taped inside the vent.' : 'Something’s in the vent.');
            } else { TH.Roaches.burst(v.x + Math.sin(v.ry) * 0.2, v.level * Hs.H, v.z + Math.cos(v.ry) * 0.2, 10, v.level); TH.UI.toast('Just roaches. Lots of roaches.'); }
          },
        });
      });

      Hs.cabinets.forEach((c) => {
        c.open = false; c.openT = 0;
        const it = IS.add({
          x: c.x, z: c.z + 0.9, level: c.level, y: c.level * Hs.H + 0.4, r: 1.8,
          prompt: () => (c.open ? null : 'OPEN ' + c.name.toUpperCase()), short: 'OPEN',
          use: () => {
            c.open = true; c.openT = 0; IS.remove(it); TH.Audio.play('cabinet', { x: c.x, y: 0.4, z: c.z }, 12); TH.Noise.emit(c.x, c.z, c.level, 3, 'a cabinet creaking');
            TH.Roaches.burst(c.x, c.level * Hs.H, c.z + 0.4, 14, c.level); TH.Audio.play('roach');
            if (c.contents) TH.Items.place(c.contents, c.spawn.x, c.spawn.y, c.spawn.z + 0.35, c.level);
            TH.UI.toast(c.contents ? 'Roaches pour out. There’s something behind them.' : 'Roaches pour out.');
          },
        });
      });

      // hiding spots
      Hs.hideSpots.forEach((s) => {
        IS.add({
          x: s.enter.x, z: s.enter.z, level: s.level, r: 1.6,
          prompt: () => ({ bed: 'HIDE UNDER THE ' + s.name.toUpperCase(), closet: 'HIDE IN THE ' + s.name.toUpperCase(), curtain: 'HIDE BEHIND THE ' + s.name.toUpperCase() }[s.type]),
          short: 'HIDE', hide: s,
          use: () => TH.Player.hide(s),
        });
      });
    },

    knockFrame(f) {
      const Hs = TH.House;
      f.knocked = true; f.fallT = 0;
      const pos = { x: f.x, y: f.level * Hs.H + 0.1, z: f.z };
      TH.Audio.play('frame', pos, 20); TH.Noise.emit(f.x, f.z, f.level, 40, 'a picture frame crashing');
      TH.UI.noisePulse(2);
      f.nook.visible = f.role === 'key';
      setTimeout(() => {
        const fx = Math.sin(f.ry), fz = Math.cos(f.ry);
        if (f.role === 'key') { TH.Items.place('padlock_key', f.x + fx * 0.12, f.level * Hs.H + 1.45, f.z + fz * 0.12, f.level); TH.UI.toast('There’s a hollow in the wall behind it.'); }
        else if (f.role === 'code') { const c = TH.state.code; TH.Items.place('note', f.x + fx * 0.5, f.level * Hs.H, f.z + fz * 0.5, f.level, { title: 'scratched into the back of the frame', body: `FRONT DOOR LOCK\n\n${c.split('').join('   ')}\n\n(don’t tell Tim)`, code: true }); TH.UI.toast('Something is scratched into the back of the frame.'); }
        else if (f.role === 'roaches') { TH.Roaches.burst(f.x + fx * 0.3, f.level * Hs.H, f.z + fz * 0.3, 12, f.level); TH.UI.toast('Roaches were nesting behind it.'); }
      }, 450);
    },

    update(dt) {
      // brushing past a portrait: walk too close to the wall and your shoulder catches it. Crouch-walking past is safe.
      const P = TH.Player;
      if (P && P.active && TH.state.mode === 'play' && !TH.state.travel && !TH.state.hidden && !P.crouch && P.speed > 1.0) {
        TH.House.frames.forEach((f) => {
          if (f.knocked || f.level !== P.level()) return;
          const d = Math.hypot(P.pos.x - f.x, P.pos.z - f.z); // distance to the frame on the wall
          if (d > (P.sprinting ? 0.85 : 0.62)) { f.bumpT = 0; return; }
          f.bumpT = (f.bumpT || 0) + dt;
          if (f.group) f.group.rotation.z = Math.sin(f.bumpT * 30) * 0.05; // it rattles first
          if (P.sprinting || f.bumpT > 0.35) { f.group.rotation.z = 0; TH.UI.toast('You knocked a picture off the wall.'); this.knockFrame(f); }
        });
      }
      // vent cover tips forward and clatters onto the floor
      TH.House.vents.forEach((v) => {
        if (v.fallT < 0 || v.fallT > 1.2) return; v.fallT += dt * 2.4; const k = Math.min(1, v.fallT);
        const bounce = k < 1 ? 0 : Math.sin((v.fallT - 1) * 18) * 0.02 * (1.2 - v.fallT) * 5;
        v.cover.rotation.x = -k * k * 1.57; v.cover.position.set(0, -0.43 * k * k + 0.21 * k * (1 - k) + bounce, 0.03 + 0.22 * k);
      });
      // cabinet doors swing open
      TH.House.cabinets.forEach((c) => { if (!c.doors) return; const want = c.open ? 1 : 0; c.openT = (c.openT || 0) + (want - (c.openT || 0)) * Math.min(1, dt * 5); c.doors.forEach((d) => (d.p.rotation.y = -d.side * 1.85 * c.openT)); });
      TH.House.frames.forEach((f) => {
        if (f.fallT < 0 || f.fallT > 1) return;
        f.fallT += dt * 2.2; const k = Math.min(1, f.fallT);
        const H = TH.House.H, fx = Math.sin(f.ry), fz = Math.cos(f.ry);
        f.group.position.set(f.x + fx * 0.35 * k, f.level * H + 1.7 - k * 1.62, f.z + fz * 0.35 * k);
        f.group.rotation.set(0, f.ry, 0); f.group.rotateX(k * 1.45);
      });
    },
  };
})();
