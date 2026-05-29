#!/usr/bin/env python3
"""
Download all .doc files from the Drive folder by individual file ID.
gdown folder API caps at 50 — we enumerate via Google Drive API (no auth for public folders)
then download each file directly.
Run: python3 download.py
"""
import os
import gdown
import requests

FOLDER_ID = "1sCafcVn_mOhf7I3oHKfFllIlGSUMPBGT"
OUTPUT_DIR = "downloaded"

# All file IDs and names captured from folder listing (50 files confirmed public)
FILES = [
    ("14eGHemUdav070BXsPwQ1c9SOw3Fdw2fR", "اقرار بابراء الكفيل من الكفالة.doc"),
    ("1FsPbLE4O2RM8EfWLdkLiFK2gG3VODFWD", "اقرار باجراء الترميمات الضرورية.doc"),
    ("1mj7VaBvGep6LgXgN1e6PdoUI2nVx8fuj", "اقرار باسترداد العارية.doc"),
    ("1a-5plMvX-2_l9uxRbuDYHLvcbfMuZSIs", "اقرار باسترداد المودع للوديعة.doc"),
    ("1A6m-VrlgSepPZwCu49zpEYY2ltTTXg_J", "اقرار باسترداد الوكيل ما انفقه وفوائده.doc"),
    ("1ZArrl9SuIT1ENMfSzxz9VIy7mzRvJs0N", "اقرار بالاذن باجراء تعديلات.doc"),
    ("1qxLFdJx5mmn2Yz6NhU_P5LByff0CCPWt", "اقرار بالتنازل عن الحق فى وعد بالبيع.doc"),
    ("1vLrj8YggUAwAoiSAa58OuLvCYqxv4RFb", "اقرار بالتنازل عن طلب الازالة.doc"),
    ("1IDJNIajSKfzi2sUGdJSCoxJVxqpV756-", "اقرار بالعلم بما يتهدد العين المؤجرة.doc"),
    ("1HNNr0ZeW29nGTd14ZFMCPgSuowuBh-Ft", "اقرار بتسلم الشئ المعار.doc"),
    ("10vVpoFktDcYOhM9lRQkezUggJ67-1nvj", "اقرار بتسلم العين المؤجرة.doc"),
    ("1Z57PK-esjoUqwxQ8JsvI83VlIqElNFzN", "اقرار بتسلم المبيع.doc"),
    ("1a_tqXq7ih7pvyFyITEjPePKDUMGcc7O0", "اقرار بتسلم كل شريك ما يخصه بعد التصفية.doc"),
    ("1uvx1TYaYfNS5r5TN7QWWIvfHRNTqDvwU", "اقرار بتسلم محل القرض.doc"),
    ("1fgSF3iZSB2FHMNhyoVYHyPVRspA6QFHW", "اقرار بتسليم مواد البناء.doc"),
    ("1gEIUpCBoUXKA57HVXKir4aUBfDhWgrZv", "اقرار بتلسم الشئ المقايض عليه.doc"),
    ("1f4gDiDiN1c_-sopoI_X66BIkxuPt6ga3", "اقرار بتنحى وكيل.doc"),
    ("1LvQ3OmMgqGmSozctE-tqYlUAWAyzOA-B", "اقرار بتنفيذ المقاولة وفقا للاصول الفنية.doc"),
    ("1rzkxzojZtL3cfsv30CJJfnZomOh5jelV", "اقرار بحل شركة قبل انقضاء اجلها.doc"),
    ("1TBQceU1vKsedO13BJ6o-BrQDRxJvlCKl", "اقرار برفض هبة.doc"),
    ("15AQEqIgFGBr6Y7uo_w2_vRdCPmuj9ecX", "اقرار بعزل وكيل.doc"),
    ("1AKI7DLXPL9Lj6KcCg0JfX6tzBoAGnsdi", "اقرار بعلم البائع بدعوى الاستحقاق.doc"),
    ("1yD0_iZNxf1tppILFAyZQi0_Z0fJus3ln", "اقرار بقبض اجر التصميم والمقايسة وتخالص.doc"),
    ("1_YpEqxu_uKku0CPKQt6LeccNTj-XLz8n", "اقرار بقبض العوض فى الهبة.doc"),
    ("1omLr986m2BMrH86EeBENLAJefsrzZeRV", "اقرار بقبض المعدل فى مقايضة.doc"),
    ("19QGMg7U2qPKj0NczvcJE91fl9kyAzLvP", "اقرار بقبض المقاول اجره وتخالص.doc"),
    ("1nXVDrrlcnJtmfmG5bEcC3dOCQ1LjsbSk", "اقرار بقبض الوكيل لأجره.doc"),
    ("1vJBrIaU_o69-ogW3Nu9XJzOmo52A8Faq", "اقرار بقبض باقى الثمن.doc"),
    ("1QK_hJ23-cjcfC2jh9yynkbzWZYlddEJ5", "اقرار بقبول الوكالة.doc"),
    ("1HoOirb9vebm7w6RuE07Dbn2KKaBMdV0G", "اقرار بقبول تنازل المقاول لآخر.doc"),
    ("1csvWYXFWsNnoeMNvXrXZLdK0q0YlBzlr", "اقرار بقبول هبة واستلام الشئ الموهوب.doc"),
    ("1WCxYxGXwAGVkzpx-7HKwQ4o9TJuKEvPX", "اقرار بمد اجل الشركة.doc"),
    ("1ktW1yUR_t4UrNii-juBVYAjDxq1A-Cxx", "اقرار بمد اجل الوفاء بقرض.doc"),
    ("1C5OJyDXyws_udJscBr7mTQh-_U92O-j4", "اقرار بوعد بفسخ عقد ايجار.doc"),
    ("1RkS054znJsDl6Oh2i0v84RITehbXk6DS", "اقرار بوعد بقبول وكالة.doc"),
    ("1xBOywPvw4IBIu789l5RJV4RIG6CO9SVQ", "اقرار من الدائن بوفاء الكفيل له بالدين وتخالص.doc"),
    ("1oQ0DsTm1GNxh0Q4rTAOERgIIUWTSOkAR", "اقرار من الموكل بتخالصه مع وكيله.doc"),
    ("15YZwZSYquOINw0l_MCe55T89lGw1dTkN", "اقرار من شريك بتخارجه.doc"),
    ("1gd_kgM1QUGbNqvaY-7apv6CQTRKoXAsR", "العقد الابتدائى للشركات المساهمة التى تنشأ.doc"),
    ("1sUaaOdTkvbK2f0L4H2r9kzDH6kJRxE-i", "العقد الابتدائي والنظام الأساسي.doc"),
    ("1x01Md2JLV531FhPeNPOFksGg0VnqJG9q", "العقد الابتدائي والنظام الاساسى 2.doc"),
    ("1a_1KEPN6-iJh_sat9oKcrbxLeuYsu798", "العقد الابتدائي والنظام الاساسى.doc"),
    ("1colepl4wE329TpQxy7OVTJm4SelqPmxL", "اوراق الضد.doc"),
    ("1vOt_qmzu9pNVPledCPa26P24G9WCGsGB", "بيع بضاعة بتظهير سند شحنها أو إيداعها.doc"),
    ("1seDmM-0aMnAoIpKltnAp3__WoH3z2Uno", "بيع حق متنازع فيه مضمون بتأمين عيني.doc"),
    ("1idFVz6Rmty0LM088BlW8V2cdJflL-_3N", "بيع صيدلية.doc"),
    ("1-7RlpStabRxAvtFiXSahpKqeXiBeH52H", "بيع ملك الغير.doc"),
    ("1U8sYWsSkC6V00B_UI_p7_X4Tswn-fqXk", "صيغة إجازة العقد.doc"),
    ("1-_Xm5mMQfwCfLzPZFyGWIFV7OIY1MD9G", "صيغة اشهار وصية.doc"),
    ("1ZCPn7Z7Fdkz-qerSMiLOcmKPXFC6EStf", "صيغة اقرار مصدق عليه بمحو قيد رهن حيازى عقارى وتخالص.doc"),
]


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    total = len(FILES)
    skipped = 0
    downloaded = 0

    for i, (fid, name) in enumerate(FILES, 1):
        dest = os.path.join(OUTPUT_DIR, name)
        if os.path.exists(dest) and os.path.getsize(dest) > 1000:
            print(f"[{i}/{total}] skip (exists): {name}")
            skipped += 1
            continue
        url = f"https://drive.google.com/uc?id={fid}"
        print(f"[{i}/{total}] Downloading: {name}")
        try:
            gdown.download(url, dest, quiet=True)
            downloaded += 1
        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\nDone. {downloaded} downloaded, {skipped} skipped. Total in {OUTPUT_DIR}/: {len(os.listdir(OUTPUT_DIR))}")


if __name__ == '__main__':
    main()
