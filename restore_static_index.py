
import json
import os

def restore_static_index():
    """
    Generates a static index.html listing all available forms
    based on the templates manifest and the contents of the forms/ directory.
    """
    manifest_path = 'spec/templates.manifest.json'
    forms_dir = 'forms'
    output_file = 'index.html'

    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Manifest file not found at {manifest_path}")
        return

    # Get a set of existing HTML file basenames for quick lookup
    existing_forms = {os.path.splitext(f)[0] for f in os.listdir(forms_dir) if f.endswith('.html')}
    
    links_html = []
    for template in manifest_data.get('templates', []):
        # The 'file' field in the manifest seems to be the basename
        template_basename = template.get('file')
        if template_basename and template_basename in existing_forms:
            title = template.get('title', {}).get('ar', template_basename)
            # We need to get the full filename including extension
            full_filename = f"{template_basename}.html"
            links_html.append(
                f'<li><a href="forms/{full_filename}">{title}</a></li>'
            )

    # If manifest is missing templates, add any extra forms found in the dir
    manifest_basenames = {t.get('file') for t in manifest_data.get('templates', [])}
    unlisted_forms = existing_forms - manifest_basenames
    for basename in sorted(list(unlisted_forms)):
        full_filename = f"{basename}.html"
        links_html.append(
            f'<li><a href="forms/{full_filename}">{basename.replace("_", " ")}</a></li>'
        )


    total_forms = len(links_html)

    html_content = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>النماذج القانونية</title>
<link rel="stylesheet" href="static/style.css">
</head>
<body>
<div class="container">
  <h1>النماذج القانونية</h1>
  <p>{total_forms} نموذج متاح</p>
  <ul class="form-list">
{''.join(links_html)}
  </ul>
</div>
</body>
</html>
"""

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"Successfully restored static {output_file} with {total_forms} links.")

if __name__ == '__main__':
    restore_static_index()
