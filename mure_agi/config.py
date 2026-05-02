import os
from dataclasses import dataclass
from pathlib import Path

@dataclass
class MUREConfig:
    # --- Persistence ---
    # Default to local if Drive not mounted (Colab path included)
    DRIVE_MOUNT_POINT: str = os.environ.get('MURE_DRIVE_MOUNT', '/content/drive')
    BRAIN_BASE_PATH: str = os.environ.get('MURE_BRAIN_PATH', '/content/drive/MyDrive/svo cc brain') if os.path.exists("/content/drive") else "./brain_data"
    
    # Paths
    RULES_DB_PATH = f"{BRAIN_BASE_PATH}/mure_rules.db"
    CONTEXT_PATH = f"{BRAIN_BASE_PATH}/context.json"
    LOG_DIR = f"{BRAIN_BASE_PATH}/logs"
    
    # --- Search Settings ---
    FUZZY_THRESHOLD = 60.0
    SEMANTIC_THRESHOLD = 0.5
    HYBRID_FUZZY_WEIGHT = 0.6
    HYBRID_SEMANTIC_WEIGHT = 0.4
    
    # --- Model Settings ---
    # Used for semantic search
    EMBEDDING_MODEL = "all-MiniLM-L6-v2"
    DEVICE = "cpu" # Default to CPU for stability, auto-detect GPU in engine
    
    # --- Context Settings ---
    MAX_CONTEXT_HISTORY = 10
    
    # --- Dream Mode Settings ---
    DREAM_INTERVAL_HOURS = 6
    WIKIPEDIA_BATCH_SIZE = 5
    
    # --- Guardrail Settings ---
    MIN_LEARNING_CONFIDENCE = 0.5
    DEDUPLICATION_THRESHOLD = 0.92

def init_directories():
    """Ensure all required directories exist"""
    paths = [
        MUREConfig.BRAIN_BASE_PATH,
        MUREConfig.LOG_DIR
    ]
    for p in paths:
        Path(p).mkdir(parents=True, exist_ok=True)
    print(f"✅ MURE Environment Initialized at {MUREConfig.BRAIN_BASE_PATH}")

config = MUREConfig()
