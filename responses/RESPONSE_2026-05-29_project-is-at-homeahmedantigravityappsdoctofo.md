Project is at [/home/ahmed/antigravityapps/doc-to-form/](../antigravityapps/doc-to-form/). Here's what's done and what to run next:

**What's built:**
- `download.py` — downloads all 50+ .doc files from the Drive folder (it's public, no auth needed)
- `convert.py` — parses Word 97-2003 binary format directly (no LibreOffice/Java), detects fill-in blanks (dots, date patterns, `[placeholder]`, `(name)` fields), generates RTL Arabic HTML forms
- `static/style.css` — inline input fields styled directly in the text, print mode included

**Field detection works** — sample1 (guarantor release form) got 7 fields: two names, an amount, a date, and the signer field.

**Next two commands to run:**
```bash
cd /home/ahmed/antigravityapps/doc-to-form
python3 download.py         # download all 50+ docs
python3 convert.py          # convert everything → open index.html
```

The forms open in-browser with no server — just `open index.html`.