/* ---------- buildings ---------- */
function extrude(buf, uvCell, ring, h, c, y0) {
  y0 = y0 || 0;
  for (var i = 0; i < ring.length; i++) {
    var a = ring[i], b = ring[(i + 1) % ring.length];
    buf.tri([a.x, y0, a.y], [b.x, y0, b.y], [b.x, h, b.y], c); buf.tri([a.x, y0, a.y], [b.x, h, b.y], [a.x, h, a.y], c);
  }
}
Buf.prototype.quv = function (a, b, y0, y1, c, u0, u1, v1) {
  this.v(a.x, y0, a.y, c, u0, 0); this.v(b.x, y0, b.y, c, u1, 0); this.v(b.x, y1, b.y, c, u1, v1);
  this.v(a.x, y0, a.y, c, u0, 0); this.v(b.x, y1, b.y, c, u1, v1); this.v(a.x, y1, a.y, c, u0, v1);
};
Buf.prototype.tuv = function (a, b, c, k, s) { /* triangle with uv from a function of position */
  for (var i = 0, q = [a, b, c]; i < 3; i++) { var uv = s(q[i]); this.v(q[i][0], q[i][1], q[i][2], k, uv[0], uv[1]); }
};
/* walls: windowed cells along long walls, plain cladding on stubs too short for a window */
function walls(buf, stub, stubRep, ring, y0, y1, c, cellW, cols, floors, start) {
  var d = start;
  for (var i = 0; i < ring.length; i++) {
    var a = ring[i], b = ring[(i + 1) % ring.length], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < cellW * 0.62) { stub.quv(a, b, y0, y1, c, 0, len / stubRep, (y1 - y0) / stubRep); continue; }
    var n = Math.max(1, Math.round(len / cellW)), u0 = (d % cols) / cols;
    buf.quv(a, b, y0, y1, c, u0, u0 + n / cols, floors / 4); d += n;
  }
}
var HOUSE = ['#8c3327', '#8c3327', '#9a3b2a', '#8c3327', '#dcb866', '#e9d59a', '#f0ece2', '#f0ece2', '#d9dad5', '#a9bb9d', '#96abb9', '#5f4334', '#cdb48e', '#3b3f44'].map(col);
var ROOF = ['#a8523a', '#a8523a', '#93452f', '#34363b', '#34363b', '#55585e', '#7f4030'].map(col);
var APT = ['#e2d5bd', '#d2bfa5', '#b0624f', '#ebe6da', '#d6cdb7', '#a35f51', '#c9cfd2'].map(col), APT_BRICK = { 2: 1, 5: 1 };
var PUB = ['#d3ab86', '#c4c5c2', '#ddd2ba', '#bda88d'].map(col);
var SHED = ['#8c3327', '#8c3327', '#5b5d60', '#d9dad5', '#5f4334', '#e9d59a'].map(col);
var FLAT = col('#5c5e63'), FLAT2 = col('#3f4145'), PLINTH = col('#8d8d88'), WHITE = col('#f1f0ea'), VENT = col('#9a9da0'), CHIM = [col('#8a5645'), col('#d8d4ca'), col('#4a4c50')];
var woodB = new Buf(), boardB = new Buf(), aptB = new Buf(), brickB = new Buf(), pubB = new Buf(), plainB = new Buf(), tileB = new Buf(), noUv = new Buf();
plainB.quv = function (a, b, y0, y1, c) { this.tri([a.x, y0, a.y], [b.x, y0, b.y], [b.x, y1, b.y], c); this.tri([a.x, y0, a.y], [b.x, y1, b.y], [a.x, y1, a.y], c); };
var BOARD = 1.16, TILE = 1.2;
function box(buf, cx, cz, ux, uz, hl, hw, y0, y1, c, top) {
  var vx = -uz, vz = ux, q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (s) { return new THREE.Vector2(cx + ux * hl * s[0] + vx * hw * s[1], cz + uz * hl * s[0] + vz * hw * s[1]); });
  extrude(buf, null, q, y1, c, y0); fillPoly(buf, q, null, y1, top || c);
}
function inRing(r, x, z) { var inn = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var a = r[i], b = r[j]; if ((a.y > z) !== (b.y > z) && x < (b.x - a.x) * (z - a.y) / (b.y - a.y) + a.x) inn = !inn; } return inn; }
var builds = [], GRID = 40, grid = {};
W.buildings.forEach(function (b, bi) {
  var ring = pts(b.p), s = b.s, t = b.t, wc, rc, lo = 1e9, mean = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, cxm = 0, czm = 0;
  ring.forEach(function (p) { var e = hAt(p.x, p.y); lo = Math.min(lo, e); mean += e / ring.length; cxm += p.x / ring.length; czm += p.y / ring.length;
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.y); z1 = Math.max(z1, p.y); });
  var y0 = lo - 0.6, h = mean + b.h / 10, top = h;
  var base = mean + (t === 2 ? 0.12 : (t === 0 ? 0.45 : 0.3)), fh = t === 0 ? 2.65 : (t === 3 ? 3.4 : 3.0), floors = Math.max(1, Math.round((h - base) / fh));
  extrude(plainB, null, ring, base, PLINTH, y0);
  if (t === 0) { wc = HOUSE[s % HOUSE.length]; rc = ROOF[(s >> 1) % ROOF.length]; walls(woodB, boardB, BOARD, ring, base, h, wc, 3.1, 8, floors, s % 8); }
  else if (t === 1) { var ai = s % APT.length; wc = APT[ai]; rc = ROOF[(s >> 2) % ROOF.length]; walls(APT_BRICK[ai] ? brickB : aptB, plainB, 1, ring, base, h, wc, 3.2, 4, floors, s % 4); }
  else if (t === 2) { wc = SHED[s % SHED.length]; rc = s % 3 ? FLAT2 : ROOF[s % ROOF.length]; walls(boardB, boardB, BOARD, ring, base, h, wc, 1e9, 1, 1, 0); }
  else { wc = PUB[s % PUB.length]; rc = FLAT; walls(pubB, plainB, 1, ring, base, h, wc, 3.4, 4, floors, s % 4); }
  if (b.r) {
    /* gabled roof on the footprint's bounding rectangle, eaves overhanging the walls */
    var cx = b.r[0] / 10, cz = b.r[1] / 10, hl = b.r[2] / 10, hw = b.r[3] / 10, a = b.r[4] / 1000, ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux;
    var steep = t === 2 ? 0.32 + (s % 4) * 0.05 : (b.h > 40 ? 0.5 + (s % 5) * 0.06 : 0.62 + (s % 5) * 0.07);
    var rise = Math.min(t === 0 ? 3.8 : (t === 2 ? 1.5 : 6), Math.max(0.5, hw * steep)), sl = rise / hw, ov = t === 2 ? 0.25 : 0.5, og = t === 2 ? 0.2 : 0.4;
    var P = function (i, j, y) { return [cx + ux * i + vx * j, y, cz + uz * i + vz * j]; };
    var ye = h - sl * ov, yr = h + rise, L = hl + og, Wd = hw + ov, run = Math.hypot(Wd, rise + sl * ov);
    [-1, 1].forEach(function (sd) {
      var A = P(-L, sd * Wd, ye), B2 = P(L, sd * Wd, ye), R0 = P(-L, 0, yr), R1 = P(L, 0, yr);
      [[A, 0, 0], [B2, 2 * L, 0], [R1, 2 * L, run], [A, 0, 0], [R1, 2 * L, run], [R0, 0, run]].forEach(function (q) { tileB.v(q[0][0], q[0][1], q[0][2], rc, q[1] / TILE, q[2] / TILE); });
      /* gable end, in the wall's cladding */
      var e = sd * hl, G = [P(e, -hw, h), P(e, hw, h), P(e, 0, yr)], gb = t === 3 ? plainB : boardB;
      if (gb === plainB) plainB.tri(G[0], G[1], G[2], wc); else [[0, -hw, 0], [1, hw, 0], [2, 0, rise]].forEach(function (q) { var g = G[q[0]]; boardB.v(g[0], g[1], g[2], wc, q[1] / BOARD, q[2] / BOARD); });
      /* white barge boards along the gable edge */
      if (t === 0) { var e2 = sd * (L + 0.02); [-1, 1].forEach(function (s2) { var p0 = P(e2, s2 * Wd, ye), p1 = P(e2, 0, yr), p2 = P(e2, 0, yr - 0.24), p3 = P(e2, s2 * Wd, ye - 0.24); plainB.tri(p0, p1, p2, WHITE); plainB.tri(p0, p2, p3, WHITE); }); }
    });
    if (t === 0 && s % 4 !== 0) { var ci = ((s % 7) / 7 - 0.5) * hl * 1.1, cj = ((s % 3) - 1) * hw * 0.3, q = P(ci, cj, 0); box(plainB, q[0], q[2], ux, uz, 0.32, 0.32, h, yr + 0.75, CHIM[s % 3], FLAT2); }
    top = h + rise * 0.5;
  } else if (b.k) {
    /* hipped roof built from height bands */
    var slope = b.k.s / 100, uvT = function (p) { return [(p[0] * 0.93 + p[2] * 0.37) / TILE, p[1] / (TILE * 0.62)]; };
    b.k.b.forEach(function (bd) {
      var o = pts(bd[1]), hs = bd[3].map(pts), all = o.slice(), no = o.length, ya = h + bd[0] / 10 * slope, yb = h + bd[2] / 10 * slope;
      hs.forEach(function (r) { all = all.concat(r); });
      var tr = THREE.ShapeUtils.triangulateShape(o, hs);
      for (var i = 0; i < tr.length; i++) { var V = tr[i].map(function (k) { return [all[k].x, k < no ? ya : yb, all[k].y]; }); tileB.tuv(V[0], V[1], V[2], rc, uvT); }
    });
    top = h + 1;
  } else {
    /* flat roof behind a parapet, with plant boxes on the bigger ones */
    var par = t === 2 ? 0.12 : 0.4;
    extrude(plainB, null, ring, h + par, wc, h); fillPoly(plainB, ring, null, h + (t === 2 ? 0.1 : 0.05), t === 2 ? FLAT2 : rc === FLAT ? FLAT : FLAT);
    if (t !== 2) for (var k = 0; k < 3; k++) {
      var px = cxm + (rnd(s + k * 5.1) - 0.5) * (x1 - x0) * 0.5, pz = czm + (rnd(s + k * 9.7 + 2) - 0.5) * (z1 - z0) * 0.5, ok = true;
      for (var m = 0; m < 4; m++) if (!inRing(ring, px + (m & 1 ? 2.4 : -2.4), pz + (m & 2 ? 2.4 : -2.4))) ok = false;
      if (ok) box(plainB, px, pz, 1, 0, 1.1 + rnd(s + k) * 0.9, 0.9, h, h + 1.1 + rnd(s * 3 + k) * 0.9, VENT, FLAT2);
    }
  }
  builds.push({ r: ring, x0: x0, x1: x1, z0: z0, z1: z1, h: top });
  for (var gx = Math.floor(x0 / GRID); gx <= Math.floor(x1 / GRID); gx++) for (var gz = Math.floor(z0 / GRID); gz <= Math.floor(z1 / GRID); gz++) {
    var gk = gx + ',' + gz; (grid[gk] || (grid[gk] = [])).push(bi);
  }
});

/* facade atlases: colour in rgb, and in alpha how far the wall's own paint colour tints that pixel
   (cladding takes the paint; window trim, glass, doors and balconies keep their own colour) */
function facade(kind, brick) {
  var cols = kind === 'wood' ? 8 : 4, CW = 128, TW = cols * CW, TH = 512;
  var cs = [0, 1, 2].map(function () { var c = document.createElement('canvas'); c.width = TW; c.height = TH; return c; });
  var A = cs[0].getContext('2d'), Mk = cs[1].getContext('2d'), E = cs[2].getContext('2d');
  function R(x, y, w, h, c, tint) { A.fillStyle = c; A.fillRect(x, y, w, h); Mk.fillStyle = tint ? '#fff' : '#000'; Mk.fillRect(x, y, w, h); }
  E.fillStyle = '#000'; E.fillRect(0, 0, TW, TH); R(0, 0, TW, TH, '#fff', 1);
  var x, y, i, j;
  if (kind === 'wood') for (x = 0; x < TW; x += 8) { R(x, 0, 1, TH, '#b9b9b9', 1); R(x + 1, 0, 1, TH, '#e4e4e4', 1); R(x + 7, 0, 1, TH, '#f0f0f0', 1); }
  else if (brick) { for (y = 0; y < TH; y += 4) { R(0, y, TW, 1, '#d8d0c4', 0); for (x = (y / 4 % 2) * 5; x < TW; x += 10) R(x, y + 1, 1, 3, '#d8d0c4', 0); } }
  else { for (i = 0; i < 900; i++) R(rnd(i) * TW, rnd(i + 0.5) * TH, 3, 2, rnd(i * 3) > 0.5 ? '#f2f2f2' : '#fbfbfb', 1); for (j = 1; j <= 4; j++) R(0, j * 128 - 2, TW, 1, '#e9e9e9', 1); }
  function glass(x, y, w, h, lit) {
    var g = A.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#93a9bb'); g.addColorStop(0.45, '#55687a'); g.addColorStop(1, '#3d4c5b');
    R(x, y, w, h, '#55687a', 0); A.fillStyle = g; A.fillRect(x, y, w, h);
    A.fillStyle = 'rgba(235,235,225,.5)'; A.fillRect(x, y, Math.min(7, w * 0.2), h); A.fillRect(x + w - Math.min(7, w * 0.2), y, Math.min(7, w * 0.2), h); /* curtains */
    if (lit > 0.5) { var e = E.createLinearGradient(0, y, 0, y + h), k = lit > 0.85 ? '#fff0c4' : (lit > 0.68 ? '#f8cf7c' : '#d69a4a'); e.addColorStop(0, k); e.addColorStop(1, '#8f5f2a'); E.fillStyle = e; E.fillRect(x, y, w, h); }
  }
  function win(cx, by, w, h, trim, tc, panes, bar, lit) {
    R(cx - w / 2 - trim, by - h - trim, w + 2 * trim, h + 2 * trim + (trim > 3 ? 2 : 0), tc, 0); glass(cx - w / 2, by - h, w, h, lit);
    for (var p = 1; p < panes; p++) { R(cx - w / 2 + w * p / panes - 1, by - h, 2, h, tc, 0); E.fillStyle = '#000'; E.fillRect(cx - w / 2 + w * p / panes - 1, by - h, 2, h); }
    if (bar) R(cx - w / 2, by - h + h * bar - 1, w, 2, tc, 0);
    A.fillStyle = 'rgba(0,0,0,.22)'; A.fillRect(cx - w / 2 - trim, by + trim + (trim > 3 ? 2 : 0), w + 2 * trim, 2);
  }
  for (i = 0; i < cols; i++) for (j = 0; j < 4; j++) {
    var cx = i * CW + CW / 2, by = j * 128 + 128, fl = 3 - j, r = rnd(i * 7.3 + j * 13.1 + (kind === 'wood' ? 3 : kind === 'apt' ? 11 : 19)), lit = rnd(i * 3.7 + j * 5.9 + 1.3);
    if (kind === 'wood') {
      if (fl === 0 && i === 3) { /* front door with porch light and step */
        R(cx - 25, by - 104, 50, 100, '#f4f3ee', 0); R(cx - 20, by - 99, 40, 95, '#35503f', 0); R(cx - 12, by - 90, 24, 30, '#55687a', 0); R(cx + 12, by - 50, 4, 3, '#d9c27a', 0);
        R(cx - 34, by - 5, 68, 5, '#9a9a94', 0); R(cx + 32, by - 96, 6, 8, '#2c2c2c', 0); E.fillStyle = '#ffe9b0'; E.fillRect(cx + 32, by - 90, 6, 4); E.fillStyle = '#c98f3f'; E.fillRect(cx - 12, by - 90, 24, 30);
      } else if (r < 0.2) { /* blank bay */ }
      else if (r < 0.42) win(cx, by - 40, 76, 56, 5, '#f4f3ee', 3, 0, lit);
      else if (r < 0.52 && fl > 0) win(cx, by - 52, 30, 30, 4, '#f4f3ee', 1, 0, lit);
      else win(cx, by - 40, 40, 58, 5, '#f4f3ee', 2, 0.3, lit);
    } else if (kind === 'apt') {
      if (fl === 0 && i === 1) { R(cx - 34, by - 108, 68, 108, '#3a3d42', 0); glass(cx - 29, by - 103, 27, 100, 0.9); glass(cx + 2, by - 103, 27, 100, 0.9); R(cx - 44, by - 116, 88, 7, '#6a6d72', 0); }
      else if (i % 2 === 1 && fl > 0) { /* balcony bay: glazed door, window, railing */
        R(cx - 44, by - 106, 30, 100, '#eceae4', 0); glass(cx - 40, by - 102, 22, 94, lit); win(cx + 18, by - 44, 44, 54, 3, '#eceae4', 2, 0, lit);
        A.fillStyle = 'rgba(0,0,0,.28)'; A.fillRect(cx - 54, by - 6, 108, 5);
        R(cx - 54, by - 50, 108, 44, brick ? '#d9d6cf' : '#b9bdc0', 0); R(cx - 54, by - 53, 108, 4, '#6f7377', 0); for (x = -42; x < 54; x += 12) R(cx + x, by - 49, 1, 43, 'rgba(0,0,0,.14)', 0);
        E.fillStyle = '#000'; E.fillRect(cx - 54, by - 53, 108, 48);
      } else if (r < 0.12) { /* blank */ }
      else win(cx, by - 42, 62, 60, 3, '#eceae4', 2, 0, lit);
    } else {
      if (fl === 0 && i === 2) { R(cx - 40, by - 110, 80, 110, '#3a3d42', 0); glass(cx - 35, by - 105, 33, 102, 0.9); glass(cx + 2, by - 105, 33, 102, 0.9); R(cx - 52, by - 120, 104, 8, '#6a6d72', 0); }
      else win(cx, by - 36, 104, 62, 3, '#43464b', 4, 0, lit > 0.7 ? lit : 0);
    }
  }
  var a = A.getImageData(0, 0, TW, TH).data, m = Mk.getImageData(0, 0, TW, TH).data, o = new Uint8Array(TW * TH * 4);
  for (y = 0; y < TH; y++) for (x = 0; x < TW; x++) { var sI = (y * TW + x) * 4, dI = ((TH - 1 - y) * TW + x) * 4; o[dI] = a[sI]; o[dI + 1] = a[sI + 1]; o[dI + 2] = a[sI + 2]; o[dI + 3] = m[sI]; }
  var tex = new THREE.DataTexture(o, TW, TH, THREE.RGBAFormat), em = new THREE.CanvasTexture(cs[2]);
  [tex, em].forEach(function (q) { q.wrapS = q.wrapT = THREE.RepeatWrapping; q.generateMipmaps = true; q.minFilter = THREE.LinearMipmapLinearFilter; q.magFilter = THREE.LinearFilter; q.anisotropy = 8; q.needsUpdate = true; });
  return [tex, em];
}
function strip(draw) { var c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
var boardTex = strip(function (c) { c.fillStyle = '#fff'; c.fillRect(0, 0, 64, 64); for (var x = 0; x < 64; x += 8) { c.fillStyle = '#b9b9b9'; c.fillRect(x, 0, 1, 64); c.fillStyle = '#e4e4e4'; c.fillRect(x + 1, 0, 1, 64); } });
var tileTex = strip(function (c) {
  for (var r = 0; r < 4; r++) { var g = c.createLinearGradient(0, r * 16, 0, r * 16 + 16); g.addColorStop(0, '#8f8f8f'); g.addColorStop(0.18, '#ffffff'); g.addColorStop(1, '#d2d2d2'); c.fillStyle = g; c.fillRect(0, r * 16, 64, 16);
    for (var x = (r % 2) * 4; x < 64; x += 8) { c.fillStyle = 'rgba(0,0,0,.13)'; c.fillRect(x, r * 16, 1, 16); } }
});
var wallMats = [];
function wallMat(tx) {
  var m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map: tx[0], emissiveMap: tx[1], emissive: 0xffffff, emissiveIntensity: 0 });
  m.onBeforeCompile = function (sh) { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.rgb *= mix( vec3( 1.0 ), vColor, diffuseColor.a ); diffuseColor.a = 1.0;'); };
  wallMats.push(m); return m;
}
var plainMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
[[woodB, wallMat(facade('wood'))], [aptB, wallMat(facade('apt'))], [brickB, wallMat(facade('apt', true))], [pubB, wallMat(facade('pub'))],
  [boardB, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map: boardTex })],
  [tileB, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map: tileTex })], [plainB, plainMat]].forEach(function (a) {
  if (!a[0].p.length) return; var m = new THREE.Mesh(a[0].geo(), a[1]); m.frustumCulled = false; scene.add(m);
});

