#!/usr/bin/env bash
# Convert all downloaded .doc files to .docx via LibreOffice, then generate HTML forms.
# Run after: sudo apt install libreoffice-writer

set -e
cd "$(dirname "$0")"

mkdir -p converted forms

echo "=== Step 1: .doc → .docx (LibreOffice) ==="
for f in downloaded/*.doc; do
    name=$(basename "$f" .doc)
    out="converted/${name}.docx"
    if [ -f "$out" ]; then
        echo "  skip (exists): $name.docx"
        continue
    fi
    echo "  Converting: $name"
    libreoffice --headless --convert-to docx "$f" --outdir converted/ 2>&1 | grep -v "^$" || true
done

echo ""
echo "=== Step 2: .docx → HTML forms (python-docx) ==="
python3 convert_docx.py

echo ""
echo "Done. Open index.html in a browser."
