const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  for (const v of [['f-shelter', 'light', 'shelter'], ['f-sign', 'light', 'sign'], ['f-zebra', 'light', 'zebra'], ['f-bench', 'light', 'bench'], ['f-dusk', 'dark', 'sign'], ['f-over', 'light', 'over']]) {
    const c = await b.newContext({ viewport: { width: 1280, height: 760 } }); const p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(v[0] + ': ' + m.text()); });
    p.on('pageerror', e => errs.push(v[0] + ': ' + e.message));
    await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
    await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(9000);
    if (v[1] === 'dark') await p.click('#sky');
    const info = await p.evaluate(kind => {
      const L = window.__lahall, T = L.traffic, o = {}; L.setMode('fly');
      let tx, tz, dist = 16, up = 5;
      if (T.furn.first[kind]) { const q = T.furn.first[kind]; tx = q[0]; tz = q[1]; dist = kind === 'zebra' ? 20 : 9; up = kind === 'zebra' ? 9 : 2.6; }
      else if (kind === 'bus') { const a = T.cars.filter(c => c.bus && T.R[c.r].c !== 'motorway')[0] || T.cars.filter(c => c.bus)[0]; T.at(a.r, a.s, o); tx = o.x; tz = o.z; dist = 22; up = 6; }
      else if (kind === 'bike') { const a = T.bikes[2]; T.at(a.r, a.s, o); tx = o.x; tz = o.z; dist = 7; up = 2; }
      else if (kind === 'car') { const a = T.cars.filter(c => T.R[c.r].c === 'residential' || T.R[c.r].c === 'tertiary')[0]; T.at(a.r, a.s, o); tx = o.x; tz = o.z; }
      else if (kind === 'ped') { const a = T.people[3]; T.at(a.r, a.s, o); tx = o.x; tz = o.z; dist = 9; up = 2.2; }
      else if (kind === 'over') { tx = 100; tz = -100; dist = 160; up = 90; }
      else { tx = T.lot[0]; tz = T.lot[1]; dist = 30; up = 55; }
      window.__cam = () => { L.me.x = tx - dist * 0.72; L.me.z = tz + dist * 0.69; L.me.y = L.hAt(tx, tz) + up; L.me.yaw = Math.atan2(-0.72, 0.69); L.me.pitch = -Math.atan2(up - 1, dist); L.me.speed = 0; };
      return { links: T.links, parked: T.parked, cars: T.cars.length, people: T.people.length, t: [tx, tz], classes: T.cars.reduce((m, c) => { const k = T.R[c.r].c; m[k] = (m[k] || 0) + 1; return m; }, {}), moving: T.cars.filter(c => c.v > 0.5).length, stops: T.stops.length, bikes: T.bikes.length, bus: T.cars.filter(c => c.bus).map(c => T.R[c.r].c + (c.wait > 0 ? ':stopped' : '')) };
    }, v[2]);
    if (v[0] === 'f-shelter') console.log(JSON.stringify(await p.evaluate(() => { const f = window.__lahall.traffic.furn; return [f.benches, f.bins, f.shelters, f.racks, f.signs, f.zebras]; })));
    await p.evaluate(() => { const L = window.__lahall; L.me.gy = 0; window.__cam(); });
    await p.waitForTimeout(700);
    await p.screenshot({ path: process.argv[2] + '/' + v[0] + '.png' }); await c.close();
  }
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
