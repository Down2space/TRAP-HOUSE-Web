/* TRAP HOUSE — static batching. After the house is built, every piece that never moves is merged
   into one mesh per material, cutting ~1000 draw calls to well under 200. Big win on phones. */
(function () {
  'use strict';
  const TH = window.TH;
  /* Author colours are written as sRGB hex; with a linear pipeline they must be converted once. */
  TH.Linear = {
    fix(root) {
      const doMat = (m) => {
        if (!m || m.userData.lin) return; m.userData.lin = true;
        if (m.color && m.color.isColor) m.color.convertSRGBToLinear();
        if (m.emissive && m.emissive.isColor) m.emissive.convertSRGBToLinear();
        if (m.specular && m.specular.isColor) m.specular.convertSRGBToLinear();
        if (m.map && m.map.encoding !== THREE.sRGBEncoding) { m.map.encoding = THREE.sRGBEncoding; m.map.needsUpdate = true; }
        m.needsUpdate = true;
      };
      root.traverse((o) => {
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(doMat);
        if (o.isLight && !o.userData.lin) { o.userData.lin = true; o.color.convertSRGBToLinear(); if (o.groundColor) o.groundColor.convertSRGBToLinear(); }
      });
      if (root.isScene && !root.userData.lin) { root.userData.lin = true; if (root.background && root.background.isColor) root.background.convertSRGBToLinear(); if (root.fog) root.fog.color.convertSRGBToLinear(); }
    },
  };
  TH.Batch = {
    run(scene) {
      scene.updateMatrixWorld(true);
      const buckets = new Map(), victims = [];
      const visit = (o) => {
        if (o.userData && o.userData.dynamic) return;
        if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.geometry && o.geometry.attributes.position) {
          const key = o.material.uuid;
          if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [] });
          let g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); if (g.index) g = g.toNonIndexed();
          buckets.get(key).geos.push(g); victims.push(o);
        }
        o.children.slice().forEach(visit);
      };
      scene.children.slice().forEach(visit);
      victims.forEach((m) => m.parent && m.parent.remove(m));
      let made = 0;
      buckets.forEach(({ mat, geos }) => {
        let n = 0; geos.forEach((g) => (n += g.attributes.position.count));
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
        geos.forEach((g) => {
          pos.set(g.attributes.position.array, o * 3);
          if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
          if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
          o += g.attributes.position.count; g.dispose();
        });
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        out.computeBoundingSphere();
        const mesh = new THREE.Mesh(out, mat); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); scene.add(mesh); made++;
      });
      // drop now-empty groups
      scene.children.slice().forEach((c) => { if (c.isGroup && !c.children.length) scene.remove(c); });
      return { merged: victims.length, meshes: made };
    },
  };
})();
