// Run: npm i --no-save playwright-core@1.48.2 && node tests/print-names.js <baseUrl> [headed]
// e.g. node tests/print-names.js https://namadij.ahmedbouchefra.com headed
// Fills the rental contract with uncommon names (long, Amazigh, Latin, apostrophes),
// checks the print copy (plain text, dotted empty blanks, DD/MM/YYYY) and writes an A4 PDF to tests/shots/.
process.on('unhandledRejection', () => {});
process.on('uncaughtException', (e) => { if (!/has been closed/.test(e.message)) { console.error(e); process.exit(2); } });
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const BASE = process.argv[2];
const HEADED = process.argv[3] === 'headed';
const FORM = '/forms/' + encodeURIComponent('عقد إيجار سكني') + '.html';
const PDF = path.join(__dirname, 'shots', HEADED ? 'print-names-live.pdf' : 'print-names-local.pdf');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const ok = (n, p, x = '') => { const l = `${p ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`; log.push(l); console.log(l); };

// [blank index, value] — long, Amazigh, Latin-in-Arabic, apostrophes, digits+Arabic.
const NAMES = [
  [0, 'عبد الصمد بن الحاج إبراهيم الزموري الإدريسي الحسني'],
  [1, 'BK7654'],
  [2, 'دوار أيت بوكماز، جماعة تبانت، إقليم أزيلال'],
  [3, "Itto Aït Ba'ha"],
  [4, 'JA112233'],
  [5, "Douar Tizi n'Tichka, Ouarzazate"],
  [6, 'زنقة 7 رقم 12 مكرر، حي السلام'],
];

async function caption(page, text) {
  if (!HEADED) return;
  await page.evaluate((t) => {
    let el = document.getElementById('__demo');
    if (!el) {
      el = document.createElement('div');
      el.id = '__demo';
      el.style.cssText = 'position:fixed;inset-inline:8px;inset-block-start:8px;z-index:99999;padding:10px 14px;border-radius:10px;background:#111;color:#ffd84d;font:600 15px/1.5 system-ui,Tahoma;box-shadow:0 4px 16px #0006;pointer-events:none;direction:rtl';
      document.body.append(el);
    }
    el.textContent = '▶ ' + t;
  }, text);
  await wait(1800);
}
const uncaption = (page) => page.evaluate(() => document.getElementById('__demo')?.remove());

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: !HEADED, slowMo: HEADED ? 200 : 0, args: ['--window-position=40,20', '--window-size=760,940'] });
  const ctx = await browser.newContext({ viewport: { width: 700, height: 820 } });
  const page = await ctx.newPage();
  await page.goto(BASE + FORM);
  await page.waitForSelector('.progress .count');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.progress .count');

  await caption(page, '1/4 أسماء غير شائعة: طويلة، أمازيغية، لاتينية، بفاصلة عليا');
  const fields = page.locator('#doc-form .field');
  for (const [i, v] of NAMES) {
    await fields.nth(i).click();
    await page.keyboard.type(v, { delay: HEADED ? 35 : 0 });
  }
  const dates = page.locator('#doc-form input[type=date]');
  if (await dates.count()) await dates.first().fill('2026-12-01');
  await wait(600);

  await caption(page, '2/4 شكل الطباعة: النص فقط، والفراغات الفارغة خط منقط');
  await uncaption(page);
  await page.emulateMedia({ media: 'print' });
  await wait(HEADED ? 5000 : 200);

  const r = await page.evaluate(() => {
    const f = [...document.querySelectorAll('#doc-form .field')];
    const vis = f.filter((e) => getComputedStyle(e).display !== 'none').length;
    const filled = [...document.querySelectorAll('.pv:not(:empty)')];
    const underlined = filled.filter((e) => getComputedStyle(e).borderBottomStyle !== 'none').length;
    const empty = [...document.querySelectorAll('.pv:empty')].filter((e) => !e.previousElementSibling.classList.contains('cell-field'));
    const dotted = empty.filter((e) => getComputedStyle(e).borderBottomStyle === 'dotted').length;
    const texts = filled.map((e) => e.textContent);
    return { vis, underlined, dotted, empty: empty.length, texts, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  ok('inputs hidden in print', r.vis === 0, `${r.vis} visible`);
  ok('filled values have no underline', r.underlined === 0, `${r.underlined} underlined`);
  ok('empty blanks are dotted lines', r.dotted === r.empty, `${r.dotted}/${r.empty}`);
  for (const [, v] of NAMES) ok(`prints exactly: ${v}`, r.texts.includes(v));
  ok('no sideways overflow with long names', r.overflow <= 0, `overflow=${r.overflow}`);
  await page.emulateMedia({ media: 'screen' });

  // Date formatting on a form that has a date picker.
  const dp = await ctx.newPage();
  await dp.goto(BASE + '/forms/' + encodeURIComponent('اقرار باسترداد العارية') + '.html');
  await dp.waitForSelector('.progress .count');
  await dp.locator('#doc-form input[type=date]').first().fill('2026-12-01');
  await dp.emulateMedia({ media: 'print' });
  const dtxt = await dp.evaluate(() => document.querySelector('input[type=date] + .pv').textContent);
  ok('date printed as DD/MM/YYYY', dtxt === '01/12/2026', dtxt);
  await dp.close();

  // PDF from headless Edge with the same draft.
  const draft = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  const hb = await chromium.launch({ channel: 'msedge', headless: true });
  const hp = await hb.newPage();
  await hp.goto(BASE + FORM);
  await hp.evaluate((d) => { for (const [k, v] of JSON.parse(d)) localStorage.setItem(k, v); }, draft);
  await hp.reload();
  await hp.waitForSelector('.progress .count');
  await hp.pdf({ path: PDF, format: 'A4', preferCSSPageSize: true });
  await hb.close();
  ok('A4 PDF generated', fs.statSync(PDF).size > 5000, PDF);

  if (HEADED) {
    await caption(page, '3/4 إعادة التحميل — الأسماء تُستعاد كما هي');
    await page.reload();
    await page.waitForSelector('.progress .count');
    await wait(1500);
    ok('long name restored intact', (await fields.nth(0).inputValue()) === NAMES[0][1]);
    await caption(page, '4/4 زر الطباعة الحقيقي');
    await uncaption(page);
    page.click('.actions .primary').catch(() => {});
    await wait(9000);
  }
  console.log(`\n${log.filter((l) => l.startsWith('PASS')).length}/${log.length} passed`);
  await browser.close().catch(() => {});
  if (HEADED) require('child_process').spawn('cmd', ['/c', 'start', '', 'msedge', PDF], { detached: true, stdio: 'ignore' }).unref();
  process.exit(log.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})();
