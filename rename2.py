# Targeted replacements for renaming to 游游记账
import shutil, os

base = r'D:\1kaifa\money-tracker'

# Copy logo to public
shutil.copy2(os.path.join(base, 'logo.png'), os.path.join(base, 'public', 'logo.png'))

targets = [
    os.path.join(base, 'index.html'),
    os.path.join(base, 'public', 'manifest.json'),
]

for f in targets:
    if not os.path.exists(f):
        print(f'MISSING: {f}')
        continue
    with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
        content = fh.read()
    new_content = content
    new_content = new_content.replace('记账系统', '游游记账')
    if new_content != content:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(new_content)
        print(f'Updated: {f}')

print('Done')
