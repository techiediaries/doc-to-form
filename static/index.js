// Index page: search box + category chips over the static list.
// Progressive enhancement — without this file the full list still shows.
(function () {
  const list = document.querySelector('.form-list');
  if (!list) return;

  // Same letter written different ways should still match: أ/إ/آ→ا, ى→ي, ة→ه, no tashkeel.
  const norm = (s) =>
    s.normalize('NFKD')
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .toLowerCase()
      .trim();

  // Category from the title's first word. Order = chip order.
  const CATS = [
    ['اقرارات', /^(اقرار|صيغه اقرار|تصريح)/],
    ['عقود', /^(عقد|العقد|اتفاقيه|اوراق الضد)/],
    ['بيع', /^بيع/],
    ['وكالات', /^(توكيل|وكاله)/],
    ['أخرى', /./],
  ];

  const items = Array.from(list.querySelectorAll('li')).map((li) => {
    const title = norm(li.textContent);
    const cat = CATS.find(([, re]) => re.test(title))[0];
    return { li, title, cat };
  });

  const search = document.createElement('div');
  search.className = 'search';
  search.innerHTML =
    '<input type="search" autocomplete="off" enterkeyhint="search" aria-label="بحث">' +
    '<div class="chips" role="toolbar" aria-label="الأصناف"></div>';
  const input = search.querySelector('input');
  const chips = search.querySelector('.chips');
  input.placeholder = 'ابحث في ' + items.length + ' نموذجًا…';
  list.before(search);

  const empty = document.createElement('p');
  empty.className = 'empty';
  empty.textContent = 'لا توجد نتائج. جرّب كلمة أخرى.';
  empty.hidden = true;
  list.after(empty);

  let active = 'الكل';
  const counts = { 'الكل': items.length };
  for (const { cat } of items) counts[cat] = (counts[cat] || 0) + 1;

  for (const name of ['الكل', ...CATS.map(([n]) => n)]) {
    if (!counts[name]) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.cat = name;
    b.setAttribute('aria-pressed', String(name === active));
    b.innerHTML = name + '<span>' + counts[name] + '</span>';
    chips.append(b);
  }

  function apply() {
    const q = norm(input.value);
    let shown = 0;
    for (const it of items) {
      const ok = (active === 'الكل' || it.cat === active) && (!q || it.title.includes(q));
      it.li.hidden = !ok;
      if (ok) shown++;
    }
    empty.hidden = shown > 0;
  }

  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    active = b.dataset.cat;
    for (const c of chips.children) c.setAttribute('aria-pressed', String(c === b));
    apply();
  });
  input.addEventListener('input', apply);
})();
