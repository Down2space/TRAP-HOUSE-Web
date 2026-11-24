/* TRAP HOUSE — UIManager: menus, HUD, prompts, inventory bar, notes, day cards, capture/win/lose screens */
(function () {
  'use strict';
  const TH = window.TH;
  const $ = (id) => document.getElementById(id);

  const UI = (TH.UI = {
    modal: null,

    init() {
      const isTouch = TH.util.isTouch;
      $('keys-pc').hidden = isTouch; $('keys-mobile').hidden = !isTouch;

      // difficulty picker
      const box = $('diffs');
      Object.entries(TH.DIFF).forEach(([k, d]) => {
        const b = document.createElement('button'); b.className = 'diff'; b.textContent = d.label; b.dataset.k = k;
        b.addEventListener('click', () => { TH.settings.difficulty = k; TH.settings.save(); this.syncDiff(); TH.Audio.init(); TH.Audio.play('pickup'); });
        box.appendChild(b);
      });
      this.syncDiff();

      $('btn-play').addEventListener('click', () => { TH.Audio.init(); TH.Audio.resume(); TH.Game.start(TH.settings.difficulty); });
      $('btn-settings').addEventListener('click', () => this.open('settings'));
      $('btn-howto').addEventListener('click', () => this.open('howto'));
      $('btn-howto-close').addEventListener('click', () => this.close('howto'));
      $('btn-settings-close').addEventListener('click', () => { this.close('settings'); if (TH.state.mode === 'play') this.open('pause'); });
      $('btn-pause').addEventListener('click', () => this.pause());
      $('btn-resume').addEventListener('click', () => this.close('pause'));
      $('btn-pause-settings').addEventListener('click', () => { this.close('pause'); this.open('settings'); });
      $('btn-restart').addEventListener('click', () => { this.close('pause'); TH.Game.start(TH.state.diff); });
      $('btn-quit').addEventListener('click', () => { this.close('pause'); this.toMenu(); });
      $('btn-note-close').addEventListener('click', () => this.close('note'));
      $('btn-combo-try').addEventListener('click', () => this.tryCombo());
      $('btn-combo-close').addEventListener('click', () => this.close('combo'));
      addEventListener('keydown', (e) => { if (this.modal !== 'combo') return; if (/^[0-9]$/.test(e.key)) { const i = (this._ci = ((this._ci || 0) % 4)); this._combo[i] = +e.key; $('cw' + i).textContent = e.key; this._ci++; } if (e.key === 'Enter') this.tryCombo(); });
      $('btn-bag-close').addEventListener('click', () => this.close('bag'));
      $('btn-bag-drop').addEventListener('click', () => { this.close('bag'); TH.Inventory.drop(); });
      ['win', 'over'].forEach((k) => {
        $(`btn-${k}-again`).addEventListener('click', () => { $(k).hidden = true; TH.Game.start(TH.state.diff); });
        $(`btn-${k}-menu`).addEventListener('click', () => { $(k).hidden = true; this.toMenu(); });
      });

      // settings bindings
      const S = TH.settings;
      const bind = (id, key, prop, after) => { const el = $(id); el[prop] = S[key]; el.addEventListener('input', () => { S[key] = prop === 'checked' ? el.checked : prop === 'value' && el.type === 'range' ? parseFloat(el.value) : el.value; S.save(); if (after) after(); }); };
      bind('s-sens', 'sens', 'value'); bind('s-invert', 'invertY', 'checked'); bind('s-joy', 'joySize', 'value');
      bind('s-swap', 'swapSides', 'checked', () => $('mobile').classList.toggle('swap', S.swapSides));
      bind('s-quality', 'quality', 'value'); bind('s-fps', 'showFps', 'checked', () => ($('fps').hidden = !S.showFps)); $('fps').hidden = !S.showFps; bind('s-vol', 'volume', 'value', () => TH.Audio.setVolume(S.volume)); if ($('s-haptics')) bind('s-haptics', 'haptics', 'checked');
      $('mobile').classList.toggle('swap', S.swapSides);

      TH.Bus.on('inv', () => this.renderInv());
      TH.Bus.on('crouch', (on) => $('m-crouch').classList.toggle('on', on));
      TH.Bus.on('hide', (s) => { $('hidden-ov').hidden = !s; this.syncHideBtn(); });
      /* his footsteps also show as a red smudge at the edge of the screen in the direction they came from: phone speakers can't tell left from right */
      TH.Bus.on('tstep', (e) => {
        if (TH.state.mode !== 'play' || TH.state.caught || TH.state.travel || !TH.Player) return;
        const P = TH.Player, dx = e.x - P.pos.x, dz = e.z - P.pos.z, ly = Math.abs(e.y - P.y), d = Math.hypot(dx, dz) + (ly > 1.5 ? 5 : 0), max = e.chase ? 22 : 16;
        if (d > max || d < 1.2) return;
        const a = Math.atan2(-dx, -dz) - P.yaw, box = $('steps'), w = box.clientWidth, h = box.clientHeight;
        const sx = -Math.sin(a), sy = -Math.cos(a), k = Math.min((w / 2 - 26) / Math.max(1e-3, Math.abs(sx)), (h / 2 - 26) / Math.max(1e-3, Math.abs(sy)));
        const m = document.createElement('div'); m.className = 'stepmark' + (e.chase ? ' chase' : '');
        m.style.left = (w / 2 + sx * k) + 'px'; m.style.top = (h / 2 + sy * k) + 'px'; m.style.setProperty('--o', (0.25 + 0.7 * (1 - d / max)).toFixed(2));
        if (ly > 1.5) m.style.filter = 'blur(6px)'; // another floor: blurrier
        box.appendChild(m); setTimeout(() => m.remove(), 1000); while (box.children.length > 6) box.removeChild(box.firstChild);
      });
      TH.Bus.on('enemyState', (s) => { if (s === 'chase' && TH.state.mode === 'play') { TH.haptic([90, 60, 90]); TH.state.spotted = (TH.state.spotted || 0) + 1; } });
      TH.Bus.on('enemyState', (s) => $('chase').classList.toggle('on', s === 'chase' && !(TH.FX && TH.FX.composer))); // the shader does the red pulse on High/Ultra
    },

    syncDiff() {
      document.querySelectorAll('.diff').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === TH.settings.difficulty)));
      $('diff-blurb').textContent = TH.DIFF[TH.settings.difficulty].blurb;
    },

    open(id) { $(id).hidden = false; if (['pause', 'settings', 'howto', 'note', 'bag', 'combo'].includes(id)) { this.modal = id; TH.Input.unlock(); } },
    close(id) { $(id).hidden = true; if (this.modal === id) this.modal = null; },
    pause() { if (TH.state.mode !== 'play' || TH.state.caught) return; this.open('pause'); },

    toMenu() {
      TH.state.mode = 'menu'; TH.Audio.setChase(false);
      ['hud', 'mobile', 'touch-layer', 'hidden-ov'].forEach((k) => ($(k).hidden = true));
      $('chase').classList.remove('on');
      $('menu').hidden = false; this.modal = null;
    },

    startGame() {
      $('menu').hidden = true;
      ['win', 'over', 'caught', 'pause', 'note', 'bag', 'combo'].forEach((k) => ($(k).hidden = true));
      this.modal = null;
      $('hud').hidden = false;
      const touch = TH.util.isTouch; $('hud').classList.toggle('touch', touch); $('mobile').hidden = !touch; $('touch-layer').hidden = !touch; $('prompt-key').hidden = touch;
      $('hidden-ov').hidden = true; $('chase').classList.remove('on');
      TH.Input.sprintToggle = false; $('m-sprint').classList.remove('on'); $('m-crouch').classList.remove('on');
      this.renderInv(); this.syncDay();
      if (touch && innerHeight > innerWidth) setTimeout(() => this.toast('Tip: turn your phone sideways'), 2800);
    },
    syncDay() { $('day').innerHTML = `DAY ${TH.state.day}<small>/ ${TH.state.maxDays}</small>`; },

    dayCard(day, text) {
      this.syncDay();
      $('dc-day').textContent = 'DAY ' + day; $('dc-text').textContent = text; $('daycard').hidden = false; this.modal = 'daycard';
      clearTimeout(this._dc);
      const done = () => { $('daycard').hidden = true; if (this.modal === 'daycard') this.modal = null; };
      this._dc = setTimeout(done, 2600);
      $('daycard').onclick = () => { clearTimeout(this._dc); done(); };
    },

    caught(fromHide, next) {
      $('caught-text').textContent = fromHide ? 'He saw where you hid. He dragged you out.' : (TH.state.day >= TH.state.maxDays ? 'That was your last day.' : `You have ${TH.state.maxDays - TH.state.day} day${TH.state.maxDays - TH.state.day === 1 ? '' : 's'} left.`);
      setTimeout(() => { $('caught').hidden = false; }, 650);
      setTimeout(() => { $('caught').hidden = true; next(); }, 3200);
    },
    win(s) {
      $('win-text').textContent = s.route === 'fire' ? 'Tim Wright’s finest rental goes up like dry kindling. For a second there’s a shape standing in the burning doorway, perfectly still. Then the roof comes down.' : s.route === 'car' ? 'Tires spitting gravel. The garage shrinks in the mirror. Somewhere behind you, he’s standing in the driveway.' : s.route === 'gate' ? 'The gate scrapes open. Wet grass, the alley, a dog barking somewhere far off. You run and you don’t stop.' : 'Cold air. Dead lawn. A FOR RENT sign. You don’t look back.';
      $('win-title').textContent = s.route === 'car' ? 'YOU DROVE AWAY' : s.route === 'gate' ? 'OUT THE BACK' : s.route === 'fire' ? 'IT ALL BURNS' : 'YOU GOT OUT';
      ['hud', 'mobile', 'touch-layer', 'hidden-ov'].forEach((k) => ($(k).hidden = true)); $('chase').classList.remove('on');
      const m = Math.floor(s.secs / 60), sec = String(s.secs % 60).padStart(2, '0');
      const ROUTE = { door: 'Front door', gate: 'Back gate', car: 'The car', fire: 'Fire' }[s.route] || s.route, fmt = (t) => Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
      $('win-stats').innerHTML = `<div><b>${m}:${sec}</b>time</div><div><b>${s.day}</b>day${s.day === 1 ? '' : 's'}</div><div><b>${s.catches}</b>caught</div><div><b>${s.spotted}</b>spotted</div><div><b>${ROUTE}</b>way out</div><div><b>${s.diff}</b>mode</div>`;
      const B = s.badges, el = $('win-badges');
      if (el && B) {
        const best = s.practice ? 'Practice runs don’t earn badges.' : B.newBest ? `New best time for this way out!` : B.best ? `Best time this way out: ${fmt(B.best)}` : '';
        el.innerHTML = `<p class="fine bbest">${best}</p><div class="badges">` + TH.Badges.LIST.map((b) => { const on = !!B.have[b.id], nw = B.fresh.includes(b.id);
          return `<div class="badge${on ? ' on' : ''}${nw ? ' new' : ''}" title="${b.how}"><i>${on ? '★' : '☆'}</i><b>${b.name}</b><span>${nw ? 'NEW' : on ? '' : b.how}</span></div>`; }).join('') + '</div>';
      }
      setTimeout(() => ($('win').hidden = false), 500);
    },
    gameOver() { ['hud', 'mobile', 'touch-layer', 'hidden-ov'].forEach((k) => ($(k).hidden = true)); $('chase').classList.remove('on'); $('over').hidden = false; },

    // combination lock: four wheels, tap/click the arrows or type digits
    openCombo(cb) {
      const box = $('combo-wheels'); this._combo = [0, 0, 0, 0]; this._comboCb = cb; box.innerHTML = '';
      this._combo.forEach((v, i) => {
        const w = document.createElement('div'); w.className = 'wheel';
        w.innerHTML = `<button aria-label="Up">▲</button><b id="cw${i}">0</b><button aria-label="Down">▼</button>`;
        const [up, , dn] = w.children; const set = (d) => { this._combo[i] = (this._combo[i] + d + 10) % 10; $('cw' + i).textContent = this._combo[i]; TH.Audio.play('vent'); };
        up.onclick = () => set(1); dn.onclick = () => set(-1); box.appendChild(w);
      });
      $('combo-msg').textContent = TH.state.knowsCode ? 'You remember the code.' : TH.state.codeParts ? 'You only have half the code: ' + this.codeHint() : 'Four digits. You don’t know the code yet. It’s written down somewhere in the house.';
      this.open('combo');
    },
    codeHint() { const c = TH.state.code, p = TH.state.codeParts || 0; return [0, 1, 2, 3].map((i) => ((i < 2 ? p & 1 : p & 2) ? c[i] : '_')).join(' '); },
    tryCombo() {
      const ok = this._combo.join('') === TH.state.code;
      if (ok) { this.close('combo'); TH.Audio.play('unlock'); if (this._comboCb) this._comboCb(true); }
      else { $('combo-msg').textContent = 'It won’t open.'; TH.Audio.play('locked', TH.Player.camPos(), 10); TH.Noise.emit(TH.Player.pos.x, TH.Player.pos.z, TH.Player.level(), 3, 'a lock rattling'); }
    },
    showNote(n) { $('note-title').textContent = n.title; $('note-body').textContent = n.body; this.open('note'); },

    toast(msg) {
      const box = $('toasts'); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t);
      while (box.children.length > 2) box.removeChild(box.firstChild);
      setTimeout(() => t.remove(), 2800);
    },
    heard(desc, room) {
      if (!desc) return; const el = $('heard'); el.textContent = room ? `He heard ${desc} · he’s heading to the ${room}` : `He heard ${desc}…`; el.classList.add('on');
      clearTimeout(this._h); this._h = setTimeout(() => el.classList.remove('on'), room ? 3200 : 2200);
    },
    spotted() { this.toast('HE SEES YOU — RUN AND HIDE'); },
    noisePulse(level) { const el = $('noise'); el.style.setProperty('--s', 1.5 + level * 1.6); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); },

    setPrompt(p) {
      const el = $('prompt'), btn = $('m-interact');
      if (!p) { el.hidden = true; btn.classList.add('off'); btn.classList.remove('blocked'); $('m-interact-label').textContent = 'USE'; $('m-interact-bar').style.width = '0'; this._hideNear = null; this.syncHideBtn(); return; }
      el.hidden = false; el.classList.toggle('blocked', !!p.blocked);
      $('prompt-text').textContent = p.blocked || p.label;
      $('prompt-key').textContent = p.hold ? 'HOLD E' : 'E';
      $('prompt-bar').style.width = (p.progress * 100).toFixed(0) + '%';
      el.querySelector('.bar').style.display = p.hold ? 'block' : 'none';
      btn.classList.remove('off'); btn.classList.toggle('blocked', !!p.blocked);
      $('m-interact-label').textContent = p.blocked ? 'LOCKED' : p.short;
      $('m-interact-bar').style.width = (p.progress * 100).toFixed(0) + '%';
      const cur = TH.Interact.current; this._hideNear = cur && cur.hide ? cur : null; this.syncHideBtn();
    },
    syncHideBtn() { const b = $('m-hide'); const hidden = TH.state.hidden; b.hidden = !(hidden || this._hideNear); b.textContent = hidden ? 'Leave' : 'Hide'; },

    renderInv() {
      const inv = TH.Inventory, bar = $('inv'); bar.innerHTML = '';
      inv.items.forEach((id, i) => {
        const b = document.createElement('button'); b.className = 'slot' + (i === inv.held ? ' on' : ''); b.innerHTML = TH.ITEMS[id].icon; b.title = TH.ITEMS[id].name; b.setAttribute('aria-label', TH.ITEMS[id].name);
        b.addEventListener('pointerdown', (e) => { e.stopPropagation(); inv.select(i); });
        bar.appendChild(b);
      });
      const h = inv.heldId(); $('held-name').textContent = h ? TH.ITEMS[h].name : '';
      // bag panel
      const list = $('bag-list'); list.innerHTML = inv.items.length ? '' : '<p class="fine" style="font-size:16px">Empty. Search the rooms.</p>';
      if (TH.state.knowsCode || TH.state.codeParts) list.insertAdjacentHTML('afterbegin', `<p class="fine" style="font-size:17px;color:var(--nicotine)">Front door combination: <b>${TH.state.knowsCode ? TH.state.code : this.codeHint()}</b></p>`);
      inv.items.forEach((id, i) => {
        const b = document.createElement('button'); b.className = 'inv-item' + (i === inv.held ? ' on' : '');
        b.innerHTML = `${TH.ITEMS[id].icon}<div><b>${TH.ITEMS[id].name}</b><span>${TH.ITEMS[id].desc}</span></div>`;
        b.addEventListener('click', () => inv.select(i)); list.appendChild(b);
      });
    },

    update() {
      const P = TH.Player; if (!P.active) return;
      const r = TH.House.roomAt(P.pos.x, P.pos.z, P.level()); const name = r ? r.name : '';
      if (name !== this._room) { this._room = name; $('room').textContent = name; }
    },
  });
})();
