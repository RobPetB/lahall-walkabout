const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(20000);
  const cam = (x, z, d, up, br) => p.evaluate(([x, z, d, up, br]) => { const L = window.__lahall; br = br * Math.PI / 180; L.setMode('fly'); L.me.x = x - Math.sin(br) * d; L.me.z = z + Math.cos(br) * d; L.me.y = L.hAt(x, z) + up; L.me.yaw = Math.atan2(-Math.sin(br), Math.cos(br)); L.me.pitch = -Math.atan2(up - 1.5, d); L.me.speed = 0; }, [x, z, d, up, br]);
  const tod = h => p.evaluate(h => { const t = document.getElementById('tod'); t.value = h; t.dispatchEvent(new Event('input')); }, h);
  const shot = async n => { await p.waitForTimeout(2500); await p.screenshot({ path: process.argv[2] + '/' + n + '.png' }); };
  for (const s of (process.argv[3] || 'a,b,c,d,e').split(',')) {
    if (s === 'a') { await cam(175, -52, 34, 9, 45); await shot('g-street'); }
    if (s === 'b') { await cam(900, 300, 120, 22, 150); await shot('g-water'); }
    if (s === 'c') { await cam(100, -100, 500, 260, 20); await shot('g-wide'); }
    if (s === 'd') { await tod(23.5); await cam(900, 300, 120, 22, 150); await shot('g-night'); await tod(15); }
    if (s === 'e') { await p.evaluate(() => window.__lahall.setSeason('winter')); await cam(900, 300, 120, 22, 150); await shot('g-winter'); }
    if (s === 'f') { await p.evaluate(() => window.__lahall.setMode('fly')); const r = await p.evaluate(() => { const L = window.__lahall, y0 = L.me.yaw, c = document.getElementById('view'), ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 5, pointerType: 'touch', clientX: x, clientY: y })); ev('pointerdown', 900, 400); ev('pointermove', 960, 410); ev('pointermove', 1010, 420); ev('pointerup', 1010, 420); return (L.me.yaw - y0).toFixed(3); }); console.log('drag turned view by', r); }
  }
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
