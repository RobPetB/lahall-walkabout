const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1200, height: 720 } })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(20000);
  await p.evaluate(() => { const $ = id => document.getElementById(id); $('rfrom').value = 'Lahällsvägen 25'; $('rto').value = 'Näsbypark station'; document.querySelector('#rmodes [data-v=train]').click(); $('rplay').click(); window.__lahall.journey.toLeg(1, 300); });
  await p.waitForTimeout(9000); await p.screenshot({ path: process.argv[2] + '/v-train.png' });
  console.log(await p.evaluate(() => { const L = window.__lahall, s = L.journey.state(); return JSON.stringify([s.li, Math.round(s.d), document.getElementById('tripinfo').textContent]); }));
  await p.evaluate(() => document.getElementById('tview').click()); await p.waitForTimeout(5000); await p.screenshot({ path: process.argv[2] + '/v-cab.png' });
  await p.evaluate(() => window.__lahall.journey.toLeg(2, 0)); await p.waitForTimeout(25000);
  console.log('end', await p.evaluate(() => JSON.stringify([window.__lahall.me.mode, document.getElementById('rnote').textContent.slice(0, 60), document.getElementById('tripbar').hidden])));
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
