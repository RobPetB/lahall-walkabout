const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(20000);
  const info = () => p.evaluate(() => JSON.stringify([document.getElementById('street').textContent, document.querySelector('.plate small').textContent, window.__lahall.me.mode]));
  for (const [x, z] of [[150, -60], [150, -60], [600, -300]]) for (const m of ['drive']) {
    await p.evaluate(([x, z, m]) => { const L = window.__lahall; L.setMode('fly'); L.me.x = x; L.me.z = z; document.getElementById('m-' + m).click(); }, [x, z, m]);
    await p.waitForTimeout(6000); console.log(m, x, z, await info());
  }
  await p.evaluate(() => document.getElementById('m-train').click()); await p.waitForTimeout(6000); console.log('train', await info());
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
