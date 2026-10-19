#!/usr/bin/env python3
"""
Convert .docx files (converted from .doc via LibreOffice) to HTML fill-in forms.
Detection rules are loaded from spec/field-spec.v{N}.json — never hardcoded here.
Templates declare which spec version they use via spec/templates.manifest.json.

Pipeline:
  .doc → (LibreOffice) → converted/*.docx → (this script) → forms/*.html

Run:
  python3 convert_docx.py [file.docx ...]   # specific files
  python3 convert_docx.py                   # all in converted/
"""
import os
import re
import glob
import json
import argparse
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn

SPEC_DIR = "spec"
DEFAULT_SPEC_VERSION = "1"

_field_counter = 0
_spec_cache = {}


def load_spec(version=DEFAULT_SPEC_VERSION):
    """Load and cache field spec for a given version."""
    if version in _spec_cache:
        return _spec_cache[version]
    path = os.path.join(SPEC_DIR, f"field-spec.v{version}.json")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Field spec not found: {path}")
    with open(path, encoding="utf-8") as f:
        spec = json.load(f)
    _spec_cache[version] = spec
    return spec


def load_manifest():
    path = os.path.join(SPEC_DIR, "templates.manifest.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def spec_version_for(filename_stem, manifest):
    """Return the spec version declared for this template, or default."""
    for t in manifest.get("templates", []):
        if t.get("file") == filename_stem:
            return t.get("spec_version", DEFAULT_SPEC_VERSION)
    return DEFAULT_SPEC_VERSION


def make_field_html(spec, ftype, fid, label="", options=""):
    """Render an input from the spec's html_input template."""
    template = spec["field_types"].get(ftype, spec["field_types"]["text"])["html_input"]
    return (template
            .replace("{id}", fid)
            .replace("{label}", label)
            .replace("{options}", options))


def _next_id():
    global _field_counter
    _field_counter += 1
    return f"f{_field_counter}"


def is_underlined_blank(run, spec):
    """True if run is underlined and contains only whitespace/dots — per spec rule priority 3+4."""
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


def run_to_html(run, fields, spec):
    """Convert a single run to HTML, replacing blank runs with inputs."""
    text = run.text

    if not text:
        return ''

    # Underlined whitespace/dots → input field (spec rules priority 3+4)
    if is_underlined_blank(run, spec):
        fid = _next_id()
        fields.append({'id': fid, 'type': 'text', 'label': ''})
        return make_field_html(spec, 'text', fid)

    # Apply inline formatting
    html = escape_html(text)
    if run.bold:
        html = f'<strong>{html}</strong>'
    return html


def escape_html(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def _compile_regex_rules(spec):
    """Build compiled regex list from spec detection_rules, ordered by priority."""
    rules = []
    for rule in sorted(spec["detection_rules"], key=lambda r: r["priority"]):
        if rule.get("source") != "text_regex":
            continue
        try:
            rules.append({
                "name": rule["name"],
                "re": re.compile(rule["pattern"]),
                "output_type": rule["output_type"],
                "label": rule.get("label", ""),
                "min_label_length": rule.get("min_label_length", 0),
                "exclude_if_digits_only": rule.get("exclude_if_digits_only", False),
            })
        except re.error as e:
            print(f"  WARN: bad regex in spec rule '{rule['name']}': {e}")
    return rules


def apply_regex_fields(text, fields, spec):
    """Apply spec-driven regex detection rules in priority order."""
    rules = _compile_regex_rules(spec)
    out = text

    for rule in rules:
        ftype = rule["output_type"]
        label_source = rule["label"]
        min_len = rule["min_label_length"]
        exclude_digits = rule["exclude_if_digits_only"]

        def make_replacer(ftype=ftype, label_source=label_source,
                          min_len=min_len, exclude_digits=exclude_digits,
                          spec=spec, rule=rule):
            def replacer(m):
                # Determine label
                if label_source == "from_capture_group_1":
                    try:
                        label = m.group(1).strip()
                    except IndexError:
                        label = ""
                    if len(label) < min_len:
                        return m.group(0)
                    if exclude_digits and label.isdigit():
                        return m.group(0)
                else:
                    label = label_source

                fid = _next_id()
                fields.append({'id': fid, 'type': ftype, 'label': label})
                return make_field_html(spec, ftype, fid, escape_html(label))
            return replacer

        out = rule["re"].sub(make_replacer(), out)

    return out


def paragraph_to_html(para, fields, spec):
    """Convert a paragraph to an HTML line, detecting fields from runs and regex."""
    # Word form fields — whole paragraph is one field (spec rules priority 1+2)
    if has_word_formfield(para):
        ftype = extract_field_instruction(para)
        fid = _next_id()
        label = para.text.strip()
        fields.append({'id': fid, 'type': ftype, 'label': label})
        return make_field_html(spec, ftype, fid, escape_html(label))

    # Build HTML run by run (spec rules priority 3+4: underlined runs)
    parts = []
    for run in para.runs:
        parts.append(run_to_html(run, fields, spec))
    line = ''.join(parts)

    # Fallback: apply spec regex rules on plain text (priority 5–11)
    if '<input' not in line and para.text.strip():
        line = apply_regex_fields(para.text, fields, spec)
        if line == para.text:
            line = escape_html(para.text)

    return line


def table_to_html(table, fields, spec):
    """Convert a Word table to an HTML table, treating empty cells as inputs (spec rule priority 5)."""
    rows_html = []
    for row in table.rows:
        cells_html = []
        for cell in row.cells:
            cell_text = cell.text.strip()
            if not cell_text or set(cell_text) <= {'.', '_', ' ', '،', ','}:
                fid = _next_id()
                fields.append({'id': fid, 'type': 'text', 'label': ''})
                html = make_field_html(spec, 'text', fid).replace('class="field"', 'class="field cell-field"')
                cells_html.append(f'<td>{html}</td>')
            else:
                cell_parts = []
                for para in cell.paragraphs:
                    cell_parts.append(paragraph_to_html(para, fields, spec))
                cells_html.append(f'<td>{"<br>".join(p for p in cell_parts if p)}</td>')
        rows_html.append('<tr>' + ''.join(cells_html) + '</tr>')
    return '<table class="doc-table">' + ''.join(rows_html) + '</table>'


def docx_to_html(docx_path, output_dir, spec):
    """Convert one .docx to a standalone HTML form using the provided spec."""
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

    from docx.text.paragraph import Paragraph
    from docx.table import Table
    body = doc.element.body
    for child in body:
        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag

        if tag == 'p':
            para = Paragraph(child, doc)
            line = paragraph_to_html(para, fields, spec)
            if line.strip():
                body_parts.append(f'<p class="doc-line" dir="rtl">{line}</p>')
            else:
                body_parts.append('<br>')

        elif tag == 'tbl':
            table = Table(child, doc)
            body_parts.append(table_to_html(table, fields, spec))

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
    parser.add_argument('--spec', default=DEFAULT_SPEC_VERSION, help='Field spec version to use (default: 1)')
    args = parser.parse_args()

    os.makedirs('forms', exist_ok=True)

    manifest = load_manifest()

    docx_files = args.files or sorted(glob.glob('converted/*.docx'))
    if not docx_files:
        print("No .docx files found in converted/. Run LibreOffice conversion first:")
        print("  libreoffice --headless --convert-to docx downloaded/*.doc --outdir converted/")
        print("  (Windows: .\\batch_convert.ps1 does both steps)")
        return

    entries = []
    for path in docx_files:
        name = Path(path).stem
        # Each template picks its own spec version from the manifest
        spec_ver = spec_version_for(name, manifest) if manifest else args.spec
        spec = load_spec(spec_ver)

        print(f"Converting {os.path.basename(path)} [spec v{spec_ver}]...")
        result = docx_to_html(path, 'forms', spec)
        if result:
            out_path, field_count = result
            entries.append({'file': name + '.html', 'title': name, 'fields': field_count})
            print(f"  → forms/{name}.html ({field_count} fields)")

    build_index(entries)
    print(f"\nDone. {len(entries)} forms. Open index.html in a browser.")


if __name__ == '__main__':
    main()
