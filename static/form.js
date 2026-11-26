// Form page helpers: progress counter, jump to next empty blank, auto-saved draft.
// Progressive enhancement — the form still works (fill + print) without this file.
(function () {
  const form = document.getElementById('doc-form');
  if (!form) return;

  const fields = Array.from(form.querySelectorAll('.field'));
  const actions = form.querySelector('.actions');
  const key = 'dtf:v1:draft:' + decodeURIComponent(location.pathname.split('/').pop());

  const isFilled = (el) => (el.type === 'checkbox' ? el.checked : el.value.trim() !== '');

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
    '<button type="button" class="btn-ghost next">الفراغ التالي</button>';
  const note = document.createElement('div');
  note.className = 'draft-note';
  if (actions && fields.length) {
    actions.prepend(progress);
    actions.append(note);
  }

  function render() {
    let n = 0;
    for (const el of fields) {
      const f = isFilled(el);
      el.classList.toggle('filled', f);
      if (f) n++;
    }
    const total = fields.length;
    progress.querySelector('.count').textContent = n === total ? 'اكتملت كل الفراغات ✓' : n + ' من ' + total;
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
      b.textContent = 'مسح الكل';
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
    showNote('تمت استعادة مسودتك المحفوظة على هذا الجهاز', true);
  }

  let timer;
  form.addEventListener('input', () => {
    render();
    clearTimeout(timer);
    timer = setTimeout(() => {
      save();
      if (!note.textContent) showNote('تُحفظ المسودة تلقائيًا على هذا الجهاز', true);
    }, 400);
  });

  render();
})();
