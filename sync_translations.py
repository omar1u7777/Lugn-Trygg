#!/usr/bin/env python3
"""
I18n Translation Sync Tool
Syncs Norwegian (no.json) and English (en.json) to match Swedish (sv.json) structure
"""

import json
import sys
from pathlib import Path

# Add deep merge function
def deep_merge(target, source, path=""):
    """Recursively merge source into target, preserving existing translations"""
    for key in source:
        if key not in target:
            # Key doesn't exist in target - add it
            target[key] = source[key]
        elif isinstance(source[key], dict) and isinstance(target[key], dict):
            # Both are dicts - recurse
            deep_merge(target[key], source[key], f"{path}.{key}")
        elif isinstance(source[key], list) and isinstance(target[key], list):
            # Both are lists - if source has more items, extend target
            if len(source[key]) > len(target[key]):
                target[key].extend(source[key][len(target[key]):])
    return target

def sync_translations():
    locales_dir = Path(__file__).parent / "src" / "i18n" / "locales"
    
    # Read all three files
    with open(locales_dir / "sv.json", "r", encoding="utf-8") as f:
        sv = json.load(f)
    
    with open(locales_dir / "no.json", "r", encoding="utf-8") as f:
        no = json.load(f)
    
    with open(locales_dir / "en.json", "r", encoding="utf-8") as f:
        en = json.load(f)
    
    # Track untranslated keys (identical to Swedish)
    untranslated = {"no": [], "en": []}

    def find_untranslated_keys(source, target, path=""):
        """Find keys where target value is identical to source (not translated)"""
        untranslated_keys = []
        for key in source:
            current_path = f"{path}.{key}" if path else key
            if key in target:
                if isinstance(source[key], dict) and isinstance(target[key], dict):
                    untranslated_keys.extend(find_untranslated_keys(source[key], target[key], current_path))
                elif isinstance(source[key], str) and isinstance(target[key], str):
                    if source[key] == target[key]:
                        untranslated_keys.append(current_path)
        return untranslated_keys
    
    def find_missing_keys(source, target, path=""):
        """Find keys in source that are missing from target"""
        missing = []
        for key in source:
            current_path = f"{path}.{key}" if path else key
            if key not in target:
                missing.append(current_path)
            elif isinstance(source[key], dict):
                if isinstance(target.get(key), dict):
                    missing.extend(find_missing_keys(source[key], target[key], current_path))
                else:
                    missing.append(current_path)
        return missing
    
    # Find missing keys
    no_missing = find_missing_keys(sv, no)
    en_missing = find_missing_keys(sv, en)

    # Find untranslated keys (identical to Swedish)
    untranslated["no"] = find_untranslated_keys(sv, no)
    untranslated["en"] = find_untranslated_keys(sv, en)

    print(f"Missing in Norwegian: {len(no_missing)} keys")
    print(f"Missing in English: {len(en_missing)} keys")
    print(f"Untranslated in Norwegian: {len(untranslated['no'])} keys")
    print(f"Untranslated in English: {len(untranslated['en'])} keys")
    
    # Deep merge Swedish structure into Norwegian and English
    # This preserves existing translations while adding missing keys
    no_updated = deep_merge(no, sv)
    en_updated = deep_merge(en, sv)
    
    # Write updated files with proper formatting
    with open(locales_dir / "no.json", "w", encoding="utf-8") as f:
        json.dump(no_updated, f, ensure_ascii=False, indent=2)

    with open(locales_dir / "en.json", "w", encoding="utf-8") as f:
        json.dump(en_updated, f, ensure_ascii=False, indent=2)

    # Export untranslated keys for manual translation
    untranslated_path = Path(__file__).parent / "untranslated_keys.json"
    with open(untranslated_path, "w", encoding="utf-8") as f:
        json.dump(untranslated, f, ensure_ascii=False, indent=2)

    print(f"✅ Updated no.json with {len(no_missing)} new keys")
    print(f"✅ Updated en.json with {len(en_missing)} new keys")
    print(f"📝 Exported untranslated keys to {untranslated_path}")

    # Print some examples of what was added
    if no_missing:
        print("\nSample Norwegian additions:")
        for key in no_missing[:5]:
            print(f"  - {key}")
    if untranslated["no"]:
        print("\nSample untranslated Norwegian keys:")
        for key in untranslated["no"][:5]:
            print(f"  - {key}")
    if untranslated["en"]:
        print("\nSample untranslated English keys:")
        for key in untranslated["en"][:5]:
            print(f"  - {key}")

    return 0

if __name__ == "__main__":
    sys.exit(sync_translations())
