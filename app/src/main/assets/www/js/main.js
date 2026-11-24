/* TRAP HOUSE — bootstrap and main loop */
(function () {
  'use strict';
  const TH = window.TH;

  async function boot() {
    const canvas = document.getElementById('game');
    const low = TH.settings.quality === 'low';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.25 : TH.settings.quality === 'ultra' ? 2 : 1.5));
    renderer.setSize(innerWidth, innerHeight, false);
    // physically-based colour pipeline: linear lighting, sRGB output, filmic tone mapping
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    TH.renderer = renderer;
    const scene = (TH.scene = new THREE.Scene());
    const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);
    scene.add(camera); TH.camera = camera;

    // make sure canvas text (graffiti, signs) uses the real fonts
    try {
      await Promise.race([
        Promise.all(['74px "Permanent Marker"', '700 30px "Barlow Condensed"', '30px "Rubik Dirt"', '20px "Special Elite"'].map((f) => document.fonts.load(f))),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch (e) { /* fonts optional */ }

    try { await Promise.race([TH.Tex.load(), new Promise((r) => setTimeout(r, 12000))]); } catch (e) { /* scans optional */ }
    TH.Tex.make();
    TH.Col.reset();
    TH.House.build(scene);
    TH.Outside.build(scene);
    TH.Nav.build();
    TH.batchInfo = TH.Batch.run(scene);
    TH.Player.init(camera);
    TH.Enemy.init(scene);
    TH.Roaches.init(scene);
    TH.Drips.init(scene);
    TH.Lights.init(scene);
    TH.Input.init(canvas);
    TH.UI.init();
    TH.PBR.convert(scene);
    TH.Linear.fix(scene);
    TH.Atmos.build(scene);
    TH.Shadows.init(renderer, scene);
    camera.position.set(0.5, 1.7, 5.5); TH.Lights.update(0, 0);
    TH.Env.build(renderer, scene);
    TH.FX.init(renderer, scene, camera);
    TH.Perf.init(renderer);
    TH.Hands.init();
    TH.FX.addHands();
    document.getElementById('hidden-ov').querySelector('p').textContent = TH.util.isTouch ? 'HIDING' : 'HIDING · PRESS E TO LEAVE';

    // menu: you're standing in the foyer, he's at the end of the hall
    TH.state.diff = TH.settings.difficulty; TH.Lights.applyDifficulty();
    const E = TH.Enemy; E.model.root.visible = true; E.pos.set(1.6, 0, -8.4); E.y = 0; E.face = 0; E.state = 'patrol';

    window.addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); TH.FX.resize(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) TH.UI.pause(); });

    const clock = new THREE.Clock(); let t = 0;
    function frame() {
      requestAnimationFrame(frame);
      const rawDt = clock.getDelta();
      // smooth frame timing: averaging out tiny spikes stops movement and camera from jittering
      TH._dts = TH._dts || []; TH._dts.push(Math.min(0.1, rawDt)); if (TH._dts.length > 5) TH._dts.shift();
      const dt = Math.min(0.05, TH._dts.reduce((a, b) => a + b, 0) / TH._dts.length); t += dt;
      const I = TH.Input, mode = TH.state.mode;
      if (TH.Tapes && TH.Tapes.active) { TH.Tapes.frame(dt, t); I.endFrame(); return; }

      if (mode === 'menu') {
        const a = Math.sin(t * 0.12) * 0.35;
        camera.position.set(0.6 + Math.sin(t * 0.2) * 0.3, 1.6, 7.4); camera.rotation.set(-0.02, a * 0.6 + 0.08, 0);
        E.animate(dt, 0, t); E.model.root.rotation.y = Math.PI * 0.02;
      }

      if (mode === 'play') {
        I.update(dt);
        if (I.hit('Escape') || I.hit('KeyP')) { if (TH.UI.modal && TH.UI.modal !== 'daycard') TH.UI.close(TH.UI.modal); else TH.UI.pause(); }
        if (!TH.UI.modal && !TH.state.caught) {
          if (I.hit('Tab') || I.hit('Bag')) TH.UI.open('bag');
          if (I.hit('KeyG') || I.hit('Drop')) { if (!TH.state.hidden) TH.Inventory.drop(); }
          if (I.hit('KeyQ')) TH.Inventory.cycle();
          for (let k = 1; k <= 9; k++) if (I.hit('Digit' + k)) TH.Inventory.select(k - 1);
          if (TH.state.hidden && (I.hit('KeyE') || I.hit('Interact') || I.hit('Hide') || I.hit('Space'))) TH.Player.unhide();
          else if (I.hit('Hide') && TH.Interact.current && TH.Interact.current.hide) TH.Player.hide(TH.Interact.current.hide);
        } else if (TH.UI.modal === 'bag' && (I.hit('Tab') || I.hit('Bag'))) TH.UI.close('bag');
        else if (TH.UI.modal === 'note' && (I.hit('KeyE') || I.hit('Interact'))) TH.UI.close('note');

        TH.Player.update(dt, t);
        TH.Enemy.update(dt, t);
        TH.Interact.update(dt);
        TH.UI.update();
        if (TH.Enemy.active && !TH.state.caught && !TH.state.travel) { /* heartbeat (and a buzz on phones) when he's close: faster the closer he is, fastest when he's after you */
          const E = TH.Enemy, P = TH.Player, ly = Math.abs(E.y - P.y);
          const d = Math.hypot(E.pos.x - P.pos.x, E.pos.z - P.pos.z) + (ly > 1.5 ? 4 : 0), chase = E.state === 'chase', near = chase ? 14 : TH.state.hidden ? 7 : 8;
          TH._hb = (TH._hb || 0) - dt;
          if (d < near && TH._hb <= 0) { TH.Audio.play('heart'); TH.haptic(chase ? [40, 140, 30] : [25, 160, 15], d); TH._hb = (chase ? 0.34 : 0.5) + d * (chase ? 0.035 : 0.1); }
        }
      }
      if (mode === 'play' || mode === 'won' || mode === 'over') {
        if (TH.state.caught) { // camera locks onto his face
          const P = TH.Player, hp = TH.Enemy.headPos();
          const tx = Math.atan2(-(hp.x - camera.position.x), -(hp.z - camera.position.z));
          camera.rotation.y = TH.util.angleLerp(camera.rotation.y, tx, 1 - Math.exp(-8 * dt));
          camera.rotation.x = TH.util.damp(camera.rotation.x, 0.25, 6, dt);
        }
      }
      TH.Doors.update(dt); if (TH.Openables) TH.Openables.update(dt); if (TH.Traps) TH.Traps.update(dt); if (TH.Weapons) TH.Weapons.update(dt);
      TH.Items.update(t);
      TH.Puzzles.update(dt);
      TH.Roaches.update(dt, t);
      TH.Drips.update(dt);
      TH.Lights.update(dt, t);
      TH.Details.update(t);
      if (TH._dirty || (TH._lf = (TH._lf || 0) + 1) % 240 === 0) { TH._dirty = false; TH.PBR.convert(scene); TH.Linear.fix(scene); } // new items/locks/shards only
      TH.Perf.update(rawDt);
      TH.Atmos.update(t);
      TH.Outside.update(t); if (TH.Grounds) TH.Grounds.update(t);
      TH.Garage.update(dt, t);
      TH.Hands.update(dt, t);
      TH.Shadows.update(renderer);
      if (TH.Extras) TH.Extras.update(dt, t);
      if (TH.Tapes) TH.Tapes.record(dt);
      TH.FX.render(t, dt);
      I.endFrame();
    }
    frame();
    TH.ready = true;

    // #tour: walks the camera through the rooms (handy for checking the art on any device)
    if (location.hash === '#tour') {
      TH.Audio.init(); TH.Game.start('practice'); document.getElementById('daycard').click();
      const H = TH.House.H, stops = [
        [0, 8.6, 0, 0], [0, 4, 0, 0.6], [-5, 8.5, 0, 2.2], [-6, -2, 0, 3.0], [9.5, 3, 0, -0.6], [1.6, 1, 0, 0], [5, -5.5, 0, 2.6], [9.5, -5, 0, 2.6],
        [-1.9, 2.4, 0, 0], [1.6, 8, 1, 0], [-5, 5, 1, 2.2], [-6, -1, 1, 1.6], [-6, -5, 1, 2.8], [5.5, 4, 1, -0.6], [5, -2, 1, -1.6], [9, -5.5, 1, 2.4],
      ];
      let i = 0; const go = () => { const [x, z, lv, yaw] = stops[i % stops.length]; TH.Player.pos.set(x, 0, z); TH.Player.y = lv * H; TH.Player.yaw = yaw; TH.Player.pitch = -0.08; TH.UI.toast('Tour ' + (i % stops.length + 1) + '/' + stops.length); i++; };
      go(); setInterval(go, 3500);
    }
  }
  boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<p style="position:fixed;left:16px;bottom:16px;z-index:99;color:#f88;font:16px sans-serif">Couldn’t start: ${e.message}</p>`); });
})();
