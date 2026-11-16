/* ---------- sound: everything is synthesised, nothing is downloaded ---------- */
var sound = (function () {
  var ctx = null, on = false, master, L = {}, tick = 0, bird = 1, mwD = 9999, near = 0, lastT = null, trainV = 0, clack = 0;
  function noise(brown) {
    var n = ctx.sampleRate * 3, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  function loop(buf, type, freq, q) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = buf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(master); s.start(); return { f: f, g: g };
  }
  function to(node, v, tc) { node.setTargetAtTime(v, ctx.currentTime, tc || 0.4); }
  function start() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    var white = noise(false), brown = noise(true);
    L.wind = loop(white, 'bandpass', 380, 0.5); L.road = loop(brown, 'lowpass', 300, 0.4); L.tyre = loop(white, 'bandpass', 1100, 0.6);
    L.train = loop(brown, 'lowpass', 220, 0.8); L.rail = loop(white, 'bandpass', 2400, 2.5); L.rain = loop(white, 'highpass', 2600, 0.3);
    return true;
  }
  function blip(f0, f1, dur, vol, pan, when, type) {
    var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + (when || 0); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var out = g; if (ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    o.connect(g); out.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function birdsong(quiet) {
    var kind = Math.random(), pan = Math.random() * 2 - 1, vol = (0.018 + Math.random() * 0.03) * quiet, f = 2400 + Math.random() * 2600, n, i;
    if (kind < 0.4) { n = 2 + Math.floor(Math.random() * 4); for (i = 0; i < n; i++) blip(f * (1 + 0.12 * (i % 2)), f * 1.25, 0.07, vol, pan, i * 0.11); }          /* tit: two-note see-saw */
    else if (kind < 0.75) { n = 3 + Math.floor(Math.random() * 5); for (i = 0; i < n; i++) blip(f * (0.8 + Math.random() * 0.5), f * (0.8 + Math.random() * 0.6), 0.09 + Math.random() * 0.08, vol, pan, i * 0.16); } /* blackbird-ish phrase */
    else { for (i = 0; i < 6; i++) blip(f * 1.3, f * 0.9, 0.035, vol * 0.8, pan, i * 0.055); }                                                                    /* quick trill */
  }
  function step(dt) {
    if (!on || !ctx) return;
    var g = hAt(me.x, me.z), alt = Math.max(0, me.y - g), ground = 1 / (1 + alt / 110);
    tick -= dt;
    if (tick <= 0) {
      tick = 0.4; var n = nearestRoad(me.x, me.z, function (r) { return r.c === 'motorway'; }, 800); mwD = n ? n.d : 9999;
      near = 0; var o = {}; traffic.cars.forEach(function (c) { if (c.v < 1) return; traffic.at(c.r, c.s, o); var d = Math.hypot(o.x - me.x, o.z - me.z); if (d < 70) near += (1 - d / 70) * Math.min(1, c.v / 10); });
    }
    var night = sunEl < -2 ? 0.45 : 1, muffle = weatherNow === 'snow' || seasonNow === 'winter' ? 0.7 : 1;
    to(L.wind.g.gain, (0.035 + Math.min(0.16, alt / 500) + Math.min(0.1, me.speed / 400) + (weatherNow === 'rain' ? 0.03 : 0)) * (0.8 + 0.3 * Math.sin(performance.now() / 2300)), 0.8);
    to(L.wind.f.frequency, 320 + Math.min(500, me.speed * 6) + 90 * Math.sin(performance.now() / 3700), 0.8);
    to(L.road.g.gain, (Math.pow(Math.max(0, 1 - mwD / 800), 2) * 0.5 * night + Math.min(0.25, near * 0.12)) * ground * muffle);
    to(L.tyre.g.gain, (Math.pow(Math.max(0, 1 - mwD / 260), 2) * 0.05 * night + Math.min(0.06, near * 0.03)) * ground * muffle * (weatherNow === 'rain' ? 2 : 1));
    var tp = train.pos(), td = Math.hypot(tp.x - me.x, tp.z - me.z); if (lastT && dt > 0) trainV = trainV * 0.8 + 0.2 * Math.hypot(tp.x - lastT[0], tp.z - lastT[1]) / dt; lastT = [tp.x, tp.z];
    var tg = Math.pow(Math.max(0, 1 - td / 320), 2) * Math.min(1, trainV / 9) * ground;
    to(L.train.g.gain, tg * 0.7, 0.3); to(L.rail.g.gain, tg * 0.035, 0.3);
    if (tg > 0.02) { clack -= dt * trainV; if (clack <= 0) { clack = 17; blip(160, 70, 0.06, tg * 0.25, 0, 0, 'triangle'); blip(150, 60, 0.06, tg * 0.2, 0, 0.09, 'triangle'); } }   /* wheels over rail joints */
    to(L.rain.g.gain, weatherNow === 'rain' ? 0.11 : 0, 0.6);
    bird -= dt;
    if (bird <= 0) {
      var day = sunEl > -4 && weatherNow !== 'rain' && weatherNow !== 'snow', dawn = sunEl < 12 ? 1.6 : 1;
      if (day && ground > 0.25) birdsong(ground * (seasonNow === 'winter' ? 0.6 : 1));
      bird = (seasonNow === 'winter' ? 3 + Math.random() * 7 : (0.5 + Math.random() * 2.6)) / dawn;
    }
  }
  function set(v) {
    if (v && !ctx && !start()) return false;
    on = v; if (ctx) { if (v && ctx.state === 'suspended') ctx.resume(); to(master.gain, v ? 0.9 : 0, 0.25); }
    return true;
  }
  document.addEventListener('visibilitychange', function () { if (ctx && on) { if (document.hidden) ctx.suspend(); else ctx.resume(); } });
  return { step: step, set: set, isOn: function () { return on; } };
})();
$('snd').addEventListener('click', function () { var v = !sound.isOn(); if (!sound.set(v)) { this.textContent = 'No sound here'; this.disabled = true; return; } this.setAttribute('aria-pressed', v ? 'true' : 'false'); this.textContent = v ? 'Sound on' : 'Sound off'; });

