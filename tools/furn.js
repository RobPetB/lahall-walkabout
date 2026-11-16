/* ---------- street furniture ---------- */
(function () {
  var part = traffic.part, merge = traffic.merge, F = W.furn || {}, d = new THREE.Object3D(), mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  var isCar = function (r) { return r.b !== 2 && (PAVE[r.c] || r.c === 'living_street' || r.c === 'service'); }, anyWay = function (r) { return r.b !== 2; };
  /* stand an item beside the road it belongs to, facing it */
  function seat(x, z, filter, clear) {
    var n = nearestRoad(x, z, filter, 30), ang = 0;
    if (n) {
      var sx = x - n.px, sz = z - n.pz, side = (-n.dz * sx + n.dx * sz) >= 0 ? 1 : -1, need = n.w / 2 + clear + (PAVE[roads[n.k].c] ? 0.5 : 0);
      if (n.d < need) { x = n.px - n.dz * side * need; z = n.pz + n.dx * side * need; }
      ang = Math.atan2(n.px - x, n.pz - z);
    }
    return [x, z, ang];
  }
  function put(geo, list) {
    list = list.filter(function (q) { return !inBuilding(q[0], q[1]); }); if (!list.length) return;
    var m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(function (q, i) { d.position.set(q[0], hAt(q[0], q[1]), q[1]); d.rotation.set(0, q[2], 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.frustumCulled = false; scene.add(m);
  }
  function pairs(a, filter, clear) { var o = []; for (var i = 0; i < (a || []).length; i += 2) o.push(seat(a[i] / 10, a[i + 1] / 10, filter, clear)); return o; }
  function beside(q, dx) { return [q[0] + Math.cos(q[2]) * dx, q[1] - Math.sin(q[2]) * dx, q[2]]; }

  var benchG = merge([part(1.6, 0.06, 0.45, 0, 0.46, 0, '#8a6a45'), part(1.6, 0.36, 0.05, 0, 0.78, -0.22, '#8a6a45'), part(0.06, 0.46, 0.4, 0.68, 0.23, 0, '#33363a'), part(0.06, 0.46, 0.4, -0.68, 0.23, 0, '#33363a')]);
  var binG = merge([part(0.07, 0.9, 0.07, 0, 0.45, 0, '#4a4f55'), part(0.38, 0.5, 0.3, 0, 0.85, 0.12, '#2f4a3a'), part(0.4, 0.05, 0.32, 0, 1.12, 0.12, '#1f2a24')]);
  var postG = merge([part(0.09, 1.0, 0.09, 0, 0.5, 0, '#4a4f55'), part(0.46, 0.56, 0.3, 0, 1.26, 0, '#f2c230'), part(0.3, 0.04, 0.02, 0, 1.38, 0.16, '#2a2a2a'), part(0.46, 0.05, 0.32, 0, 1.56, 0, '#d9a91f')]);
  var hoops = []; for (var hI = -2; hI <= 2; hI++) { hoops.push(part(0.05, 0.8, 0.05, hI * 0.7, 0.4, 0.35, '#8d9296'), part(0.05, 0.8, 0.05, hI * 0.7, 0.4, -0.35, '#8d9296'), part(0.05, 0.05, 0.75, hI * 0.7, 0.8, 0, '#8d9296')); }
  var rackG = merge(hoops);
  var giveG = merge([part(0.07, 2.3, 0.07, 0, 1.15, 0, '#8d9296'), part(0.7, 0.14, 0.04, 0, 2.5, 0.03, '#c8202a'), part(0.5, 0.2, 0.04, 0, 2.33, 0.03, '#f2c230'), part(0.26, 0.2, 0.04, 0, 2.13, 0.03, '#f2c230'), part(0.6, 0.06, 0.045, 0, 2.2, 0.025, '#c8202a')]);
  var stopG = merge([part(0.07, 2.3, 0.07, 0, 1.15, 0, '#8d9296'), part(0.62, 0.62, 0.04, 0, 2.4, 0.03, '#c8202a'), part(0.44, 0.12, 0.045, 0, 2.4, 0.035, '#ffffff')]);
  var crossG = merge([part(0.07, 2.6, 0.07, 0, 1.3, 0, '#8d9296'), part(0.6, 0.6, 0.04, 0, 2.6, 0.03, '#1b4f93'), part(0.34, 0.34, 0.045, 0, 2.6, 0.035, '#ffffff'), part(0.1, 0.24, 0.05, 0, 2.6, 0.04, '#1a1a1a')]);
  var shelterG = merge([part(3.6, 2.1, 0.06, 0, 1.15, -0.7, '#9fc0cf'), part(0.06, 2.1, 1.3, 1.8, 1.15, -0.05, '#9fc0cf'), part(0.06, 2.1, 1.3, -1.8, 1.15, -0.05, '#9fc0cf'), part(3.9, 0.1, 1.7, 0, 2.28, 0, '#3a3f45'),
    part(2.4, 0.07, 0.4, 0, 0.5, -0.45, '#8a6a45'), part(0.08, 2.2, 0.08, 1.8, 1.1, 0.6, '#3a3f45'), part(0.08, 2.2, 0.08, -1.8, 1.1, 0.6, '#3a3f45')]);

  var benches = pairs(F.bench, anyWay, 1.2), bins = pairs(F.bin, anyWay, 0.8), racks = pairs(F.bike, anyWay, 1.5);
  benches.forEach(function (q, i) { if (i % 2 === 0) bins.push(beside(q, 1.4)); });
  /* a shelter at each bus stop, set back from the kerb, with a bin beside it */
  var shelters = [];
  traffic.stops.forEach(function (st, i) {
    var o = traffic.at(st.k, st.s, {}), r = traffic.R[st.k], off = r.w / 2 + 3.4, x = o.x - o.dz * st.side * off, z = o.z + o.dx * st.side * off, q = [x, z, Math.atan2(o.x - x, o.z - z)];
    if (i % 3 !== 2) { shelters.push(q); bins.push(beside(q, 2.6)); } else benches.push(q);
  });
  /* bike racks by the stations */
  W.platforms.forEach(function (pf, i) { if (i > 3) return; var x = 0, z = 0, n = pf.length / 2; for (var k = 0; k < pf.length; k += 2) { x += pf[k] / 10 / n; z += pf[k + 1] / 10 / n; } var q = seat(x + 9, z + 5, anyWay, 1.5); racks.push(q); racks.push(beside(q, 3.6)); });
  put(benchG, benches); put(binG, bins); put(postG, pairs(F.postbox, anyWay, 0.9)); put(rackG, racks); put(shelterG, shelters);
  put(giveG, pairs(F.giveway, isCar, 0.9).map(function (q) { return [q[0], q[1], q[2] + Math.PI / 2]; }));
  put(stopG, pairs(F.stop, isCar, 0.9).map(function (q) { return [q[0], q[1], q[2] + Math.PI / 2]; }));
  /* a blue crossing sign on each side of every zebra */
  var cs = [];
  zebras.forEach(function (n) { [1, -1].forEach(function (sd) { var off = n.w / 2 + 0.9; cs.push([n.px - n.dz * sd * off + n.dx * sd * 2.2, n.pz + n.dx * sd * off + n.dz * sd * 2.2, Math.atan2(n.dx, n.dz) + (sd > 0 ? Math.PI : 0)]); }); });
  put(crossG, cs);

  /* hedges, fences and walls as mapped */
  var bb = new Buf(), BK = { hedge: [0.45, 1.25, col('#4c7743'), col('#5b8a4e')], fence: [0.05, 1.1, col('#8a7355'), col('#8a7355')], wall: [0.18, 0.95, col('#a9a59c'), col('#b9b5ac')] };
  (W.barriers || []).forEach(function (b) {
    var k = BK[b.k], l = densify(pts(b.p), 5); if (!k) return;
    for (var i = 1; i < l.length; i++) {
      var a = l[i - 1], c = l[i], dx = c.x - a.x, dz = c.y - a.y, len = Math.hypot(dx, dz) || 1, nx = -dz / len * k[0], nz = dx / len * k[0];
      var ya = hAt(a.x, a.y), yc = hAt(c.x, c.y), A0 = [a.x + nx, ya - 0.2, a.y + nz], A1 = [a.x - nx, ya - 0.2, a.y - nz], C0 = [c.x + nx, yc - 0.2, c.y + nz], C1 = [c.x - nx, yc - 0.2, c.y - nz];
      var tA0 = [A0[0], ya + k[1], A0[2]], tA1 = [A1[0], ya + k[1], A1[2]], tC0 = [C0[0], yc + k[1], C0[2]], tC1 = [C1[0], yc + k[1], C1[2]];
      bb.tri(A0, C0, tC0, k[2]); bb.tri(A0, tC0, tA0, k[2]); bb.tri(A1, tC1, C1, k[2]); bb.tri(A1, tA1, tC1, k[2]); bb.tri(tA0, tC0, tC1, k[3]); bb.tri(tA0, tC1, tA1, k[3]);
      if (i === 1) { bb.tri(A0, tA0, tA1, k[2]); bb.tri(A0, tA1, A1, k[2]); } if (i === l.length - 1) { bb.tri(C0, tC1, tC0, k[2]); bb.tri(C0, C1, tC1, k[2]); }
    }
  });
  if (bb.p.length) { var bm = new THREE.Mesh(bb.geo(), plainMat); bm.frustumCulled = false; scene.add(bm); }

  /* street-name plates where differently named streets meet */
  var names = W.names, used = [], signs = [], seen = {};
  traffic.R.forEach(function (r, k) {
    var ni = roads[k].n; if (ni < 0 || ni === undefined || !PAVE[r.c] || r.len < 25) return;
    traffic.carJ[k].forEach(function (e) {
      var atStart = e.s < 1.5, atEnd = e.s > r.len - 1.5; if (!atStart && !atEnd) return;
      if (!e.to.some(function (t) { var n2 = roads[t[0]].n; return n2 >= 0 && n2 !== ni; })) return;
      var o = traffic.at(k, atStart ? 7 : r.len - 7, {}), sd = atStart ? 1 : -1, off = r.w / 2 + 1.3, x = o.x - o.dz * sd * off, z = o.z + o.dx * sd * off, key = Math.round(x / 14) + ',' + Math.round(z / 14) + ',' + ni;
      if (seen[key] || inBuilding(x, z) || signs.length >= 400) return; seen[key] = 1;
      if (used.indexOf(ni) < 0) used.push(ni);
      signs.push([x, z, Math.atan2(o.dx, o.dz), used.indexOf(ni)]);
    });
  });
  if (signs.length) {
    var rows = Math.ceil(used.length / 2), cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.pow(2, Math.ceil(Math.log(rows * 64) / Math.LN2));
    var c = cv.getContext('2d'); c.fillStyle = '#1b4f93'; c.fillRect(0, 0, cv.width, cv.height); c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillStyle = '#fff';
    used.forEach(function (ni, i) { var x0 = (i % 2) * 512, y0 = Math.floor(i / 2) * 64, t = names[ni], fs = 40; c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(x0 + 5, y0 + 5, 502, 54);
      do { c.font = '700 ' + fs + 'px "Inter", system-ui, sans-serif'; fs -= 2; } while (c.measureText(t).width > 470 && fs > 14); c.fillText(t, x0 + 256, y0 + 33); });
    var tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8;
    var P = [], U = [], PP = [], PC = [], grey = col('#8d9296');
    signs.forEach(function (q) {
      var y = hAt(q[0], q[1]), ux = Math.sin(q[2]) * 0.75, uz = Math.cos(q[2]) * 0.75, i = q[3], u0 = (i % 2) * 0.5, v1 = 1 - Math.floor(i / 2) * 64 / cv.height, v0 = v1 - 64 / cv.height;
      [1, -1].forEach(function (f) { /* readable from both sides */
        var nx = Math.cos(q[2]) * 0.03 * f, nz = -Math.sin(q[2]) * 0.03 * f, a = [q[0] - ux * f + nx, q[1] - uz * f + nz], b = [q[0] + ux * f + nx, q[1] + uz * f + nz];
        P.push(a[0], y + 2.5, a[1], b[0], y + 2.5, b[1], b[0], y + 2.69, b[1], a[0], y + 2.5, a[1], b[0], y + 2.69, b[1], a[0], y + 2.69, a[1]);
        U.push(u0, v0, u0 + 0.5, v0, u0 + 0.5, v1, u0, v0, u0 + 0.5, v1, u0, v1);
      });
      var g = new THREE.BoxGeometry(0.07, 2.72, 0.07).toNonIndexed(); g.translate(q[0], y + 1.36, q[1]); var pa = g.attributes.position.array; for (var k = 0; k < pa.length; k += 3) { PP.push(pa[k], pa[k + 1], pa[k + 2]); PC.push(grey.r, grey.g, grey.b); }
    });
    var g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g1.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g1.computeVertexNormals();
    var m1 = new THREE.Mesh(g1, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); m1.frustumCulled = false; scene.add(m1);
    var g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(PP, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(PC, 3)); g2.computeVertexNormals();
    var m2 = new THREE.Mesh(g2, mat); m2.frustumCulled = false; scene.add(m2);
  }
  traffic.furn = { benches: benches.length, bins: bins.length, shelters: shelters.length, racks: racks.length, signs: signs.length, zebras: zebras.length, first: { bench: benches[0], shelter: shelters[0], sign: signs[0], zebra: zebras[0] && [zebras[0].px, zebras[0].pz] } };
})();

