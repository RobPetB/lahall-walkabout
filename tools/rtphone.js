const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 400, height: 760 }, hasTouch: true, isMobile: true })).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(20000);
  await p.evaluate(() => { const $ = id => document.getElementById(id); $('rt').click(); $('rfrom').value = 'Lahällsvägen 25'; $('rto').value = 'Näsbypark station'; document.querySelector('#rmodes [data-v=train]').click(); });
  await p.waitForTimeout(1500); await p.screenshot({ path: process.argv[2] + '/rtphone.png' });
  console.log(await p.evaluate(() => document.getElementById('rnote').textContent + ' | overflow ' + (document.documentElement.scrollWidth > innerWidth)));
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
