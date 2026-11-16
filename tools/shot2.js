const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const TG = JSON.parse(require('fs').readFileSync(__dirname + '/targets.json'));
  const views = [['b-dusk', 0, 0, 24, 5, 'dark'], ['b-aptdusk', 1, 0, 45, 14, 'dark']];
  for (const v of views) {
    const c = await b.newContext({ viewport: { width: 1280, height: 760 }, colorScheme: v[6] }); const p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(v[0] + ': ' + m.text()); });
    await p.addInitScript(t => { window.__targets = t; }, TG); p.on('pageerror', e => errs.push(v[0] + ': ' + e.message));
    await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
    await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(5000);
    await p.evaluate(v => { const L = window.__lahall; L.setMode('fly'); const T = window.__targets[v[1]][v[2]]; window.__set = () => { L.me.x = T[0] - v[3] * 0.72; L.me.z = T[1] + v[3] * 0.69; L.me.y = T[2] + v[4]; L.me.yaw = Math.atan2(-0.72, 0.69); L.me.pitch = -Math.atan2(v[4] - 3, v[3]); L.me.speed = 0; }; window.__set(); }, v);
    if (v[5] === 'dark') await p.click('#sky');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: process.argv[2] + '/' + v[0] + '.png' }); await c.close();
  }
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
