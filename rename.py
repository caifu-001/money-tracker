# -*- coding: utf-8 -*-
import os, glob, shutil

base = r'D:\1kaifa\money-tracker'

# Copy logo
src_logo = os.path.join(base, 'logo.png')
dst_logo = os.path.join(base, 'public', 'logo.png')
os.makedirs(os.path.dirname(dst_logo), exist_ok=True)
shutil.copy2(src_logo, dst_logo)
print(f'Logo copied to {dst_logo}')

# Files to update
files_to_update = glob.glob(base + r'\**\*.tsx', recursive=True) + \
                 glob.glob(base + r'\**\*.ts', recursive=True) + \
                 glob.glob(base + r'\**\*.html', recursive=True) + \
                 glob.glob(base + r'\**\*.json', recursive=True) + \
                 glob.glob(base + r'\**\*.css', recursive=True)

replacements = [
    # Title
    ('>记账系统<', '>游游记账<'),
    # Nav labels
    ('>首页<', '>首页<'),
    # Document titles
    ('<title>记账系统</title>', '<title>游游记账</title>'),
    # Manifest
    ('"name": "记账系统"', '"name": "游游记账"'),
    ('"short_name": "记账"', '"short_name": "游游记账"'),
    # Description
    ('"description": "轻量级家庭记账系统"', '"description": "游游记账 - 家庭协同记账应用"'),
    # App title
    ('APP_NAME=记账系统', 'APP_NAME=游游记账'),
    # Any other references
    ('money-tracker', 'money-tracker'),
    ('Money Tracker', '游游记账'),
    ('money tracker', '游游记账'),
]

count = 0
for f in files_to_update:
    if 'node_modules' in f or 'dist' in f: continue
    try:
        with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
            content = fh.read()
        new_content = content
        changed = False
        
        # Specific replacements
        for old, new in replacements:
            if old in new_content:
                new_content = new_content.replace(old, new)
                changed = True
        
        # Also fix specific known patterns
        if '记账系统' in new_content and '游游记账' not in new_content:
            new_content = new_content.replace('记账系统', '游游记账')
            changed = True
        if 'money-tracker' in new_content:
            new_content = new_content.replace('money-tracker', 'money-tracker')
            changed = True

        if changed:
            with open(f, 'w', encoding='utf-8') as fh:
                fh.write(new_content)
            print(f'Updated: {f}')
            count += 1
    except Exception as e:
        print(f'Error in {f}: {e}')

print(f'\nTotal files updated: {count}')
