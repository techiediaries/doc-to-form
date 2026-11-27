// Run: serve the repo on :8080 (or set BASE), npm i --no-save playwright-core@1.48.2, then node tests/edge-lang.js
// Checks the French (LTR) form and the AR <-> FR links in Microsoft Edge.
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:8080';
const R = []; const ok = (n, c, x = '') => R.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(() => { if (!sessionStorage.t) { localStorage.clear(); sessionStorage.t = 1; } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));

  await p.goto(BASE + '/forms/' + encodeURIComponent('توكيل خاص') + '.html');
  await p.click('.lang-switch');
  await p.waitForURL(/procuration\.html$/);
  ok('AR form links to FR form', true, decodeURIComponent(p.url()).split('/').pop());
  await p.waitForSelector('.edit-toggle');
  ok('page is LTR French', await p.evaluate(() => document.documentElement.dir === 'ltr' && document.documentElement.lang === 'fr'));
  ok('text starts on the left', await p.evaluate(() => { const l = document.querySelector('.doc-line'); return getComputedStyle(l).direction === 'ltr' && l.getBoundingClientRect().left < innerWidth / 2; }));
  ok('Latin font first', (await p.evaluate(() => getComputedStyle(document.body).fontFamily)).startsWith('"Segoe UI"'));
  ok('UI in French', (await p.locator('.progress .count').textContent()).includes('sur') && (await p.locator('.next').textContent()) === 'Blanc suivant' && (await p.locator('.edit-toggle').textContent()) === 'Modifier le texte');
  ok('no Arabic keyboard on FR page', (await p.locator('.kb-toggle').count()) === 0);
  await p.click('#f1'); await p.keyboard.type('Ahmed Alaoui');
  ok('typing stays Latin', (await p.inputValue('#f1')) === 'Ahmed Alaoui');
  await p.click('.edit-toggle');
  ok('edit bar in French', (await p.locator('.edit-bar .done').textContent()) === 'OK' && !!(await p.locator('.edit-bar button[title="Gras"]').count()));
  await p.click('.edit-bar .done');
  ok('no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0);
  await p.screenshot({ path: 'tests/shots/fr-desktop.png', fullPage: true });
  await p.emulateMedia({ media: 'print' });
  ok('print hides lang switch', !(await p.locator('.lang-switch').isVisible()));
  await p.emulateMedia({ media: 'screen' });

  await p.click('.lang-switch');
  await p.waitForURL(/%D8%AA%D9%88%D9%83%D9%8A%D9%84|توكيل/);
  await p.waitForSelector('.edit-toggle');
  ok('FR form links back to AR form', await p.evaluate(() => document.documentElement.dir === 'rtl'));
  ok('AR UI still Arabic', (await p.locator('.next').textContent()) === 'الفراغ التالي' && (await p.locator('.kb-toggle').count()) === 1);

  await p.goto(BASE + '/');
  await p.fill('.search input', 'procuration');
  ok('index search finds FR form', (await p.locator('.form-list li:visible').allTextContents()).join() === 'Procuration (FR)');
  await p.fill('.search input', '');
  await p.click('.chip[data-cat="وكالات"]');
  ok('FR form in وكالات chip', (await p.locator('.form-list li:visible').allTextContents()).includes('Procuration (FR)'));

  const m = await b.newPage({ viewport: { width: 375, height: 800 } }); await m.addInitScript(() => localStorage.setItem('dtf:v1:wizard', '0'));
  await m.goto(BASE + '/forms/procuration.html'); await m.waitForSelector('.edit-toggle');
  ok('phone: no sideways scroll', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0);
  await m.screenshot({ path: 'tests/shots/fr-phone.png' });
  ok('no JS errors', errs.length === 0, errs.join(' | '));
  console.log(R.join('\n'));
  await b.close();
})();
