// Form page helpers: progress counter, jump to next empty blank, auto-saved draft.
// Progressive enhancement — the form still works (fill + print) without this file.
(function () {
  const form = document.getElementById('doc-form');
  if (!form) return;
  const scriptSrc = document.currentScript && document.currentScript.src;

  // UI text follows the page language (<html lang="ar|fr">); the layout follows dir via logical CSS.
  const T = {
    ar: {
      next: 'الفراغ التالي', all: 'اكتملت كل الفراغات ✓', of: (n, t) => n + ' من ' + t, clear: 'مسح الكل',
      restored: 'تمت استعادة مسودتك المحفوظة على هذا الجهاز', autosave: 'تُحفظ المسودة تلقائيًا على هذا الجهاز',
    },
    fr: {
      next: 'Blanc suivant', all: 'Tous les blancs sont remplis ✓', of: (n, t) => n + ' sur ' + t, clear: 'Tout effacer',
      restored: 'Votre brouillon enregistré sur cet appareil a été restauré',
      autosave: 'Le brouillon est enregistré automatiquement sur cet appareil',
    },
  }[document.documentElement.lang === 'fr' ? 'fr' : 'ar'];

  // Text edited in edit mode (editor.js) replaces the original body — before the blanks are collected.
  try {
    const edited = localStorage.getItem('dtf:v1:edit:' + decodeURIComponent(location.pathname.split('/').pop()));
    const docBody = form.querySelector('.doc-body');
    if (edited && docBody) docBody.innerHTML = edited;
  } catch {}

  // Print footer: our own @page margin boxes replace the browser's header/footer (Chrome/Edge 131+),
  // so the paper shows only the site's domain, never a full path or localhost.
  const SITE = 'namadij.ahmedbouchefra.com';
  const host = location.hostname;
  const local = !host || location.protocol === 'file:' || host === 'localhost' || host === '::1' || host === '[::1]' ||
    /^127\./.test(host) || /^(10|192\.168)\./.test(host) || host.endsWith('.local');
  const domain = (local ? SITE : host).replace(/["\\]/g, '');
  const pageStyle = document.createElement('style');
  pageStyle.textContent = '@media print { @page {' +
    ' @bottom-left { content: "' + domain + '"; font: 8.5pt "Segoe UI", system-ui, sans-serif; color: #666; }' +
    ' @bottom-right { content: counter(page) " / " counter(pages); font: 8.5pt "Segoe UI", system-ui, sans-serif; color: #666; }' +
    ' } }';
  document.head.append(pageStyle);

  const fields = Array.from(form.querySelectorAll('.field'));
  const actions = form.querySelector('.actions');
  const key = 'dtf:v1:draft:' + decodeURIComponent(location.pathname.split('/').pop());

  const isFilled = (el) => (el.type === 'checkbox' ? el.checked : el.value.trim() !== '');

  // Closing lines (usually the signature labels + signature blanks) print on one page.
  const lines = form.querySelectorAll('.doc-body > .doc-line');
  if (lines.length > 3) {
    const keep = document.createElement('div');
    keep.className = 'keep-together';
    lines[lines.length - 2].before(keep);
    keep.append(lines[lines.length - 2], lines[lines.length - 1]);
  }

  // ---- Print copy: each blank gets a plain-text twin. Print shows the twin, not the
  // input, so filled values flow as normal text (no box, no underline, no gaps) and
  // only empty blanks keep a dotted line for handwriting.
  document.documentElement.classList.add('has-print-twins');
  const fmtDate = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); return m ? `${m[3]}/${m[2]}/${m[1]}` : v; };
  const twins = new Map();
  for (const el of fields) {
    const t = document.createElement('span');
    t.className = 'pv';
    t.dir = 'auto'; // Latin names inside Arabic text keep their own direction
    el.after(t);
    twins.set(el, t);
  }
  function syncTwins() {
    for (const [el, t] of twins) {
      t.textContent = el.type === 'checkbox' ? (el.checked ? '☑' : '☐')
        : el.type === 'date' ? fmtDate(el.value) : el.value.trim();
    }
  }

  // ---- Storage (may throw in private mode — never break the form) ----
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
    set(v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
    clear() { try { localStorage.removeItem(key); } catch {} },
  };

  // ---- Progress ----
  const progress = document.createElement('div');
  progress.className = 'progress';
  progress.setAttribute('aria-live', 'polite');
  progress.innerHTML =
    '<span class="count"></span><span class="bar"><i></i></span>' +
    '<button type="button" class="btn-ghost next">' + T.next + '</button>';
  const note = document.createElement('div');
  note.className = 'draft-note';
  if (actions && fields.length) {
    actions.prepend(progress);
    actions.append(note);
  }

  function render() {
    syncTwins();
    let n = 0;
    for (const el of fields) {
      const f = isFilled(el);
      el.classList.toggle('filled', f);
      if (f) n++;
    }
    const total = fields.length;
    progress.querySelector('.count').textContent = n === total ? T.all : T.of(n, total);
    progress.querySelector('.bar i').style.inlineSize = (total ? (n / total) * 100 : 0) + '%';
    progress.querySelector('.next').hidden = n === total;
    progress.classList.toggle('done', n === total);
  }

  progress.querySelector('.next').addEventListener('click', () => {
    const el = fields.find((f) => !isFilled(f));
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  });

  // ---- Draft ----
  function save() {
    const data = {};
    for (const el of fields) data[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    if (Object.values(data).some((v) => v !== '' && v !== false)) store.set({ t: Date.now(), data });
    else store.clear();
  }

  function showNote(text, withClear) {
    note.textContent = text;
    if (withClear) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = T.clear;
      b.addEventListener('click', () => {
        form.reset();
        store.clear();
        note.textContent = '';
        render();
      });
      note.append(' · ', b);
    }
  }

  const saved = store.get();
  if (saved && saved.data) {
    for (const el of fields) {
      if (!(el.id in saved.data)) continue;
      if (el.type === 'checkbox') el.checked = !!saved.data[el.id];
      else el.value = saved.data[el.id];
    }
    showNote(T.restored, true);
  }

  let timer;
  form.addEventListener('input', () => {
    render();
    clearTimeout(timer);
    timer = setTimeout(() => {
      save();
      if (!note.textContent) showNote(T.autosave, true);
    }, 400);
  });

  render();

  // Edit mode + Arabic keyboard, then wizard mode, live in their own files (loaded in this order).
  for (const file of ['editor.js', 'wizard.js']) {
    const s = document.createElement('script');
    s.src = scriptSrc ? new URL(file, scriptSrc).href : '../static/' + file;
    s.async = false;
    document.body.append(s);
  }
})();
