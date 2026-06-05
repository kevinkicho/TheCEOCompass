import json
import os

base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
seed_path = os.path.join(base, "backend", "seed", "frameworks.json")
out_path = os.path.join(base, "..", "ceo-toolkit", "tools", "consolidated-glossary.md")

with open(seed_path) as f:
    data = json.load(f)

lines = [
    "# Consolidated Concept Glossary",
    "",
    "All concepts from the CEO Knowledge Platform, organized by framework.",
    "",
]

for fw in data:
    lines.append(f"## {fw['title']}")
    lines.append("")
    for c in fw["concepts"]:
        lines.append(f"**{c['name']}**")
        lines.append(f"{c['definition']}")
        if c.get("formula"):
            lines.append(f"  Formula: `{c['formula']}`")
        if c.get("example"):
            lines.append(f"  Example: {c['example']}")
        if c.get("tags"):
            lines.append(f"  Tags: {', '.join(c['tags'])}")
        lines.append("")

with open(out_path, "w") as f:
    f.write("\n".join(lines))

print(f"Wrote {len(lines)} lines to {out_path}")