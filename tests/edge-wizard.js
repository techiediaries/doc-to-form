// Run: serve the repo on :8080 (or set BASE), npm i --no-save playwright-core@1.48.2, then node tests/edge-wizard.js
// Checks wizard mode ("step by step") in Microsoft Edge: steps, Enter, skip, review, draft, print, French, phone.
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:8080';
const R = []; const ok = (n, c, x = '') => R.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);
const AR = BASE + '/forms/' + encodeURIComponent('تصريح بالشرف') + '.html';
const FR = BASE + '/forms/procuration.html';
const visibleLines = (p) => p.evaluate(() => [...document.querySelectorAll('.doc-body .doc-line')].filter((l) => l.checkVisibility()).length);
(async () => {
  process.on('unhandledRejection', (e) => { console.log(R.join('\n')); console.log('ERROR', e.message.split('\n')[0]); process.exit(1); });
  const b = await chromium.launch({ channel: 'msedge' });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(() => { if (!sessionStorage.t) { localStorage.clear(); sessionStorage.t = 1; } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));

  // ---- Desktop: off by default, toggle on ----
  await p.goto(AR); await p.waitForSelector('.wz-toggle', { state: 'attached' });
  ok('desktop: off by default', !(await p.evaluate(() => document.documentElement.classList.contains('wizard'))));
  const total = await p.locator('.doc-body .doc-line').count();
  await p.click('.wz-toggle');
  ok('toggle turns wizard on', await p.evaluate(() => document.documentElement.classList.contains('wizard')));
  const shown = await visibleLines(p);
  ok('only current line (+ context) shown', shown >= 1 && shown <= 2, `${shown} of ${total} lines`);
  ok('step counter', /^الخطوة 1 من \d+$/.test(await p.locator('.wz-count').textContent()), await p.locator('.wz-count').textContent());
  ok('first blank focused', await p.evaluate(() => document.activeElement.matches('.wz-current .field')));
  ok('action bar = prev/next only', (await p.locator('.actions .primary:not(.wz-next):visible').count()) === 0 && await p.locator('.wz-next').isVisible());
  ok('empty step says skip', (await p.locator('.wz-next').textContent()).startsWith('تخطٍّ'));

  // ---- Type + Enter moves on ----
  const firstId = await p.evaluate(() => document.activeElement.id);
  await p.keyboard.type('أحمد العلوي');
  ok('filled step says next', (await p.locator('.wz-next').textContent()) === 'التالي');
  const stepsN = Number((await p.locator('.wz-count').textContent()).match(/من (\d+)/)[1]);
  for (let k = 0; k < 6 && /الخطوة 1 /.test(await p.locator('.wz-count').textContent()); k++) { await p.keyboard.press('Enter'); await p.waitForTimeout(350); }
  ok('Enter goes to step 2', /^الخطوة 2 /.test(await p.locator('.wz-count').textContent()));
  await p.keyboard.press('Shift+Enter');
  await p.waitForTimeout(350);
  ok('Shift+Enter goes back', /^الخطوة 1 /.test(await p.locator('.wz-count').textContent()) || await p.evaluate(() => document.activeElement.closest('.wz-current') !== null));
  ok('value kept (draft input)', (await p.inputValue('#' + firstId)) === 'أحمد العلوي');

  // ---- Skip to review ----
  for (let k = 0; k < stepsN + 2 && await p.locator('.wz-next').isVisible(); k++) { await p.click('.wz-next'); await p.waitForTimeout(260); }
  ok('review step reached', await p.evaluate(() => document.documentElement.classList.contains('wz-review')));
  ok('review shows whole document', (await visibleLines(p)) === total);
  ok('review counts blanks left', /تُملأ باليد/.test(await p.locator('.wz-count').textContent()), await p.locator('.wz-count').textContent());
  ok('review offers print', await p.locator('.wz-print').isVisible());
  await p.click('#' + firstId); await p.waitForTimeout(350);
  ok('touch value → back to its step', await p.evaluate((id) => document.getElementById(id).closest('.wz-current') !== null && !document.documentElement.classList.contains('wz-review'), firstId));

  // ---- Print: full A4 document, no wizard UI ----
  await p.emulateMedia({ media: 'print' });
  ok('print shows every line', (await visibleLines(p)) === total);
  ok('print hides wizard UI', !(await p.locator('.wz-head').isVisible()) && !(await p.locator('.wz-nav').isVisible()));
  ok('print uses normal size', await p.evaluate(() => getComputedStyle(document.querySelector('.wz-current')).fontSize === getComputedStyle(document.querySelector('.doc-line:not(.wz-current)')).fontSize));
  await p.emulateMedia({ media: 'screen' });

  // ---- Remembered + draft survives reload ----
  await p.reload(); await p.waitForSelector('.wz-toggle', { state: 'attached' });
  ok('choice remembered', await p.evaluate(() => document.documentElement.classList.contains('wizard')));
  ok('draft restored', (await p.inputValue('#' + firstId)) === 'أحمد العلوي');
  ok('opens at first empty step', !(await p.evaluate((id) => document.getElementById(id).closest('.wz-current') !== null, firstId)));

  // ---- Edit mode and wizard exclude each other ----
  await p.click('.wz-exit');
  ok('exit shows full document', (await visibleLines(p)) === total && (await p.locator('.edit-toggle').isVisible()));
  await p.click('.edit-toggle');
  await p.evaluate(() => document.querySelector('.wz-toggle').click());
  ok('wizard closes edit mode', await p.evaluate(() => !document.documentElement.classList.contains('editing') && document.documentElement.classList.contains('wizard')), await p.evaluate(() => document.documentElement.className));
  await p.evaluate(() => document.querySelector('.wz-exit').click());

  // ---- French page ----
  await p.goto(FR); await p.waitForSelector('.wz-toggle', { state: 'attached' });
  ok('FR toggle text', (await p.locator('.wz-toggle').textContent()) === 'Pas à pas');
  await p.evaluate(() => document.querySelector('.wz-toggle').click());
  ok('FR counter', /^Étape 1 sur \d+$/.test(await p.locator('.wz-count').textContent()));
  ok('FR label as placeholder', (await p.getAttribute('#f1', 'placeholder')) === 'Mandant');
  for (let k = 0; k < 4; k++) await p.click('.wz-next'); // quick taps add up
  await p.waitForTimeout(400);
  const ctxOf = (id) => p.evaluate((id) => document.querySelector('.wz-current #' + id) && document.querySelector('.wz-context')?.textContent.trim(), id);
  ok('FR quick taps → step 5', /^Étape 5 /.test(await p.locator('.wz-count').textContent()), await p.locator('.wz-count').textContent());
  ok('FR bare blank has context line', /^pour, en mon nom/.test(await ctxOf('f7') || ''), await ctxOf('f7'));
  await p.click('.wz-next'); await p.waitForTimeout(400);
  ok('FR next bare blank keeps context', /^pour, en mon nom/.test(await ctxOf('f8') || ''), await ctxOf('f8'));
  await p.click('.wz-exit');
  ok('FR placeholders removed on exit', (await p.getAttribute('#f1', 'placeholder')) === null);
  await p.screenshot({ path: 'tests/shots/wizard-fr-desktop.png' });

  // ---- Phone: on by default, no keyboard popping on load ----
  const m = await b.newContext({ viewport: { width: 375, height: 760 }, hasTouch: true, isMobile: true });
  const mp = await m.newPage(); mp.on('pageerror', (e) => errs.push(e.message));
  await mp.goto(AR); await mp.waitForSelector('.wz-toggle', { state: 'attached' });
  ok('phone: on by default', await mp.evaluate(() => document.documentElement.classList.contains('wizard')));
  ok('phone: nothing focused on load', await mp.evaluate(() => !document.activeElement.matches('.field')));
  ok('phone: no sideways scroll', await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0);
  ok('phone: nav fits on screen', await mp.evaluate(() => document.querySelector('.wz-next').getBoundingClientRect().bottom <= innerHeight));
  await mp.screenshot({ path: 'tests/shots/wizard-ar-phone.png' });
  await mp.tap('.wz-next'); await mp.waitForTimeout(300);
  await mp.screenshot({ path: 'tests/shots/wizard-ar-phone-2.png' });

  ok('no JS errors', errs.length === 0, errs.join(' | '));
  console.log(R.join('\n'));
  await b.close();
})();
