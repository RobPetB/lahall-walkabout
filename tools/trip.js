const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await (await b.newContext({ viewport: { width: 1200, height: 720 } })).newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(20000);
  const $c = id => p.evaluate(id => document.getElementById(id).click(), id);
  const st = async tag => console.log(tag, await p.evaluate(() => { const L = window.__lahall, s = L.journey.state(); return JSON.stringify([L.me.mode, s.li, Math.round(s.d), document.getElementById('tripinfo').textContent, document.getElementById('tripbar').hidden]); }));
  for (const [mode, name] of [['train', 'v-train'], ['drive', 'v-drive']]) {
    await p.evaluate(mode => { const $ = id => document.getElementById(id); $('route').hidden = false; $('rfrom').value = 'Lahällsvägen 25'; $('rto').value = 'Näsbypark station'; document.querySelector('#rmodes [data-v=' + mode + ']').click(); document.querySelector('#rspeed [data-v="16"]').click(); $('route').hidden = true; $('rplay').click(); }, mode);
    await p.waitForTimeout(mode === 'train' ? 16000 : 7000); await st(mode); await p.screenshot({ path: process.argv[2] + '/' + name + '.png' });
    if (mode === 'walk') { await $c('tpause'); await p.waitForTimeout(1500); await st('paused'); await p.evaluate(() => window.__lahall.journey.look(0.8, 0.2)); await p.waitForTimeout(1500); await p.screenshot({ path: process.argv[2] + '/v-look.png' }); await $c('tview'); await p.waitForTimeout(1500); await p.screenshot({ path: process.argv[2] + '/v-close.png' }); await $c('tview'); await $c('tpause'); }
    await $c('tstop'); await p.waitForTimeout(400);
  }
  await st('stopped'); console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
