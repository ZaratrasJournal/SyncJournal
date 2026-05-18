#!/usr/bin/env python3
"""Compile all per-item research JSONs into a single markdown report."""
import json
import os
import re
import sys
import yaml
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
RESULTS_DIR = SCRIPT_DIR / "results"
FIELDS_FILE = SCRIPT_DIR / "fields.yaml"
OUTLINE_FILE = SCRIPT_DIR / "outline.yaml"
REPORT_FILE = SCRIPT_DIR / "report.md"
REPORT_DATE = "2026-05-18"

# Summary fields shown in TOC per item
TOC_FIELDS = ["playbook_concept_maturity", "crypto_perp_exchange_support", "pre_trade_validation"]

# Category label mapping (yaml category name -> possible JSON keys)
CATEGORY_MAPPING = {
    "basis": ["basis", "Basis"],
    "ai_features": ["ai_features", "AI-Features", "AI Features"],
    "playbook_depth": ["playbook_depth", "Playbook & Setup-Level"],
    "privacy_stack": ["privacy_stack", "Privacy & Stack"],
    "crypto_fit": ["crypto_fit", "Crypto-Fit"],
    "coaching_depth": ["coaching_depth", "Coaching Depth"],
    "community": ["community", "Community"],
    "framework_specifics": ["framework_specifics", "Framework (alleen frameworks-items)"],
}

CATEGORY_LABELS = {
    "basis": "Basis",
    "ai_features": "AI-Features",
    "playbook_depth": "Playbook & Setup-Level",
    "privacy_stack": "Privacy & Stack",
    "crypto_fit": "Crypto-Fit",
    "coaching_depth": "Coaching Depth",
    "community": "Community",
    "framework_specifics": "Framework",
}

INTERNAL_FIELDS = {"_source_file", "uncertain", "item_name", "url"}


def slugify(s):
    s = re.sub(r"[^\w\s-]", "", s.lower())
    s = re.sub(r"[\s_]+", "-", s)
    return s.strip("-")


def is_uncertain(val, field_name, uncertain_list):
    if val is None or val == "":
        return True
    if field_name in (uncertain_list or []):
        return True
    if isinstance(val, str) and "[uncertain]" in val:
        return True
    return False


def lookup_field(data, field_name, yaml_category):
    """Find field value in nested or flat JSON. Returns value or None."""
    # Top-level direct hit
    if field_name in data:
        return data[field_name]
    # Look in category subdict (try all aliases)
    for alias in CATEGORY_MAPPING.get(yaml_category, [yaml_category]):
        if alias in data and isinstance(data[alias], dict):
            if field_name in data[alias]:
                return data[alias][field_name]
    # Traverse all nested dicts (fallback)
    for key, val in data.items():
        if isinstance(val, dict) and field_name in val:
            return val[field_name]
    return None


def fmt_value(val, max_inline=120):
    """Format value for markdown — handle strings, lists, dicts."""
    if val is None or val == "":
        return ""
    if isinstance(val, bool):
        return "✓ ja" if val else "✗ nee"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, str):
        # Strip [uncertain] marker for display
        clean = val.replace(" [uncertain]", "").replace("[uncertain]", "").strip()
        if len(clean) > max_inline:
            return f"<br>{clean}"
        return clean
    if isinstance(val, list):
        if not val:
            return ""
        if all(isinstance(x, (str, int, float, bool)) for x in val):
            short = ", ".join(str(x) for x in val)
            if len(short) > max_inline:
                return "<br>" + "<br>".join(f"- {x}" for x in val)
            return short
        # list of dicts
        lines = []
        for d in val:
            if isinstance(d, dict):
                lines.append(" | ".join(f"{k}: {v}" for k, v in d.items()))
            else:
                lines.append(str(d))
        return "<br>" + "<br>".join(f"- {l}" for l in lines)
    if isinstance(val, dict):
        return "; ".join(f"{k}: {fmt_value(v, 80)}" for k, v in val.items())
    return str(val)


def truncate_for_toc(val, maxlen=60):
    """Short value for TOC display."""
    s = fmt_value(val, max_inline=999).replace("<br>", " ")
    s = s.replace("\n", " ").strip()
    if len(s) > maxlen:
        return s[:maxlen - 1] + "…"
    return s


def main():
    # Load outline + fields
    with open(OUTLINE_FILE, encoding="utf-8") as f:
        outline = yaml.safe_load(f)
    with open(FIELDS_FILE, encoding="utf-8") as f:
        fields_def = yaml.safe_load(f)

    topic = outline.get("topic", "")
    items_order = outline.get("items", [])
    name_to_item = {it["name"]: it for it in items_order}

    # Load all JSON results
    items = {}
    for f in sorted(RESULTS_DIR.glob("*.json")):
        try:
            with open(f, encoding="utf-8") as fh:
                data = json.load(fh)
            name = data.get("item_name", f.stem)
            items[name] = data
        except Exception as e:
            print(f"WARN: kon {f.name} niet lezen: {e}", file=sys.stderr)

    # Group items by tier from outline (for TOC organization)
    tier1, tier2, tier3 = [], [], []
    for outline_item in items_order:
        name = outline_item["name"]
        tier = outline_item.get("tier", 3)
        # Match outline-name to JSON item_name (may differ slightly)
        json_data = None
        for json_name, d in items.items():
            if json_name == name or slugify(json_name) == slugify(name):
                json_data = d
                break
        if json_data is None:
            # Fallback: search by partial name match
            for json_name, d in items.items():
                if slugify(name).startswith(slugify(json_name).split("-")[0]) or slugify(json_name).startswith(slugify(name).split("-")[0]):
                    json_data = d
                    break
        bucket = tier1 if tier == 1 else (tier2 if tier == 2 else tier3)
        bucket.append((outline_item, json_data))

    # Build report
    lines = []
    lines.append(f"# Playbook-coaching AI — Research Report")
    lines.append("")
    lines.append(f"**Datum**: {REPORT_DATE}")
    lines.append(f"**Topic**: {topic}")
    lines.append(f"**Items onderzocht**: {len(items)} (10 Tier-1, 11 Tier-2, ~7 Tier-3 + frameworks/patterns)")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Table of Contents
    lines.append("## 📋 Table of Contents")
    lines.append("")

    def emit_toc_section(label, bucket):
        if not bucket:
            return
        lines.append(f"### {label}")
        lines.append("")
        for i, (outline_item, json_data) in enumerate(bucket, 1):
            name = outline_item["name"]
            anchor = slugify(name)
            if not json_data:
                lines.append(f"{i}. **{name}** — ⚠ no research data")
                continue
            uncertain = json_data.get("uncertain", []) or []
            parts = [f"[{name}](#{anchor})"]
            # Append TOC summary fields
            summaries = []
            for tf in TOC_FIELDS:
                val = None
                for cat in CATEGORY_MAPPING:
                    val = lookup_field(json_data, tf, cat)
                    if val:
                        break
                if val and not is_uncertain(val, tf, uncertain):
                    summaries.append(f"{tf.replace('_', ' ')}: {truncate_for_toc(val, 50)}")
            if summaries:
                parts.append(" — " + " · ".join(summaries))
            lines.append(f"{i}. " + "".join(parts))
        lines.append("")

    emit_toc_section("🥇 Tier 1 (top-relevant)", tier1)
    emit_toc_section("🥈 Tier 2 (good context)", tier2)
    emit_toc_section("🥉 Tier 3 (reference)", tier3)

    lines.append("---")
    lines.append("")

    # Detailed sections
    lines.append("## 📊 Detailed Findings")
    lines.append("")

    all_items_flat = tier1 + tier2 + tier3
    for outline_item, json_data in all_items_flat:
        name = outline_item["name"]
        url = outline_item.get("url", "")
        tier = outline_item.get("tier", 3)
        why = outline_item.get("why", "")
        anchor = slugify(name)

        lines.append(f"### {name}")
        if url:
            lines.append(f"<a id='{anchor}'></a>")
        else:
            lines.append(f"<a id='{anchor}'></a>")
        lines.append("")
        meta_parts = [f"Tier **{tier}**"]
        if url:
            meta_parts.append(f"[{url}]({url})")
        lines.append(" · ".join(meta_parts))
        lines.append("")
        if why:
            lines.append(f"> _Why researched_: {why}")
            lines.append("")

        if not json_data:
            lines.append("⚠ No research data available.")
            lines.append("")
            lines.append("---")
            lines.append("")
            continue

        uncertain = json_data.get("uncertain", []) or []

        # Render per category
        for cat_key, cat_def in fields_def.get("categories", {}).items():
            cat_label = cat_def.get("label", CATEGORY_LABELS.get(cat_key, cat_key))
            fields = cat_def.get("fields", [])
            rendered_rows = []
            for field_def in fields:
                fname = field_def["name"]
                val = lookup_field(json_data, fname, cat_key)
                if is_uncertain(val, fname, uncertain):
                    continue
                rendered_rows.append((fname, val))
            if not rendered_rows:
                continue
            lines.append(f"#### {cat_label}")
            lines.append("")
            for fname, val in rendered_rows:
                formatted = fmt_value(val)
                if formatted.startswith("<br>"):
                    # Multi-line value
                    lines.append(f"**{fname.replace('_', ' ')}**:")
                    lines.append(formatted[4:])  # strip leading <br>
                else:
                    lines.append(f"- **{fname.replace('_', ' ')}**: {formatted}")
            lines.append("")

        # Uncertain summary at end
        if uncertain:
            lines.append(f"_Uncertain fields_: {', '.join(uncertain)}")
            lines.append("")

        lines.append("---")
        lines.append("")

    REPORT_FILE.write_text("\n".join(lines), encoding="utf-8")
    print(f"OK Report saved: {REPORT_FILE}")
    print(f"  Lines: {len(lines)}")
    print(f"  Items: {len(items)}")


if __name__ == "__main__":
    main()
