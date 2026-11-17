const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1200, height: 720 } })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(20000);
  const run = (from, to, mode) => p.evaluate(([from, to, mode]) => { const $ = id => document.getElementById(id); $('route').hidden = false; $('rfrom').value = from; $('rto').value = to; document.querySelector('#rmodes [data-v=' + mode + ']').click(); const t0 = performance.now(); const r = window.__lahall.journey.go(); return mode + ' (' + Math.round(performance.now() - t0) + ' ms): ' + $('rnote').textContent + ' ' + JSON.stringify(window.__lahall.journey.state().legs); }, [from, to, mode]);
  for (const m of ['walk', 'drive', 'bike', 'train']) console.log(await run('Lahäll station', process.argv[3] || 'Näsbypark', m));
  console.log(await run('', 'Näsby slott', 'walk')); console.log(await run('Lahällsvägen 25', 'qqqq', 'walk')); console.log(await run('Näsby slott', 'Vårfrukyrkan', 'train'));
  await run('Lahäll station', 'Näsbypark', process.argv[4] || 'drive');
  await p.evaluate(() => { document.querySelector('#rspeed [data-v="16"]').click(); document.getElementById('rplay').click(); }); await p.waitForTimeout(9000);
  console.log('trip', await p.evaluate(() => JSON.stringify([window.__lahall.me.mode, window.__lahall.journey.state().li, Math.round(window.__lahall.journey.state().d), document.getElementById('readout').textContent])));
  await p.screenshot({ path: process.argv[2] + '/trip.png' });
  await p.evaluate(() => document.getElementById('m-fly').click()); await p.waitForTimeout(500);
  console.log('after fly', await p.evaluate(() => window.__lahall.me.mode + ' running=' + window.__lahall.journey.isRunning() + ' btn=' + document.getElementById('rplay').textContent));
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
