const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('lahall-seen', '1'); localStorage.setItem('lahall-detail', 'low'); } catch (e) {} });
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html#from=Lah%C3%A4llsv%C3%A4gen%2025&to=N%C3%A4sbypark%20station&by=train'); await p.waitForTimeout(14000);
  const bar = () => p.evaluate(() => document.getElementById('tripinfo').textContent + ' | ' + JSON.stringify(window.__lahall.journey.state().d | 0));
  await p.evaluate(() => { document.getElementById('rplay').click(); window.__lahall.journey.toLeg(1, 0); });
  console.log('fps', await p.evaluate(() => new Promise(r => { let n = 0, t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 4000) r((n / 4).toFixed(1)); else requestAnimationFrame(f); }; requestAnimationFrame(f); })), await p.evaluate(() => JSON.stringify(window.__lahall.quality.state())));
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(5000); console.log(i, await bar()); if (i === 1) await p.screenshot({ path: process.argv[2] + '/wait.png' }); }
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
