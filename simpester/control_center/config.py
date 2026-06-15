"""Tiny JSON settings store shared by Simpester modules.

Each tool can persist a small dict of "remember my last settings" values to a
JSON file under simpester/config/. Loading returns the defaults merged with
whatever was saved (so new keys added later still get a sane value).
"""

import json
import os
import threading

# config.py lives in control_center/, so its parent's parent is simpester/.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(BASE_DIR, "config")
_lock = threading.Lock()

def _path(name):
    safe = "".join(c for c in str(name) if c.isalnum() or c in ("-", "_"))
    return os.path.join(CONFIG_DIR, (safe or "settings") + ".json")

def load_config(name, defaults=None):
    merged = dict(defaults or {})
    try:
        with open(_path(name), "r", encoding="utf-8") as fh:
            saved = json.load(fh)
        if isinstance(saved, dict):
            merged.update(saved)
    except (OSError, ValueError):
        pass
    return merged

def save_config(name, data):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with _lock:
        with open(_path(name), "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
    return data
