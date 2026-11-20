const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { if (!window.__keepHello) localStorage.setItem('lahall-seen', '1'); } catch (e) {} });
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(9000);
  const st = () => p.evaluate(() => JSON.stringify([window.__lahall.quality.state(), document.getElementById('detailnote').textContent]));
  console.log('fps', await p.evaluate(() => new Promise(r => { let n = 0, t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 4000) r((n / 4).toFixed(1)); else requestAnimationFrame(f); }; requestAnimationFrame(f); })));
  console.log('after 9 s', await st()); await p.waitForTimeout(14000); console.log('after 23 s', await st());
  await p.screenshot({ path: process.argv[2] + '/q-low.png' });
  await p.evaluate(() => document.querySelector('#details [data-v=high]').click()); await p.waitForTimeout(6000); console.log('forced high', await st());
  await p.evaluate(() => document.querySelector('#details [data-v=auto]').click()); await p.waitForTimeout(500); console.log('back to auto', await st());
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
