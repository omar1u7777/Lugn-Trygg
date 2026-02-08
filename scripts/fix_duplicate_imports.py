"""
Quick fix for duplicate imports - only fix duplicates
"""
import os
import re

def fix_duplicate_imports_in_line(line):
    """Fix duplicate imports in a single import line"""
    if not line.strip().startswith('import'):
        return line
    
    match = re.match(r'(import \{)([^}]+)(\} from [\'"][^\'"]+[\'"];?)', line)
    if not match:
        return line
    
    imports_str = match.group(2)
    imports = [i.strip() for i in imports_str.split(',') if i.strip()]
    
    # Remove duplicates while preserving order
    seen = set()
    unique = []
    for imp in imports:
        if imp not in seen:
            unique.append(imp)
            seen.add(imp)
    
    if len(unique) < len(imports):
        # Duplicates found, fix it
        return f"{match.group(1)} {', '.join(unique)} {match.group(3)}\n"
    
    return line

def fix_file(filepath):
    """Fix duplicates in a file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    fixed_lines = [fix_duplicate_imports_in_line(line) for line in lines]
    
    if fixed_lines != lines:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(fixed_lines)
        return True
    
    return False

def main():
    root = r'C:\Projekt\Lugn-Trygg-main_klar\src'
    files_fixed = 0
    
    print("🔧 Fixing duplicate imports...\n")
    
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ['node_modules', 'dist', '__pycache__', '.git']]
        
        for filename in filenames:
            if filename.endswith(('.tsx', '.ts', '.jsx', '.js')):
                filepath = os.path.join(dirpath, filename)
                
                if fix_file(filepath):
                    files_fixed += 1
                    rel_path = os.path.relpath(filepath, root)
                    print(f"✓ {rel_path}")
    
    print(f"\n✅ Fixed {files_fixed} files")

if __name__ == '__main__':
    main()
