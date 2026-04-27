import os
import zipfile
import json

# အစပိုင်းက သတ်မှတ်ခဲ့တဲ့အတိုင်း Google Drive Path တွေချိတ်ဆက်ခြင်း
BASE_DIR = "/content/drive/MyDrive/svo cc brain"
RULES_DIR = os.path.join(BASE_DIR, "rules")
RULES_FILE = os.path.join(RULES_DIR, "rules.json")
DATA_ZIP = os.path.join(BASE_DIR, "priming_data.zip")
EXTRACT_DIR = os.path.join(BASE_DIR, "priming_data_extracted")

print(f"🔍 Checking Google Drive mapping at: {BASE_DIR}")

# 1. Base Directory တည်ဆောက်ခြင်း
if not os.path.exists(BASE_DIR):
    print(f"📁 Creating base directory: {BASE_DIR}")
    os.makedirs(BASE_DIR, exist_ok=True)

# 2. Rules Directory နှင့် File တည်ဆောက်ခြင်း
if not os.path.exists(RULES_DIR):
    os.makedirs(RULES_DIR, exist_ok=True)

if not os.path.exists(RULES_FILE):
    print(f"📄 Creating initial empty rules.json at {RULES_FILE}")
    with open(RULES_FILE, 'w') as f:
        json.dump([], f)
else:
    print(f"✅ Found existing MURE knowledge base (rules.json)")

# 3. Priming Data ZIP ဖိုင်ကို ဖြေခြင်း
if os.path.exists(DATA_ZIP):
    print(f"📦 Found priming data pack: {DATA_ZIP}. Extracting...")
    os.makedirs(EXTRACT_DIR, exist_ok=True)
    try:
        with zipfile.ZipFile(DATA_ZIP, 'r') as zip_ref:
            zip_ref.extractall(EXTRACT_DIR)
        print(f"✅ Priming data successfully extracted to: {EXTRACT_DIR}")
    except Exception as e:
        print(f"⚠️ Error extracting priming_data.zip: {e}")
else:
    print(f"ℹ️ No priming_data.zip found at {DATA_ZIP}. Skipping extraction.")

print("\n🚀 Environment Setup 100% Complete! Ready to Run.")
