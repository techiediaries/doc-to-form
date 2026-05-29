#!/usr/bin/env python3
"""
Convert .doc files (Word 97-2003 binary) to HTML fill-in forms.

Field detection patterns:
  - .......... (5+ dots) → text input
  - ....../..../........ (date pattern) → date fields
  - [placeholder] or (placeholder) → labeled input
  - _____ (underscores 4+) → text input

Run: python3 convert.py [--all | <file.doc>]
"""
import os
import re
import struct
import glob
import json
import argparse
from pathlib import Path
from olefile import OleFileIO


def extract_text_from_doc(filepath):
    """Extract Unicode text from Word 97-2003 binary .doc file."""
    with OleFileIO(filepath) as ole:
        fib = ole.openstream('WordDocument').read()
        fcMin = struct.unpack('<I', fib[24:28])[0]
        ccpText = struct.unpack('<I', fib[28:32])[0]
        text_bytes = fib[fcMin:fcMin + ccpText * 2]
        text = text_bytes.decode('utf-16-le', errors='replace')
        # Strip non-text garbage after first null block
        cutoff = text.find('\x00\x00\x00')
        if cutoff > 100:
            text = text[:cutoff]
        return text.strip()


# Field patterns — order matters (most specific first)
DATE_PATTERN = re.compile(r'[\.\s]{2,}/[\.\s]{2,}/[\.\s]{4,}')
DOTS_PATTERN = re.compile(r'\.{5,}')
UNDERSCORE_PATTERN = re.compile(r'_{4,}')
BRACKET_PATTERN = re.compile(r'\[([^\]]{1,40})\]')
PAREN_PATTERN = re.compile(r'\(([^)]{1,40})\)')

_field_counter = 0


def _next_id():
    global _field_counter
    _field_counter += 1
    return f"f{_field_counter}"


def text_to_form_html(text, title):
    """Convert extracted text with blank patterns into an HTML form."""
    global _field_counter
    _field_counter = 0

    # Split into lines for better rendering
    lines = text.split('\n')
    fields = []
    html_lines = []

    for line in lines:
        line = line.rstrip()
        if not line:
            html_lines.append('<br>')
            continue

        out = line

        # Date fields first (dd/mm/yyyy pattern)
        def replace_date(m):
            fid = _next_id()
            fields.append({'id': fid, 'type': 'date', 'label': 'تاريخ'})
            return f'<input type="date" id="{fid}" name="{fid}" class="field date-field">'

        out = DATE_PATTERN.sub(replace_date, out)

        # Named bracket placeholders
        def replace_bracket(m):
            fid = _next_id()
            label = m.group(1).strip()
            fields.append({'id': fid, 'type': 'text', 'label': label})
            return f'<input type="text" id="{fid}" name="{fid}" placeholder="{label}" class="field">'

        out = BRACKET_PATTERN.sub(replace_bracket, out)

        # Parenthesized placeholders (only if 3+ chars inside — avoid false positives)
        def replace_paren(m):
            label = m.group(1).strip()
            if len(label) < 3 or label.isdigit():
                return m.group(0)
            fid = _next_id()
            fields.append({'id': fid, 'type': 'text', 'label': label})
            return f'<input type="text" id="{fid}" name="{fid}" placeholder="{label}" class="field">'

        out = PAREN_PATTERN.sub(replace_paren, out)

        # Dot blanks (after date already handled)
        def replace_dots(m):
            fid = _next_id()
            fields.append({'id': fid, 'type': 'text', 'label': ''})
            return f'<input type="text" id="{fid}" name="{fid}" class="field">'

        out = DOTS_PATTERN.sub(replace_dots, out)

        # Underscore blanks
        def replace_underscores(m):
            fid = _next_id()
            fields.append({'id': fid, 'type': 'text', 'label': ''})
            return f'<input type="text" id="{fid}" name="{fid}" class="field">'

        out = UNDERSCORE_PATTERN.sub(replace_underscores, out)

        html_lines.append(f'<p class="doc-line" dir="rtl">{out}</p>')

    body = '\n'.join(html_lines)
    return body, fields


def doc_to_html(doc_path, output_dir):
    """Convert one .doc to a standalone HTML form. Returns output path."""
    name = Path(doc_path).stem
    title = name  # Arabic filename as title

    try:
        text = extract_text_from_doc(doc_path)
    except Exception as e:
        print(f"  SKIP {name}: {e}")
        return None

    body_html, fields = text_to_form_html(text, title)

    html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="stylesheet" href="../static/style.css">
</head>
<body>
<div class="container">
  <h1 class="doc-title">{title}</h1>
  <form id="doc-form" autocomplete="off">
    <div class="doc-body">
{body_html}
    </div>
    <div class="actions">
      <button type="button" onclick="exportForm('{name}')">تصدير كنص</button>
      <button type="button" onclick="window.print()">طباعة</button>
      <a href="../index.html">← العودة للقائمة</a>
    </div>
  </form>
</div>
<script>
const fields = {json.dumps(fields, ensure_ascii=False)};

function exportForm(name) {{
  let out = '';
  fields.forEach(f => {{
    const el = document.getElementById(f.id);
    const val = el ? el.value : '';
    out += (f.label || f.id) + ': ' + val + '\\n';
  }});
  const blob = new Blob([out], {{type: 'text/plain;charset=utf-8'}});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name + '-filled.txt';
  a.click();
}}
</script>
</body>
</html>"""

    out_path = os.path.join(output_dir, name + '.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)
    return out_path


def build_index(forms_dir, entries):
    """Build index.html listing all forms."""
    items = ''.join(
        f'<li><a href="forms/{e["file"]}">{e["title"]}</a> '
        f'<span class="field-count">({e["fields"]} حقل)</span></li>\n'
        for e in entries
    )
    html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>النماذج القانونية</title>
<link rel="stylesheet" href="static/style.css">
</head>
<body>
<div class="container">
  <h1>النماذج القانونية</h1>
  <p>{len(entries)} نموذج متاح</p>
  <ul class="form-list">
{items}
  </ul>
</div>
</body>
</html>"""
    with open(os.path.join(forms_dir, '..', 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)


def main():
    parser = argparse.ArgumentParser(description='Convert .doc files to HTML forms')
    parser.add_argument('files', nargs='*', help='.doc files to convert (default: all in downloaded/)')
    args = parser.parse_args()

    os.makedirs('forms', exist_ok=True)
    os.makedirs('static', exist_ok=True)

    doc_files = args.files or sorted(glob.glob('downloaded/*.doc'))
    if not doc_files:
        print("No .doc files found. Run download.py first.")
        return

    entries = []
    for doc_path in doc_files:
        print(f"Converting {os.path.basename(doc_path)}...")
        out = doc_to_html(doc_path, 'forms')
        if out:
            name = Path(doc_path).stem
            # Count input fields in the generated file
            with open(out, encoding='utf-8') as f:
                content = f.read()
            field_count = content.count('<input ')
            entries.append({'file': name + '.html', 'title': name, 'fields': field_count})
            print(f"  → forms/{name}.html ({field_count} fields)")

    build_index('forms', entries)
    print(f"\nDone. Open index.html in a browser.")


if __name__ == '__main__':
    main()
