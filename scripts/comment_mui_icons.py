"""
Comment out ALL remaining MUI icon imports
"""
import os
import re

def fix_mui_icon_imports(root_dir):
    """Find and comment out all MUI icon imports"""
    files_fixed = []
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith(('.ts', '.tsx')):
                filepath = os.path.join(dirpath, filename)
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original_content = content
                
                # Pattern 1: import IconName from '@mui/icons-material/IconName';
                pattern1 = r"^import .+ from ['\"]@mui/icons-material/.+['\"];?\s*$"
                content = re.sub(pattern1, lambda m: '// TODO: Replace with Heroicons\n// ' + m.group(0), content, flags=re.MULTILINE)
                
                # Pattern 2: import { Icon1, Icon2 } from '@mui/icons-material';
                pattern2 = r"^import \{[^}]+\} from ['\"]@mui/icons-material['\"];?\s*$"
                content = re.sub(pattern2, lambda m: '// TODO: Replace with Heroicons\n// ' + m.group(0), content, flags=re.MULTILINE)
                
                if content != original_content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    files_fixed.append(filepath)
                    rel_path = os.path.relpath(filepath, root_dir)
                    print(f"✓ Fixed: {rel_path}")
    
    return files_fixed

if __name__ == '__main__':
    root = r'C:\Projekt\Lugn-Trygg-main_klar\src'
    print("Commenting out MUI icon imports...")
    fixed = fix_mui_icon_imports(root)
    print(f"\n✅ Fixed {len(fixed)} files")
