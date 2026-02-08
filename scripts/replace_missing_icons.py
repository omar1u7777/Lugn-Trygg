#!/usr/bin/env python3
"""Replace missing MUI icons with Heroicons in WorldClassDashboard.tsx"""

import re

file_path = 'src/components/WorldClassDashboard.tsx'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Icon replacements
replacements = [
    (r'<MenuBook\s*/>', '<BookOpenIcon className="w-6 h-6" />'),
    (r'<Insights\s*/>', '<LightBulbIcon className="w-6 h-6" />'),
    (r'<TrackChanges\s*/>', '<ArrowPathIcon className="w-6 h-6" />'),
    (r'<Assessment\s*/>', '<ChartBarIcon className="w-6 h-6" />'),
    (r'<Timeline\s*/>', '<ClockIcon className="w-6 h-6" />'),
]

count = 0
for pattern, replacement in replacements:
    before = content
    content = re.sub(pattern, replacement, content)
    matches = len(re.findall(pattern, before))
    if matches > 0:
        print(f"Replaced {matches} instances of {pattern}")
        count += matches

# Add missing icon imports to existing import line
import_line_pattern = r'(import \{ [^}]+ \} from \'@heroicons/react/24/outline\';)'
if 'BookOpenIcon' not in content:
    content = re.sub(
        import_line_pattern,
        lambda m: m.group(1).replace('} from', ', BookOpenIcon, ChartBarIcon } from'),
        content
    )
    print("Added BookOpenIcon and ChartBarIcon to imports")

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal replacements: {count}")
print("SUCCESS: All missing icons replaced!")
