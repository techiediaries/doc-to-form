
import json
import sys

def update_manifest(new_entries_json):
    """
    Reads the existing manifest, appends new entries, and writes it back.
    """
    manifest_path = 'templates/manifest.json'
    
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        manifest_data = []

    try:
        new_entries = json.loads(new_entries_json)
    except json.JSONDecodeError:
        print("Error: Invalid JSON provided for new entries.", file=sys.stderr)
        sys.exit(1)

    manifest_data.extend(new_entries)

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest_data, f, ensure_ascii=False, indent=2)

    print(f"Successfully added {len(new_entries)} new entries to {manifest_path}.")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python update_manifest.py '<new_entries_json>'", file=sys.stderr)
        sys.exit(1)
    
    update_manifest(sys.argv[1])
