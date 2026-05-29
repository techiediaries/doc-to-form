---
tags: [google-drive, doc, forms, conversion, automation]
related: []
supersedes: ~
status: current
---

# Feasibility Analysis — doc-to-form

## Section 1 — Problem validation

```
Pain statement:
A Google Drive folder contains .doc files used as fill-in templates (forms).
Accessing them requires opening Google Drive, downloading each file, opening in Word/LibreOffice,
and filling in manually — clunky, not web-native, no validation, no structured output.

Frequency:
Per-use (each time someone needs to fill in one of the forms)

Who feels it:
Ahmed — working with a specific Drive folder of .doc form templates

Current workaround:
Download .doc manually, open in Word/LibreOffice, fill in, re-save or print

Root cause or symptom?:
Root cause: .doc is a print format, not an interactive data-entry format.
The templates were built for paper/Word workflows, not web-native interaction.
```

**Gate result:** [x] Pass — pain is real, specific, recurring

---

## Section 2 — Solution fit

```
How it eliminates the pain:
1. Script downloads all .doc files from the Drive folder (gdown if public, Drive API if private)
2. Parser extracts form fields / blanks / underlined gaps / tables from each .doc
3. Generates an HTML form per doc — fill in browser, no Word needed
4. Optional: export filled form back to .docx or PDF

What changes in the user's workflow:
Open a local web page (or hosted app) → fill form in browser → download result

Explicitly out of scope:
- Syncing edits back to Drive
- Multi-user collaboration
- Complex .doc formatting fidelity (headers, images, custom fonts)

Simpler 80% alternative considered:
Google Forms — but requires recreating all questions manually, loses original layout,
and the Drive folder already has the .doc source of truth.

Why the simpler alternative is insufficient:
The .doc files ARE the canonical templates. Recreating them in Google Forms
is more work than parsing them, and loses fidelity.
```

**Gate result:** [x] Pass

---

## Section 3 — Prior art audit

| Tool | What it does | What it doesn't do | Why build ours |
|---|---|---|---|
| Google Forms | Web-native forms with responses | Doesn't read .doc; manual recreation required | .doc is the source — don't want to duplicate |
| LibreOffice Writer forms | Can open .doc and fill fields | Not web-native; requires install; no automation | Need browser-based, scriptable |
| pdf2form / FormSwift | Converts PDF to fillable PDF | Starts from PDF not .doc; output is PDF not HTML | Need HTML output for web interaction |
| Pandoc | Converts .doc → HTML (structural) | Doesn't detect form fields / blanks; no UI | Good for conversion step, not field detection |

```
Genuine gap:
No tool goes from .doc → browser-fillable HTML form automatically,
detecting blank fields (underlines, table cells, bracketed placeholders).

Type of gap:
Technical — field detection from .doc structure is not covered by any of the above.

Considered contributing to existing tool instead?
No existing tool is close enough to the full pipeline. Pandoc handles conversion;
we'd add field detection + form generation on top.
```

**Gate result:** [x] Pass

---

## Section 4 — Technical feasibility

```
Hardest technical problem:
Field detection — .doc files use various conventions for "fill this in":
underscores (___), bracketed placeholders ([NAME]), table cells, form fields (legacy Word fields).
No single parser handles all of these reliably.

Prototyped / proven?:
No — field detection pattern is the unknown. python-docx can read text and tables;
regex on common patterns (___+, [PLACEHOLDER], {{field}}) covers most cases.
LibreOffice headless can convert to HTML for a cleaner text parse.

Known unknowns:
- How consistent are the .doc conventions across files in this specific folder?
- Are there actual Word form fields (legacy input fields) or just visual underlines?
- Will LibreOffice headless be available on this machine?

Generalization-breaking assumptions:
Assumes blank fields follow one of: underscores, brackets, or table cells.
Files with freeform blank areas (draw-a-box layouts) will not parse cleanly.

Graceful degradation when assumptions fail:
Fall back to full-text display with manual highlight — user sees the doc as text
and fills in a textarea. Not ideal but not broken.
```

**Gate result:** [x] Pass — uncertainty is bounded; fallback exists

---

## Section 5 — Adoption feasibility

```
Step 1 (find/install): Clone/navigate to project folder
Step 2 (configure): Set Drive folder ID; choose gdown (public) or OAuth (private)
Step 3 (first use): Run download script → run converter → open generated HTML
Step 4 (first value): Fill in form in browser, get filled output
```

```
Drop-off point:
Step 2 — OAuth setup if folder is private (requires Google Cloud project + credentials file)

Minimum path to first value:
If folder is public: python download.py → python convert.py → open index.html
That's 3 commands and ~2 minutes.

Upfront investment required:
Public folder: near-zero (install gdown, run scripts)
Private folder: 15-30 min for Google Cloud project + OAuth credentials

Investment proportional to payoff? 
Public: yes, trivially
Private: conditional — yes if the folder has many docs worth converting
```

**Gate result:** [x] Pass (for public folder case) / Conditional (for private)

---

## Section 6 — Build and maintenance cost

```
V1 scope:
IN: download all .doc from folder, convert to HTML form, fill in browser, export filled text
OUT: Drive sync, multi-user, complex formatting, PDF export (phase 2)

Realistic hours for V1:
- Download script: 1h
- .doc → field detection + HTML form: 3-4h (field detection is the variable)
- Simple browser UI to list/open forms: 1h
- Total: 5-6h across 1-2 sessions

Known scope creep risks:
- "Can it export back to .docx?" — Phase 2, explicitly out
- "Can it sync to Drive?" — No
- "Can multiple people fill the same form?" — No

Ongoing maintenance triggers:
- gdown breaks if Google changes Drive's anonymous download (happened before)
- python-docx API changes (rare, stable library)
- No cloud deps if using local server

Who maintains it:
Ahmed only — internal tool

Cost of abandonment:
Zero — falls back to original manual workflow. No users stranded.
```

**Gate result:** [x] Pass

---

## Section 7 — Open source viability

Internal tool — skip.

---

## Verdict

**[x] Conditional go**

```
Condition 1: Verify whether the Drive folder (1sCafcVn_mOhf7I3oHKfFllIlGSUMPBGT) is publicly accessible
             (determines whether gdown path or OAuth path is needed)
Condition 2: Inspect 2-3 .doc files from the folder to confirm field detection patterns
             (underscores? brackets? actual Word form fields?) before writing the parser
```

Build starts immediately with the download step; field detection strategy locked after
inspecting actual files.
