/* ---------- time of day: the sun's real path over Täby, sky, light and shadows ---------- */
var LAT = 59.424 * Math.PI / 180, SEASON = { decl: 18, noon: 13 };
/* looks keyed to the sun's height above the horizon, in degrees */
var LOOKS = [
  { e: -14, top: '#060a1a', mid: '#0d1430', hor: '#1a2342', fog: '#121830', far: 2400, hemiS: '#5a6ca8', hemiG: '#1a1c2c', hemiI: 0.40, sun: '#a9bcff', sunI: 0.14, win: 1, lamp: '#ffe2a6' },
  { e: -5, top: '#0f1736', mid: '#2a3566', hor: '#8a5f78', fog: '#33375a', far: 2700, hemiS: '#6878b8', hemiG: '#24263c', hemiI: 0.60, sun: '#b6bdea', sunI: 0.12, win: 1, lamp: '#ffe2a6' },
  { e: 1.5, top: '#1c2650', mid: '#4a5488', hor: '#e79a6a', fog: '#4f5078', far: 3000, hemiS: '#7686c2', hemiG: '#2c2e46', hemiI: 0.80, sun: '#ff9d6b', sunI: 0.34, win: 1, lamp: '#ffe2a6' },
  { e: 8, top: '#4f86c6', mid: '#a8c4e0', hor: '#f6dcb8', fog: '#d8d6cf', far: 3600, hemiS: '#fff3e2', hemiG: '#8a917c', hemiI: 0.70, sun: '#ffd49c', sunI: 0.56, win: 0, lamp: '#d9d9d2' },
  { e: 22, top: '#5f9bd6', mid: '#a9cdea', hor: '#dfeaf0', fog: '#d3e2ea', far: 4200, hemiS: '#ffffff', hemiG: '#8f9a84', hemiI: 0.78, sun: '#fff1d6', sunI: 0.62, win: 0, lamp: '#d9d9d2' }
];
var COLK = ['top', 'mid', 'hor', 'fog', 'hemiS', 'hemiG', 'sun', 'lamp'], NUMK = ['far', 'hemiI', 'sunI', 'win'];
LOOKS.forEach(function (k) { COLK.forEach(function (c) { k[c] = col(k[c]); }); });
var look = { }, weather = { dim: 1, fog: 1, tint: null }; COLK.forEach(function (c) { look[c] = new THREE.Color(); });
var tod = 15, todOverride = null, skyNow = null, sunDir = new THREE.Vector3(0, 1, 0), lightDir = new THREE.Vector3(0, 1, 0), sunEl = 40, playing = false;
function themeSky() {
  var t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return 'dusk'; if (t === 'light') return 'day';
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dusk' : 'day';
}
function sunsetHour() { var c = -Math.tan(LAT) * Math.tan(SEASON.decl * Math.PI / 180); return SEASON.noon + Math.acos(Math.max(-1, Math.min(1, c))) * 12 / Math.PI; }
var sunMesh = new THREE.Mesh(new THREE.SphereGeometry(170, 16, 10), new THREE.MeshBasicMaterial({ fog: false, depthWrite: false })); sunMesh.renderOrder = -99; scene.add(sunMesh);
var moonMesh = new THREE.Mesh(new THREE.SphereGeometry(120, 16, 10), new THREE.MeshBasicMaterial({ color: '#e8ecf5', fog: false, depthWrite: false })); moonMesh.renderOrder = -99; scene.add(moonMesh);
var MOON = new THREE.Vector3(0.45, 0.55, 0.7).normalize();
function fmtTime(t) { t = ((t % 24) + 24) % 24; var h = Math.floor(t), m = Math.round((t - h) * 60); if (m === 60) { h = (h + 1) % 24; m = 0; } return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
function applySky(force) {
  tod = todOverride !== null ? todOverride : (themeSky() === 'dusk' ? sunsetHour() - 0.15 : Math.min(15, SEASON.noon + 1.5));
  var H = (tod - SEASON.noon) * Math.PI / 12, d = SEASON.decl * Math.PI / 180;
  var sinEl = Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(H), el = Math.asin(sinEl), az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(d) * Math.cos(LAT)) + Math.PI;
  sunEl = el * 180 / Math.PI; sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
  var i = 0; while (i < LOOKS.length - 2 && sunEl > LOOKS[i + 1].e) i++;
  var A = LOOKS[i], B = LOOKS[i + 1], t = Math.max(0, Math.min(1, (sunEl - A.e) / (B.e - A.e)));
  COLK.forEach(function (c) { look[c].copy(A[c]).lerp(B[c], t); }); NUMK.forEach(function (c) { look[c] = A[c] + (B[c] - A[c]) * t; });
  if (weather.tint) { ['top', 'mid', 'hor', 'fog'].forEach(function (c) { var g = (look[c].r + look[c].g + look[c].b) / 3 * weather.dim; look[c].lerp(new THREE.Color(g * weather.tint[0], g * weather.tint[1], g * weather.tint[2]), weather.tint[3]); }); }
  var pos = skyGeo.attributes.position, ca = skyGeo.attributes.color, tc = new THREE.Color(), hx = sunDir.x, hz = sunDir.z, hl = Math.hypot(hx, hz) || 1, glowAmt = Math.max(0, 1 - Math.abs(sunEl - 1) / 9) * (weather.tint ? 1 - weather.tint[3] : 1);
  for (var k = 0; k < pos.count; k++) {
    var h = Math.max(0, pos.getY(k) / 8000);
    if (h < 0.22) tc.copy(look.hor).lerp(look.mid, h / 0.22); else tc.copy(look.mid).lerp(look.top, Math.min(1, (h - 0.22) / 0.6));
    if (glowAmt > 0) { var w = Math.max(0, (pos.getX(k) * hx + pos.getZ(k) * hz) / (8000 * hl)); tc.lerp(look.hor, Math.max(0, 0.55 - h * 2.2) * w * glowAmt); }
    ca.setXYZ(k, tc.r, tc.g, tc.b);
  }
  ca.needsUpdate = true;
  scene.fog.color.copy(look.fog); scene.fog.far = look.far * weather.fog; scene.fog.near = weather.fog < 0.5 ? 20 : 300; renderer.setClearColor(look.fog);
  hemi.color.copy(look.hemiS); hemi.groundColor.copy(look.hemiG); hemi.intensity = look.hemiI * (0.75 + 0.25 * weather.dim);
  /* below the horizon the moon takes over as the light that casts shadows */
  var night = sunEl < -1.5; lightDir.copy(night ? MOON : sunDir); if (!night && lightDir.y < 0.07) { lightDir.y = 0.07; lightDir.normalize(); }
  sun.color.copy(look.sun); sun.intensity = look.sunI * (weather.tint ? Math.max(0.12, 1 - weather.tint[3] * 1.1) : 1) * (night ? 1 : Math.min(1, Math.max(0.25, (sunEl + 1.5) / 5)));
  sunMesh.visible = sunEl > -3 && !weather.tint; sunMesh.material.color.copy(look.sun).lerp(col('#ffffff'), 0.45); moonMesh.visible = sunEl < 2 && !weather.tint;
  wallMats.forEach(function (m) { m.emissiveIntensity = look.win * 0.95; }); train.band.emissiveIntensity = look.win;
  lampHead.color.copy(look.lamp); glow.visible = look.win > 0.35;
  var name = look.win > 0.5 ? 'dusk' : 'day';
  if (todOverride !== null) app.setAttribute('data-sky', name); else app.removeAttribute('data-sky');
  $('sky').textContent = fmtTime(tod); $('tod').value = tod; $('tod').setAttribute('aria-valuetext', fmtTime(tod));
  if (name !== skyNow || force) { skyNow = name; drawMapBase(); }
}
/* shadows: one shadow map that follows where you are looking, wider the higher you fly */
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
var SHRES = (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 2048 : 4096;
sun.castShadow = true; sun.shadow.mapSize.set(SHRES, SHRES); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06; scene.add(sun.target);
scene.traverse(function (o) { if (!o.isMesh || o === skyMesh || o === sunMesh || o === moonMesh) return; o.receiveShadow = true; if (!o.userData.ground) o.castShadow = true; });
var shHalf = 0;
function updateShadow() {
  var g = hAt(me.x, me.z), alt = Math.max(0, me.y - g), half = Math.max(110, Math.min(900, 90 + alt * 2.2)), ahead = Math.min(half * 0.7, 40 + alt * 1.2);
  var step = half * 2 / SHRES * 8, tx = Math.round((me.x - Math.sin(me.yaw) * ahead) / step) * step, tz = Math.round((me.z - Math.cos(me.yaw) * ahead) / step) * step;
  sun.target.position.set(tx, g, tz); sun.position.set(tx + lightDir.x * 900, g + lightDir.y * 900, tz + lightDir.z * 900);
  if (Math.abs(half - shHalf) > shHalf * 0.08) { shHalf = half; var c = sun.shadow.camera; c.left = c.bottom = -half; c.right = c.top = half; c.near = 50; c.far = 2200; c.updateProjectionMatrix(); sun.shadow.normalBias = 0.05 + half / 2500; }
  sunMesh.position.set(me.x + sunDir.x * 7400, sunDir.y * 7400, me.z + sunDir.z * 7400); moonMesh.position.set(me.x + MOON.x * 7400, MOON.y * 7400, me.z + MOON.z * 7400);
}
function setTime(t) { todOverride = ((t % 24) + 24) % 24; applySky(); }
$('sky').addEventListener('click', function () { var p = $('scene'), open = p.hidden; p.hidden = !open; $('sky').setAttribute('aria-expanded', open ? 'true' : 'false'); if (open) $('tod').focus(); else canvas.focus(); });
$('tod').addEventListener('input', function () { playing = false; $('play').setAttribute('aria-pressed', 'false'); setTime(parseFloat(this.value)); });
$('play').addEventListener('click', function () { playing = !playing; this.setAttribute('aria-pressed', playing ? 'true' : 'false'); if (playing && todOverride === null) todOverride = tod; });
new MutationObserver(function () { todOverride = null; playing = false; $('play').setAttribute('aria-pressed', 'false'); applySky(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { if (todOverride === null) applySky(); }); }

