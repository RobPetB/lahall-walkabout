const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(20000);
  const info = () => p.evaluate(() => JSON.stringify([document.getElementById('street').textContent, document.querySelector('.plate small').textContent, document.getElementById('tripinfo').textContent]));
  for (const m of ['drive', 'bike', 'walk']) {
    await p.evaluate(m => { const $ = id => document.getElementById(id); $('rfrom').value = 'Lahällsvägen 25'; $('rto').value = 'Näsbypark station'; document.querySelector('#rmodes [data-v=' + m + ']').click(); $('rplay').click(); }, m);
    for (const dd of [30, 500, 1200]) { await p.evaluate(dd => window.__lahall.journey.toLeg(0, dd), dd); await p.waitForTimeout(900); console.log('trip', m, dd, await info()); }
    if (m === 'drive') await p.screenshot({ path: process.argv[2] + '/plate-drive.png' });
    await p.evaluate(() => document.getElementById('tstop').click());
  }
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
