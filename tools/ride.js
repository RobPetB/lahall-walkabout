const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(7000);
  await p.evaluate(() => { const L = window.__lahall; L.setMode('fly'); L.me.x = 150; L.me.z = -60; });
  for (const m of ['drive', 'bike', 'train']) {
    await p.evaluate(m => { document.getElementById('m-' + m).click(); document.getElementById('c') && document.getElementById('c').focus(); }, m); await p.waitForTimeout(600);
    await p.keyboard.down('w'); await p.waitForTimeout(5000); await p.keyboard.down('d'); await p.waitForTimeout(1200); await p.keyboard.up('d'); await p.keyboard.up('w');
    console.log(m, await p.evaluate(() => { const L = window.__lahall; return L.me.mode + ' speed ' + L.me.speed.toFixed(1) + ' at ' + L.me.x.toFixed(0) + ',' + L.me.z.toFixed(0) + ' | ' + document.getElementById('readout').textContent; }));
    await p.screenshot({ path: process.argv[2] + '/ride-' + m + '.png' });
  }
  await p.evaluate(() => document.getElementById('m-walk').click()); await p.waitForTimeout(500); console.log('walk', await p.evaluate(() => window.__lahall.me.mode));
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
