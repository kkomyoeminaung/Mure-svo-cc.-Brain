import sqlite3
import time
import os
from typing import List, Dict, Optional
from .config import config

class SQLiteStorage:
    def __init__(self, db_path: str = config.RULES_DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Causal Rules Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS causal_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cause TEXT NOT NULL,
                effect TEXT NOT NULL,
                strength REAL DEFAULT 0.8,
                confidence REAL DEFAULT 1.0,
                occurrences INTEGER DEFAULT 1,
                source TEXT DEFAULT 'seed',
                timestamp REAL,
                UNIQUE(cause, effect)
            )
        ''')
        
        # Indexes for speed
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_cause ON causal_rules(cause)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_effect ON causal_rules(effect)')
        
        conn.commit()
        conn.close()

    def add_rule(self, cause: str, effect: str, strength: float = 0.8, source: str = 'learned') -> bool:
        cause = cause.lower().strip()
        effect = effect.lower().strip()
        timestamp = time.time()
        
        conn = self._get_connection()
        cursor = conn.cursor()
        is_new = False
        try:
            # Check if exists
            cursor.execute('SELECT id FROM causal_rules WHERE cause = ? AND effect = ?', (cause, effect))
            if not cursor.fetchone():
                is_new = True

            cursor.execute('''
                INSERT INTO causal_rules (cause, effect, strength, source, timestamp)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(cause, effect) DO UPDATE SET
                    occurrences = occurrences + 1,
                    timestamp = EXCLUDED.timestamp
            ''', (cause, effect, strength, source, timestamp))
            conn.commit()
        except sqlite3.Error as e:
            print(f"❌ DB Error: {e}")
            is_new = False
        finally:
            conn.close()
        return is_new

    def get_all_rules(self) -> List[Dict]:
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM causal_rules')
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def search_exact(self, cause: str) -> List[Dict]:
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM causal_rules WHERE cause = ? ORDER BY strength DESC', (cause.lower(),))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_stats(self) -> Dict:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM causal_rules')
        count = cursor.fetchone()[0]
        conn.close()
        return {"total_rules": count}

    def bootstrap_seed(self, rules: List[Dict]):
        """Bulk insert seed rules if empty"""
        if self.get_stats()["total_rules"] > 0:
            return
            
        print("🌱 Bootstrapping seed knowledge...")
        conn = self._get_connection()
        cursor = conn.cursor()
        for r in rules:
            cursor.execute('''
                INSERT OR IGNORE INTO causal_rules (cause, effect, strength, source, timestamp)
                VALUES (?, ?, ?, ?, ?)
            ''', (r['cause'].lower(), r['effect'].lower(), r.get('strength', 0.8), 'seed', time.time()))
        conn.commit()
        conn.close()
        print(f"✅ Seeded {len(rules)} rules.")
