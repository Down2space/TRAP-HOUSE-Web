/* TRAP HOUSE — game state: start, capture → next day, five days, escape, restart */
(function () {
  'use strict';
  const TH = window.TH;

  /* Badges: one for each way out, plus a few for how you did it. Kept on this phone/browser only. Practice (empty house) doesn't count. */
  TH.Badges = {
    LIST: [
      { id: 'door', name: 'Front Door', how: 'Get out the front door' },
      { id: 'gate', name: 'Back Gate', how: 'Get out through the back gate' },
      { id: 'car', name: 'Getaway', how: 'Drive off in Tim’s car' },
      { id: 'fire', name: 'Arsonist', how: 'Burn your way out' },
      { id: 'ghost', name: 'Ghost', how: 'Escape without Tim ever spotting you' },
      { id: 'dayone', name: 'Day One', how: 'Escape without getting caught once' },
      { id: 'nightmare', name: 'Nightmare', how: 'Escape on Nightmare' },
    ],
    load() { try { return JSON.parse(localStorage.getItem('traphouse.badges') || '{}'); } catch (e) { return {}; } },
    save(o) { try { localStorage.setItem('traphouse.badges', JSON.stringify(o)); } catch (e) { /* storage blocked */ } },
    award(r) {
      const have = this.load(), got = [];
      if (!r.practice) {
        got.push(r.route);
        if (!r.spotted) got.push('ghost');
        if (!r.catches) got.push('dayone');
        if (TH.state.diff === 'nightmare') got.push('nightmare');
      }
      const fresh = got.filter((id) => !have[id] && this.LIST.some((b) => b.id === id));
      fresh.forEach((id) => (have[id] = Date.now()));
      const bk = 'best_' + r.route, best = have[bk]; let newBest = false;
      if (!r.practice && (!best || r.secs < best)) { have[bk] = r.secs; newBest = !!best; }
      this.save(have);
      return { have, got, fresh, best: have[bk] || null, newBest };
    },
  };

  TH.Game = {
    start(diff) {
      TH.state.diff = diff || TH.settings.difficulty || 'normal';
      TH.state.day = 1; TH.state.caught = false; TH.state.hidden = false; TH.state.cinematic = false; TH.state.travel = null; if (TH.Garage) TH.Garage.done = false, TH.Garage.caught = false; TH.Audio.stopEngine(); TH.state.startTime = performance.now(); this._ending = false; TH.state.replay = false; if (TH.Replay) TH.Replay.buf = [];
      TH.state.mode = 'play'; TH.state.catches = 0; TH.state.spotted = 0;
      // reset doors
      TH.Doors.list.forEach((d) => { d.open = false; d.target = 0; d.angle = 0; d.pivot.rotation.y = 0; d.col.off = false; d.playerLock = false; if (d.name === 'Office Door') d.lock = 'rusty_key'; });
      TH.Inventory.reset();
      TH.Interact.clear();
      TH.Doors.register();
      TH.state.taserCharges = 0; TH.Puzzles.setup(); TH.state.limpT = 0; if (TH.Traps) TH.Traps.reset();
      TH.Lights.applyDifficulty();
      TH.Player.spawn(TH.House.playerSpawn);
      TH.Enemy.spawn(TH.Enemy.farSpawn());
      TH.UI.startGame();
      TH.UI.dayCard(1, TH.DIFF[TH.state.diff].enemy ? 'You wake up in a bed that isn’t yours. Someone is walking around downstairs.' : 'Practice. The house is empty. Take your time.');
    },

    caught(fromHide) {
      if (TH.state.caught) return;
      TH.state.caught = true; TH.state.catches = (TH.state.catches || 0) + 1; TH.Input.unlock(); TH.haptic([400]);
      const P = TH.Player;
      if (P.hideSpot) { P.hideSpot = null; TH.state.hidden = false; }
      TH.Inventory.drop(true); // whatever was in your hand stays where you got caught
      TH.Audio.setChase(false); TH.Audio.play('sting');
      // turn to face him
      const E = TH.Enemy;
      P.yaw = Math.atan2(-(E.pos.x - P.pos.x), -(E.pos.z - P.pos.z)); P.pitch = 0.18;
      TH.UI.caught(fromHide, () => (TH.Replay ? TH.Replay.play(() => this.nextDay()) : this.nextDay()));
    },

    nextDay() {
      TH.state.day++;
      if (TH.state.day > TH.state.maxDays) { this.gameOver(); return; }
      TH.state.caught = false;
      TH.Player.spawn(TH.House.playerSpawn); if (TH.Replay) TH.Replay.buf = [];
      // he changes his habits: starts somewhere else, and a random door on your floor gets slammed shut
      TH.Enemy.spawn(TH.Enemy.farSpawn()); TH.state.limpT = 0; if (TH.Traps) TH.Traps.reset(); // overnight he resets his traps
      TH.Doors.list.forEach((d) => { if (d.kind === 'door' && Math.random() < 0.35) TH.Doors.setOpen(d, false, null, true); });
      TH.UI.dayCard(TH.state.day, ['', '', 'He knows your face now. He’s a little faster.', 'Day three. The walls feel closer.', 'He’s stopped sleeping entirely.', 'Last chance. Get out today.'][TH.state.day] || '');
    },

    escape(route) {
      route = route || 'door';
      if (TH.Endings && TH.Endings.has(route) && !this._ending) { this._ending = true; TH.Endings.play(route, () => this.finishEscape(route)); return; }
      this.finishEscape(route);
    },
    finishEscape(route) {
      TH.state.mode = 'won'; TH.state.cinematic = false; TH.Audio.hush(); TH.Input.unlock(); TH.Audio.setChase(false); TH.Audio.play('win'); setTimeout(() => TH.Audio.stopEngine(), 2500);
      const secs = Math.round((performance.now() - TH.state.startTime) / 1000);
      const st = TH.state, r = route || 'door', D = TH.DIFF[st.diff], res = { day: st.day, secs, diff: D.label, route: r, catches: st.catches || 0, spotted: st.spotted || 0, practice: !D.enemy };
      res.badges = TH.Badges.award(res); TH.UI.win(res);
    },

    gameOver() {
      TH.state.mode = 'over'; TH.Audio.setChase(false); TH.Audio.hush();
      TH.UI.gameOver();
    },
  };
})();
