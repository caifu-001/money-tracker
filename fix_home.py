# -*- coding: utf-8 -*-
with open(r'D:\1kaifa\money-tracker\money-tracker\src\pages\Home.tsx', 'rb') as f:
    raw = f.read()

# Find line 211 and replace
lines = raw.split(b'\n')
print(f'Total lines: {len(lines)}')
print(f'Line 211: {lines[210][:80]}')
# Replace with better time format
lines[210] = b"                      {format(new Date(transaction.created_at || transaction.date), 'MM/dd HH:mm')}"
print(f'New line 211: {lines[210][:80]}')

with open(r'D:\1kaifa\money-tracker\money-tracker\src\pages\Home.tsx', 'wb') as f:
    f.write(b'\n'.join(lines))
print('Done')
