---
tags: [doc-to-form, bug-audit, feature-gap-analysis]
related:
  - templates/manifest.json
  - static/app.js
  - spec/field-spec.v1.json
  - TODO.md
supersedes: ~
status: current
---

# Full analysis — bugs and missing features (doc-to-form)

Scope: `app.html` + `static/app.js` (the dynamic app) and its data (`templates/manifest.json`, template JSON files). `index.html` + `forms/*.html` (the legacy static app) is separately assessed at the bottom.

## Critical bugs

### 1. 76% of listed templates are dead links (path-prefix mismatch)
`static/app.js:122` fetches every template as `templates/${template.file}`. But 194 of 255 entries in `templates/manifest.json` have `file` values like `templates_scraped_and_generated/contracts/loan-agreement.json` — a path relative to the **project root**, not to `templates/`. The real file lives at `templates_scraped_and_generated/contracts/loan-agreement.json`; the app requests `templates/templates_scraped_and_generated/contracts/loan-agreement.json`, which doesn't exist.

- Verified: `194/255` manifest entries → 404 on click.
- User-facing effect: clicking ~76% of the list does nothing (only `console.error`, no on-screen message) — looks like the app is broken.
- Root cause: `update_manifest.py` (or whichever script last wrote the manifest) wrote root-relative paths for the `new_generated`/scraped batch but kept `templates/`-relative paths for the `original_html_conversion` batch. Two conventions collided.
- Fix: either move `templates_scraped_and_generated/**` into `templates/` and rewrite `file` to be `templates/`-relative, or change the fetch prefix logic to be root-relative and drop the hardcoded `templates/` prefix. Given `templates/original_html/*.json` already exists correctly, moving the scraped/generated tree into `templates/` and regenerating the manifest is the smaller change.

### 2. Duplicate manifest entries
40 template `id`s appear 2–3 times in `templates/manifest.json`, each pointing at the *same* file (not a real collision, a literal duplicate list entry — likely from `update_manifest.py` re-appending on repeated runs). Effect: the same template shows up 2–3 times in its category in the UI, and the "255 نموذج متاح" header count is inflated by ~35 phantom entries — real unique template count is closer to 200 (61 original + ~139 unique generated/scraped, minus the 4 zero-field ones below).

### 3. Field-spec is documentation only — never wired into the renderer
`spec/field-spec.v1.json` defines rich per-type behavior: CIN pattern `[A-Z]{1,2}[0-9]{6}`, phone pattern `0[67][0-9]{8}`, currency suffix "درهم", checkbox rendering, select options, and distinct `print_style` per type. None of this reaches `renderForm()` in `app.js`. In practice, `input.type = fieldDef.type || 'text'` is the *entire* type-handling logic — and no template JSON on disk actually uses `cin`, `currency`, `phone`, `checkbox`, or `select` as a field type (checked all 232 template files: only `text` (1072), `date` (116), `textarea` (19), `number` (6) occur). So the CIN/phone/amount validation the app's own `TODO.md` calls "critical: courts reject if mismatch" doesn't exist anywhere — not in the generator, not in the templates, not in the renderer. This is the single biggest gap for a legal-document tool: nothing stops a malformed CIN or phone number from going onto a printed legal declaration.

### 4. Zero data persistence — filled forms vanish on back/refresh
`showListView()` sets `this.state.activeForm = null` and there is no localStorage/sessionStorage anywhere in `app.js`. Clicking "← العودة للقائمة" or hitting refresh mid-fill discards everything typed, with no confirmation dialog. For a multi-field legal document (some templates have 100+ fields, e.g. `العقد الابتدائي والنظام الاساسى 2` at 118 fields) this is a severe usability problem, not a nice-to-have — it's already flagged in `TODO.md` under "Namespaced localStorage keys" but is currently **fully unimplemented**, not partially.

### 5. Silent failures, no user-facing error state
`loadAndRenderForm()`'s catch block only does `console.error(...)` — the UI stays on whatever it was showing, with zero indication a click failed. Combined with bug #1, a user can click through a dozen dead template links and see nothing happen each time, with no way to tell the app from a frozen page.

## Data-quality bugs

### 6. Four templates have zero detected fields
4 of 78 files under `templates/` parsed with `fields: []` — these render as static, non-fillable text with no inputs at all, silently. Worth an `audit_template.py` pass (already scoped in `TODO.md`) to catch this at generation time instead of at click time.

### 7. 17 orphan template files never reachable from any UI
17 JSON files exist under `templates/{agency,company,contracts,declarations,other,real_estate}/*.json` (the "before-move" location matching the manifest's `templates/`-relative convention) but have **no entry in `templates/manifest.json` at all** — e.g. `templates/company/merger-agreement.json`, `templates/agency/authorization-to-sign-documents.json`. These are templates that exist and presumably work (their path convention matches what `app.js` actually fetches) but are simply invisible to users because nothing lists them.

## Design/robustness gaps

### 8. `innerHTML` used for data that could contain markup
`renderFormList()` builds list items via `li.innerHTML = ...${template.title}...` and the form title/labels are inserted similarly elsewhere. Current content is self-authored so risk is low today, but any future template ingested from a scrape (there's already a `scrape_bulletin.py` / `scrape_bulletin_analysis.py` pipeline in this repo) could inject HTML into the DOM. Switch to `textContent` / `createTextNode` for all data-derived strings (the field-rendering path already does this correctly with `createTextNode`; only the list-rendering and title-setting paths use `innerHTML`/`textContent` inconsistently — worth auditing both for the same pattern).

### 9. `<input type="cin">` / `type="currency">` are invalid HTML5 — silently downgrade to `type="text"`
Even setting aside bug #3 (no template actually declares these types yet), if one ever did, the browser would silently coerce an unrecognized `type` value to `"text"` per the HTML spec — no error, just loses the intended input semantics (numeric keypad for phone, spinner for currency, etc.). Any future type-aware rendering needs an explicit type map, not a passthrough.

### 10. No required-field enforcement before print or export
Nothing marks a field required, and nothing blocks `window.print()` or "تصدير كنص" when fields are empty — a user can print/export a legal declaration full of blank underscores without warning. Flagged already in `TODO.md`; confirmed unimplemented.

### 11. Placeholder-as-only-label
Every field uses `placeholder` for its label, not an associated `<label>`. Once text is typed, the field's meaning disappears visually — on a form with 100+ fields (several templates hit that), a user who scrolls away and back has no way to recall what a filled blue box represents without deleting the value. Also an accessibility gap (screen readers don't reliably announce placeholder as a label).

### 12. Category fallback silently mislabels
`template.category || 'other'` and `categoryTitles[categoryId] || categoryId` mean any template missing a `category`, or any category key missing from `spec/templates.manifest.json`'s `categories` map, renders the raw category slug (e.g. literal string `"other"`) instead of a real heading — not a crash, but a quality leak into the visible UI.

## Missing features (already scoped in `TODO.md`, confirmed still absent)

Cross-checked against the repo's own backlog — these are not new findings, just confirmation of current state:
- No search/filter on the template list (all 200+ templates in one flat scroll, grouped only by category)
- No `content_version` / `legal_review.status` tracking — nothing distinguishes a lawyer-reviewed template from an LLM-generated draft in the UI (the legal disclaimer only lives in `GEMINI.md`, never surfaces to end users in `app.html`)
- No bilingual (FR/AR) field labels despite Morocco's dual-language legal practice
- No auto-fill of today's date on date fields
- No signature/witness block auto-appended at print time
- No cache-busting / Cache-Control strategy for the eventual Cloudflare deploy

## Legacy static app (`index.html` / `forms/*.html`)

Separate from the above — `index.html` still lists 61 forms pointing into `/forms/*.html` with Arabic filenames containing spaces (e.g. `forms/إقرار بعدم المديونية.html`). This works today served locally, but Arabic-plus-space filenames are a known source of breakage under some static hosts (URL encoding mismatches, Unicode NFC/NFD normalization differences between the filesystem that generated them and the host serving them). Worth a smoke test against Cloudflare Pages specifically before relying on this path, or better, retiring `index.html`/`forms/` entirely once bug #1 is fixed and the dynamic app fully supersedes it (per `GEMINI.md`, `forms/` is already explicitly legacy).

## Priority order to fix

1. **Bug #1** (path-prefix mismatch) — one-line-class fix, unblocks 76% of content immediately.
2. **Bug #2** (duplicate manifest entries) — dedupe on manifest write, cosmetic but visible to every user.
3. **Bug #4** (no persistence) — already scoped, do the namespaced-localStorage TODO item.
4. **Bug #3** (field-spec not wired) — biggest legal-risk item; do before promoting any CIN/phone-bearing template as "ready."
5. Everything else is UX polish, safe to sequence after a working deploy.
