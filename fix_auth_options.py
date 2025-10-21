"""
Quick script to add OPTIONS support to all POST endpoints in auth.py
"""
import re

# Read the file
with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

# List of endpoints that need OPTIONS
endpoints_to_fix = [
    ('/verify-2fa', 'verify_2fa'),
    ('/setup-2fa', 'setup_2fa'),
    ('/google-login', 'google_login'),
    ('/logout', 'logout'),
    ('/reset-password', 'reset_password'),
    ('/consent', 'save_consent'),
    ('/refresh', 'refresh_token'),
]

# For each endpoint, add OPTIONS and the check
for route, func_name in endpoints_to_fix:
    # Find the route decorator
    pattern = rf"(@auth_bp\.route\('{re.escape(route)}', methods=\[)'POST'(\]\))"
    replacement = r"\1'POST', 'OPTIONS'\2"
    content = re.sub(pattern, replacement, content)
    
    # Find the function definition and add OPTIONS check
    # Pattern: def function_name():
    func_pattern = rf"(def {func_name}\([^)]*\):)\n(\s+)(\"\"\"[^\"]*\"\"\")\n"
    func_replacement = r"\1\n\2\3\n\2if request.method == 'OPTIONS':\n\2    return '', 204\n\2\n"
    content = re.sub(func_pattern, func_replacement, content)

# Write back
with open(r'c:\Projekt\Lugn-Trygg-main_klar\Backend\src\routes\auth.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed all auth.py endpoints!")
