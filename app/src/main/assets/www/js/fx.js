/* TRAP HOUSE — graphics engine upgrades, scaled by the Graphics setting:
     low   – plain forward rendering (old phones)
     high  – physically-based materials with normal maps + reflections, bloom, film grade, light shafts, dust
     ultra – everything in high + screen-space ambient occlusion, real-time shadows, anti-aliasing */
(function () {
  'use strict';
  const TH = window.TH;
  const tier = () => TH.settings.quality || 'high';
  TH.tier = { hi: () => tier() !== 'low', ultra: () => tier() === 'ultra' };

  /* ---------- normal maps from the procedural textures (Sobel on luminance) ---------- */
  const normalCache = new Map();
  function normalFrom(tex, strength) {
    if (!tex || !tex.image) return null;
    if (normalCache.has(tex.uuid)) return normalCache.get(tex.uuid);
    const src = tex.image, n = Math.min(src.width, 1024), m = Math.min(src.height, 1024);
    const c = document.createElement('canvas'); c.width = n; c.height = m; const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, 0, 0, n, m);
    const d = g.getImageData(0, 0, n, m).data, out = g.createImageData(n, m), o = out.data;
    const L = (x, y) => { x = (x + n) % n; y = (y + m) % m; const i = (y * n + x) * 4; return (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255; };
    for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) {
      const dx = (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x - 1, y) + L(x - 1, y + 1));
      const dy = (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x, y - 1) + L(x + 1, y - 1));
      let nx = -dx * strength, ny = dy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * n + x) * 4; o[i] = (nx * 0.5 + 0.5) * 255; o[i + 1] = (ny * 0.5 + 0.5) * 255; o[i + 2] = (nz * 0.5 + 0.5) * 255; o[i + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.repeat.copy(tex.repeat); t.anisotropy = tex.anisotropy;
    normalCache.set(tex.uuid, t); return t;
  }

  /* ---------- swap Phong/Lambert for physically-based Standard materials ---------- */
  const pbrCache = new Map();
  TH.PBR = {
    convert(root) {
      TH.Tex.dressAll(root);
      if (!TH.tier.hi()) return;
      root.traverse((o) => {
        if (!o.isMesh || !o.material || Array.isArray(o.material) || o.isPoints) return;
        const m = o.material; if (m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isShaderMaterial || m.userData.noPBR) return;
        if (!pbrCache.has(m.uuid)) {
          const shin = m.shininess !== undefined ? m.shininess : 4;
          const spec = m.specular ? (m.specular.r + m.specular.g + m.specular.b) / 3 : 0;
          const brass = shin >= 50 && spec > 0.2;
          const s = new THREE.MeshStandardMaterial({
            color: m.color.clone(), map: m.map || null, emissiveMap: m.emissiveMap || null, emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0), emissiveIntensity: m.emissiveIntensity === undefined ? 1 : m.emissiveIntensity,
            roughness: THREE.MathUtils.clamp(1 - shin / 95, 0.18, 0.96), metalness: brass ? 0.65 : 0,
            transparent: m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite, flatShading: !!m.flatShading,
            polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits,
            envMapIntensity: m.transparent ? 0.25 : 0.3,
          });
          if (m.bumpMap) { const nm = normalFrom(m.bumpMap, m.bumpScale > 0.018 ? 3.0 : m.bumpScale > 0.011 && m.bumpScale < 0.0125 && m.map === TH.Tex.ceiling ? 0.8 : 1.8); if (nm) { s.normalMap = nm; s.normalScale.set(1, 1); } }
          if (m.normalMap) { s.normalMap = m.normalMap; s.normalScale.copy(m.normalScale); const r = TH.Tex.rgh.get(m.map); if (r) { s.roughnessMap = r; s.roughness = THREE.MathUtils.clamp(s.roughness * 1.35, 0.55, 1); } }
          s.userData = Object.assign({}, m.userData);
          if (m._anti) TH.Tex.anti(s);
          pbrCache.set(m.uuid, s);
        }
        o.material = pbrCache.get(m.uuid);
      });
    },
  };

  /* ---------- reflections: capture the house into an environment map ---------- */
  TH.Env = {
    build(renderer, scene) {
      if (!TH.tier.hi() || !THREE.PMREMGenerator) return;
      const rt = new THREE.WebGLCubeRenderTarget(256, { format: THREE.RGBFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      const cam = new THREE.CubeCamera(0.1, 40, rt); cam.position.set(0.5, 1.7, 5.5); scene.add(cam);
      const fog = scene.fog; scene.fog = null; cam.update(renderer, scene); scene.fog = fog; scene.remove(cam);
      const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromCubemap(rt.texture).texture; pm.dispose(); rt.dispose();
      scene.environment = env;
    },
  };

  /* ---------- moonlight shafts through the window boards, and floating dust ---------- */
  TH.Atmos = {
    build(scene) {
      if (!TH.tier.hi()) return;
      // slatted beam texture: light between the boards, fading along its length
      const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
      for (let y = 0; y < 256; y++) { const fall = Math.pow(1 - y / 256, 1.6); for (let x = 0; x < 128; x++) { const slat = 0.75 + 0.25 * Math.sin((x / 128) * Math.PI * 9), edge = Math.pow(Math.sin((x / 128) * Math.PI), 2); g.fillStyle = `rgba(255,255,255,${(fall * slat * edge * 0.9).toFixed(3)})`; g.fillRect(x, y, 1, 1); } }
      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x7d94d8, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
      mat.userData.noPBR = true;
      const patchMat = new THREE.MeshBasicMaterial({ map: tex, color: 0x5a6ea8, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
      (TH.House.windows || []).forEach((w) => {
        const len = 3.4, g2 = new THREE.Group(); g2.position.set(w.x, w.y, w.z); g2.rotation.y = w.ry; scene.add(g2);
        for (const rz of [0]) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, len), mat);
          p.geometry.translate(0, -len / 2, 0); p.rotation.set(-0.75, 0, rz); p.position.z = 0.05; g2.add(p);
        }
        const floorY = (w.y > TH.House.H ? TH.House.H : 0) + 0.012;
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), patchMat); patch.rotation.x = -Math.PI / 2;
        const wx = new THREE.Vector3(0, 0, 2.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), w.ry);
        patch.position.set(w.x + wx.x, floorY, w.z + wx.z); patch.rotation.z = w.ry; scene.add(patch);
      });
      // dust: a box of motes that wraps around the camera
      const N = TH.tier.ultra() ? 900 : 450, pos = new Float32Array(N * 3); this.R = 6;
      for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() * 2 - 1) * this.R;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dc = document.createElement('canvas'); dc.width = dc.height = 32; const dg = dc.getContext('2d'); const gr = dg.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(1, 'rgba(255,240,210,0)'); dg.fillStyle = gr; dg.fillRect(0, 0, 32, 32);
      this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(dc), size: 0.022, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xd8c8a8 }));
      this.dust.frustumCulled = false; this.base = pos.slice(); scene.add(this.dust);
    },
    update(t) {
      if (!this.dust) return;
      const cp = TH.camera.position, R = this.R, p = this.dust.geometry.attributes.position.array, b = this.base;
      for (let i = 0; i < p.length; i += 3) {
        const x = b[i] + Math.sin(t * 0.13 + i) * 0.4, y = b[i + 1] + Math.sin(t * 0.09 + i * 0.7) * 0.3 - t * 0.02, z = b[i + 2] + Math.cos(t * 0.11 + i) * 0.4;
        p[i] = cp.x + (((x - cp.x) % (2 * R)) + 3 * R) % (2 * R) - R;
        p[i + 1] = cp.y + (((y - cp.y) % (2 * R)) + 3 * R) % (2 * R) - R;
        p[i + 2] = cp.z + (((z - cp.z) % (2 * R)) + 3 * R) % (2 * R) - R;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    },
  };

  /* ---------- final grade: colour grading, chromatic aberration, vignette, film grain, danger pulse ---------- */
  const GradeShader = {
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, danger: { value: 0 }, grain: { value: 0.05 }, res: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float time; uniform float danger; uniform float grain; uniform vec2 res; varying vec2 vUv;
      float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
      vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d, d);
        float ca = 0.0016 + 0.006 * danger;
        vec3 col;
        col.r = texture2D(tDiffuse, vUv + d * ca * 2.0).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - d * ca * 2.0).b;
        // grade: cool, slightly green shadows; warm, dirty highlights; a touch desaturated
        col = max(col - 0.012, 0.0) * 1.06;                                    // deeper blacks
        col = col * col * (3.0 - 2.0 * col) * 0.35 + col * 0.65;                // gentle S-curve contrast
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, 0.86);
        col += vec3(-0.004, 0.006, 0.004) * (1.0 - smoothstep(0.0, 0.25, l));
        col *= mix(vec3(1.0), vec3(1.05, 1.0, 0.9), smoothstep(0.2, 0.9, l));
        col = mix(col, col * vec3(1.35, 0.55, 0.5), danger * 0.35 * (0.6 + 0.4 * sin(time * 9.0)));
        col *= 1.0 - smoothstep(0.18, 0.75, r2 * (1.6 + danger)) * 0.75;   // vignette
        vec3 s = toSRGB(col);
        s += (rand(vUv * res + fract(time * 13.0)) - 0.5) * grain;           // film grain
        gl_FragColor = vec4(s, 1.0);
      }`,
  };

  TH.FX = {
    composer: null,
    init(renderer, scene, camera) {
      this.renderer = renderer; this.scene = scene; this.camera = camera;
      if (!TH.tier.hi() || !THREE.EffectComposer) return;
      const w = innerWidth, h = innerHeight, C = (this.composer = new THREE.EffectComposer(renderer));
      C.setPixelRatio(renderer.getPixelRatio());
      if (TH.tier.ultra() && THREE.SSAOPass && THREE.SimplexNoise) {
        const ss = (this.ssao = new THREE.SSAOPass(scene, camera, w, h));
        ss.kernelRadius = 0.5; ss.minDistance = 0.00008; ss.maxDistance = 0.006;
        this.plain = new THREE.RenderPass(scene, camera); this.plain.enabled = false; C.addPass(this.plain); C.addPass(ss);
        // keep glows, light shafts, dust, cobwebs and decals out of the AO normal pass (they'd leave dark halos)
        const ro = ss.renderOverride.bind(ss); let skip = [], k = 0;
        ss.renderOverride = (r, mat, rt, cc, ca) => {
          if (mat !== ss.normalMaterial) return ro(r, mat, rt, cc, ca);
          if (k++ % 60 === 0) { skip = []; scene.traverse((o) => { if (o.isSprite || o.isPoints || (o.material && o.material.transparent)) skip.push(o); }); }
          const vis = skip.map((o) => o.visible); skip.forEach((o) => (o.visible = false));
          ro(r, mat, rt, cc, ca); skip.forEach((o, i) => (o.visible = vis[i]));
        };
      } else C.addPass(new THREE.RenderPass(scene, camera));
      this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.55, 0.5, 0.8); C.addPass(this.bloom);
      this.grade = new THREE.ShaderPass(GradeShader); C.addPass(this.grade);
      if (TH.tier.ultra() && THREE.FXAAShader) { this.fxaa = new THREE.ShaderPass(THREE.FXAAShader); C.addPass(this.fxaa); }
      this.resize();
      document.querySelector('.vignette').hidden = true; // the shader does it now
    },
    // the hands get their own pass on top of the world (cleared depth = they never clip into walls)
    addHands() {
      if (!this.composer || !TH.Hands.ready) return;
      const p = new THREE.RenderPass(TH.Hands.scene, TH.Hands.cam); p.clear = false; p.clearDepth = true;
      this.composer.insertPass(p, this.composer.passes.indexOf(this.bloom));
    },
    resize() {
      if (!this.composer) return;
      const w = innerWidth, h = innerHeight, pr = this.renderer.getPixelRatio();
      this.composer.setSize(w, h); if (this.ssao) this.ssao.setSize(w * pr, h * pr);
      this.grade.uniforms.res.value.set(w * pr, h * pr);
      if (this.fxaa) this.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    },
    render(t, dt) {
      if (!this.composer) {
        const R = this.renderer; R.render(this.scene, this.camera);
        if (TH.Hands.ready && TH.Hands.right.root.visible) { R.autoClear = false; R.clearDepth(); R.render(TH.Hands.scene, TH.Hands.cam); R.autoClear = true; }
        return;
      }
      const E = TH.Enemy, want = TH.state.caught ? 1 : (E && E.active && E.state === 'chase' && TH.state.mode === 'play') ? 0.55 : 0;
      const u = this.grade.uniforms; u.time.value = t; u.danger.value += (want - u.danger.value) * Math.min(1, dt * 3);
      this.composer.render(dt);
    },
  };

  /* ---------- real-time shadows (ultra): the nearest bulb casts them; the map refreshes only when needed ---------- */
  TH.Shadows = {
    init(renderer, scene) {
      if (!TH.tier.ultra()) return;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
      const L = TH.Lights.pool[0]; L.castShadow = true; L.shadow.mapSize.set(512, 512); L.shadow.camera.near = 0.15; L.shadow.camera.far = 14; L.shadow.bias = -0.004; L.shadow.radius = 3;
      scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) { const tr = o.material && o.material.transparent; o.castShadow = !tr; o.receiveShadow = !tr; } });
      if (TH.Enemy.model) TH.Enemy.model.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.on = true; this.last = null; this.k = 0;
    },
    update(renderer) {
      if (!this.on) return;
      const L = TH.Lights.pool[0], key = L.position.x.toFixed(2) + L.position.z.toFixed(2);
      // the house never moves, so only redraw shadows when the light changes or the Tenant is walking under it
      const E = TH.Enemy, near = E.active && E.speed > 0.2 && Math.hypot(E.pos.x - L.position.x, E.pos.z - L.position.z) < 10;
      if (key !== this.last || (near && ++this.k % 3 === 0)) { renderer.shadowMap.needsUpdate = true; this.last = key; }
    },
    disable(renderer) { if (!this.on) return; this.on = false; TH.Lights.pool[0].castShadow = false; renderer.shadowMap.enabled = false; TH.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); },
  };

  /* ---------- smoothness: dynamic resolution + effect fallback so the frame rate stays steady ---------- */
  TH.Perf = {
    level: 0, acc: 0, n: 0, good: 0, fps: 60,
    init(renderer) {
      this.renderer = renderer; this.base = renderer.getPixelRatio();
      this.target = TH.util.isTouch ? 50 : 56;
      this.el = document.getElementById('fps');
    },
    apply() {
      const L = this.level, R = this.renderer, FX = TH.FX;
      const scale = [1, 0.85, 0.85, 0.7, 0.7, 0.55][L];
      const pr = Math.max(0.5, this.base * scale);
      if (Math.abs(R.getPixelRatio() - pr) > 0.01) { R.setPixelRatio(pr); R.setSize(innerWidth, innerHeight, false); if (FX.composer) FX.composer.setPixelRatio(pr); FX.resize(); }
      if (FX.ssao) { FX.ssao.enabled = L < 2; FX.plain.enabled = L >= 2; }
      if (FX.bloom) FX.bloom.enabled = L < 4;
      if (L >= 5) TH.Shadows.disable(R);
    },
    update(dt) {
      this.acc += dt; this.n++;
      if (this.acc < 1) return;
      this.fps = this.n / this.acc; this.acc = 0; this.n = 0;
      if (this.el && !this.el.hidden) this.el.textContent = Math.round(this.fps) + ' FPS';
      if (TH.state.mode !== 'play' || document.hidden) return;
      if (this.fps < this.target - 6 && this.level < 5) { this.level++; this.good = 0; this.apply(); }
      else if (this.fps > 58 && this.level > 0 && this.level < 5) { if (++this.good >= 4) { this.level--; this.good = 0; this.apply(); } }
      else this.good = 0;
    },
  };
})();
