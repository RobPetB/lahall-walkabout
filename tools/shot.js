const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  async function run(name, opts, fn) {
    const c = await b.newContext(opts); const p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
    await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(22000);
    if (fn) await fn(p).catch(e => errs.push(name + ' eval: ' + e.message.split('\n')[0]));
    await p.screenshot({ path: process.argv[2] + '/' + name + '.png' }); await c.close();
  }
  await run('tour-day', { viewport: { width: 1280, height: 760 }, colorScheme: 'light' });
  await run('search-fly', { viewport: { width: 1280, height: 760 }, colorScheme: 'light' }, async p => {
    const r = await p.evaluate(() => { const f = window.__lahall_search.find; const show = q => q + ' => ' + f(q).map(e => e.note ? '[' + e.note.slice(0, 70) + ']' : e.t + ' (' + e.kind + ')').join(' | ');
      return ['Lahällsvägen 7', 'lahallsvagen 25', 'Lahällsvägen 99', 'Åsvägen 3', 'näsby', '59.4240, 18.0741', '59,5 18,0', 'qqq', ''].map(show).join('\n'); });
    console.log(r);
    await p.evaluate(() => window.__lahall_search.pick('Lahällsvägen 15')); await p.waitForTimeout(1200); });
  await run('search-walk', { viewport: { width: 1280, height: 760 }, colorScheme: 'dark' }, async p => {
    await p.evaluate(() => { window.__lahall.setMode('walk'); window.__lahall_search.pick('lahallsvagen 25'); }); await p.waitForTimeout(800);
    await p.click('#q'); await p.keyboard.press('Control+A'); await p.keyboard.type('djursholmsv 20'); await p.waitForTimeout(500); });
  await run('phone', { viewport: { width: 400, height: 760 }, colorScheme: 'light', hasTouch: true, isMobile: true }, async p => {
    await p.tap('#q'); await p.keyboard.type('stations'); await p.waitForTimeout(600); });
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
