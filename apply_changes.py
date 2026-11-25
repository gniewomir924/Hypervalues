import json
import re
from pathlib import Path

ROOT = Path(__file__).parent

DATA_FILE = ROOT / "data.js"
SCORES_FILE = ROOT / "ideology_scores.json"
QUESTIONS_FILE = ROOT / "questions_tree.json"

# Updated source files from the changes branch
BASE_URL = (
    "https://raw.githubusercontent.com/"
    "gniewomir924/Hypervalues/"
    "fix-social-theories-scores/"
)

import urllib.request

def get_updated_file(name):
    url = BASE_URL + name
    with urllib.request.urlopen(url) as response:
        return response.read().decode("utf-8")

def backup(path):
    backup_path = path.with_suffix(path.suffix + ".backup")
    if not backup_path.exists():
        backup_path.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"Backup created: {backup_path.name}")

def replace_file(name):
    path = ROOT / name
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {name}")

    backup(path)
    content = get_updated_file(name)

    # Validate JSON before replacing JSON files
    if name.endswith(".json"):
        json.loads(content)

    path.write_text(content, encoding="utf-8")
    print(f"Updated: {name}")

def main():
    for name in ("data.js", "ideology_scores.json", "questions_tree.json"):
        replace_file(name)

    print("\nAll three files have been updated successfully.")

if __name__ == "__main__":
    main()
