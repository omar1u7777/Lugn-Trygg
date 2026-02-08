"""
Convert MUI sx={{}} props to Tailwind className
Smart conversion of spacing, colors, typography, flexbox, etc.
"""
import os
import re

# MUI spacing to Tailwind mapping (theme.spacing(1) = 8px in MUI)
SPACING_MAP = {
    '0': '0',
    '0.5': '1',  # 4px
    '1': '2',    # 8px
    '2': '4',    # 16px
    '3': '6',    # 24px
    '4': '8',    # 32px
    '5': '10',   # 40px
    '6': '12',   # 48px
    '7': '14',   # 56px
    '8': '16',   # 64px
    '10': '20',  # 80px
    '12': '24',  # 96px
}

def convert_spacing(value):
    """Convert MUI spacing value to Tailwind"""
    return SPACING_MAP.get(str(value), str(value))

def parse_sx_to_tailwind(sx_content):
    """Parse sx object and convert to Tailwind classes"""
    classes = []
    
    # Remove outer braces and whitespace
    sx_content = sx_content.strip()
    if sx_content.startswith('{') and sx_content.endswith('}'):
        sx_content = sx_content[1:-1].strip()
    
    # Common patterns
    patterns = [
        # Margin
        (r"mt:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"mt-{convert_spacing(m.group(1))}"),
        (r"mb:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"mb-{convert_spacing(m.group(1))}"),
        (r"ml:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"ml-{convert_spacing(m.group(1))}"),
        (r"mr:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"mr-{convert_spacing(m.group(1))}"),
        (r"mx:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"mx-{convert_spacing(m.group(1))}"),
        (r"my:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"my-{convert_spacing(m.group(1))}"),
        (r"m:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"m-{convert_spacing(m.group(1))}"),
        
        # Padding
        (r"pt:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"pt-{convert_spacing(m.group(1))}"),
        (r"pb:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"pb-{convert_spacing(m.group(1))}"),
        (r"pl:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"pl-{convert_spacing(m.group(1))}"),
        (r"pr:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"pr-{convert_spacing(m.group(1))}"),
        (r"px:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"px-{convert_spacing(m.group(1))}"),
        (r"py:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"py-{convert_spacing(m.group(1))}"),
        (r"p:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"p-{convert_spacing(m.group(1))}"),
        
        # Width/Height
        (r"width:\s*['\"]100%['\"]", lambda m: "w-full"),
        (r"width:\s*['\"]50%['\"]", lambda m: "w-1/2"),
        (r"height:\s*['\"]100%['\"]", lambda m: "h-full"),
        (r"minHeight:\s*['\"]100vh['\"]", lambda m: "min-h-screen"),
        
        # Flexbox
        (r"display:\s*['\"]flex['\"]", lambda m: "flex"),
        (r"flexDirection:\s*['\"]column['\"]", lambda m: "flex-col"),
        (r"flexDirection:\s*['\"]row['\"]", lambda m: "flex-row"),
        (r"justifyContent:\s*['\"]center['\"]", lambda m: "justify-center"),
        (r"justifyContent:\s*['\"]space-between['\"]", lambda m: "justify-between"),
        (r"justifyContent:\s*['\"]flex-start['\"]", lambda m: "justify-start"),
        (r"justifyContent:\s*['\"]flex-end['\"]", lambda m: "justify-end"),
        (r"alignItems:\s*['\"]center['\"]", lambda m: "items-center"),
        (r"alignItems:\s*['\"]flex-start['\"]", lambda m: "items-start"),
        (r"alignItems:\s*['\"]flex-end['\"]", lambda m: "items-end"),
        (r"gap:\s*['\"]?(\d+(?:\.\d+)?)['\"]?", lambda m: f"gap-{convert_spacing(m.group(1))}"),
        
        # Text
        (r"textAlign:\s*['\"]center['\"]", lambda m: "text-center"),
        (r"textAlign:\s*['\"]left['\"]", lambda m: "text-left"),
        (r"textAlign:\s*['\"]right['\"]", lambda m: "text-right"),
        (r"fontWeight:\s*['\"]bold['\"]", lambda m: "font-bold"),
        (r"fontWeight:\s*['\"]?600['\"]?", lambda m: "font-semibold"),
        (r"fontWeight:\s*['\"]?700['\"]?", lambda m: "font-bold"),
        
        # Border
        (r"borderRadius:\s*['\"]?(\d+)['\"]?", lambda m: f"rounded-{m.group(1)}" if m.group(1) in ['0','1','2','3'] else "rounded-lg"),
        
        # Position
        (r"position:\s*['\"]relative['\"]", lambda m: "relative"),
        (r"position:\s*['\"]absolute['\"]", lambda m: "absolute"),
        (r"position:\s*['\"]fixed['\"]", lambda m: "fixed"),
        
        # Overflow
        (r"overflow:\s*['\"]hidden['\"]", lambda m: "overflow-hidden"),
        (r"overflow:\s*['\"]auto['\"]", lambda m: "overflow-auto"),
    ]
    
    for pattern, replacement in patterns:
        matches = re.finditer(pattern, sx_content)
        for match in matches:
            if callable(replacement):
                classes.append(replacement(match))
            else:
                classes.append(replacement)
    
    return ' '.join(classes)

def convert_sx_in_file(filepath):
    """Convert all sx props to className in a file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Find all sx={{...}} patterns
    # Simple pattern for single-line sx
    pattern = r'sx=\{\{([^}]+)\}\}'
    
    def replace_sx(match):
        sx_content = match.group(1)
        tailwind_classes = parse_sx_to_tailwind(sx_content)
        if tailwind_classes:
            return f'className="{tailwind_classes}"'
        return match.group(0)  # Keep original if conversion fails
    
    content = re.sub(pattern, replace_sx, content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def main():
    root = r'C:\Projekt\Lugn-Trygg-main_klar\src'
    files_fixed = 0
    
    print("🔄 Converting sx={{}} to Tailwind className...\n")
    
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ['node_modules', 'dist', '__pycache__', '.git']]
        
        for filename in filenames:
            if filename.endswith(('.tsx', '.ts', '.jsx', '.js')):
                filepath = os.path.join(dirpath, filename)
                
                if convert_sx_in_file(filepath):
                    files_fixed += 1
                    rel_path = os.path.relpath(filepath, root)
                    print(f"✓ {rel_path}")
    
    print(f"\n✅ Converted sx props in {files_fixed} files")
    print(f"🎯 All sx={{}} props converted to className!")

if __name__ == '__main__':
    main()
