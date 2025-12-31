#!/usr/bin/env python3
"""
MASSIV MUI -> Tailwind Migration Script
Ersätter automatiskt MUI imports i ALLA TypeScript/TSX filer
"""

import os
import re
from pathlib import Path

# MUI Component Mapping
MUI_TO_TAILWIND = {
    'Box': ('Box', 'ui/tailwind'),
    'Container': ('Container', 'ui/tailwind'),
    'Grid': ('Grid', 'ui/tailwind'),
    'Stack': ('Stack', 'ui/tailwind'),
    'Card': ('Card', 'ui/tailwind'),
    'CardContent': ('CardContent', 'ui/tailwind'),
    'CardHeader': ('CardHeader', 'ui/tailwind'),
    'Button': ('Button', 'ui/tailwind'),
    'TextField': ('Input', 'ui/tailwind'),
    'Typography': ('Typography', 'ui/tailwind'),
    'Alert': ('Alert', 'ui/tailwind'),
    'Chip': ('Chip', 'ui/tailwind'),
    'Badge': ('Badge', 'ui/tailwind'),
    'Avatar': ('Avatar', 'ui/tailwind'),
    'CircularProgress': ('Spinner', 'ui/tailwind'),
    'LinearProgress': ('Progress', 'ui/tailwind'),
    'Divider': ('Divider', 'ui/tailwind'),
    'Dialog': ('Dialog', 'ui/tailwind'),
    'Snackbar': ('Snackbar', 'ui/tailwind'),
    'Skeleton': ('Skeleton', 'ui/tailwind'),
    'Paper': ('Card', 'ui/tailwind'),
    'IconButton': ('Button', 'ui/tailwind'),
    'Fab': ('Button', 'ui/tailwind'),
}

def process_file(file_path):
    """Process a single file to replace MUI imports"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Skip if no MUI imports
        if '@mui/' not in content and '@emotion/' not in content:
            return False
        
        # Replace @mui/material imports
        mui_import_pattern = r"import\s+{([^}]+)}\s+from\s+['\"]@mui/material['\"]"
        
        def replace_mui_import(match):
            imports = match.group(1)
            import_list = [imp.strip() for imp in imports.split(',')]
            
            tailwind_imports = []
            for imp in import_list:
                # Remove 'as' aliases for now
                base_name = imp.split(' as ')[0].strip()
                if base_name in MUI_TO_TAILWIND:
                    new_name, path = MUI_TO_TAILWIND[base_name]
                    tailwind_imports.append(new_name)
            
            if tailwind_imports:
                # Calculate relative path
                file_dir = Path(file_path).parent
                src_dir = Path(file_path).parents[2]  # Go up to src
                rel_parts = file_dir.relative_to(src_dir).parts
                up_levels = len(rel_parts)
                rel_path = '../' * up_levels + 'components/ui/tailwind'
                
                return f"import {{ {', '.join(tailwind_imports)} }} from '{rel_path}'"
            return ''
        
        content = re.sub(mui_import_pattern, replace_mui_import, content)
        
        # Remove @mui/icons-material imports (comment them out)
        content = re.sub(
            r"import\s+{[^}]+}\s+from\s+['\"]@mui/icons-material['\"]",
            lambda m: f"// TODO: Replace with Heroicons\n// {m.group(0)}",
            content
        )
        
        # Remove @emotion imports
        content = re.sub(
            r"import\s+.*\s+from\s+['\"]@emotion/[^'\"]+['\"].*\n",
            '',
            content
        )
        
        # Remove sx prop usage (basic removal - will need manual cleanup)
        content = re.sub(r'\s+sx={{[^}]*}}', '', content)
        
        # Replace variant="contained" with variant="primary"
        content = re.sub(r'variant="contained"', 'variant="primary"', content)
        content = re.sub(r"variant='contained'", "variant='primary'", content)
        
        # Replace variant="outlined" with variant="outline"
        content = re.sub(r'variant="outlined"', 'variant="outline"', content)
        content = re.sub(r"variant='outlined'", "variant='outline'", content)
        
        # Save if changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
            
    except Exception as e:
        print(f"ERROR processing {file_path}: {e}")
    
    return False

def process_directory(directory):
    """Process all .tsx and .ts files in directory"""
    src_dir = Path(directory)
    files_processed = 0
    files_modified = 0
    
    # Skip certain directories
    skip_dirs = {'node_modules', 'dist', 'build', '.git', '__pycache__', 'Backend'}
    
    for file_path in src_dir.rglob('*.tsx'):
        # Check if file is in skip directory
        if any(skip in file_path.parts for skip in skip_dirs):
            continue
        
        files_processed += 1
        if process_file(file_path):
            files_modified += 1
            print(f"✓ Modified: {file_path.relative_to(src_dir)}")
    
    for file_path in src_dir.rglob('*.ts'):
        # Check if file is in skip directory or is a test file
        if any(skip in file_path.parts for skip in skip_dirs):
            continue
        if '.test.' in file_path.name or '.spec.' in file_path.name:
            continue
            
        files_processed += 1
        if process_file(file_path):
            files_modified += 1
            print(f"✓ Modified: {file_path.relative_to(src_dir)}")
    
    return files_processed, files_modified

if __name__ == '__main__':
    print("=" * 60)
    print("MUI -> TAILWIND MASS MIGRATION")
    print("=" * 60)
    print()
    
    src_dir = Path(__file__).parent.parent / 'src'
    
    if not src_dir.exists():
        print(f"ERROR: Source directory not found: {src_dir}")
        exit(1)
    
    print(f"Processing: {src_dir}")
    print()
    
    processed, modified = process_directory(src_dir)
    
    print()
    print("=" * 60)
    print(f"✅ MIGRATION COMPLETE!")
    print(f"📊 Files processed: {processed}")
    print(f"✏️  Files modified: {modified}")
    print("=" * 60)
    print()
    print("⚠️  NEXT STEPS:")
    print("1. Review all modified files")
    print("2. Replace icon imports with Heroicons")
    print("3. Fix remaining sx props manually")
    print("4. Test components")
    print("5. Run: npm run build")
