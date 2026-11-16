const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(7000);
  await p.click('#sky'); await p.click('#snd'); await p.waitForTimeout(6000);
  console.log(await p.evaluate(() => document.getElementById('snd').textContent + ' / pressed=' + document.getElementById('snd').getAttribute('aria-pressed')));
  await p.click('#weathers [data-v=rain]'); await p.waitForTimeout(3000);
  await p.screenshot({ path: process.argv[2] + '/panel.png' });
  await p.click('#snd'); await p.waitForTimeout(500);
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
