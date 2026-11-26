## Current

### Minimalist UI — 2026-11-26
Backup: tag `backup/2026-11-26-pre-minimal-ui` + branch `backup/pre-minimal-ui` (both on GitHub).
Restore: `git checkout backup/pre-minimal-ui -- .` then `npx wrangler deploy`.
- [x] Quiet visual style: white page, one accent colour, underline-only blanks, dark mode
- [x] Index: search box (Arabic-normalised) + category chips, hide test samples
      (samples removed from index.html only — generators still list converted/sample*.docx)
- [x] Forms: small back link on top, one primary action (طباعة), export as secondary
- [x] Forms: progress counter (filled / total) + jump to next empty blank
- [x] Forms: auto-save draft per form (localStorage `dtf:v1:draft:<form>`), clear button
- [x] Same markup in generators (convert.py, convert_docx.py, restore_static_index.py)
- [x] Test in headed Edge: phone 375px + desktop, search, chips, progress, draft restore, print
      27/27 checks pass (Playwright + Edge, headed); print checked by computed style, not on paper
- [x] Deploy + push

### Edit mode + Arabic keyboard — 2026-11-26 (not deployed)
- [x] New templates: تصريح بالشرف, استقالة (Arabic, Moroccan wording, old static format)
- [x] Edit mode (`static/editor.js`, loaded by form.js): edit any text + bold/underline/italic/align/size/undo
      before print; saved per form (`dtf:v1:edit:<form>`), restored by form.js; "الأصل" resets (values kept)
- [x] Arabic phonetic keyboard (table from doua-reminder keyboard.html): works with the installed layout
      (letters by e.key, number row → harakat and ء by key position); on-screen panel with hints read from
      the real layout (navigator.keyboard); Ctrl+Space; hidden on touch-only devices
- [x] Tests: tests/edge-editor.js 31/31, tests/edge-ui.js 29/29 (Edge, headed off)
- [ ] Deploy + push
- AI search/generation research: decisions/ai-template-generation.md (not planned yet)

### Next — bilingual templates (AR + FR) — proposed 2026-11-26, not started
- [ ] Template format v2: fields once (`label: {ar, fr}`, `perLang` for names/addresses), `body: {ar, fr}`
- [ ] One shell page `form.html?id=…&lang=fr` with AR | FR switch; print AR, FR or both
- [ ] Per-language dates + amounts in words (تفقيط / en lettres)
- [ ] Node build script (no Python on this PC): manifest + search index
- [ ] First batch, Moroccan wording, AR + FR: تصريح بالشرف, وكالة, استقالة, شهادة العمل,
      شهادة الأجر, طلب إجازة, شهادة الإيواء, التزام, وصل استلام, عقد كراء سكني
- [ ] "Not legally reviewed" badge until a lawyer checks each template
- [ ] Migrate the 61 old forms (Egyptian sources: جنيه, wording) → Moroccan v2, then retire them + app.html

### State check — 2026-10-19
- Pipeline done: download → LibreOffice → convert_docx.py → 61 static forms in `forms/` (index.html works)
- Dynamic app (`app.html` + `static/app.js`) exists but is broken: manifest has 255 entries,
  **194 point to missing files** (paths say `templates/scraped_and_generated/...`, files live in
  root `templates_scraped_and_generated/`) and **40 are duplicate ids**
- Backlog below: 0 items done (architecture, validation, print, UX, NLP, deploy all open)
- Windows: no Python installed — scripts can't run here yet; `batch_convert.ps1` added for LibreOffice step
- Next step: fix manifest paths + dedupe, then shell renderer / validation

## Backlog

### ARCHITECTURE — fix before adding features (structural, expensive to change later)
- [ ] Stable opaque slugs for ALL ~50 drive-imported templates in manifest (IDs are permanent identity)
- [ ] Shell renderer: one `forms/shell.html?id=bay-saydalia` + `static/renderer.js` + `templates/{id}.json`
      — eliminates re-rendering all HTML when spec or layout changes
- [ ] Namespaced localStorage keys: `dtf:v1:draft:{template.id}` — collision-proof, versionable
- [ ] No inline `<script>` in generated HTML — move to `<template type="application/json">` + external renderer.js (CSP)
- [ ] Build script (`build.py`): generates `static/search-index.json` from manifest at build time

### ARCHITECTURE — before first deploy
- [ ] Content-hash assets: `style.a3f9c2d1.css`, `renderer.b7e1d2a0.js` — cache busting
- [ ] Cache-Control strategy in Cloudflare config:
      `manifest.json` + `search-index.json` → no-cache
      `templates/*.json` → immutable (content never changes once published)
- [ ] Add `required: true/false` to every field in template JSONs

### VALIDATION — document rejection prevention
- [ ] Add validator declarations to field-spec.v1.json:
      CIN: pattern `[A-Z]{1,2}[0-9]{6}`
      Phone: pattern `0[67][0-9]{8}`
      Date: not empty, valid calendar date
      Currency: numeric, > 0
- [ ] Cross-field validators per template in manifest:
      `end_date > start_date` (rental, partnership)
      `parties_differ` — signer CIN ≠ receiver CIN
      `amount_words_match` — تفقيط: words match digits (critical: courts reject if mismatch)
- [ ] Write `validate.js` — client-side validator that reads field declarations from template JSON,
      runs all validators before enabling print button
- [ ] Write `validate.py` — same logic server-side for CI/template authoring checks
- [ ] `content_version` + `legal_review.status` fields in manifest — track which templates have been
      reviewed by a lawyer; show "draft, not legally reviewed" badge on unreviewed ones
- [ ] Draft invalidation: if stored draft's `content_version` < current → warn user on form open

### VALIDATION — template authoring quality (catch issues at generation time not runtime)
- [ ] Write `audit_template.py` — runs on every .docx in converted/:
      checks field count > 0, required fields present, no empty title, date fields detected,
      CIN fields detected where "ب.ت.و" appears in text
- [ ] Add `audit_template.py` to batch_convert.sh — runs after every conversion, prints warnings

### Print & export
- [ ] Native print-to-PDF button (`window.print()`) — NOT html2pdf.js (Arabic reshaping is broken in html2pdf)
- [ ] Auto-fill today's date in all date fields on form open
- [ ] Signature + witness block at bottom of every printed form
- [ ] Required field check before print: highlight empty required fields, block print

### UX
- [ ] Search/filter on index page using pre-built search-index.json
- [ ] Category grouping on index (real estate, company, loans, agency, declarations)
- [ ] Bilingual field labels (Arabic + French per field, declared in template JSON)
- [ ] "Template updated" warning if user's saved draft is older than current content_version

### Content
- [ ] Add French title + field labels to all 10 generated templates
- [ ] Add more templates beyond the 50 downloaded

### Intelligence (NLP — see decision note below)
- [ ] Rule-based entity extractor: regex + dictionary for CIN, phone, amount, date from Arabic text
      → pre-populate fields without any model (handles 70% of cases)
- [ ] Template router: keyword matching (no model needed) — "إيجار" → rental, "بيع" → sale
      → suggest top 3 matching templates from user's free-text description
- [ ] Slot-filling UI: user types description → extracted entities shown as chips → user confirms → fields filled
- [ ] Evaluate AraBERT/CAMeL-BERT NER for name/entity extraction (phase 2, after rule-based proves insufficient)

### Infrastructure
- [ ] Deploy to Cloudflare Pages (static, zero cost, CDN edge)
- [ ] Add more docs from other Drive folders or Moroccan legal sources

## Done
- [x] Feasibility analysis written — 2026-05-29
- [x] Project folder + git repo created — 2026-05-29
- [x] download.py — batch download 50 .doc files from public Drive folder — 2026-05-29
- [x] convert.py — binary OLE parser, regex field detection (v1) — 2026-05-29
- [x] LibreOffice batch conversion: all 50 .doc → .docx — 2026-05-29
- [x] convert_docx.py — python-docx parser: underlines, table cells, Word form fields — 2026-05-29
- [x] A4 print CSS — hides UI chrome, date picker icons, formats for Moroccan paper — 2026-05-29
