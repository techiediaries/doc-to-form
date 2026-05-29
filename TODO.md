## Current

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
