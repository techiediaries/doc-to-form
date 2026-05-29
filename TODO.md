## Current

## Backlog

### Print & export
- [ ] PDF export button (html2pdf.js) — courts accept PDF; avoids needing a printer
- [ ] Auto-fill today's date in all date fields on form open
- [ ] Signature + witness block at bottom of every printed form

### Field quality
- [ ] Required field validation — block print if critical fields are empty
- [ ] CIN field format validation (B123456 pattern)
- [ ] Fix اوراق الضد + صيغة إجازة العقد — 0 fields detected (inspect manually)

### UX
- [ ] Search/filter on index page — 50+ forms is unwieldy
- [ ] Sector categories on index (real estate, company, loans, agency, gift/inheritance)
- [ ] Bilingual field labels (Arabic + French per field)
- [ ] Save draft to localStorage — resume filling without losing data
- [ ] Auto-fill today's date in all date fields on page load

### Content
- [ ] French version of each form (acte sous seing privé bilingual)
- [ ] Add more form categories beyond the 50 downloaded

### Intelligence
- [ ] LLM fill mode — user describes situation in plain Arabic → fields auto-populate
  e.g. "استلمت 50,000 درهم قرضاً من محمد الأمين اليوم" → fills all fields
  This is the moat: turns form viewer into a legal document assistant

### Infrastructure
- [ ] Deploy as hosted web app (Cloudflare Pages — static, zero cost)
- [ ] Add more docs from other Drive folders or legal sources

## Done
- [x] Feasibility analysis written — 2026-05-29
- [x] Project folder + git repo created — 2026-05-29
- [x] download.py — batch download 50 .doc files from public Drive folder — 2026-05-29
- [x] convert.py — binary OLE parser, regex field detection (v1) — 2026-05-29
- [x] LibreOffice batch conversion: all 50 .doc → .docx — 2026-05-29
- [x] convert_docx.py — python-docx parser: underlines, table cells, Word form fields — 2026-05-29
- [x] A4 print CSS — hides UI chrome, date picker icons, formats for Moroccan paper — 2026-05-29
