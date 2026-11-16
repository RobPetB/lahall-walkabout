const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 400, height: 760 }, hasTouch: true, isMobile: true })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(22000);
  await p.screenshot({ path: process.argv[2] + '/phone-a.png' });
  await p.evaluate(() => { const q = document.getElementById('q'); q.focus(); q.value = 'stations'; q.dispatchEvent(new Event('input')); }); await p.waitForTimeout(1500);
  await p.screenshot({ path: process.argv[2] + '/phone-b.png' });
  await p.evaluate(() => { const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input')); q.blur(); document.getElementById('sky').click(); }); await p.waitForTimeout(1500);
  await p.screenshot({ path: process.argv[2] + '/phone-c.png' });
  console.log(await p.evaluate(() => document.documentElement.scrollWidth + ' vs ' + innerWidth));
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
