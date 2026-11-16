/* ---------- bridges and the ramps up to them ---------- */
var deckSegs = [], deckGrid = {};
(function () {
  var db = new Buf(), ASPH = col('#74777b'), MWAY = col('#63666b'), WALKC = col('#c3c0b8'), CONCR = col('#a8a59d'), DARK = col('#7d7a74'), RAIL = col('#cfd2d4'), PATHC = col('#c9bda2');
  function quad(a, b, c, d, k) { db.tri(a, b, c, k); db.tri(a, c, d, k); }
  roads.forEach(function (r) {
    if (!r.z) return;
    var p = r.p, n = p.length, w = RW[r.c] || 3, half = w / 2 + (PAVE[r.c] ? WALK : 0.35), top = r.c === 'motorway' ? MWAY : (RORDER.indexOf(r.c) < 5 ? PATHC : ASPH), S = [];
    for (var i = 0; i < n; i++) {
      var a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)], dx = b.x - a.x, dz = b.y - a.y, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, lf = r.z[i] / 10, y = hAt(p[i].x, p[i].y) + lf + 0.09;
      S.push({ x: p[i].x, z: p[i].y, nx: nx, nz: nz, y: y, lf: lf });
    }
    for (i = 1; i < n; i++) {
      var A = S[i - 1], B = S[i]; if (A.lf < 0.12 && B.lf < 0.12) continue;
      var P = function (s, o, dy) { return [s.x + s.nx * o, s.y + (dy || 0), s.z + s.nz * o]; }, G = function (s, o) { var x = s.x + s.nx * o, z = s.z + s.nz * o; return [x, Math.min(s.y, hAt(x, z)) - 0.4, z]; };
      quad(P(A, -w / 2), P(B, -w / 2), P(B, w / 2), P(A, w / 2), top);
      if (PAVE[r.c]) { quad(P(A, -half, 0.1), P(B, -half, 0.1), P(B, -w / 2, 0.1), P(A, -w / 2, 0.1), WALKC); quad(P(A, w / 2, 0.1), P(B, w / 2, 0.1), P(B, half, 0.1), P(A, half, 0.1), WALKC); }
      [-1, 1].forEach(function (sd) {
        var o = sd * half, lowA = r.b === 1 ? P(A, o, -1.1) : G(A, o), lowB = r.b === 1 ? P(B, o, -1.1) : G(B, o);
        quad(lowA, lowB, P(B, o, 0.1), P(A, o, 0.1), r.b === 1 ? DARK : CONCR);
        if (A.lf > 0.7 || B.lf > 0.7) quad(P(A, o, 0.1), P(B, o, 0.1), P(B, o, 1.15), P(A, o, 1.15), RAIL);
      });
      if (r.b === 1) quad(P(A, -half, -1.1), P(B, -half, -1.1), P(B, half, -1.1), P(A, half, -1.1), DARK);
      var seg = { ax: A.x, az: A.z, bx: B.x, bz: B.z, ya: A.y, yb: B.y, half: half + 0.4 }, si = deckSegs.push(seg) - 1;
      for (var gx = Math.floor((Math.min(A.x, B.x) - half) / 30); gx <= Math.floor((Math.max(A.x, B.x) + half) / 30); gx++) for (var gz = Math.floor((Math.min(A.z, B.z) - half) / 30); gz <= Math.floor((Math.max(A.z, B.z) + half) / 30); gz++) { var key = gx + ',' + gz; (deckGrid[key] || (deckGrid[key] = [])).push(si); }
    }
    if (r.b === 1) { /* abutments, and a pier under the middle of a long span */
      var at = [0, n - 1]; if (n > 7) at.push(Math.floor(n / 2));
      at.forEach(function (i, q) {
        var s = S[i], th = q < 2 ? 1.6 : 0.7, wd = q < 2 ? half : half * 0.7, ux = -s.nz, uz = s.nx, g = hAt(s.x, s.z) - 0.5, sh = q === 0 ? th : (q === 1 ? -th : 0);
        var c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (e) { return new THREE.Vector2(s.x + ux * (sh + e[0] * th) + s.nx * wd * e[1], s.z + uz * (sh + e[0] * th) + s.nz * wd * e[1]); });
        extrude(db, null, c, s.y - 1.0, CONCR, g);
      });
    }
  });
  if (db.p.length) { var m = new THREE.Mesh(db.geo(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.frustumCulled = false; scene.add(m); }
})();
/* the surface you stand on: a bridge deck if you are on it, otherwise the ground */
function standY(x, z, feet) {
  var g = hAt(x, z), L = deckGrid[Math.floor(x / 30) + ',' + Math.floor(z / 30)]; if (!L) return g;
  var best = g;
  for (var i = 0; i < L.length; i++) {
    var s = deckSegs[L[i]], ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez || 1, t = ((x - s.ax) * ex + (z - s.az) * ez) / l2; if (t < -0.02 || t > 1.02) continue;
    t = Math.max(0, Math.min(1, t)); if (Math.hypot(s.ax + ex * t - x, s.az + ez * t - z) > s.half) continue;
    var y = s.ya + (s.yb - s.ya) * t; if (y > best && feet > y - 1.6) best = y;
  }
  return best;
}

