
import os
import json
import re
from bs4 import BeautifulSoup

def convert_html_to_json():
    """
    Parses HTML files in the 'forms/' directory, extracts their structure
    and field definitions, and saves them as structured JSON files in the
    'templates/' directory.
    """
    forms_dir = 'forms'
    output_dir = 'templates'
    
    if not os.path.exists(forms_dir):
        print(f"Error: Directory '{forms_dir}' not found.")
        return

    os.makedirs(output_dir, exist_ok=True)

    form_files = [f for f in os.listdir(forms_dir) if f.endswith('.html')]
    print(f"Found {len(form_files)} HTML forms to convert.")

    all_templates_metadata = []

    for file_name in form_files:
        file_path = os.path.join(forms_dir, file_name)
        base_name = os.path.splitext(file_name)[0]
        
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html.parser')

        # --- Extract field definitions from the script tag ---
        script_tag = soup.find('script')
        fields_json = []
        if script_tag:
            script_content = script_tag.string
            match = re.search(r'const fields = (\[.*?\]);', script_content, re.DOTALL)
            if match:
                try:
                    fields_json = json.loads(match.group(1))
                except json.JSONDecodeError:
                    print(f"Warning: Could not parse fields JSON in {file_name}")

        # --- Extract document body structure ---
        doc_body = soup.find('div', class_='doc-body')
        if not doc_body:
            print(f"Warning: No 'doc-body' found in {file_name}")
            continue
            
        document_structure = []
        for element in doc_body.children:
            if element.name == 'p' and 'doc-line' in element.get('class', []):
                line_content = []
                for content_part in element.contents:
                    if content_part.name == 'input':
                        field_id = content_part.get('id')
                        line_content.append({'type': 'field', 'id': field_id})
                    elif content_part.name is None: # It's a NavigableString (text)
                        text = content_part.string.strip()
                        if text:
                            line_content.append({'type': 'text', 'value': text})
                document_structure.append({'type': 'paragraph', 'content': line_content})
            elif element.name == 'br':
                 document_structure.append({'type': 'break'})


        # --- Combine and save the new JSON template ---
        template_data = {
            'id': base_name,
            'title': soup.title.string if soup.title else base_name,
            'fields': fields_json,
            'structure': document_structure
        }
        
        output_path = os.path.join(output_dir, f"{base_name}.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(template_data, f, ensure_ascii=False, indent=2)

        # --- Add to metadata list for manifest ---
        all_templates_metadata.append({
            "id": base_name,
            "title": template_data['title'],
            "file": f"{base_name}.json",
            "field_count": len(fields_json)
        })

    # --- Create a new manifest for the dynamic app ---
    manifest_path = os.path.join(output_dir, 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(all_templates_metadata, f, ensure_ascii=False, indent=2)

    print(f"Successfully converted {len(form_files)} forms.")
    print(f"New JSON templates are in: '{output_dir}'")
    print(f"A new manifest file has been created: '{manifest_path}'")

if __name__ == '__main__':
    convert_html_to_json()
