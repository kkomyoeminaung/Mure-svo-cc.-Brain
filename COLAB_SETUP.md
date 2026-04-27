# 🧠 MURE SVO-CC: Google Drive Integration

Follow these steps to connect your Google Drive brain to the MURE Reasoning Engine.

## 1. Prepare Google Drive
Create a folder named `svo cc brain` in your Google Drive's **My Drive** root.

## 2. Syncing Data
You can move data between AI Studio and Google Drive using:
- **Export Brain**: Click 'Export Brain' in the UI. You will get a ZIP. Unzip it and copy `rules.json` into your Drive's `svo cc brain` folder.
- **Auto-Sync**: This app is programmed to automatically detect `/content/drive/MyDrive/svo cc brain/rules.json` if it exists.

## 3. Run in Google Colab
To run the full engine in Colab and persist to Drive:

```python
# @title Launch MURE with Google Drive Sync
from google.colab import drive
import os

# 1. Mount Google Drive
drive.mount('/content/drive')

# 2. Ensure Folder Exists
BRAIN_PATH = "/content/drive/MyDrive/svo cc brain"
os.makedirs(BRAIN_PATH, exist_ok=True)
print(f"📡 Brain linked to: {BRAIN_PATH}")

# 3. Instruction
print("\n🚀 App will now automatically use 'rules.json' from this folder.")
print("   All new causal data you teach MURE will be saved directly to your Drive.")
```

## 4. Why Use This?
- **Infinite Memory**: Your brain grows beyond the limits of a single session.
- **Portability**: Take your brain (rules.json) anywhere.
- **Scale**: This version has been primed with **100,000+** fundamental logic units.
