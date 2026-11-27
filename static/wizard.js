// Form page, loaded by form.js — wizard mode ("step by step"): one line of the document at a time,
// with its blanks, so the person only thinks about one thing. The last step reviews the whole document.
// Nothing is copied: the wizard only hides the other lines, and all its hiding rules live in
// `@media screen` (style.css), so printing always gives the full A4 document, exactly as on a computer.
// Choice kept on this device (localStorage dtf:v1:wizard); on by default on phones.
(function () {
  const form = document.getElementById('doc-form');
  const body = form && form.querySelector('.doc-body');
  const actions = form && form.querySelector('.actions');
  if (!body || !actions || !body.querySelector('.field')) return;

  const root = document.documentElement;
  const fr = root.lang === 'fr';
  const T = fr ? {
    toggle: 'Pas à pas', toggleTitle: 'Remplir le document une ligne à la fois',
    step: (i, n) => 'Étape ' + i + ' sur ' + n, exit: 'Voir tout le document',
    prev: 'Précédent', next: 'Suivant', skip: 'Passer (à remplir à la main)', toReview: 'Vérifier',
    review: (left) => 'Vérifiez le document' + (left ? ' — ' + left + (left > 1 ? ' blancs restent' : ' blanc reste') + ' à remplir à la main' : ''),
    print: 'Imprimer', hint: 'Touchez une valeur pour la modifier',
  } : {
    toggle: 'خطوة بخطوة', toggleTitle: 'ملء الوثيقة سطرًا سطرًا',
    step: (i, n) => 'الخطوة ' + i + ' من ' + n, exit: 'عرض الوثيقة كاملة',
    prev: 'السابق', next: 'التالي', skip: 'تخطٍّ (يُملأ باليد)', toReview: 'مراجعة',
    review: (left) => 'راجع الوثيقة' + (left ? ' — فراغات تُملأ باليد: ' + left : ''),
    print: 'طباعة', hint: 'المس أي قيمة لتعديلها',
  };

  const KEY = 'dtf:v1:wizard';
  const ls = {
    get() { try { return localStorage.getItem(KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch {} },
  };
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };
  const button = (cls, text, title) => {
    const b = el('button', cls, text);
    b.type = 'button';
    if (title) b.title = title;
    return b;
  };
  const isFilled = (f) => (f.type === 'checkbox' ? f.checked : f.value.trim() !== '');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // Labels from the page's own field list (new templates have them; old ones are empty).
  const labels = {};
  try { if (typeof fields !== 'undefined') for (const f of fields) if (f.label) labels[f.id] = f.label; } catch {}

  // ---- UI ----
  const toggle = button('btn-ghost wz-toggle', T.toggle, T.toggleTitle);
  toggle.setAttribute('aria-pressed', 'false');
  actions.insertBefore(toggle, actions.querySelector('.edit-toggle') || actions.querySelector('.btn-ghost:not(.next)') || null);

  const head = el('div', 'wz-head');
  const count = el('span', 'wz-count');
  count.setAttribute('aria-live', 'polite');
  const track = el('span', 'bar');
  track.append(el('i'));
  const exit = button('btn-ghost wz-exit', T.exit);
  head.append(count, exit, track);
  body.before(head);

  const nav = el('div', 'wz-nav');
  const prev = button('btn-ghost wz-prev', T.prev);
  const next = button('primary wz-next', T.next);
  const print = button('primary wz-print', T.print);
  nav.append(prev, next, print);
  actions.prepend(nav);

  // ---- Steps: each line with blanks; a short line without blanks just before it is shown as context ----
  let steps = [];
  let at = 0; // steps.length = the review step
  function units() {
    const out = [];
    for (const c of body.children) {
      if (c.classList.contains('keep-together')) out.push(...c.children);
      else if (c.matches('.doc-line, .doc-table, p, div, table')) out.push(c);
    }
    return out;
  }
  const textOnly = (u) => {
    const c = u.cloneNode(true);
    c.querySelectorAll('input, select, textarea, .pv').forEach((n) => n.remove());
    return c.textContent.trim();
  };
  function buildSteps() {
    const list = units();
    steps = [];
    list.forEach((u, i) => {
      const blanks = [...u.querySelectorAll('.field')];
      if (!blanks.length) return;
      let ctx = null;
      for (let j = i - 1; j >= 0; j--) {
        const p = list[j];
        if (!p.querySelector('.field')) { if (textOnly(p).length <= 160) ctx = p; break; }
        if (textOnly(p)) break; // a line with its own words is not context for this one
      }
      steps.push({ line: u, ctx, blanks });
    });
  }
  const stepOf = (f) => steps.findIndex((s) => s.blanks.includes(f));

  function show(i) {
    at = goal = Math.max(0, Math.min(i, steps.length));
    const review = at === steps.length;
    root.classList.toggle('wz-review', review);
    body.querySelectorAll('.wz-current, .wz-context').forEach((n) => n.classList.remove('wz-current', 'wz-context'));
    const s = steps[at];
    if (s) {
      s.line.classList.add('wz-current');
      if (s.ctx) s.ctx.classList.add('wz-context');
    }
    const all = steps.flatMap((x) => x.blanks);
    count.textContent = review ? T.review(all.filter((f) => !isFilled(f)).length) : T.step(at + 1, steps.length);
    track.firstChild.style.inlineSize = (at / steps.length) * 100 + '%';
    prev.disabled = at === 0;
    updateNext();
    head.dataset.hint = review ? T.hint : '';
  }
  function updateNext() {
    const s = steps[at];
    if (!s) return;
    next.textContent = at === steps.length - 1 ? T.toReview : s.blanks.some(isFilled) ? T.next : T.skip;
    next.classList.toggle('wz-skip', !s.blanks.some(isFilled) && at < steps.length - 1);
  }
  function focusStep() {
    const s = steps[at];
    window.scrollTo({ top: 0 });
    if (!s) { print.focus({ preventScroll: true }); return; }
    const f = s.blanks.find((b) => !isFilled(b)) || s.blanks[0];
    f.focus({ preventScroll: true });
  }

  // Slide between steps with the View Transitions API, toward the reading direction (flips in RTL).
  // `goal` is where we are heading: quick taps during a slide add up instead of being lost.
  let goal = 0;
  function go(i) {
    i = Math.max(0, Math.min(i, steps.length));
    if (i === goal) return focusStep();
    const forward = i > goal;
    goal = i;
    const swap = () => { show(goal); focusStep(); };
    if (!document.startViewTransition || reduced.matches) return swap();
    root.style.setProperty('--wz-from', (forward ? 1 : -1) * (getComputedStyle(root).direction === 'rtl' ? -1 : 1));
    const t = document.startViewTransition(swap);
    t.ready.catch(() => {}); // a newer slide skips this one: expected, not an error
    t.finished.catch(() => {});
  }

  // ---- On / off ----
  let on = false;
  function setWizard(v, remember) {
    if (v && root.classList.contains('editing')) document.querySelector('.edit-toggle')?.click(); // one mode at a time
    on = v;
    root.classList.toggle('wizard', v);
    root.classList.toggle('wz-review', false);
    toggle.setAttribute('aria-pressed', String(v));
    if (remember) ls.set(v ? '1' : '0');
    if (v) {
      buildSteps();
      for (const s of steps) for (const f of s.blanks) if (labels[f.id] && !f.placeholder) { f.placeholder = labels[f.id]; f.dataset.wzPh = '1'; }
      const firstEmpty = steps.findIndex((s) => s.blanks.some((f) => !isFilled(f)));
      show(firstEmpty < 0 ? steps.length : firstEmpty);
      if (remember) focusStep(); // not on page load: a phone keyboard popping up unasked is noise
    } else {
      body.querySelectorAll('.wz-current, .wz-context').forEach((n) => n.classList.remove('wz-current', 'wz-context'));
      body.querySelectorAll('[data-wz-ph]').forEach((f) => { f.removeAttribute('placeholder'); delete f.dataset.wzPh; });
    }
  }

  toggle.addEventListener('click', () => setWizard(!on, true));
  exit.addEventListener('click', () => setWizard(false, true));
  prev.addEventListener('click', () => go(goal - 1));
  next.addEventListener('click', () => go(goal + 1));
  print.addEventListener('click', () => window.print());
  form.addEventListener('input', () => { if (on) updateNext(); });

  // Enter: next blank of this line, then the next step. Shift+Enter: back.
  form.addEventListener('keydown', (e) => {
    if (!on || e.key !== 'Enter' || e.isComposing || !e.target.matches('.field')) return;
    e.preventDefault();
    const s = steps[at];
    if (!s) return;
    const k = s.blanks.indexOf(e.target);
    if (e.shiftKey) return k > 0 ? s.blanks[k - 1].focus() : go(goal - 1);
    if (k > -1 && k < s.blanks.length - 1) return s.blanks[k + 1].focus();
    go(goal + 1);
  });

  // Review: touching a value goes back to its step.
  body.addEventListener('click', (e) => {
    if (!on || at !== steps.length) return;
    const f = e.target.closest('.field');
    if (!f) return;
    const i = stepOf(f);
    if (i > -1) go(i);
  });

  const saved = ls.get();
  const phone = matchMedia('(max-width: 40rem), (hover: none) and (pointer: coarse)').matches;
  if (saved === '1' || (saved === null && phone)) setWizard(true, false);
})();
