// Run: npm i --no-save playwright-core@1.48.2 && node tests/edge-ui.js .
// Opens Microsoft Edge (headed), checks index search/chips and a form's progress/draft/print rules.
// Screenshots land in tests/shots/ (git-ignored).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(process.argv[2] || '.');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(buf);
  });
});

const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge', headless: false, slowMo: 120 });
  const errors = [];

  for (const vp of [{ name: 'phone', width: 375, height: 760, mobile: true }, { name: 'desktop', width: 1280, height: 860, mobile: false }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('response', (r) => r.status() >= 400 && errors.push(vp.name + ' ' + r.status() + ' ' + r.url()));
    page.on('pageerror', (e) => errors.push(`${vp.name}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && !m.text().includes('Failed to load resource') && errors.push(vp.name + ' console: ' + m.text()));

    // ---- Index ----
    await page.goto(base + '/index.html');
    const total = await page.locator('.form-list li').count();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${vp.name}: index has no sideways scroll`, overflow <= 0, `overflow=${overflow}`);
    check(`${vp.name}: samples hidden from index`, !(await page.locator('.form-list').innerText()).includes('sample'));
    await page.screenshot({ path: path.join(OUT, `${vp.name}-index.png`) });

    await page.fill('.search input', 'وكاله'); // normalised: should match وكالة / الوكالة
    const hits = await page.locator('.form-list li:not([hidden])').count();
    check(`${vp.name}: search "وكاله" finds وكالة forms`, hits > 0 && hits < total, `${hits}/${total}`);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-search.png`) });

    await page.fill('.search input', 'zzzz');
    check(`${vp.name}: empty state shown`, await page.locator('.empty').isVisible());
    await page.fill('.search input', '');

    await page.click('.chip[data-cat="عقود"]');
    const contracts = await page.locator('.form-list li:not([hidden])').count();
    check(`${vp.name}: chip "عقود" filters`, contracts > 0 && contracts < total, `${contracts}/${total}`);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-chip.png`) });
    await page.click('.chip[data-cat="الكل"]');

    // ---- Form ----
    await page.click('.form-list a:has-text("عقد إيجار سكني")');
    await page.waitForSelector('.progress .count');
    const fields = await page.locator('#doc-form .field').count();
    const formOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${vp.name}: form has no sideways scroll`, formOverflow <= 0, `overflow=${formOverflow}`);
    check(`${vp.name}: progress starts at 0 of ${fields}`, (await page.textContent('.progress .count')) === `0 من ${fields}`);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-form.png`) });

    await page.click('.progress .next');
    const focusedId = await page.evaluate(() => document.activeElement.id);
    const firstId = await page.locator('#doc-form .field').first().getAttribute('id');
    check(`${vp.name}: "الفراغ التالي" focuses first empty blank`, focusedId === firstId, focusedId);
    await page.keyboard.type('أحمد العلوي');
    await page.click('.progress .next');
    await page.keyboard.type('AB123456');
    const countAfter = await page.textContent('.progress .count');
    check(`${vp.name}: progress updates to 2`, countAfter === `2 من ${fields}`, countAfter);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-form-filling.png`) });

    await page.reload();
    await page.waitForSelector('.progress .count');
    const restored = await page.locator('#doc-form .field').first().inputValue();
    check(`${vp.name}: draft restored after reload`, restored === 'أحمد العلوي', restored);
    check(`${vp.name}: restore note visible`, await page.locator('.draft-note').isVisible());

    await page.click('.draft-note button');
    const cleared = await page.locator('#doc-form .field').first().inputValue();
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('dtf:v1:draft:')).length);
    check(`${vp.name}: "مسح الكل" clears form + storage`, cleared === '' && stored === 0, `stored=${stored}`);

    // Print layout: UI chrome hidden.
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.querySelector('#doc-form .field').classList.add('filled'));
    const ink = await page.evaluate(() => getComputedStyle(document.querySelector('#doc-form .field')).borderBottomColor);
    check(`${vp.name}: filled blanks print with black ink`, ink === 'rgb(0, 0, 0)', ink);
    const chromeHidden = await page.evaluate(() =>
      ['.actions', '.back'].every((s) => getComputedStyle(document.querySelector(s)).display === 'none'));
    check(`${vp.name}: print hides action bar + back link`, chromeHidden);
    await page.emulateMedia({ media: 'screen' });

    // Dark mode renders.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: path.join(OUT, `${vp.name}-form-dark.png`) });
    await page.emulateMedia({ colorScheme: 'light' });

    await ctx.close();
  }

  check('no JS errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  console.log(results.join('\n'));
  console.log('screenshots:', OUT);
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(2); });
