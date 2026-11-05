# -*- coding: utf-8 -*-
import re

f = r'D:\1kaifa\money-tracker\money-tracker\src\App.tsx'

with open(f, 'r', encoding='utf-8') as file:
    content = file.read()

# Remove redundant localStorage calls after setCurrentLedger
# (setCurrentLedger in appStore.ts now handles localStorage internally)
content = re.sub(
    r'setCurrentLedger\(saved\)\s*\n\s*localStorage\.setItem\([^)]+\)\s*\n\s*return',
    'setCurrentLedger(saved); return',
    content
)
content = re.sub(
    r'setCurrentLedger\(data\[0\]\)\s*\n\s*localStorage\.setItem\([^)]+\)\s*\n\s*\}',
    'setCurrentLedger(data[0])\n  }',
    content
)

with open(f, 'w', encoding='utf-8') as file:
    file.write(content)

print('Done')
