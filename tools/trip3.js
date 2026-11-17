const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 400, height: 760 }, hasTouch: true, isMobile: true })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(20000);
  const info = () => p.evaluate(() => JSON.stringify([document.getElementById('street').textContent, document.querySelector('.plate small').textContent, document.getElementById('tripinfo').textContent, Math.round(window.__lahall.me.y)]));
  await p.evaluate(() => { const $ = id => document.getElementById(id); $('rfrom').value = 'Lahällsvägen 25'; $('rto').value = 'Näsbypark station'; document.querySelector('#rmodes [data-v=train]').click(); $('rplay').click(); });
  await p.waitForTimeout(6000); console.log('walk', await info());
  await p.evaluate(() => window.__lahall.journey.toLeg(0, 200)); await p.waitForTimeout(4000); console.log('walk+200', await info()); await p.screenshot({ path: process.argv[2] + '/names.png' });
  await p.evaluate(() => { const c = document.getElementById('view'), ev = (t, id, x, y) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y }));
    ev('pointerdown', 11, 150, 400); ev('pointerdown', 12, 250, 400); ev('pointermove', 11, 150, 400); for (let i = 1; i <= 10; i++) { ev('pointermove', 11, 150 - i * 8, 400); ev('pointermove', 12, 250 + i * 8, 400); } ev('pointerup', 11, 70, 400); ev('pointerup', 12, 330, 400); });
  await p.waitForTimeout(5000); console.log('after pinch-out (zoom in)', await info());
  await p.evaluate(() => window.__lahall.journey.toLeg(1, 400)); await p.waitForTimeout(4000); console.log('train', await info());
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
