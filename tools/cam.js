// usage: node cam.js <dir> name:x,z,dist,up,bearingDeg[,dark] ...   (camera looks at x,z from `dist` away on bearing, `up` metres above ground there)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const c = await b.newContext({ viewport: { width: 1280, height: 760 } }); const p = await c.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(20000);
  for (const spec of process.argv.slice(3)) {
    const [name, rest] = spec.split(':'); const q = rest.split(',');
    if (q[5] && q[5] !== 'js') await p.evaluate(h => { document.getElementById('tod').value = h; document.getElementById('tod').dispatchEvent(new Event('input')); }, q[5]);
    if (q[6]) await p.evaluate(v => { const a = v.split('/'); if (a[0]) window.__lahall.setSeason(a[0]); if (a[1]) window.__lahall.setWeather(a[1]); }, q[6]);
    if (q[5] === 'js') { console.log(name, JSON.stringify(await p.evaluate(q.slice(6).join(',')))); }
    await p.evaluate(q => { const L = window.__lahall, x = +q[0], z = +q[1], d = +q[2], up = +q[3], br = +q[4] * Math.PI / 180; L.setMode('fly');
      L.me.x = x - Math.sin(br) * d; L.me.z = z + Math.cos(br) * d; L.me.y = L.hAt(x, z) + up; L.me.yaw = Math.atan2(-Math.sin(br), Math.cos(br)); L.me.pitch = -Math.atan2(up - 1.5, d); L.me.speed = 0; }, q);
    await p.waitForTimeout(900); await p.screenshot({ path: process.argv[2] + '/' + name + '.png' });
  }
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
