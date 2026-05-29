---
tags: [architecture, static, performance, caching, security, localstorage, csp, chunks]
related:
  - decisions/validation-architecture.md
  - decisions/nlp-slot-filling.md
  - spec/field-spec.v1.json
supersedes: ~
status: current
---

# Static App Architecture Patterns

Decisions made 2026-05-29 before building the client-side shell.
App is fully static — templates fetched from chunked JSON files, no server.

---

## Issue 1 — Stable opaque template IDs

Arabic filenames as IDs become `%D8%A8%D9%8A%D8%B9...` in URLs. Bookmarks break,
localStorage keys collide, analytics are unreadable, renaming a file orphans all saved drafts.

**Decision:** `id` is the permanent identity (kebab-case slug, assigned once, never changes).
`file` in manifest is just the source path. Rename file → update `file`, `id` stays.

---

## Issue 2 — Static JSON chunk strategy

One JSON per template → 20 round trips for a category page. Wrong.

**Decision — correct tree:**
```
static/manifest.json          ← tiny, always cached (discovery)
static/search-index.json      ← pre-built at build time, one fetch for search
static/categories/{name}.json ← all templates in category (list view only)
static/templates/{id}.json    ← full field schema, fetched only when form opens
```
Rule: one user action = one fetch maximum.

---

## Issue 3 — Shell renderer vs pre-rendered HTML

Pre-rendered HTML: spec v2 ships → must re-render all 60 files. Want French labels → re-render.
Want to change export button → re-render. A/B test layout → impossible.

**Decision — renderer in JS, data in JSON, HTML is a shell:**
```
forms/shell.html   ← one shell for all forms, reads ?id= from URL
static/renderer.js ← only place that knows how to render a field
templates/{id}.json ← pure data
```
Change renderer once → all 60 forms updated instantly.

---

## Issue 4 — Content hash for cache busting

`style.css` updated → Cloudflare edge serves stale version for hours.

**Decision:**
- `style.a3f9c2d1.css` — hash in filename, `Cache-Control: immutable`
- `manifest.json`, `search-index.json` → `Cache-Control: no-cache`
- `templates/*.json` → `Cache-Control: max-age=31536000, immutable`
  (content never changes once published — new templates = new file)

---

## Issue 5 — Inline JS breaks CSP

`<script>const fields = [...]</script>` blocked by `script-src 'self'` on any serious host.

**Decision — no inline scripts ever:**
```html
<template id="field-data" type="application/json">{"fields": [...]}</template>
<script src="../static/renderer.js" type="module"></script>
```
Renderer reads from `<template>` tag, not inline JS.

---

## Issue 6 — localStorage key collisions

Arabic key encoding varies by browser. Two templates with similar names collide silently.

**Decision — namespaced versioned keys:**
```js
`dtf:v1:draft:${template.id}`
// e.g. "dtf:v1:draft:bay-saydalia"
```
`dtf:` namespace = scoped to this app. `v1` = clear all drafts on breaking schema change.

---

## Issue 7 — html2pdf.js + Arabic = broken

html2pdf uses html2canvas (screenshot). Arabic text is mirrored, unreshaped, RTL order breaks.

**Decision:** Use `window.print()` only. Native browser print-to-PDF has perfect Arabic rendering.
The `@page { size: A4 }` CSS already handles layout. Zero dependencies.

---

## Issue 8 — No build step = no search index

Client-side search fetching all JSONs to build index on first search is unacceptable at 60+ templates.

**Decision:** `build.py` generates `static/search-index.json` from manifest at build time.
One 10–15KB JSON → instant search client-side. Run after every template addition.

---

## Issue 9 — Template content drift

Lawyer reviews template, says clause X is wrong. Template updated. Users with cached old version
have no way to know, and their saved draft may be legally outdated.

**Decision — content version separate from spec version:**
```json
{
  "spec_version": "1",
  "content_version": "1.1.0",
  "content_updated": "2026-06-15",
  "legal_review": { "status": "pending", "reviewer": null }
}
```
If stored draft's `content_version` < current → warn user on form open.
Show "⚠ لم يُراجَع من قِبَل محامٍ" badge on `legal_review.status: pending` templates.

---

## Issue 10 — No validation = silent bad data printed

User prints form with blank required fields. Document rejected by court clerk.

**Decision:** `required: true` declared in template JSON per field, not in HTML.
Renderer reads it, adds `required` attribute, blocks print until all required fields filled.
