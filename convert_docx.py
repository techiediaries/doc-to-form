#!/usr/bin/env python3
"""
Convert .docx files (converted from .doc via LibreOffice) to HTML fill-in forms.
Uses python-docx for full formatting access: underlines, table cells, Word form fields.

Pipeline:
  .doc → (LibreOffice) → converted/*.docx → (this script) → forms/*.html

Run:
  # Step 1 — convert all .doc to .docx (run once after LibreOffice is installed):
  #   libreoffice --headless --convert-to docx downloaded/*.doc --outdir converted/
  #
  # Step 2 — generate HTML forms:
  python3 convert_docx.py [--all | file.docx ...]
"""
import os
import re
import glob
import json
import argparse
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn

_field_counter = 0


def _next_id():
    global _field_counter
    _field_counter += 1
    return f"f{_field_counter}"


def is_underlined_blank(run):
    """True if run is underlined and contains only whitespace/dots."""
    if not run.underline:
        return False
    text = run.text
    return not text.strip() or set(text.strip()) <= {'.', '_', ' '}


def has_word_formfield(paragraph):
    """Check if paragraph contains a legacy Word form field (fldChar/instrText)."""
    xml = paragraph._element.xml
    return 'fldChar' in xml or 'instrText' in xml


def extract_field_instruction(paragraph):
    """Extract field type from Word field instruction text."""
    for elem in paragraph._element.iter(qn('w:instrText')):
        text = elem.text or ''
        if 'FORMTEXT' in text:
            return 'text'
        if 'FORMCHECKBOX' in text:
            return 'checkbox'
        if 'FORMDROPDOWN' in text:
            return 'select'
    return 'text'


def run_to_html(run, fields):
    """Convert a single run to HTML, replacing blank runs with inputs."""
    text = run.text

    if not text:
        return ''

    # Underlined whitespace/dots → input field
    if is_underlined_blank(run):
        fid = _next_id()
        fields.append({'id': fid, 'type': 'text', 'label': ''})
        return f'<input type="text" id="{fid}" name="{fid}" class="field">'

    # Apply inline formatting
    html = escape_html(text)
    if run.bold:
        html = f'<strong>{html}</strong>'
    return html


def escape_html(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


# Fallback regex patterns for docs where formatting isn't preserved
DATE_RE = re.compile(r'[\.\s_]{2,}/[\.\s_]{2,}/[\.\s_]{4,}')
DOTS_RE = re.compile(r'\.{5,}')
UNDERSCORES_RE = re.compile(r'_{4,}')
BRACKET_RE = re.compile(r'\[([^\]]{1,50})\]')
PAREN_RE = re.compile(r'\(([^)]{3,50})\)')


def apply_regex_fields(text, fields):
    """Apply regex field detection as fallback on plain text."""
    out = text

    def rep_date(m):
        fid = _next_id()
        fields.append({'id': fid, 'type': 'date', 'label': 'تاريخ'})
        return f'<input type="date" id="{fid}" name="{fid}" class="field date-field">'

    def rep_dots(m):
        fid = _next_id()
        fields.append({'id': fid, 'type': 'text', 'label': ''})
        return f'<input type="text" id="{fid}" name="{fid}" class="field">'

    def rep_bracket(m):
        label = m.group(1).strip()
        fid = _next_id()
        fields.append({'id': fid, 'type': 'text', 'label': label})
        return f'<input type="text" id="{fid}" name="{fid}" placeholder="{escape_html(label)}" class="field">'

    def rep_paren(m):
        label = m.group(1).strip()
        if label.isdigit() or len(label) < 3:
            return m.group(0)
        fid = _next_id()
        fields.append({'id': fid, 'type': 'text', 'label': label})
        return f'<input type="text" id="{fid}" name="{fid}" placeholder="{escape_html(label)}" class="field">'

    out = DATE_RE.sub(rep_date, out)
    out = BRACKET_RE.sub(rep_bracket, out)
    out = PAREN_RE.sub(rep_paren, out)
    out = DOTS_RE.sub(rep_dots, out)
    out = UNDERSCORES_RE.sub(rep_dots, out)
    return out


def paragraph_to_html(para, fields):
    """Convert a paragraph to an HTML line, detecting fields from runs and regex."""
    # Word form fields — whole paragraph is one field
    if has_word_formfield(para):
        ftype = extract_field_instruction(para)
        fid = _next_id()
        label = para.text.strip()
        fields.append({'id': fid, 'type': ftype, 'label': label})
        if ftype == 'checkbox':
            return f'<label><input type="checkbox" id="{fid}" name="{fid}"> {escape_html(label)}</label>'
        return f'<input type="{ftype}" id="{fid}" name="{fid}" placeholder="{escape_html(label)}" class="field">'

    # Build HTML run by run
    parts = []
    for run in para.runs:
        parts.append(run_to_html(run, fields))
    line = ''.join(parts)

    # If no formatting-based fields found, fall back to regex on the plain text
    if '<input' not in line and para.text.strip():
        plain = escape_html(para.text)
        line = apply_regex_fields(para.text, fields)
        if line == para.text:
            line = plain  # no matches — use escaped plain text

    return line


def table_to_html(table, fields):
    """Convert a Word table to an HTML table, treating empty cells as inputs."""
    rows_html = []
    for row in table.rows:
        cells_html = []
        for cell in row.cells:
            cell_text = cell.text.strip()
            # Empty cell or pure whitespace/dots = fill-in field
            if not cell_text or set(cell_text) <= {'.', '_', ' ', '،', ','}:
                fid = _next_id()
                fields.append({'id': fid, 'type': 'text', 'label': ''})
                cells_html.append(
                    f'<td><input type="text" id="{fid}" name="{fid}" class="field cell-field"></td>'
                )
            else:
                # Cell has content — render paragraphs inside it
                cell_parts = []
                for para in cell.paragraphs:
                    cell_parts.append(paragraph_to_html(para, fields))
                cells_html.append(f'<td>{"<br>".join(p for p in cell_parts if p)}</td>')
        rows_html.append('<tr>' + ''.join(cells_html) + '</tr>')
    return '<table class="doc-table">' + ''.join(rows_html) + '</table>'


def docx_to_html(docx_path, output_dir):
    """Convert one .docx to a standalone HTML form."""
    global _field_counter
    _field_counter = 0

    name = Path(docx_path).stem
    fields = []

    try:
        doc = Document(docx_path)
    except Exception as e:
        print(f"  SKIP {name}: {e}")
        return None

    body_parts = []

    # Walk document body elements in order (paragraphs and tables interleaved)
    from docx.oxml.ns import qn as _qn
    body = doc.element.body
    for child in body:
        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag

        if tag == 'p':
            from docx.text.paragraph import Paragraph
            para = Paragraph(child, doc)
            line = paragraph_to_html(para, fields)
            if line.strip():
                body_parts.append(f'<p class="doc-line" dir="rtl">{line}</p>')
            else:
                body_parts.append('<br>')

        elif tag == 'tbl':
            from docx.table import Table
            table = Table(child, doc)
            body_parts.append(table_to_html(table, fields))

    body_html = '\n'.join(body_parts)

    html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape_html(name)}</title>
<link rel="stylesheet" href="../static/style.css">
</head>
<body>
<div class="container">
  <h1 class="doc-title">{escape_html(name)}</h1>
  <form id="doc-form" autocomplete="off">
    <div class="doc-body">
{body_html}
    </div>
    <div class="actions">
      <button type="button" onclick="exportForm('{escape_html(name)}')">تصدير كنص</button>
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
    const val = el ? (el.type === 'checkbox' ? (el.checked ? '✓' : '☐') : el.value) : '';
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
    return out_path, len(fields)


def build_index(entries):
    items = ''.join(
        f'<li><a href="forms/{e["file"]}">{escape_html(e["title"])}</a> '
        f'<span class="field-count">({e["fields"]} حقل)</span></li>\n'
        for e in sorted(entries, key=lambda x: x['title'])
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
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)


def main():
    parser = argparse.ArgumentParser(description='Convert .docx files to HTML forms')
    parser.add_argument('files', nargs='*', help='.docx files (default: all in converted/)')
    args = parser.parse_args()

    os.makedirs('forms', exist_ok=True)

    docx_files = args.files or sorted(glob.glob('converted/*.docx'))
    if not docx_files:
        print("No .docx files found in converted/. Run LibreOffice conversion first:")
        print("  libreoffice --headless --convert-to docx downloaded/*.doc --outdir converted/")
        return

    entries = []
    for path in docx_files:
        print(f"Converting {os.path.basename(path)}...")
        result = docx_to_html(path, 'forms')
        if result:
            out_path, field_count = result
            name = Path(path).stem
            entries.append({'file': name + '.html', 'title': name, 'fields': field_count})
            print(f"  → forms/{name}.html ({field_count} fields)")

    build_index(entries)
    print(f"\nDone. {len(entries)} forms. Open index.html in a browser.")


if __name__ == '__main__':
    main()
