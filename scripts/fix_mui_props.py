"""
Fix common MUI prop issues in components
- Remove duplicate imports
- Remove MUI-specific props (display, alignItems, sx, etc.)
- Remove unsupported props (fullWidth, startIcon, severity, etc.)
"""
import os
import re

def fix_duplicate_imports(content):
    """Remove duplicate imports in import statements"""
    # Find import statements
    import_pattern = r'import \{([^}]+)\} from [\'"]([^\'"]+)[\'"];'
    
    def dedupe_imports(match):
        imports_str = match.group(1)
        from_path = match.group(2)
        
        # Split by comma and deduplicate
        imports = [i.strip() for i in imports_str.split(',')]
        unique_imports = []
        seen = set()
        
        for imp in imports:
            if imp and imp not in seen:
                unique_imports.append(imp)
                seen.add(imp)
        
        return f"import {{ {', '.join(unique_imports)} }} from '{from_path}';"
    
    return re.sub(import_pattern, dedupe_imports, content)

def remove_mui_box_props(content):
    """Remove MUI Box props like display, alignItems, justifyContent"""
    # Remove display prop
    content = re.sub(r'\s+display="[^"]*"', '', content)
    content = re.sub(r"\s+display='[^']*'", '', content)
    
    # Remove alignItems prop
    content = re.sub(r'\s+alignItems="[^"]*"', '', content)
    content = re.sub(r"\s+alignItems='[^']*'", '', content)
    
    # Remove justifyContent prop
    content = re.sub(r'\s+justifyContent="[^"]*"', '', content)
    content = re.sub(r"\s+justifyContent='[^']*'", '', content)
    
    # Remove gap prop (number)
    content = re.sub(r'\s+gap=\{\d+\}', '', content)
    
    # Remove mb, mt, etc props (number)
    content = re.sub(r'\s+mb=\{\d+\}', '', content)
    content = re.sub(r'\s+mt=\{\d+\}', '', content)
    content = re.sub(r'\s+ml=\{\d+\}', '', content)
    content = re.sub(r'\s+mr=\{\d+\}', '', content)
    content = re.sub(r'\s+mx=\{\d+\}', '', content)
    content = re.sub(r'\s+my=\{\d+\}', '', content)
    content = re.sub(r'\s+p=\{\d+\}', '', content)
    content = re.sub(r'\s+pt=\{\d+\}', '', content)
    content = re.sub(r'\s+pb=\{\d+\}', '', content)
    content = re.sub(r'\s+pl=\{\d+\}', '', content)
    content = re.sub(r'\s+pr=\{\d+\}', '', content)
    content = re.sub(r'\s+px=\{\d+\}', '', content)
    content = re.sub(r'\s+py=\{\d+\}', '', content)
    
    return content

def remove_unsupported_button_props(content):
    """Remove fullWidth, startIcon, endIcon from Button"""
    content = re.sub(r'\s+fullWidth(?:\s+|/>|>)', r'\1', content)
    content = re.sub(r'\s+startIcon=\{[^}]+\}', '', content)
    content = re.sub(r'\s+endIcon=\{[^}]+\}', '', content)
    
    return content

def remove_severity_prop(content):
    """Remove severity prop from Alert"""
    content = re.sub(r'\s+severity="[^"]*"', '', content)
    content = re.sub(r"\s+severity='[^']*'", '', content)
    
    return content

def remove_grid_mui_props(content):
    """Remove MUI Grid props"""
    content = re.sub(r'\s+container(?:\s+|/>|>)', lambda m: m.group(0).replace(' container', ''), content)
    content = re.sub(r'\s+item(?:\s+|/>|>)', lambda m: m.group(0).replace(' item', ''), content)
    content = re.sub(r'\s+spacing=\{\d+\}', '', content)
    content = re.sub(r'\s+xs=\{\d+\}', '', content)
    content = re.sub(r'\s+sm=\{\d+\}', '', content)
    content = re.sub(r'\s+md=\{\d+\}', '', content)
    content = re.sub(r'\s+lg=\{\d+\}', '', content)
    content = re.sub(r'\s+xl=\{\d+\}', '', content)
    
    return content

def fix_file(filepath):
    """Fix all issues in a file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Apply all fixes
    content = fix_duplicate_imports(content)
    content = remove_mui_box_props(content)
    content = remove_unsupported_button_props(content)
    content = remove_severity_prop(content)
    content = remove_grid_mui_props(content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def main():
    root = r'C:\Projekt\Lugn-Trygg-main_klar\src'
    files_fixed = 0
    
    print("🔧 Fixing MUI prop issues...\n")
    
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
