"""
Fix incorrect import paths from '../../components/ui/tailwind'
"""
import os
import re

def fix_import_paths(root_dir):
    """Fix import paths in all TypeScript/TSX files"""
    files_fixed = []
    
    # Walk through src directory
    for dirpath, dirnames, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith(('.ts', '.tsx')):
                filepath = os.path.join(dirpath, filename)
                
                # Read file
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original_content = content
                
                # Determine correct import path based on file location
                # Files in src/components/ should use './ui/tailwind'
                # Files in src/components/subdir/ should use '../ui/tailwind'
                # Files in src/components/ui/ should use './tailwind'
                
                rel_path = os.path.relpath(filepath, root_dir).replace('\\', '/')
                
                # Count directory depth from src/components/
                if 'src/components/' in rel_path:
                    parts = rel_path.split('src/components/')[1].split('/')
                    depth = len(parts) - 1  # -1 for the filename itself
                    
                    if depth == 0:
                        # src/components/*.tsx -> './ui/tailwind'
                        correct_path = './ui/tailwind'
                    elif depth == 1:
                        # src/components/subdir/*.tsx -> '../ui/tailwind'
                        correct_path = '../ui/tailwind'
                    elif 'src/components/ui/' in rel_path:
                        # src/components/ui/*.tsx -> './tailwind'
                        correct_path = './tailwind'
                    else:
                        # src/components/subdir/subdir2/*.tsx -> '../../ui/tailwind'
                        correct_path = '../../ui/tailwind'
                    
                    # Replace incorrect paths
                    patterns = [
                        r"from ['\"]\.\.\/\.\.\/components\/ui\/tailwind['\"]",
                        r"from ['\"]\.\.\/\.\.\/\.\.\/components\/ui\/tailwind['\"]",
                        r"from ['\"]\.\.\/\.\.\/\.\.\/\.\.\/components\/ui\/tailwind['\"]",
                    ]
                    
                    for pattern in patterns:
                        if re.search(pattern, content):
                            content = re.sub(pattern, f"from '{correct_path}'", content)
                    
                    # Write back if changed
                    if content != original_content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(content)
                        files_fixed.append(filepath)
                        print(f"✓ Fixed: {rel_path}")
    
    return files_fixed

if __name__ == '__main__':
    root = r'C:\Projekt\Lugn-Trygg-main_klar'
    print("Fixing import paths...")
    fixed = fix_import_paths(root)
    print(f"\n✅ Fixed {len(fixed)} files")
