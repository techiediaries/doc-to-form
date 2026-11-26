// Form page, loaded by form.js:
//  1. Edit mode — change any text of the document and format it (bold, align, size…) before printing.
//     Edits are kept on this device (localStorage dtf:v1:edit:<form>); form.js restores them on load.
//  2. Arabic phonetic keyboard — type Arabic with the keyboard installed in the system (AZERTY, QWERTY…):
//     it reads the typed character (e.key), and the number row by key position (e.code), so no layout
//     switch is needed. An on-screen panel shows every letter with its key, and can be clicked.
//     Same table as doua-reminder/keyboard.html (mode "phon"). Toggle: button or Ctrl+Space.
(function () {
  const form = document.getElementById('doc-form');
  const body = form && form.querySelector('.doc-body');
  const actions = form && form.querySelector('.actions');
  if (!body || !actions) return;

  const name = decodeURIComponent(location.pathname.split('/').pop());
  const EDIT_KEY = 'dtf:v1:edit:' + name;
  const KB_KEY = 'dtf:v1:kb';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const cmd = (c, v) => document.execCommand(c, false, v);
  const btn = (label, title, cls) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = label;
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
    if (cls) b.className = cls;
    return b;
  };

  // ================= 1. Edit mode =================
  const editBtn = btn('تحرير النص', 'تحرير نص الوثيقة وتنسيقه قبل الطباعة', 'btn-ghost edit-toggle');
  const kbBtn = btn('⌨ عربي', 'لوحة المفاتيح العربية (Ctrl+Space)', 'btn-ghost kb-toggle');
  const exportBtn = actions.querySelector('.btn-ghost:not(.next)');
  actions.insertBefore(kbBtn, exportBtn || null);
  actions.insertBefore(editBtn, kbBtn);

  const bar = document.createElement('div');
  bar.className = 'edit-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'تنسيق النص');
  const tools = [
    ['<b>غ</b>', 'غامق', () => cmd('bold')],
    ['<u>س</u>', 'تسطير', () => cmd('underline')],
    ['<i>م</i>', 'مائل', () => cmd('italic')],
    0,
    ['⇥', 'محاذاة لليمين', () => cmd('justifyRight')],
    ['≡', 'توسيط', () => cmd('justifyCenter')],
    ['⇤', 'محاذاة لليسار', () => cmd('justifyLeft')],
    ['☰', 'ضبط', () => cmd('justifyFull')],
    0,
    ['أ−', 'تصغير الخط', () => size(-1)],
    ['أ+', 'تكبير الخط', () => size(1)],
    0,
    ['↶', 'تراجع', () => cmd('undo')],
    ['↷', 'إعادة', () => cmd('redo')],
    0,
    ['الأصل', 'استرجاع النص الأصلي (تبقى القيم المكتوبة)', resetOriginal],
  ];
  for (const t of tools) {
    if (!t) { const s = document.createElement('span'); s.className = 'sep'; bar.append(s); continue; }
    const b = btn(t[0], t[1]);
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the text selection
    b.addEventListener('click', () => { body.focus(); t[2](); saveSoon(); });
    bar.append(b);
  }
  const done = btn('تم', 'إنهاء التحرير', 'done');
  done.addEventListener('click', () => setEditing(false));
  bar.append(done);
  body.before(bar);

  function size(step) {
    const cur = parseInt(document.queryCommandValue('fontSize'), 10) || 3;
    cmd('fontSize', String(Math.min(7, Math.max(1, cur + step))));
  }

  // The edited text, without what form.js adds at run time (print twins, page-break wrapper, states).
  function snapshot() {
    const c = body.cloneNode(true);
    c.removeAttribute('contenteditable');
    c.querySelectorAll('.pv').forEach((n) => n.remove());
    c.querySelectorAll('.keep-together').forEach((n) => n.replaceWith(...n.childNodes));
    c.querySelectorAll('.filled, .flash').forEach((n) => n.classList.remove('filled', 'flash'));
    return c.innerHTML;
  }
  let saveTimer;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => ls.set(EDIT_KEY, snapshot()), 400);
  }
  body.addEventListener('input', () => { if (editing) saveSoon(); });

  function resetOriginal() {
    if (!ls.get(EDIT_KEY)) return;
    if (!confirm('استرجاع النص الأصلي؟ ستُحذف تعديلات النص والتنسيق، وتبقى القيم المكتوبة في الفراغات.')) return;
    clearTimeout(saveTimer);
    ls.del(EDIT_KEY);
    location.reload();
  }

  let editing = false;
  function setEditing(on) {
    editing = on;
    document.documentElement.classList.toggle('editing', on);
    editBtn.setAttribute('aria-pressed', String(on));
    if (on) {
      try { cmd('styleWithCSS', true); } catch {}
      body.contentEditable = 'true';
      body.spellcheck = false;
      body.focus();
    } else {
      body.removeAttribute('contenteditable');
      clearTimeout(saveTimer);
      if (ls.get(EDIT_KEY) !== null || body.dataset.touched) ls.set(EDIT_KEY, snapshot());
    }
  }
  body.addEventListener('input', () => { if (editing) body.dataset.touched = '1'; });
  editBtn.addEventListener('click', () => setEditing(!editing));
  editBtn.setAttribute('aria-pressed', 'false');
  if (ls.get(EDIT_KEY)) {
    const n = actions.querySelector('.draft-note');
    if (n && !n.textContent) n.textContent = 'تم تطبيق تعديلاتك على النص';
  }

  // ================= 2. Arabic phonetic keyboard =================
  // Lowercase = plain letter, Shift = heavy / hamza form; th ث dh ذ sh/ch ش kh خ gh غ; Esc breaks a pair.
  const PHON = {
    a: 'ا', b: 'ب', c: 'ش', d: 'د', e: 'ع', f: 'ف', g: 'غ', h: 'ه', i: 'ي', j: 'ج', k: 'ك', l: 'ل', m: 'م',
    n: 'ن', o: 'و', p: 'ة', q: 'ق', r: 'ر', s: 'س', t: 'ت', u: 'و', v: 'ى', w: 'و', x: 'خ', y: 'ي', z: 'ز',
    A: 'أ', I: 'إ', V: 'آ', O: 'ؤ', Y: 'ئ', L: 'لا', D: 'ض', H: 'ح', S: 'ص', T: 'ط', Z: 'ظ',
    ',': '،', '?': '؟', ';': '؛',
  };
  const HAMZA = 'ء'; // the key right of L (AZERTY ù, QWERTY ') — by position, works on any layout
  const HARAKAT = ['َ', 'ً', 'ُ', 'ٌ', 'ِ', 'ٍ', 'ْ', 'ّ', 'ٰ', 'ٓ']; // number row 1…0, when it does not type digits
  const DIGRAPH = { 'ت': 'ث', 'د': 'ذ', 'س': 'ش', 'ش': 'ش', 'ك': 'خ', 'غ': 'غ' };

  let kbOn = ls.get(KB_KEY) === '1';
  const touchOnly = matchMedia('(hover: none) and (pointer: coarse)').matches; // phone keyboards are already Arabic
  let last = null; // where our last letter ended — a following "h" may turn it into a pair

  const isTarget = (el) => !!el && (el.isContentEditable ||
    (el.matches && el.matches('input.field:not([type=date]):not([type=checkbox]):not([type=radio]), textarea.field')));

  function caret(el) {
    if (!el.isContentEditable) return el.selectionStart === el.selectionEnd ? { el, at: el.selectionStart } : null;
    const s = getSelection();
    return s.isCollapsed && s.anchorNode ? { el, node: s.anchorNode, at: s.anchorOffset } : null;
  }
  const same = (a, b) => a && b && a.el === b.el && a.node === b.node && a.at === b.at;
  function prevChar(c) {
    if (!c.node) return c.el.value[c.at - 1];
    return c.node.nodeType === 3 ? c.node.data[c.at - 1] : undefined;
  }
  function insert(el, ch, replacePrev) {
    if (replacePrev) {
      if (el.isContentEditable) getSelection().modify('extend', 'backward', 'character');
      else el.setSelectionRange(el.selectionStart - 1, el.selectionStart);
    }
    if (!cmd('insertText', ch) && !el.isContentEditable) { // very old browsers
      el.setRangeText(ch, el.selectionStart, el.selectionEnd, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !e.altKey && e.code === 'Space') { e.preventDefault(); setKb(!kbOn); return; }
    if (!kbOn || touchOnly || !isTarget(e.target)) return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return; // AltGr = Ctrl+Alt: leave it alone
    const el = e.target;
    const c = caret(el);
    if (e.key === 'Escape') { if (c && same(c, last)) { last = null; e.stopPropagation(); } return; }
    if (e.key === 'h' && c && same(c, last) && DIGRAPH[prevChar(c)]) {
      e.preventDefault();
      insert(el, DIGRAPH[prevChar(c)], true);
      last = null; // "shh" = شه
      return;
    }
    let ch;
    const digit = /^Digit(\d)$/.exec(e.code);
    if (digit && !e.shiftKey && !/\d/.test(e.key)) ch = HARAKAT[(+digit[1] + 9) % 10]; // AZERTY & é " ' …
    else if (e.code === 'Quote' && !e.shiftKey) ch = HAMZA;
    else if (e.key.length === 1) ch = PHON[e.key] ?? PHON[e.key.toLowerCase()];
    if (!ch) { last = null; return; }
    e.preventDefault();
    insert(el, ch, false);
    last = caret(el);
  }, true);

  // ---- On-screen panel ----
  const panel = document.createElement('div');
  panel.className = 'kb';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'لوحة المفاتيح العربية');
  panel.innerHTML =
    '<div class="kb-head"><span>اكتب بالحروف اللاتينية ← عربي · <kbd>Ctrl</kbd>+<kbd>Space</kbd></span>' +
    '<button type="button" class="kb-min" aria-label="تصغير">▾</button>' +
    '<button type="button" class="kb-close" aria-label="إيقاف">✕</button></div><div class="kb-keys"></div>';
  const keys = panel.querySelector('.kb-keys');

  // Hint under each letter = the keys that type it (from the tables above).
  const hints = {};
  for (const [k, ch] of Object.entries(PHON)) (hints[ch] = hints[ch] || []).push(k);
  hints['ث'] = ['th']; hints['ذ'] = ['dh'];
  hints['ش'] = ['c', 'sh']; hints['خ'] = ['x', 'kh']; hints['غ'] = ['g', 'gh'];
  hints[HAMZA] = ['ù'];
  const harakaHints = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  // Show the real characters of the installed layout when the browser can tell (Chrome, Edge).
  if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
    navigator.keyboard.getLayoutMap().then((map) => {
      const q = map.get('Quote');
      if (q) setHint(HAMZA, q);
      for (let i = 0; i < 10; i++) {
        const k = map.get('Digit' + ((i + 1) % 10));
        if (k) setHint(HARAKAT[i], /\d/.test(k) ? '' : k); // QWERTY: digits stay digits, click instead
      }
    }).catch(() => {});
  }
  function setHint(ch, text) {
    const el = keys.querySelector('[data-ch="' + ch + '"] small');
    if (el) el.textContent = text;
  }

  const ROWS = [
    HARAKAT,
    ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص'],
    ['ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'],
    ['ء', 'أ', 'إ', 'آ', 'ؤ', 'ئ', 'ة', 'ى', 'لا', '،', '؟', '؛', ' ', '⌫'],
  ];
  ROWS.forEach((row, r) => {
    const line = document.createElement('div');
    line.className = 'kb-row' + (r === 0 ? ' kb-harakat' : '');
    for (const ch of row) {
      const k = btn('', '', 'kb-key');
      k.dataset.ch = ch;
      const shown = r === 0 ? 'ـ' + ch : ch === ' ' ? '␣' : ch;
      const hint = r === 0 ? harakaHints[row.indexOf(ch)] : ch === ' ' ? '' : ch === '⌫' ? '' : (hints[ch] || []).join(' ');
      k.innerHTML = '<span>' + shown + '</span><small>' + hint + '</small>';
      if (ch === ' ') k.classList.add('wide');
      line.append(k);
    }
    keys.append(line);
  });

  let lastTarget = null;
  document.addEventListener('focusin', (e) => { if (isTarget(e.target)) lastTarget = e.target; });
  panel.addEventListener('mousedown', (e) => { if (e.target.closest('.kb-key')) e.preventDefault(); }); // keep focus
  panel.addEventListener('click', (e) => {
    const k = e.target.closest('.kb-key');
    if (!k) return;
    let el = isTarget(document.activeElement) ? document.activeElement : lastTarget;
    if (!el) el = form.querySelector('.field:not([type=date])');
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    if (k.dataset.ch === '⌫') cmd('delete');
    else insert(el, k.dataset.ch, false);
    last = null;
  });
  panel.querySelector('.kb-min').addEventListener('click', () => {
    const min = panel.classList.toggle('min');
    panel.querySelector('.kb-min').textContent = min ? '▴' : '▾';
    panel.querySelector('.kb-min').setAttribute('aria-label', min ? 'إظهار' : 'تصغير');
  });
  panel.querySelector('.kb-close').addEventListener('click', () => setKb(false));
  document.body.append(panel);
  // The sticky action bar sits just above the panel.
  const fit = () => document.documentElement.style.setProperty('--kb-h', (kbOn ? panel.offsetHeight : 0) + 'px');
  if (window.ResizeObserver) new ResizeObserver(fit).observe(panel);

  function setKb(on) {
    kbOn = on;
    last = null;
    ls.set(KB_KEY, on ? '1' : '0');
    kbBtn.setAttribute('aria-pressed', String(on));
    document.documentElement.classList.toggle('kb-on', on);
    fit();
  }
  kbBtn.addEventListener('click', () => setKb(!kbOn));
  setKb(kbOn);
})();
