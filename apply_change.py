
import json
import urllib.request
from pathlib import Path
from datetime import datetime
import re

BRANCH = "fix-social-theories-scores"

BASE = (
    "https://raw.githubusercontent.com/"
    "gniewomir924/Hypervalues/"
    + BRANCH + "/"
)

FILES = [
    "data.js",
    "ideology_scores.json",
    "questions_tree.json"
]

DESCRIPTIONS = {
    "social_darwinism": (
        "Applies concepts associated with biological evolution"
    ),
    "revolutionism": (
        "Advocates achieving fundamental social and political transformation"
    ),
    "reformism": (
        "Advocates changing society through gradual, cumulative reforms"
    )
}

folder = Path(__file__).resolve().parent
timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

downloaded = {}

# Download all updated files first
for filename in FILES:
    print("Downloading:", filename)

    url = BASE + filename

    with urllib.request.urlopen(url) as response:
        downloaded[filename] = response.read().decode("utf-8")

# Validate ideology scores
scores = json.loads(downloaded["ideology_scores.json"])

assert len(scores) == 270, "Expected 270 ideologies"

dimensions = [
    "revolutionism",
    "reformism",
    "social_darwinism"
]

for ideology, entry in scores.items():
    values = {}

    for part in entry["s"].split("|"):
        if ":" in part:
            key, value = part.rsplit(":", 1)
            values[key] = value

    for dimension in dimensions:
        assert dimension in values, (
            f"{ideology} is missing {dimension}"
        )

        value = values[dimension]

        assert -1 <= float(value) <= 1
        assert len(value.split(".")[-1]) == 2

# Validate descriptions in data.js
data_js = downloaded["data.js"]

for key, beginning in DESCRIPTIONS.items():
    assert beginning in data_js, (
        f"Missing description: {key}"
    )

# Validate social change questions
tree = json.loads(downloaded["questions_tree.json"])
assert "social_change" in tree

# Check synchronized ideology scores in data.js
# Parse the ideologyScores object and compare actual values.
match = re.search(
    r"const\s+ideologyScores\s*=\s*(\{.*?\})\s*;",
    data_js,
    re.DOTALL
)

assert match, "Could not find ideologyScores object in data.js"

js_scores = json.loads(match.group(1))

# Check synchronized ideology scores in data.js
match = re.search(
    r"const\s+ideologyScores\s*=\s*(\{.*?\})\s*;",
    data_js,
    re.DOTALL
)

assert match, "Could not find ideologyScores object in data.js"
js_scores = json.loads(match.group(1))

for ideology, entry in scores.items():
    expected_scores = entry["s"]
    actual_scores = js_scores.get(ideology)

    assert actual_scores == expected_scores, (
        f"Score mismatch: {ideology}\n"
        f"JSON: {expected_scores}\n"
        f"JS:   {actual_scores}"
    )

print("All ideology scores are synchronized.")
# Make backups, then replace files
for filename in FILES:
    path = folder / filename

    if path.exists():
        backup = path.with_name(
            filename + ".backup-" + timestamp
        )
        backup.write_bytes(path.read_bytes())
        print("Backup created:", backup.name)

    path.write_text(
        downloaded[filename],
        encoding="utf-8"
    )

print("\nSUCCESS!")
print("Ideologies:", len(scores))
print("Dimensions:", ", ".join(dimensions))
print("Descriptions: 3/3 verified")
print("Score formatting: verified")
print("All three files updated.")
