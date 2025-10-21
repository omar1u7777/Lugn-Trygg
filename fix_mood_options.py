"""
Quick script to add OPTIONS support to all POST endpoints in mood_routes.py
"""
import re

# Read the file
with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\mood_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# List of endpoints that need OPTIONS
endpoints_to_fix = [
    ('/log', 'log_mood'),
    ('/analyze-voice', 'analyze_voice_emotion'),
    ('/confirm', 'confirm_mood'),
    ('/crisis-detection', 'crisis_detection'),
]

# For each endpoint, add OPTIONS and the check
for route, func_name in endpoints_to_fix:
    # Find the route decorator
    pattern = rf"(@mood_bp\.route\('{re.escape(route)}', methods=\[)'POST'(\]\))"
    replacement = r"\1'POST', 'OPTIONS'\2"
    content = re.sub(pattern, replacement, content)
    
    # Find the function definition and add OPTIONS check
    # Pattern: def function_name():
    func_pattern = rf"(def {func_name}\([^)]*\):)\n(\s+)(\"\"\"[^\"]*\"\"\")\n"
    func_replacement = r"\1\n\2\3\n\2if request.method == 'OPTIONS':\n\2    return '', 204\n\2\n"
    content = re.sub(func_pattern, func_replacement, content)

# Write back
with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\mood_routes.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed all mood_routes.py endpoints!")
