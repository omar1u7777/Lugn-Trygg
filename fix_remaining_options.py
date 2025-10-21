"""
Quick script to add OPTIONS support to remaining POST endpoints
"""
import re

# Memory routes
print("Fixing memory_routes.py...")
with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\memory_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'(@memory_bp\.route\("/upload", methods=\[)"POST"(\]\))'
content = re.sub(pattern, r'\1"POST", "OPTIONS"\2', content)

func_pattern = r'(def upload_memory\([^)]*\):)\n(\s+)("""[^"]*""")\n'
func_replacement = r'\1\n\2\3\n\2if request.method == \'OPTIONS\':\n\2    return \'\', 204\n\2\n'
content = re.sub(func_pattern, func_replacement, content)

with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\memory_routes.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ Fixed memory_routes.py")

# AI routes
print("Fixing ai_routes.py...")
with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\ai_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

for route, func_name in [('/story', 'generate_story'), ('/forecast', 'predictive_forecast')]:
    pattern = rf'(@ai_bp\.route\("{re.escape(route)}", methods=\[)"POST"(\]\))'
    content = re.sub(pattern, r'\1"POST", "OPTIONS"\2', content)
    
    func_pattern = rf'(def {func_name}\([^)]*\):)\n(\s+)("""[^"]*""")\n'
    func_replacement = r'\1\n\2\3\n\2if request.method == \'OPTIONS\':\n\2    return \'\', 204\n\2\n'
    content = re.sub(func_pattern, func_replacement, content)

with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\ai_routes.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ Fixed ai_routes.py")

# AI Stories routes
print("Fixing ai_stories_routes.py...")
with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\ai_stories_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

for route, func_name in [('/stories/generate', 'generate_ai_story'), ('/stories/<story_id>/favorite', 'toggle_favorite')]:
    pattern = rf'(@ai_stories_bp\.route\(\'{re.escape(route)}\', methods=\[)\'POST\'(\]\))'
    content = re.sub(pattern, r"\1'POST', 'OPTIONS'\2", content)

# For stories routes, add OPTIONS check differently since they have complex patterns
# Just add at the beginning of each function
for func_name in ['generate_ai_story', 'toggle_favorite']:
    func_pattern = rf'(def {func_name}\([^)]*\):)\n(\s+)(?!if request\.method)'
    func_replacement = r'\1\n\2if request.method == \'OPTIONS\':\n\2    return \'\', 204\n\2\n\2'
    content = re.sub(func_pattern, func_replacement, content)

with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\ai_stories_routes.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ Fixed ai_stories_routes.py")

# Referral routes (remaining ones)
print("Fixing referral_routes.py remaining endpoints...")
with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\referral_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

for route, func_name in [('/invite', 'send_invitation'), ('/complete', 'complete_referral')]:
    pattern = rf'(@referral_bp\.route\("{re.escape(route)}", methods=\[)"POST"(\]\))'
    content = re.sub(pattern, r'\1"POST", "OPTIONS"\2', content)
    
    func_pattern = rf'(def {func_name}\([^)]*\):)\n(\s+)("""[^"]*""")\n'
    func_replacement = r'\1\n\2\3\n\2if request.method == \'OPTIONS\':\n\2    return \'\', 204\n\2\n'
    content = re.sub(func_pattern, func_replacement, content)

with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\referral_routes.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ Fixed referral_routes.py")

# AI Helpers
print("Fixing ai_helpers_routes.py...")
with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\ai_helpers_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'(@ai_helpers_bp\.route\("/analyze-text", methods=\[)"POST"(\]\))'
content = re.sub(pattern, r'\1"POST", "OPTIONS"\2', content)

func_pattern = r'(def analyze_text_sentiment\([^)]*\):)\n(\s+)("""[^"]*""")\n'
func_replacement = r'\1\n\2\3\n\2if request.method == \'OPTIONS\':\n\2    return \'\', 204\n\2\n'
content = re.sub(func_pattern, func_replacement, content)

with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\ai_helpers_routes.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ Fixed ai_helpers_routes.py")

print("\n🎉 All backend routes fixed! Total: 20+ endpoints updated")
