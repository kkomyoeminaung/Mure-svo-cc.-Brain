# MURE-SVO-CC-Brain 🌌

MURE (Multiple Underlying Reasoning Engine) is an advanced causal reasoning system designed for AGI-like persistence and logical deduction.

## 🚀 Server Selection Guide

The project contains multiple backend entry points. Choose the one that fits your hardware:

### 1. Standard Rule-Based (Recommended for General Use)
- **File**: `fastapi_server.py`
- **Logic**: Uses the `mure_python` reasoner and `rules.json`.
- **Hardware**: CPU/Laptop friendly.
- **Run**: `python fastapi_server.py`

### 2. High-Speed 3B/5M Logic (Colab API)
- **File**: `run_mure_colab_api.py`
- **Logic**: Specialized for the 5M rules dataset (`jsonlines`).
- **Hardware**: Best for Google Colab.
- **Run**: `python run_mure_colab_api.py`

### 3. Full PRD-LLM Chain (Legacy Ref)
- **File**: `COLAB_SERVER.py`
- **Logic**: Links PRD extraction with a Flask interface.
- **Hardware**: GPU Required.

---

## 🛠️ Performance & Bug Fixes (May 2026 Update)

Recent fixes applied based on the Code Review:
- **[P0] Fixed Syntax Errors**: Resolved `open()` calls missing filenames in ingestion and reasoning modules.
- **[P0] Fixed Indentation**: Resolved `loader.py` logic errors.
- **[P1] GPU/CPU Fallback**: Brain models now automatically detect hardware.
- **[P1] Dream Mode Fix**: Added `refresh_cache()` to ensure autonomous learning is immediate.
- **[P2] Ngrok Security**: Improved token handling in notebooks with userdata support.
- **[P3] Distillation Robustness**: Added logit cropping to handle vocab mismatches between Teacher and Student.

## 📁 Project Structure

- `mure_agi/`: Core AGI logic, SQLite storage, and Dream Mode.
- `mure_python/`: Level 1 & 2 causal parsers (NLP focused).
- `prd_llm/`: Production LLM integration and causal ingestion.
- `sentence_llm_3b/`: Architecture for our custom small language model.
- `distillation_notebook.ipynb`: Key pipeline for data-to-mind transfer.

---
**Created by Myo Min Aung**
