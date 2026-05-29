#!/usr/bin/env python3
"""
Download all .doc files from the Drive folder.
Folder is public — uses gdown, no OAuth needed.
Run: python3 download.py
"""
import os
import gdown

FOLDER_ID = "1sCafcVn_mOhf7I3oHKfFllIlGSUMPBGT"
OUTPUT_DIR = "downloaded"

os.makedirs(OUTPUT_DIR, exist_ok=True)

url = f"https://drive.google.com/drive/folders/{FOLDER_ID}"

print(f"Listing files in folder {FOLDER_ID}...")
files = gdown.download_folder(url, output=OUTPUT_DIR, quiet=False, skip_download=False)
print(f"\nDone. {len(files) if files else 0} files in {OUTPUT_DIR}/")
