/* TRAP HOUSE — items, world pickups, inventory (hold one item in hand), dropping with noise */
(function () {
  'use strict';
  const TH = window.TH;

  const svg = (b) => `<svg viewBox="0 0 32 32" aria-hidden="true">${b}</svg>`;
  const keyIcon = (c) => svg(`<circle cx="9" cy="16" r="6" fill="none" stroke="${c}" stroke-width="3"/><path d="M15 16h14M24 16v5M28 16v4" stroke="${c}" stroke-width="3"/>`);
  TH.ITEMS = {
    front_key: { name: 'Front Door Key', desc: 'Heavy brass. Tagged “FRONT — DO NOT COPY”.', noise: 'small', icon: keyIcon('#d9b44a') },
    padlock_key: { name: 'Padlock Key', desc: 'A small steel key. Fits a padlock.', noise: 'small', icon: keyIcon('#b8bec6') },
    rusty_key: { name: 'Rusty Key', desc: 'Stamped “OFFICE”. Barely holding together.', noise: 'small', icon: keyIcon('#a0603a') },
    screwdriver: { name: 'Screwdriver', desc: 'Flathead. Good for vent covers.', noise: 'small', icon: svg('<path d="M4 28l9-9" stroke="#e0b030" stroke-width="5" stroke-linecap="round"/><path d="M13 19l14-14" stroke="#9aa3ad" stroke-width="2.5"/>') },
    wire_cutters: { name: 'Wire Cutters', desc: 'They’ll get through a door chain.', noise: 'metal', icon: svg('<path d="M6 28l10-12M16 28 8 14" stroke="#c8372d" stroke-width="4" stroke-linecap="round"/><path d="M13 13l9-9 4 4-9 9z" fill="#9aa3ad"/>') },
    pan: { name: 'Frying Pan', desc: 'Crusted with something. Drop it to make a LOT of noise.', noise: 'metal', icon: svg('<circle cx="13" cy="17" r="9" fill="#3a3a3a" stroke="#666" stroke-width="2"/><path d="M21 13l9-6" stroke="#2a2a2a" stroke-width="4" stroke-linecap="round"/>') },
    crowbar: { name: 'Crowbar', desc: 'Heavy and red. Pries nailed boards off.', noise: 'metal', icon: svg('<path d="M7 27 24 6q3-3 5 0" stroke="#b3261e" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M5 25l-2 3 4-1" stroke="#555" stroke-width="2.5" fill="none"/>') },
    gas_can: { name: 'Gas Can', desc: 'Sloshes when you move. About a gallon left.', noise: 'metal', icon: svg('<path d="M7 9h16l3 4v15H7z" fill="#c22a1e"/><path d="M10 9V5h7l2 4" fill="none" stroke="#333" stroke-width="2"/><path d="M23 9l5-4" stroke="#d8c040" stroke-width="2.5"/><path d="M11 16l9 8M20 16l-9 8" stroke="#8a1a14" stroke-width="1.5"/>') },
    spark_plug: { name: 'Spark Plug', desc: 'Still in the box. The car is missing one.', noise: 'small', icon: svg('<rect x="13" y="3" width="6" height="9" rx="2" fill="#efe9dc"/><path d="M11 12h10v5H11z" fill="#9aa3ad"/><path d="M14 17h4v8h-4z" fill="#b8bec6"/><path d="M16 25v4h3" stroke="#777" stroke-width="2" fill="none"/>') },
    car_keys: { name: 'Car Keys', desc: 'A ring with a car key and a rabbit\u2019s foot. Tim\u2019s.', noise: 'small', icon: svg('<circle cx="10" cy="10" r="5" fill="none" stroke="#b8bec6" stroke-width="2.5"/><path d="M13 13l11 11M20 20l3-3M23 23l3-3" stroke="#d9b44a" stroke-width="3"/><ellipse cx="7" cy="22" rx="3" ry="5" fill="#d8c8a8"/>') },
    slingshot: { name: 'Slingshot', desc: 'Forked branch, surgical tubing, a pouch of gravel. Aim at him and fire: drops him for a few seconds.', noise: 'small', icon: svg('<path d="M16 29V17M16 17 9 5M16 17l7-12" stroke="#8a5a2a" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M9 5l7 9 7-9" stroke="#d07a3a" stroke-width="1.5" fill="none"/><ellipse cx="16" cy="14" rx="3" ry="2" fill="#5a3a20"/>') },
    taser_body: { name: 'Taser (no battery)', desc: 'Yellow and black. Dead — the battery slot is empty.', noise: 'metal', icon: svg('<path d="M4 9h22v8H14l-2 10H7l2-10H4z" fill="#e8c020"/><path d="M14 17 12 27H7l2-10z" fill="#222"/><rect x="24" y="10" width="4" height="6" fill="#222"/>') },
    taser_battery: { name: 'Taser Battery', desc: 'A chunky rechargeable pack. Something takes this.', noise: 'small', icon: svg('<rect x="9" y="6" width="14" height="22" rx="2" fill="#222"/><rect x="9" y="12" width="14" height="5" fill="#e8c020"/><rect x="13" y="3" width="6" height="3" fill="#888"/>') },
    taser: { name: 'Taser', desc: 'Loaded. Get close, aim at him and fire: he goes down hard. Two charges.', noise: 'metal', icon: svg('<path d="M4 9h22v8H14l-2 10H7l2-10H4z" fill="#e8c020"/><path d="M14 17 12 27H7l2-10z" fill="#222"/><rect x="24" y="10" width="4" height="6" fill="#222"/><path d="M28 7l3-3M28 19l3 3" stroke="#7ad0ff" stroke-width="2"/>') },
    rocks: { name: 'Rocks', desc: 'A handful of rocks. Aim and throw: smash a window or make a racket far away from you.', noise: 'small', icon: svg('<path d="M6 22l4-7 7 1 3 7-6 4z" fill="#8a8378"/><path d="M18 13l5-5 5 3-1 6-6 1z" fill="#a39c90"/><path d="M20 24l5-2 3 4-4 3z" fill="#6f6a62"/>') },
    radio: { name: 'Wind-up Radio', desc: 'Crank it, set it down, walk away. A few seconds later it starts blaring — and he goes to find it.', noise: 'metal', icon: svg('<rect x="4" y="11" width="24" height="15" rx="2" fill="#a83a24"/><circle cx="11" cy="18.5" r="4.5" fill="#2a2420"/><rect x="18" y="15" width="7" height="3" fill="#e8dcc0"/><path d="M8 11 22 4" stroke="#bbb" stroke-width="1.5"/>') },
    oil_can: { name: 'Oil Can', desc: 'A dented pump oiler, still half full. Frees up anything rusted solid.', noise: 'metal', icon: svg('<path d="M8 14h11v14H8z" fill="#2f5a3a"/><path d="M10 14l3-5h2l3 5" fill="#b08a3a"/><path d="M16 10l12-6" stroke="#b08a3a" stroke-width="2.2"/><rect x="7" y="20" width="13" height="3" fill="#c8b070"/>') },
    newspapers: { name: 'Old Newspapers', desc: 'A tied bundle of yellowed newspapers. Dry as kindling.', noise: 'small', icon: svg('<path d="M5 10h22v14H5z" fill="#e2dccb"/><path d="M8 13h10M8 16h16M8 19h16M8 22h12" stroke="#7a7466" stroke-width="1.4"/><path d="M16 9v16M4 17h24" stroke="#a8803a" stroke-width="1.6"/>') },
    matches: { name: 'Matches', desc: 'Strike-anywhere matches. Half a box.', noise: 'small', icon: svg('<rect x="6" y="10" width="20" height="13" rx="1" fill="#2a5aa8"/><rect x="6" y="14" width="20" height="5" fill="#e8d8a8"/><path d="M24 6v8" stroke="#e8d8b0" stroke-width="2"/><circle cx="24" cy="5" r="2" fill="#c8372d"/>') },
    bottle: { name: 'Glass Bottle', desc: 'Empty. Drop it and it shatters loud enough to be heard from anywhere.', noise: 'glass', icon: svg('<path d="M13 3h6v7l3 4v15H10V14l3-4z" fill="#4f8a4a" opacity=".9"/><rect x="13" y="3" width="6" height="2" fill="#2a4a28"/>') },
  };
  const NOISE = { small: 45, metal: 60, glass: 80, paper: 0 }; // dropped things carry through the whole house

  // Detailed, physically-shaded item models (metal reads as metal, glass as glass)
  const MAT = {};
  const std = (k, o) => MAT[k] || (MAT[k] = new THREE.MeshStandardMaterial(o));
  function labelTex(draw, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
  function buildMesh(id) {
    const g = new THREE.Group();
    const add = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
    const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg || 16);
    if (id.endsWith('_key')) {
      const m = id === 'front_key' ? std('brass', { color: 0xc9a24a, metalness: 0.95, roughness: 0.32 })
        : id === 'padlock_key' ? std('steel', { color: 0xb8bec6, metalness: 0.95, roughness: 0.28 })
        : std('rust', { color: 0x7a4026, metalness: 0.35, roughness: 0.85 });
      const k = new THREE.Group(); g.add(k); k.rotation.x = Math.PI / 2; // lies flat
      add(new THREE.TorusGeometry(0.03, 0.009, 8, 20), m, -0.035, 0, 0, k);               // bow
      if (id === 'front_key') add(new THREE.TorusGeometry(0.014, 0.005, 6, 14), m, -0.035, 0, 0, k);
      add(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 10), m, 0, 0, 0, k).rotation.z = Math.PI / 2; // collar
      add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.1, 8), m, 0.055, 0, 0, k).rotation.z = Math.PI / 2; // shaft
      [[0.075, 0.012], [0.088, 0.018], [0.1, 0.01]].forEach(([x, h]) => add(new THREE.BoxGeometry(0.009, 0.005, h), m, x, 0, 0.004 + h / 2, k)); // bit
      if (id === 'front_key') { // paper tag on a string
        const tag = add(new THREE.PlaneGeometry(0.05, 0.03), new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide, map: labelTex((c, w, h) => { c.fillStyle = '#e8dcbc'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2014'; c.font = '700 20px "Special Elite", monospace'; c.fillText('FRONT', 8, 30); c.fillStyle = '#7a1e18'; c.font = '14px monospace'; c.fillText('do not copy', 6, 48); }, 96, 60) }), -0.095, 0.002, 0.004);
        tag.rotation.set(-Math.PI / 2, 0, 0.4);
        add(new THREE.CylinderGeometry(0.0008, 0.0008, 0.04, 3), std('string', { color: 0x8a7a5a, roughness: 1 }), -0.068, 0.002, 0.002).rotation.set(0, 0, 1.2);
      }
    } else if (id === 'screwdriver') {
      const handle = add(lathe([[0, 0], [0.014, 0], [0.017, 0.015], [0.016, 0.07], [0.012, 0.095], [0.008, 0.1], [0, 0.1]], 8), std('grip', { color: 0xe0b030, roughness: 0.45 }));
      handle.rotation.z = -Math.PI / 2; handle.position.x = -0.06;
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 10), std('steel', { color: 0xb8bec6, metalness: 0.95, roughness: 0.28 }), 0.046, 0, 0).rotation.z = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.0035, 0.0035, 0.11, 8), std('steel', { color: 0xb8bec6, metalness: 0.95, roughness: 0.28 }), 0.105, 0, 0).rotation.z = Math.PI / 2;
      add(new THREE.BoxGeometry(0.012, 0.007, 0.0015), std('steel', { color: 0xb8bec6, metalness: 0.95, roughness: 0.28 }), 0.165, 0, 0);
      g.position.y = 0.017;
    } else if (id === 'wire_cutters') {
      // jaws at +x, handles fan out toward -x; dipped red grips
      const steel = std('steel', { color: 0xb8bec6, metalness: 0.95, roughness: 0.28 }), grip = std('redgrip', { color: 0xb3261e, roughness: 0.6 });
      [-1, 1].forEach((sd) => {
        const arm = new THREE.Group(); arm.rotation.y = sd * 0.13; g.add(arm);
        add(new THREE.BoxGeometry(0.07, 0.012, 0.014), steel, -0.035, 0, 0, arm);                        // steel shank
        const h = add(lathe([[0.0, 0], [0.008, 0.005], [0.009, 0.06], [0.0075, 0.12], [0.0, 0.125]], 10), grip, -0.07, 0, 0, arm); h.rotation.z = Math.PI / 2; // grip
        const jaw = add(new THREE.CylinderGeometry(0.0, 0.011, 0.045, 4), steel, 0.03, 0, sd * -0.004); jaw.rotation.z = -Math.PI / 2; jaw.scale.set(1, 1, 0.5);
      });
      add(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 14), steel, 0.004, 0, 0);                     // pivot bolt
      g.position.y = 0.012;
    } else if (id === 'pan') {
      const iron = std('iron', { color: 0x2a2a2c, metalness: 0.7, roughness: 0.55 });
      add(lathe([[0, 0], [0.12, 0], [0.135, 0.008], [0.145, 0.04], [0.15, 0.045], [0.142, 0.045], [0.134, 0.012], [0, 0.01]], 28), iron);
      add(new THREE.CircleGeometry(0.12, 24), std('crust', { color: 0x4a3218, roughness: 0.95 }), 0, 0.0115, 0).rotation.x = -Math.PI / 2;
      const h = add(new THREE.BoxGeometry(0.2, 0.012, 0.026), iron, 0.24, 0.035, 0); h.rotation.z = 0.12;
      [0.15, 0.17].forEach((x) => add(new THREE.SphereGeometry(0.005, 6, 4), std('steel', { color: 0xb8bec6, metalness: 0.95, roughness: 0.28 }), x, 0.03, 0));
      add(new THREE.TorusGeometry(0.008, 0.003, 4, 10), iron, 0.335, 0.047, 0).rotation.x = Math.PI / 2;
    } else if (id === 'bottle') {
      const glass = std('glass', { color: 0x3e7a3a, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.72 });
      add(lathe([[0, 0], [0.036, 0], [0.038, 0.01], [0.038, 0.15], [0.03, 0.18], [0.013, 0.21], [0.012, 0.25], [0.015, 0.255], [0.0, 0.255]], 20), glass);
      const label = add(new THREE.CylinderGeometry(0.0385, 0.0385, 0.07, 20, 1, true), new THREE.MeshStandardMaterial({ roughness: 0.9, map: labelTex((c, w, h) => { c.fillStyle = '#d8c89a'; c.fillRect(0, 0, w, h); c.fillStyle = '#5a1810'; c.font = '700 28px "Barlow Condensed", sans-serif'; c.fillText('RIVER RAT', 14, 40); c.font = '18px "Barlow Condensed", sans-serif'; c.fillText('cheap rye whiskey', 14, 64); c.fillStyle = 'rgba(80,50,20,.35)'; c.fillRect(0, 70, w, 30); }, 256, 100) }), 0, 0.08, 0);
      label.rotation.y = 1;
    } else if (id === 'crowbar') {
      const red = std('crowred', { color: 0xa3241a, metalness: 0.7, roughness: 0.4 }), worn = std('steel', { color: 0xb8bec6, metalness: 0.95, roughness: 0.28 });
      add(new THREE.CylinderGeometry(0.011, 0.011, 0.55, 8), red, -0.02, 0, 0).rotation.z = Math.PI / 2;
      const hook = add(new THREE.TorusGeometry(0.045, 0.011, 8, 14, Math.PI * 1.2), red, 0.26, 0.0, 0.045); hook.rotation.x = Math.PI / 2;
      const claw = add(new THREE.BoxGeometry(0.05, 0.008, 0.026), worn, 0.23, 0, 0.1); claw.rotation.y = -0.3;
      const tip = add(new THREE.BoxGeometry(0.05, 0.006, 0.024), worn, -0.31, 0, -0.008); tip.rotation.y = 0.25;
      g.position.y = 0.012;
    } else if (id === 'gas_can') {
      const red = std('canred', { color: 0xb8261a, metalness: 0.5, roughness: 0.45 }), black = std('black', { color: 0x161616, roughness: 0.6 });
      const body = add(new THREE.BoxGeometry(0.17, 0.3, 0.26, 2, 2, 2), red, 0, 0.15, 0); const bp = body.geometry.attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), z = bp.getZ(i); bp.setXYZ(i, x * (1 - Math.abs(z) * 0.5), bp.getY(i), z); } body.geometry.computeVertexNormals();
      [-0.07, 0.07].forEach((z) => add(new THREE.BoxGeometry(0.175, 0.015, 0.02), red, 0, 0.15, z));
      const hd = add(new THREE.TorusGeometry(0.045, 0.012, 8, 14, Math.PI), black, 0, 0.3, -0.03); hd.rotation.y = Math.PI / 2;
      const sp = add(new THREE.CylinderGeometry(0.012, 0.018, 0.16, 10), std('yellow', { color: 0xd8c040, roughness: 0.5 }), 0, 0.34, 0.12); sp.rotation.x = 0.7;
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), black, 0, 0.305, 0.09);
      const lab = add(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshStandardMaterial({ roughness: 0.8, transparent: true, map: labelTex((c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#f2e6c0'; c.font = '900 34px "Barlow Condensed", sans-serif'; c.fillText('GASOLINE', 10, 38); c.font = '16px sans-serif'; c.fillText('⚠ FLAMMABLE', 14, 60); }, 192, 72) }), 0.087, 0.16, 0); lab.rotation.y = Math.PI / 2;
    } else if (id === 'spark_plug') {
      const cer = std('ceramic', { color: 0xefe9dc, roughness: 0.2 }), st = std('steel', { color: 0xb8bec6, metalness: 0.95, roughness: 0.28 });
      const p = new THREE.Group(); p.rotation.z = Math.PI / 2; g.add(p);
      add(new THREE.CylinderGeometry(0.004, 0.004, 0.012, 8), st, 0, 0.06, 0, p);
      add(new THREE.LatheGeometry([[0, 0], [0.007, 0], [0.007, 0.012], [0.006, 0.015], [0.007, 0.018], [0.006, 0.02], [0.007, 0.023], [0.0055, 0.035], [0, 0.036]].map(([a, b]) => new THREE.Vector2(a, b)), 16), cer, 0, 0.018, 0, p);
      add(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6), st, 0, 0.012, 0, p);
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 10), st, 0, -0.006, 0, p);
      add(new THREE.BoxGeometry(0.002, 0.006, 0.008), st, 0.003, -0.018, 0, p);
      g.position.y = 0.011; g.scale.setScalar(1.6);
    } else if (id === 'car_keys') {
      const st = std('steel', { color: 0xb8bec6, metalness: 0.95, roughness: 0.28 }), brass = std('brass', { color: 0xc9a24a, metalness: 0.95, roughness: 0.32 });
      const ring = add(new THREE.TorusGeometry(0.022, 0.003, 6, 20), st); ring.rotation.x = Math.PI / 2;
      const key = (m, a, len) => { const k = new THREE.Group(); k.rotation.y = a; g.add(k); add(new THREE.CylinderGeometry(0.016, 0.016, 0.005, 14), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 }), 0.035, 0, 0, k); add(new THREE.BoxGeometry(len, 0.004, 0.012), m, 0.035 + len / 2 + 0.012, 0, 0, k); for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.006, 0.004, 0.006), m, 0.06 + i * 0.01, 0, 0.007, k); };
      key(st, 0.2, 0.05); key(brass, -0.7, 0.04);
      const foot = add(new THREE.SphereGeometry(0.014, 10, 8), std('fur', { color: 0xd8c8a8, roughness: 1 }), -0.035, 0, 0.03); foot.scale.set(1, 1, 2.2); foot.rotation.y = 0.6;
      g.position.y = 0.006;
    } else if (id === 'slingshot') {
      // a forked branch with orange surgical tubing and a leather pouch, lying flat
      const wood = std('slingwood', { color: 0x7a4a24, roughness: 0.75 }), tube = std('tube', { color: 0xd8742a, roughness: 0.5 }), leather = std('leather', { color: 0x4a2e18, roughness: 0.85 });
      const k = new THREE.Group(); g.add(k); k.rotation.x = -Math.PI / 2; // lie it down (the fork points along +x)
      const stick = (x0, y0, x1, y1, r) => { const m = add(new THREE.CylinderGeometry(r * 0.85, r, Math.hypot(x1 - x0, y1 - y0), 8), wood, (x0 + x1) / 2, (y0 + y1) / 2, 0, k); m.rotation.z = Math.atan2(-(x1 - x0), y1 - y0); return m; };
      stick(-0.1, 0, 0.0, 0, 0.012); stick(0.0, 0, 0.08, 0.045, 0.009); stick(0.0, 0, 0.08, -0.045, 0.009);
      add(new THREE.SphereGeometry(0.013, 8, 6), wood, 0, 0, 0, k);
      [0.045, -0.045].forEach((y) => { const t = add(new THREE.CylinderGeometry(0.003, 0.003, 0.075, 6), tube, 0.12, y * 0.6, 0, k); t.rotation.z = Math.atan2(-0.075, -y * 0.8) + Math.PI / 2; });
      add(new THREE.BoxGeometry(0.03, 0.03, 0.006), leather, 0.155, 0, 0, k);
      g.position.y = 0.012;
    } else if (id === 'taser_body' || id === 'taser' || id === 'taser_battery') {
      const yel = std('taserY', { color: 0xe8c020, roughness: 0.45 }), blk = std('taserB', { color: 0x1c1c1e, roughness: 0.55 }), met = std('steel', { color: 0xb8bec6, metalness: 0.95, roughness: 0.28 });
      const k = new THREE.Group(); g.add(k); k.rotation.x = Math.PI / 2; // lying on its side
      if (id !== 'taser_battery') {
        add(new THREE.BoxGeometry(0.15, 0.04, 0.032), yel, 0.02, 0.0, 0, k);                 // barrel housing
        add(new THREE.BoxGeometry(0.03, 0.036, 0.034), blk, 0.105, 0.0, 0, k);               // cartridge face
        [-0.009, 0.009].forEach((z) => add(new THREE.CylinderGeometry(0.003, 0.003, 0.006, 8), met, 0.122, 0.006, z, k).rotation.z = Math.PI / 2); // probes
        const grip = add(new THREE.BoxGeometry(0.035, 0.085, 0.03), blk, -0.035, -0.055, 0, k); grip.rotation.z = -0.25;
        const tg = add(new THREE.TorusGeometry(0.016, 0.003, 6, 12, Math.PI), blk, 0.002, -0.028, 0, k); tg.rotation.z = Math.PI;
        add(new THREE.BoxGeometry(0.006, 0.018, 0.008), blk, 0.004, -0.03, 0, k);              // trigger
      }
      if (id !== 'taser_body') { // the battery pack (slides into the grip)
        const b = new THREE.Group(); k.add(b); if (id === 'taser') { b.position.set(-0.047, -0.1, 0); b.rotation.z = -0.25; }
        add(new THREE.BoxGeometry(0.03, 0.05, 0.026), blk, 0, 0, 0, b); add(new THREE.BoxGeometry(0.031, 0.012, 0.027), yel, 0, 0.008, 0, b); add(new THREE.BoxGeometry(0.012, 0.006, 0.01), met, 0, 0.028, 0, b);
      }
      g.position.y = 0.017;
    } else if (id === 'rocks') {
      const st = std('rock', { color: 0x8a8378, roughness: 0.95 }), st2 = std('rock2', { color: 0x6f6a62, roughness: 0.95 });
      [[0, 0.025, 0, 0.032, st], [0.05, 0.02, 0.03, 0.026, st2], [-0.04, 0.018, 0.035, 0.022, st], [0.02, 0.016, -0.045, 0.02, st2]].forEach(([x, y, z, r, m]) => { const o = add(new THREE.DodecahedronGeometry(r, 0), m, x, y, z); o.rotation.set(Math.random() * 3, Math.random() * 3, 0); o.scale.y = 0.75; });
    } else if (id === 'radio') {
      const red = std('radioRed', { color: 0xa83a24, roughness: 0.55 }), blk = std('radioBlk', { color: 0x221e1a, roughness: 0.8 }), chrome = std('steel', { color: 0xb8bec6, metalness: 0.95, roughness: 0.28 }), dial = std('radioDial', { color: 0xe8dcc0, roughness: 0.6 });
      add(new THREE.BoxGeometry(0.24, 0.14, 0.08), red, 0, 0.07, 0);
      const spk = add(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 20), blk, -0.055, 0.07, 0.041); spk.rotation.x = Math.PI / 2;
      add(new THREE.BoxGeometry(0.08, 0.03, 0.006), dial, 0.055, 0.09, 0.041); add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12), chrome, 0.055, 0.045, 0.045).rotation.x = Math.PI / 2;
      const hd = add(new THREE.TorusGeometry(0.07, 0.007, 6, 16, Math.PI), chrome, 0, 0.14, 0); hd.scale.y = 0.4;
      const ant = add(new THREE.CylinderGeometry(0.003, 0.003, 0.22, 6), chrome, 0.09, 0.22, -0.02); ant.rotation.z = -0.5;
      const cr = add(new THREE.BoxGeometry(0.012, 0.05, 0.012), blk, 0.126, 0.07, 0); cr.rotation.z = 0.3;
    } else if (id === 'oil_can') { // a pump oiler: green tin body, brass cone and a long thin spout
      const tin = std('oilTin', { color: 0x2f5a3a, roughness: 0.45, metalness: 0.5 }), brs = std('oilBrass', { color: 0xb08a3a, roughness: 0.35, metalness: 0.85 }), lab = std('oilLabel', { color: 0xc8b070, roughness: 0.7 });
      add(new THREE.CylinderGeometry(0.042, 0.045, 0.075, 16), tin, 0, 0.0375, 0); add(new THREE.CylinderGeometry(0.0455, 0.0455, 0.025, 16), lab, 0, 0.04, 0);
      add(new THREE.CylinderGeometry(0.012, 0.04, 0.035, 14), brs, 0, 0.092, 0);
      const sp = add(new THREE.CylinderGeometry(0.0035, 0.006, 0.13, 8), brs, 0.045, 0.14, 0); sp.rotation.z = -1.0;
      add(new THREE.BoxGeometry(0.03, 0.012, 0.018), brs, -0.05, 0.06, 0); // thumb pump
    } else if (id === 'newspapers') { // a bundle of old newspapers tied with twine
      const tex = labelTex((c, w, h) => { c.fillStyle = '#ddd5c0'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2622'; c.font = 'bold 30px Georgia'; c.fillText('THE GAZETTE', 14, 40); c.fillStyle = 'rgba(60,55,48,.55)'; for (let y = 58; y < h - 8; y += 9) for (let x = 12; x < w - 12; x += 70) c.fillRect(x, y, 60 - (y % 3) * 6, 4); }, 256, 180);
      const paper = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), side = std('paperEdge', { color: 0xcfc6ae, roughness: 1 }), twine = std('twine', { color: 0xa8803a, roughness: 0.9 });
      const bundle = add(new THREE.BoxGeometry(0.3, 0.07, 0.21), [side, side, paper, side, side, side], 0, 0.035, 0); bundle.rotation.y = 0.04;
      add(new THREE.BoxGeometry(0.008, 0.075, 0.215), twine, 0.03, 0.036, 0); add(new THREE.BoxGeometry(0.305, 0.075, 0.008), twine, 0, 0.036, 0.02);
    } else if (id === 'matches') {
      const blue = std('matchBlue', { color: 0x2a5aa8, roughness: 0.7 }), card = std('matchCard', { color: 0xe8d8a8, roughness: 0.8 }), tip = std('matchTip', { color: 0xc8372d, roughness: 0.6 });
      add(new THREE.BoxGeometry(0.1, 0.022, 0.065), blue, 0, 0.011, 0); add(new THREE.BoxGeometry(0.102, 0.012, 0.03), card, 0, 0.012, 0);
      const m = add(new THREE.CylinderGeometry(0.0025, 0.0025, 0.06, 6), card, 0.07, 0.004, 0.02); m.rotation.z = Math.PI / 2; add(new THREE.SphereGeometry(0.004, 6, 5), tip, 0.1, 0.004, 0.02);
    } else if (id === 'note') {
      const geo = new THREE.PlaneGeometry(0.19, 0.25, 6, 6); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.pow(p.getX(i) * 6, 2) * 0.004 + Math.random() * 0.0015); geo.computeVertexNormals();
      const tex = labelTex((c, w, h) => { c.fillStyle = '#e6dcc0'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(70,90,140,.35)'; for (let y = 34; y < h; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.strokeStyle = '#2a2420'; c.lineWidth = 1.6; for (let y = 30; y < h - 20; y += 20) { c.beginPath(); let x = 12; c.moveTo(x, y); while (x < w - 20 - Math.random() * 60) { x += 4; c.lineTo(x, y + Math.sin(x * 0.7) * 2.2); } c.stroke(); } const gr = c.createRadialGradient(w * 0.7, h * 0.3, 4, w * 0.7, h * 0.3, 60); gr.addColorStop(0, 'rgba(120,80,30,.35)'); gr.addColorStop(1, 'rgba(120,80,30,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, 192, 256);
      add(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }), 0, 0.003, 0).rotation.x = -Math.PI / 2;
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  // soft pulsing glow so items read in a dark house on a phone screen
  let glowTex = null;
  function glowSprite() {
    if (!glowTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(0.35, 'rgba(255,220,150,.35)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.1, toneMapped: false }));
    s.scale.set(0.2, 0.2, 1); s.position.y = 0.04; return s;
  }
  TH.Items = {
    world: [], known: new Set(),
    buildMesh,
    clear() { this.world.forEach((w) => { TH.scene.remove(w.mesh); TH.Interact.remove(w.it); }); this.world = []; },

    // Put an item in the world (on a surface or the floor)
    place(id, x, y, z, level, extra) {
      const mesh = buildMesh(id); mesh.position.set(x, y + (id === 'note' ? 0.005 : 0.02), z); mesh.rotation.y = Math.random() * 6.28;
      TH.scene.add(mesh);
      TH.Linear.fix(mesh); TH._dirty = true;
      // small glow ring so items read on a phone screen in a dark house
      const glint = glowSprite(); mesh.add(glint);
      const w = { id, mesh, level, x, z, extra: extra || null, glint };
      // something you've already carried and put down gets a pale ring and a bright glint, so you can find it again
      if (this.known.has(id) && id !== 'note') {
        w.known = true;
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 32), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = -0.012; mesh.add(ring); w.ring = ring; ring.material.userData.noPBR = true;
      }
      const def = id === 'note' ? { name: 'Note' } : TH.ITEMS[id];
      w.it = TH.Interact.add({
        x, z, level, y, r: 1.9,
        prompt: () => (id === 'note' ? 'READ NOTE' : 'PICK UP ' + def.name.toUpperCase()),
        short: id === 'note' ? 'READ' : 'PICK UP', bias: () => -0.25, // a loose item on top of a dresser or the TV wins your aim over the furniture itself
        use: () => this.take(w),
      });
      this.world.push(w); return w;
    },
    take(w) {
      TH.scene.remove(w.mesh); TH.Interact.remove(w.it); this.world = this.world.filter((x) => x !== w); this.known.add(w.id);
      if (w.id === 'note') { TH.Notes.read(w.extra); return; }
      TH.Inventory.add(w.id); TH.Audio.play('pickup');
      TH.UI.toast('Picked up ' + TH.ITEMS[w.id].name);
      TH.Bus.emit('pickup', w.id);
    },
    update(t) {
      const cur = TH.Interact.current;
      this.world.forEach((w) => {
        const on = cur && cur === w.it, k = on ? 1 : 0;
        if (w.known) { // a dropped item: a slow, bright pulse you can spot from across the room
          const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + w.x);
          w.glint.material.opacity = 0.35 + pulse * 0.35 + k * 0.2; const s = 0.42 + pulse * 0.12 + k * 0.08; w.glint.scale.set(s, s, 1);
          w.ring.material.opacity = 0.25 + pulse * 0.35; const r = 1 + pulse * 0.25; w.ring.scale.set(r, r, r);
          return;
        }
        w.glint.material.opacity = (on ? 0.32 : 0.09) + Math.sin(t * 3 + w.x) * 0.03;
        const s = 0.2 + k * 0.08 + Math.sin(t * 2 + w.z) * 0.015; w.glint.scale.set(s, s, 1);
      });
    },
  };

  /* Inventory: unlimited small items; one is held in your hand (shown in view, dropped with G) */
  TH.Inventory = {
    items: [], held: -1,
    reset() { this.items = []; this.held = -1; TH.Items.known = new Set(); TH.Bus.emit('inv'); },
    has(id) { return this.items.includes(id); },
    add(id) {
      this.items.push(id); this.held = this.items.length - 1;
      if ((id === 'taser_body' || id === 'taser_battery') && this.has('taser_body') && this.has('taser_battery')) {
        this.items = this.items.filter((k) => k !== 'taser_body' && k !== 'taser_battery'); this.items.push('taser'); this.held = this.items.length - 1;
        TH.state.taserCharges = 2; setTimeout(() => { TH.UI.toast('You snap the battery into the taser. It whines up to charge.'); TH.Audio.play('unlock'); }, 600);
      }
      TH.Bus.emit('inv');
    },
    remove(id) { const i = this.items.indexOf(id); if (i < 0) return; this.items.splice(i, 1); if (this.held >= this.items.length) this.held = this.items.length - 1; TH.Bus.emit('inv'); },
    heldId() { return this.items[this.held] || null; },
    select(i) { if (i >= 0 && i < this.items.length) { this.held = i; TH.Audio.play('pickup'); TH.Bus.emit('inv'); } },
    cycle() { if (this.items.length) this.select((this.held + 1) % this.items.length); },

    // Drop whatever is in your hand onto the floor in front of you. Noise depends on what it is.
    drop(silent) {
      const id = this.heldId(); if (!id) { if (!silent) TH.UI.toast('Your hands are empty.'); return; }
      this.remove(id);
      const P = TH.Player, f = P.forward(), lv = P.level();
      let x = P.pos.x + f.x * 0.7, z = P.pos.z + f.z * 0.7;
      const p = { x, z }; TH.Col.resolve(p, 0.15, lv * TH.House.H); x = p.x; z = p.z;
      const y = TH.Col.groundY(x, z, lv * TH.House.H);
      const kind = TH.ITEMS[id].noise;
      if (silent) { TH.Items.place(id, x, y, z, lv); return; }
      const floor = (TH.House.roomAt(x, z, lv) || {}).floor;
      if (kind === 'glass') {
        TH.Audio.play('glass'); TH.UI.noisePulse(3);
        TH.Noise.emit(x, z, lv, NOISE.glass, 'breaking glass');
        TH.UI.toast('The bottle shatters. Everyone heard that.');
        const shards = new THREE.Group(); TH.scene.add(shards); shards.position.set(x, y + 0.01, z);
        for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.04), new THREE.MeshLambertMaterial({ color: 0x5f9a5a, side: THREE.DoubleSide })); s.rotation.set(-Math.PI / 2, 0, Math.random() * 6); s.position.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6); shards.add(s); }
        return;
      }
      const radius = kind === 'metal' ? NOISE.metal : (floor === 'carpet' ? 45 : NOISE.small);
      TH.Audio.play(kind === 'metal' ? 'dropMetal' : floor === 'carpet' ? 'dropWood' : 'dropSmall');
      TH.UI.noisePulse(kind === 'metal' ? 2 : 1);
      TH.Noise.emit(x, z, lv, radius, kind === 'metal' ? 'a metal clang' : 'something dropping');
      TH.Items.place(id, x, y, z, lv);
    },
  };

  /* Hidden notes left around the house */
  TH.NOTE_TEXTS = [
    { title: 'NOTICE TO ALL TENANTS', body: 'Effective immediately, rent is increased by 40%. Cockroaches are considered co-tenants and are NOT grounds for a rent reduction.\n\n— Tim Wright, Landlord' },
    { title: 'scribbled on a receipt', body: 'He sleeps in the day and walks at night. Except he never sleeps. Don’t run on the wood floors. He hears it from ANYWHERE.' },
    { title: 'MAINTENANCE REQUEST #212', body: 'Ceiling leaking in upstairs bathroom. Hole in kitchen wall. Something living in the vents.\n\nStatus: IGNORED' },
    { title: 'torn diary page', body: 'Day 3. I hid under the bed in the back bedroom. He walked right past. If he sees you go under, though, he WILL pull you out.\n\nHe’s too big for the holes in the walls. Crawl through and he has to go the long way around.' },
    { title: 'sticky note', body: 'Three ways out.\n\nFRONT: boards (need a crowbar), a combination lock, and a padlock.\nGARAGE: Tim’s car. No gas, missing a spark plug, keys in his office.\nBACK GATE: chained (cutters??), the bolt’s rusted solid, AND he put one of those magnet locks on it. Hums all night. Runs off the house somewhere.\n\nThe office key is somewhere in the walls??' },
    { title: 'burnt matchbook', body: 'Tim keeps a box of matches in a drawer somewhere. Says the house is insured for more than it’s worth.\n\nThat front door is solid oak. Gas alone won’t take. Stuff some old newspaper under it first, soak it, then a match…\n\nNobody would miss this place.' },
    { title: 'lease, page 14', body: '14.3 — Tenant may not leave the premises until all outstanding balances are paid in full. Balances are calculated daily.' },
  ];
  TH.Notes = {
    read(n) { TH.Audio.play('pickup'); if (n.code) { TH.state.knowsCode = true; TH.Bus.emit('inv'); } if (n.codePart) { TH.state.codeParts |= n.codePart; if (TH.state.codeParts === 3) { TH.state.knowsCode = true; TH.UI.toast('Both halves. You have the whole code.'); } TH.Bus.emit('inv'); } TH.UI.showNote(n); TH.Bus.emit('note', n); },
  };
})();
