/* ---------- cars and people ---------- */
var traffic = (function () {
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var CAR = { motorway: 24, tertiary: 12, unclassified: 9, residential: 8, living_street: 4, service: 4 };
  var PED = { footway: 1, path: 0.6, pedestrian: 2, cycleway: 0.8, steps: 0.5, residential: 0.7, living_street: 1, tertiary: 0.5, unclassified: 0.5, service: 0.3 };
  var R = roads.map(function (r) {
    var cum = [0]; for (var i = 1; i < r.p.length; i++) cum.push(cum[i - 1] + r.p[i].distanceTo(r.p[i - 1]));
    return { c: r.c, p: r.p, cum: cum, len: cum[cum.length - 1], w: RW[r.c] || 3, ok: r.b !== 2 && cum[cum.length - 1] > 3 };
  });
  function at(k, s, o) {
    var r = R[k], cum = r.cum, i = 1; s = Math.max(0, Math.min(r.len, s)); while (i < cum.length - 1 && cum[i] < s) i++;
    var a = r.p[i - 1], b = r.p[i], t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), dx = b.x - a.x, dz = b.y - a.y, l = Math.hypot(dx, dz) || 1;
    o.x = a.x + dx * t; o.z = a.y + dz * t; o.dx = dx / l; o.dz = dz / l; return o;
  }
  /* where one road meets another: shared vertices, and road ends that touch the middle of another road */
  function network(allow) {
    var J = R.map(function () { return []; }), hash = {}, use = R.map(function (r) { return r.ok && allow[r.c] !== undefined; });
    function link(k, s, k2, s2) { var L = J[k], e = null; for (var i = 0; i < L.length; i++) if (Math.abs(L[i].s - s) < 1) e = L[i]; if (!e) { e = { s: s, to: [] }; L.push(e); } e.to.push([k2, s2]); }
    R.forEach(function (r, k) { if (use[k]) r.p.forEach(function (p, i) { var key = Math.round(p.x / 2) + ',' + Math.round(p.y / 2); (hash[key] || (hash[key] = [])).push([k, i]); }); });
    R.forEach(function (r, k) {
      if (!use[k]) return;
      r.p.forEach(function (p, i) {
        var gx = Math.round(p.x / 2), gz = Math.round(p.y / 2), found = false;
        for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) (hash[(gx + a) + ',' + (gz + b)] || []).forEach(function (q) {
          if (q[0] === k) return; var o = R[q[0]].p[q[1]]; if (Math.hypot(o.x - p.x, o.y - p.y) < 1.3) { link(k, r.cum[i], q[0], R[q[0]].cum[q[1]]); found = true; }
        });
        if (found || (i !== 0 && i !== r.p.length - 1)) return;
        for (var k2 = 0; k2 < R.length; k2++) {
          if (!use[k2] || k2 === k) continue; var q2 = R[k2].p;
          for (var j = 1; j < q2.length; j++) {
            var ax = q2[j - 1].x, az = q2[j - 1].y, ex = q2[j].x - ax, ez = q2[j].y - az, l2 = ex * ex + ez * ez; if (!l2) continue;
            var t = Math.max(0, Math.min(1, ((p.x - ax) * ex + (p.y - az) * ez) / l2));
            if (Math.hypot(ax + ex * t - p.x, az + ez * t - p.y) < 1.6) { var s2 = R[k2].cum[j - 1] + Math.sqrt(l2) * t; link(k, r.cum[i], k2, s2); link(k2, s2, k, r.cum[i]); return; }
          }
        }
      });
    });
    var pool = [], tot = 0; R.forEach(function (r, k) { if (use[k]) { tot += r.len * (allow[r.c] || 1) * (allow === CAR ? ({ motorway: 0.35, tertiary: 0.25, service: 0.04, living_street: 0.06 }[r.c] || 0.125) : 1); pool.push([k, tot]); } });
    return { J: J, pick: function (seed) { var x = seed * tot; for (var i = 0; i < pool.length; i++) if (pool[i][1] >= x) return pool[i][0]; return pool[pool.length - 1][0]; } };
  }
  var carNet = network(CAR), pedNet = network(PED), seedN = 1;
  function rand() { return rnd(seedN++ * 1.37 + 0.11 + performance.now() % 7); }
  function spawn(a, net, car) {
    a.r = net.pick(rand()); var r = R[a.r]; a.s = rand() * r.len; a.dir = car && r.c === 'motorway' ? 1 : (rand() < 0.5 ? 1 : -1); a.cool = 3; a.ang = null;
    return a;
  }
  function advance(a, ds, net, car) {
    var r = R[a.r], s0 = a.s, s1 = a.s + ds * a.dir, L = net.J[a.r], end = s1 <= 0 || s1 >= r.len, hit = null;
    a.cool -= ds;
    if (a.cool <= 0) for (var i = 0; i < L.length; i++) { var js = L[i].s; if ((js - s0) * a.dir >= 0 && (s1 - js) * a.dir >= 0) { var last = js < 1 || js > r.len - 1; if (last || rand() < 0.3) hit = L[i]; } }
    if (!hit && end) for (i = 0; i < L.length; i++) if (Math.abs(L[i].s - (s1 <= 0 ? 0 : r.len)) < 1.5) hit = L[i];
    if (hit) {
      var opts = hit.to.filter(function (t) { return !(car && R[t[0]].c === 'motorway' && t[1] > R[t[0]].len - 2); });
      if (opts.length) {
        var t = opts[Math.floor(rand() * opts.length)], r2 = R[t[0]];
        a.r = t[0]; a.s = t[1]; a.dir = t[1] < 1.5 ? 1 : (t[1] > r2.len - 1.5 ? -1 : (rand() < 0.5 ? 1 : -1)); if (car && r2.c === 'motorway') a.dir = 1; a.cool = 4; return;
      }
    }
    if (end) { if (car) spawn(a, net, true); else { a.dir = -a.dir; a.s = Math.max(0, Math.min(r.len, s1)); a.cool = 4; } return; }
    a.s = s1;
  }
  function turn(a, target, rate) { if (a.ang === null) { a.ang = target; return; } var d = target - a.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; a.ang += d * Math.min(1, rate); }

  /* --- shapes --- */
  function part(w, h, l, x, y, z, c) { var g = new THREE.BoxGeometry(w, h, l).toNonIndexed(); g.translate(x, y, z); g.userData.c = col(c); return g; }
  function merge(list) {
    var P = [], N = [], C = [];
    list.forEach(function (g) { var p = g.attributes.position.array, n = g.attributes.normal.array, c = g.userData.c; for (var i = 0; i < p.length; i += 3) { P.push(p[i], p[i + 1], p[i + 2]); N.push(n[i], n[i + 1], n[i + 2]); C.push(c.r, c.g, c.b); } });
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return g;
  }
  var bodyG = merge([part(1.78, 0.62, 4.3, 0, 0.6, 0, '#ffffff'), part(1.6, 0.07, 2.0, 0, 1.52, -0.3, '#ffffff'), part(1.7, 0.12, 4.36, 0, 0.36, 0, '#3a3a3a')]);
  var trimG = merge([part(1.62, 0.58, 2.35, 0, 1.2, -0.3, '#2b3a47'), part(1.86, 0.62, 0.66, 0, 0.31, 1.35, '#17181a'), part(1.86, 0.62, 0.66, 0, 0.31, -1.35, '#17181a')]);
  var lightG = merge([part(0.42, 0.14, 0.06, 0.6, 0.72, 2.16, '#fff6d8'), part(0.42, 0.14, 0.06, -0.6, 0.72, 2.16, '#fff6d8'), part(0.42, 0.12, 0.06, 0.62, 0.76, -2.16, '#d8262a'), part(0.42, 0.12, 0.06, -0.62, 0.76, -2.16, '#d8262a')]);
  var CARCOL = ['#e9eaea', '#e9eaea', '#bfc3c6', '#bfc3c6', '#8d9296', '#2a2c30', '#2a2c30', '#4b4f55', '#27456f', '#8f2323', '#6f7f8f', '#3e5a48', '#b9a57a'].map(col);
  /* parked cars fill the mapped car parks in rows */
  var parked = [];
  polys.forEach(function (g, gi) {
    if (g.k !== 'parking' || parked.length > 420) return;
    var p = g.p, best = 0, ux = 1, uz = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length], l = Math.hypot(q.x - p[i].x, q.y - p[i].y); if (l > best) { best = l; ux = (q.x - p[i].x) / l; uz = (q.y - p[i].y) / l; } }
    var vx = -uz, vz = ux, u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    p.forEach(function (q) { var u = q.x * ux + q.y * uz, v = q.x * vx + q.y * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); });
    for (var v = v0 + 3, row = 0; v < v1 - 2.6; v += 5.6, row++) {
      if (row % 3 === 2) { v += 1; continue; }
      for (var u = u0 + 1.8; u < u1 - 1.5; u += 2.7) {
        if (rnd(gi * 31 + row * 7 + u) > 0.55) continue;
        var x = ux * u + vx * v, z = uz * u + vz * v, ok = !inBuilding(x, z);
        for (var m = 0; m < 4 && ok; m++) { var du = m & 1 ? 1 : -1, dv = m & 2 ? 2.3 : -2.3; if (!inRing(p, x + ux * du + vx * dv, z + uz * du + vz * dv)) ok = false; }
        if (ok) parked.push([x, z, Math.atan2(vx, vz) + (rnd(u + v) > 0.5 ? Math.PI : 0)]);
      }
    }
  });
  var NC = coarse ? 45 : 90, NP = coarse ? 70 : 150, TOTAL = NC + parked.length;
  var bodyM = new THREE.InstancedMesh(bodyG, new THREE.MeshLambertMaterial({ vertexColors: true }), TOTAL);
  var trimM = new THREE.InstancedMesh(trimG, new THREE.MeshLambertMaterial({ vertexColors: true }), TOTAL);
  var lightMat = new THREE.MeshBasicMaterial({ vertexColors: true }), lightM = new THREE.InstancedMesh(lightG, lightMat, NC);
  var d = new THREE.Object3D(); d.rotation.order = 'YXZ';
  function place(i, x, z, ang, sx, sy, sl, lit) {
    var y = hAt(x, z), fx = Math.sin(ang), fz = Math.cos(ang);
    d.position.set(x, y, z); d.rotation.set(-Math.atan2(hAt(x + fx * 2, z + fz * 2) - hAt(x - fx * 2, z - fz * 2), 4), ang, 0); d.scale.set(sx, sy, sl); d.updateMatrix();
    bodyM.setMatrixAt(i, d.matrix); trimM.setMatrixAt(i, d.matrix); if (lit) lightM.setMatrixAt(i, d.matrix);
  }
  var cars = [], o = {}, o2 = {};
  for (var i = 0; i < NC; i++) { var c = spawn({ v: 0, lane: rnd(i * 3.3) > 0.5 ? 1 : 0, sx: 0.95 + rnd(i) * 0.1, sy: 0.92 + rnd(i + 7) * (rnd(i * 5) > 0.8 ? 0.5 : 0.16), sl: 0.9 + rnd(i + 3) * 0.22, k: 0.85 + rnd(i * 9) * 0.3 }, carNet, true); cars.push(c); bodyM.setColorAt(i, CARCOL[Math.floor(rnd(i * 1.9 + 4) * CARCOL.length)]); }
  parked.forEach(function (q, j) { var i = NC + j; place(i, q[0], q[1], q[2], 0.95 + rnd(j) * 0.1, 0.92 + rnd(j + 7) * 0.16, 0.9 + rnd(j + 3) * 0.2, false); bodyM.setColorAt(i, CARCOL[Math.floor(rnd(j * 2.7 + 1) * CARCOL.length)]); });
  [bodyM, trimM, lightM].forEach(function (m) { m.frustumCulled = false; scene.add(m); });

  var torsoG = merge([part(0.4, 0.6, 0.22, 0, 1.17, 0, '#ffffff'), part(0.09, 0.54, 0.11, 0.25, 1.16, 0, '#ffffff'), part(0.09, 0.54, 0.11, -0.25, 1.16, 0, '#ffffff')]);
  var headG = merge([part(0.2, 0.24, 0.21, 0, 1.62, 0, '#ffffff'), part(0.22, 0.09, 0.23, 0, 1.73, -0.01, '#5a4636')]);
  var legG = merge([part(0.14, 0.86, 0.16, 0, -0.43, 0, '#ffffff')]);
  var pm = new THREE.MeshLambertMaterial({ vertexColors: true });
  var torsoM = new THREE.InstancedMesh(torsoG, pm, NP), headM = new THREE.InstancedMesh(headG, pm, NP), legM = new THREE.InstancedMesh(legG, pm, NP * 2);
  var COAT = ['#b33a2e', '#2f4f7f', '#2b2d31', '#d9d2c0', '#3f6b52', '#c79a3a', '#6b4a7a', '#7d8a93', '#1f6f7a', '#e6e3dc', '#44484e'].map(col), SKIN = ['#e8c4a2', '#d9a982', '#b98360', '#8a5a3c', '#f0d2b6'].map(col), LEG = ['#2a3142', '#33363b', '#4a5a78', '#5b5348', '#1f2023'].map(col);
  var people = [];
  for (i = 0; i < NP; i++) {
    people.push(spawn({ v: 1.05 + rnd(i * 2.1) * 0.55, side: rnd(i * 4.3) > 0.5 ? 1 : -1, h: rnd(i * 6.1) > 0.88 ? 0.66 + rnd(i) * 0.12 : 0.93 + rnd(i * 8.7) * 0.14, ph: rnd(i) * 6 }, pedNet, false));
    torsoM.setColorAt(i, COAT[Math.floor(rnd(i * 1.3 + 2) * COAT.length)]); headM.setColorAt(i, SKIN[Math.floor(rnd(i * 2.9 + 5) * SKIN.length)]);
    var lc = LEG[Math.floor(rnd(i * 3.7 + 8) * LEG.length)]; legM.setColorAt(i * 2, lc); legM.setColorAt(i * 2 + 1, lc);
  }
  [torsoM, headM, legM].forEach(function (m) { m.frustumCulled = false; scene.add(m); });

  function step(dt) {
    var i, a, r;
    for (i = 0; i < NC; i++) {
      a = cars[i]; r = R[a.r];
      var vmax = CAR[r.c] * a.k, toEnd = a.dir > 0 ? r.len - a.s : a.s; if (r.c !== 'motorway' && toEnd < 14) vmax = Math.min(vmax, 3 + toEnd * 0.4);
      for (var j = 0; j < NC; j++) { var b = cars[j]; if (b === a || b.r !== a.r || b.dir !== a.dir || b.lane !== a.lane) continue; var gap = (b.s - a.s) * a.dir; if (gap > 0 && gap < 16) vmax = Math.min(vmax, gap < 7 ? 0 : b.v); }
      a.v += Math.max(-9 * dt, Math.min(2.5 * dt, vmax - a.v)); if (a.v < 0) a.v = 0;
      if (dt) advance(a, a.v * dt, carNet, true);
      r = R[a.r]; at(a.r, a.s, o);
      var off = r.c === 'motorway' ? (a.lane ? 1.8 : -1.8) : (r.w >= 5 ? r.w * 0.24 : 0), fx = o.dx * a.dir, fz = o.dz * a.dir;
      turn(a, Math.atan2(fx, fz), dt ? dt * 5 : 1);
      place(i, o.x - fz * off, o.z + fx * off, a.ang, a.sx, a.sy, a.sl, true);
    }
    for (i = 0; i < NP; i++) {
      a = people[i]; if (dt) advance(a, a.v * dt, pedNet, false); r = R[a.r]; at(a.r, a.s, o);
      fx = o.dx * a.dir; fz = o.dz * a.dir; off = (r.w >= 4.5 ? r.w / 2 + 0.5 : r.w * 0.22) * a.side;
      var x = o.x - fz * off, z = o.z + fx * off, y = hAt(x, z); turn(a, Math.atan2(fx, fz), dt ? dt * 6 : 1); a.ph += a.v * dt * 4.2;
      var sw = Math.sin(a.ph) * 0.55, h = a.h;
      d.scale.set(h, h, h); d.position.set(x, y + Math.abs(Math.cos(a.ph)) * 0.03, z); d.rotation.set(0, a.ang, 0); d.updateMatrix(); torsoM.setMatrixAt(i, d.matrix); headM.setMatrixAt(i, d.matrix);
      var rx = Math.cos(a.ang) * 0.1 * h, rz = -Math.sin(a.ang) * 0.1 * h;
      d.position.set(x + rx, y + 0.87 * h, z + rz); d.rotation.set(sw, a.ang, 0); d.updateMatrix(); legM.setMatrixAt(i * 2, d.matrix);
      d.position.set(x - rx, y + 0.87 * h, z - rz); d.rotation.set(-sw, a.ang, 0); d.updateMatrix(); legM.setMatrixAt(i * 2 + 1, d.matrix);
    }
    bodyM.instanceMatrix.needsUpdate = trimM.instanceMatrix.needsUpdate = lightM.instanceMatrix.needsUpdate = torsoM.instanceMatrix.needsUpdate = headM.instanceMatrix.needsUpdate = legM.instanceMatrix.needsUpdate = true;
  }
  step(0);
  return { step: step, cars: cars, people: people, parked: parked.length, R: R, at: at, links: [carNet, pedNet].map(function (n) { return n.J.reduce(function (s, l) { return s + l.length; }, 0); }) };
})();

