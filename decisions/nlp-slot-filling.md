---
tags: [nlp, slot-filling, arabic, entity-extraction, template-routing, camelbert, arabert]
related:
  - decisions/static-app-architecture.md
  - decisions/validation-architecture.md
supersedes: ~
status: current
---

# NLP Slot-Filling — Decision and Architecture

Decided 2026-05-29.
Question: can NLP models (not LLMs) fill forms from user free-text? Worth it?

---

## Verdict: Yes. Scope it in two phases.

The task is **slot filling** — extract structured values from free text and map them to
known field names. Classical NLP, solved since the 1990s. Not "understand legal Arabic."

---

## Phase 1 — Rule-based (free, offline, ships first)

Covers ~70% of what users type. Runs entirely client-side, no model, no API, no latency.

### Entity extraction by regex + trigger words:

| User types | Rule | Extracted |
|---|---|---|
| `50,000 درهم` or `50000 درهم` | currency regex | `amount: 50000` |
| `ب.ت.و رقم B234567` | CIN pattern | `cin: B234567` |
| `0661234567` or `06 61 23 45 67` | phone pattern | `phone: 0661234567` |
| `من السيد X` / `إلى السيدة X` | trigger word + name | `person: X` |
| `بتاريخ 15 يونيو` / `15/06/2026` | date pattern | `date: 2026-06-15` |
| `شقة بالدار البيضاء` | property + city dict | `type: شقة, city: الدار البيضاء` |

### Template routing — keyword scoring (no model):

```js
const KEYWORDS = {
  'iqrar-adam-madiyuniya': ['ديون', 'مديونية', 'براءة الذمة'],
  'aqd-ijar-sakani':       ['إيجار', 'كراء', 'مكتري', 'شقة', 'محل'],
  'bay-saydalia':          ['بيع', 'شراء', 'مشتري', 'بائع', 'ثمن'],
  'tawkil-khas':           ['توكيل', 'وكيل', 'أُوَكِّل', 'نيابة'],
  'itifaqiya-shiraka':     ['شركة', 'شريك', 'رأس المال', 'شراكة'],
}
// Score each template by keyword hits → return top 3
```

### UX flow:

```
User: "أريد وصل استلام مبلغ 30,000 درهم من السيد عبد الله المنصوري"

Extracts:
  template suggestion: "وصل استلام مبلغ مالي"
  amount: 30,000 درهم
  person: عبد الله المنصوري

Shows:
  [30,000 درهم ✓] [عبد الله المنصوري ✓] [رقم البطاقة: ?] [التاريخ: اليوم؟]

User confirms chips → fields pre-filled → fills remaining 2 gaps → print
```

---

## Phase 2 — Small NER model (only if phase 1 proves insufficient)

When to evaluate: after shipping phase 1, measure what the rule-based extractor fails on.
Common failure: names not preceded by a trigger word (`من/إلى/السيد`).

**Candidate models:**
- **CAMeL-Tools** (NYU Abu Dhabi) — Arabic NLP toolkit, has NER weights, MIT license
- **AraBERT** fine-tuned for NER — strong Arabic NER, heavier (~500MB)
- **camelbert-msa-ner** — smaller, Modern Standard Arabic, best fit for legal Arabic

**Deployment:** Cloudflare Worker + ONNX runtime. Client sends text → worker returns
extracted entities as JSON. Model stays server-side. Client just receives structured data.
Zero model weight shipped to browser.

**Do NOT:** run BERT in the browser (100–500MB download, 2–5s inference on mobile).

---

## What NLP cannot replace

- Knowing which template is legally correct for a given situation
- Generating the legal language (use LLMs for that, separate feature)
- Understanding ambiguous situations ("I want to sell my share in a company I co-own
  but my partner disagrees" → requires legal advice, not slot filling)

---

## Implementation order

1. Regex entity extractor (`extractor.js`) — ships with phase 1
2. Keyword template router (`router.js`) — ships with phase 1
3. Slot-filling UI (chips + confirm flow) — ships with phase 1
4. Evaluate CAMeL NER on failure cases — phase 2 decision point
5. Cloudflare Worker + ONNX — only if phase 2 is green-lit

Phase 1 alone makes the app meaningfully better. Phase 2 is optimization, not prerequisite.
