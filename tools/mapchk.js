const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html');
  for (const t of [3000, 6000, 12000]) { await p.waitForTimeout(t === 3000 ? 3000 : t / 2); console.log(t, await p.evaluate(() => { const m = document.getElementById('map'); const d = m.getContext('2d').getImageData(0, 0, m.width, m.height).data; let s = new Set(); for (let i = 0; i < d.length; i += 4001 * 4) s.add(d[i] + ',' + d[i + 1]); return s.size + ' colours; frames ' + (window.__f || 'n/a'); })); }
  await b.close();
})();
