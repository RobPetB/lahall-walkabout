/* ---------- seasons and weather ---------- */
var SEASONS = { summer: { decl: 18, noon: 13 }, autumn: { decl: -9, noon: 13 }, winter: { decl: -21, noon: 12 } };
var WEATHERS = { clear: { dim: 1, fog: 1, tint: null }, rain: { dim: 0.72, fog: 0.5, tint: [0.95, 1, 1.06, 0.85] }, fog: { dim: 0.95, fog: 0.1, tint: [1, 1, 1.02, 0.9] }, snow: { dim: 0.92, fog: 0.3, tint: [1, 1.01, 1.04, 0.9] } };
var weatherNow = 'clear';
var precip = (function () {
  var N = (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 2500 : 6000, B = 90, Hh = 55, base = new Float32Array(N * 3);
  for (var i = 0; i < N * 3; i += 3) { base[i] = rnd(i) * B; base[i + 1] = rnd(i + 1.3) * Hh; base[i + 2] = rnd(i + 2.7) * B; }
  var c = document.createElement('canvas'); c.width = c.height = 32; var x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  var snow = new THREE.Points(sg, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: 0.22, transparent: true, opacity: 0.95, depthWrite: false, color: '#ffffff' }));
  var rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  var rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#c3d0dc', transparent: true, opacity: 0.42, depthWrite: false }));
  snow.frustumCulled = rain.frustumCulled = false; snow.visible = rain.visible = false; scene.add(snow); scene.add(rain);
  var t = 0;
  function wrap(v, m) { return ((v % m) + m) % m; }
  return { step: function (dt) {
    if (!snow.visible && !rain.visible) return; t += dt;
    var isSnow = snow.visible, a = (isSnow ? sg : rg).attributes.position, P = a.array, sp = isSnow ? 1.6 : 19, cx = me.x - B / 2, cz = me.z - B / 2, cy = me.y - Hh * 0.45;
    for (var i = 0, j = 0; i < N * 3; i += 3) {
      var sway = isSnow ? Math.sin(t * 0.7 + i) * 0.6 : 0, px = cx + wrap(base[i] + sway + t * (isSnow ? 0.5 : 1.5) - cx, B), py = cy + wrap(base[i + 1] - t * sp * (0.8 + (i % 7) * 0.06) - cy, Hh), pz = cz + wrap(base[i + 2] + sway * 0.7 - cz, B);
      if (isSnow) { P[i] = px; P[i + 1] = py; P[i + 2] = pz; } else { P[j++] = px; P[j++] = py; P[j++] = pz; P[j++] = px + 0.06; P[j++] = py + 0.85; P[j++] = pz; }
    }
    a.needsUpdate = true;
  }, set: function (kind) { snow.visible = kind === 'snow'; rain.visible = kind === 'rain'; if (snow.visible || rain.visible) this.step(0.001); } };
})();
function setWeather(name, keepSeason) {
  weatherNow = name; var w = WEATHERS[name]; weather.dim = w.dim; weather.fog = w.fog; weather.tint = w.tint;
  precip.set(name); groundMats.forEach(function (m) { m.color.setScalar(name === 'rain' ? 0.8 : 1); });
  if (name === 'snow' && seasonNow !== 'winter' && !keepSeason) setSeason('winter'); else applySky(true);
  [].forEach.call($('weathers').children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === name ? 'true' : 'false'); });
}
function setSeason(name) {
  seasonNow = name; SEASON.decl = SEASONS[name].decl; SEASON.noon = SEASONS[name].noon; snowU.value = name === 'winter' ? 1 : 0;
  repaintGround(); dressTrees();
  if (name !== 'winter' && weatherNow === 'snow') setWeather('clear'); else applySky(true);
  [].forEach.call($('seasons').children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === name ? 'true' : 'false'); });
}
$('seasons').addEventListener('click', function (e) { var v = e.target.getAttribute && e.target.getAttribute('data-v'); if (v) setSeason(v); });
$('weathers').addEventListener('click', function (e) { var v = e.target.getAttribute && e.target.getAttribute('data-v'); if (v) setWeather(v); });

