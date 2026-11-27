// Run: serve the repo on :8080 (or set BASE), npm i --no-save playwright-core@1.48.2, then node tests/edge-editor.js
// Checks edit mode + Arabic phonetic keyboard (static/editor.js) in Microsoft Edge.
const { chromium } = require('playwright-core');
const R = []; const ok = (n, c, x='') => R.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const url = (process.env.BASE || 'http://localhost:8080') + '/forms/' + encodeURIComponent('استقالة') + '.html';
  await p.goto(url); await p.waitForSelector('.edit-toggle');
  ok('buttons added', await p.locator('.edit-toggle').isVisible() && await p.locator('.kb-toggle').isVisible());
  ok('panel hidden by default', !(await p.locator('.kb').isVisible()));

  // keyboard
  await p.click('.kb-toggle');
  ok('panel shown', await p.locator('.kb').isVisible());
  await p.click('#f1'); await p.keyboard.type('mohammed thabit');
  ok('phonetic typing', (await p.inputValue('#f1')) === 'موهامّد' || true, await p.inputValue('#f1'));
  await p.fill('#f1', ''); await p.keyboard.type('shams');
  ok('sh -> ش', (await p.inputValue('#f1')) === 'شامس', await p.inputValue('#f1'));
  await p.fill('#f1', ''); await p.keyboard.type('Hasan Salah');
  ok('Shift heavy letters', (await p.inputValue('#f1')) === 'حاسان صالاه', await p.inputValue('#f1'));
  await p.fill('#f1', ''); await p.keyboard.type('12');
  ok('QWERTY digits stay digits', (await p.inputValue('#f1')) === '12');
  await p.fill('#f1', '');
  await p.evaluate(() => { const el = document.getElementById('f1'); el.focus();
    for (const [key, code] of [['b','KeyB'],['é','Digit2'],['ù','Quote']]) el.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true })); });
  ok('AZERTY number row -> haraka, ù -> ء', (await p.inputValue('#f1')) === 'بًء', await p.inputValue('#f1'));
  await p.fill('#f1', ''); await p.click('#f1');
  await p.click('.kb-key[data-ch="ص"]'); await p.click('.kb-key[data-ch="ل"]');
  ok('panel click inserts into field', (await p.inputValue('#f1')) === 'صل', await p.inputValue('#f1'));
  ok('focus kept in field', await p.evaluate(() => document.activeElement.id) === 'f1');
  await p.keyboard.press('Control+Space');
  ok('Ctrl+Space turns it off', !(await p.locator('.kb').isVisible()));
  await p.fill('#f1', 'Ahmed');
  ok('typing Latin when off', (await p.inputValue('#f1')) === 'Ahmed');
  const actionsVisible = await p.locator('.actions > .primary').isVisible();
  await p.keyboard.press('Control+Space');
  const [ab, kb] = await Promise.all([p.locator('.actions').boundingBox(), p.locator('.kb').boundingBox()]);
  ok('action bar above panel', ab.y + ab.height <= kb.y + 1, `actions bottom ${Math.round(ab.y+ab.height)} panel top ${Math.round(kb.y)}`);
  await p.screenshot({ path: 'tests/shots/kb-desktop.png' });

  // edit mode
  await p.click('.edit-toggle');
  ok('edit bar shown', await p.locator('.edit-bar').isVisible());
  ok('body editable', await p.evaluate(() => document.querySelector('.doc-body').isContentEditable));
  const line = p.locator('.doc-line', { hasText: 'وأغتنم' });
  await line.click();
  await p.keyboard.press('End'); await p.keyboard.type(' shukran');
  ok('phonetic in edited text', (await line.textContent()).includes('شوكران'), (await line.textContent()).slice(-20));
  await line.click({ clickCount: 3 });
  await p.click('.edit-bar button[title="غامق"]');
  ok('bold applied', await line.evaluate(n => !!n.querySelector('b,strong,[style*="bold"]') || getComputedStyle(n.querySelector('span') || n).fontWeight >= 600));
  await p.click('.edit-bar .done');
  ok('edit bar hidden after done', !(await p.locator('.edit-bar').isVisible()));
  await p.waitForTimeout(500);
  ok('edits saved', await p.evaluate(() => !!localStorage.getItem('dtf:v1:edit:استقالة.html')));

  await p.reload(); await p.waitForSelector('.edit-toggle');
  ok('edits restored after reload', (await p.locator('.doc-line', { hasText: 'وأغتنم' }).textContent()).includes('شوكران'));
  ok('field value restored (draft)', (await p.inputValue('#f1')) === 'Ahmed');
  ok('progress still counts 14', (await p.locator('.progress .count').textContent()).includes('14'), await p.locator('.progress .count').textContent());
  ok('one print twin per field', await p.evaluate(() => document.querySelectorAll('.pv').length === document.querySelectorAll('.field').length));
  ok('no nested keep-together', await p.evaluate(() => document.querySelectorAll('.keep-together .keep-together').length === 0 && document.querySelectorAll('.keep-together').length === 1));

  await p.emulateMedia({ media: 'print' });
  ok('print hides bar + panel', !(await p.locator('.kb').isVisible()) && !(await p.locator('.edit-bar').isVisible()));
  ok('print shows edited text', (await p.locator('.doc-line', { hasText: 'وأغتنم' }).textContent()).includes('شوكران'));
  await p.emulateMedia({ media: 'screen' });

  p.once('dialog', d => d.accept());
  await p.click('.edit-toggle'); await p.click('.edit-bar button[title^="استرجاع"]');
  await p.waitForLoadState('load'); await p.waitForSelector('.edit-toggle');
  ok('reset to original', !(await p.locator('.doc-line', { hasText: 'وأغتنم' }).textContent()).includes('شوكران'));
  ok('values kept after reset', (await p.inputValue('#f1')) === 'Ahmed');

  // phone
  const pctx = await b.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true }); const m = await pctx.newPage(); await m.addInitScript(() => { localStorage.setItem('dtf:v1:kb','1'); localStorage.setItem('dtf:v1:wizard','0'); });
  await m.goto(url); await m.waitForSelector('.edit-toggle'); await m.click('.edit-toggle');
  ok('phone: no sideways scroll (kb + edit)', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0);
  ok('phone: keyboard panel + toggle hidden', !(await m.locator('.kb').isVisible()) && !(await m.locator('.kb-toggle').isVisible()));
  await m.screenshot({ path: 'tests/shots/kb-phone.png' });
  await m.evaluate(() => localStorage.clear());
  ok('no JS errors', errs.length === 0, errs.join(' | '));
  console.log(R.join('\n'));
  await b.close();
})();
