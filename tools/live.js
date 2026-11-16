const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  for (const mode of ['snow']) {
    const p = await (await b.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
    await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
    await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.route('**/api.open-meteo.com/**', r => mode === 'blocked' ? r.abort() : r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ current: { temperature_2m: -3.4, weather_code: 73, snow_depth: 0.12, cloud_cover: 100, wind_speed_10m: 9 } }) }));
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(20000);
    await p.evaluate(() => { document.getElementById('sky').click(); document.getElementById('live').click(); }); await p.waitForTimeout(25000);
    console.log(mode, await p.evaluate(() => [document.getElementById('sky').textContent, [...document.querySelectorAll('#seasons [aria-pressed=true], #weathers [aria-pressed=true]')].map(e => e.textContent).join('/'), document.getElementById('live').getAttribute('aria-pressed'), document.getElementById('livenote').textContent].join(' | ')));
    if (mode === 'snow') { await p.screenshot({ path: process.argv[2] + '/live.png' }); await p.evaluate(() => document.querySelector('#weathers [data-v=clear]').click()); await p.waitForTimeout(500); console.log('after manual', await p.evaluate(() => document.getElementById('live').getAttribute('aria-pressed'))); }
    await p.close();
  }
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
