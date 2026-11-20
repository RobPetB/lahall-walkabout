const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1200, height: 740 }, locale: 'en-GB' })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('lahall-seen', '1'); localStorage.setItem('lahall-detail', 'low'); } catch (e) {} });
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(13000);
  for (const l of await p.evaluate(() => window.__lahall.journey.lines())) console.log('line', JSON.stringify(l).slice(0, 330));
  const run = (from, to, mode) => p.evaluate(([from, to, mode]) => { const $ = id => document.getElementById(id); $('rfrom').value = from; $('rto').value = to; document.querySelector('#rmodes [data-v=' + mode + ']').click(); return mode + ': ' + $('rnote').textContent + ' ' + JSON.stringify(window.__lahall.journey.state().legs); }, [from, to, mode]);
  console.log(await run('Lahällsvägen 25', 'Näsbypark station', 'train'));
  for (const [a, c] of [['Lahäll station', 'Näsbypark station'], ['Enmans väg', 'Viggbyholms gård'], ['Fenixvägen', 'Näsbypark station']]) console.log(await run(a, c, 'bus'));
  await p.evaluate(() => { document.getElementById('route').hidden = true; document.getElementById('rplay').click(); window.__lahall.journey.toLeg(1, 0); }); await p.waitForTimeout(9000);
  console.log('bar', await p.evaluate(() => document.getElementById('tripinfo').textContent)); await p.waitForTimeout(45000); console.log('bar', await p.evaluate(() => document.getElementById('tripinfo').textContent + ' || ' + document.querySelector('.plate small').textContent));
  await p.screenshot({ path: process.argv[2] + '/bus.png' });
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
