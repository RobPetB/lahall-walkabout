const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(20000);
  for (const m of ['walk', 'train']) {
    await p.evaluate(m => { const $ = id => document.getElementById(id); $('rfrom').value = 'Lahällsvägen 25'; $('rto').value = 'Näsbypark station'; document.querySelector('#rmodes [data-v=' + m + ']').click(); }, m);
    console.log(m, await p.evaluate(() => document.getElementById('rnote').textContent));
  }
  await p.evaluate(() => { document.getElementById('rplay').click(); window.__lahall.journey.toLeg(1, 700); }); await p.waitForTimeout(4000);
  for (const [i, dd] of [[0, 10], [1, 700], [2, 5]]) { await p.evaluate(([i, dd]) => window.__lahall.journey.toLeg(i, dd), [i, dd]); await p.waitForTimeout(2500); console.log('bar', await p.evaluate(() => document.getElementById('tripinfo').textContent)); }
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
