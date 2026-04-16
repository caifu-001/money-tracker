with open(r'D:\1kaifa\money-tracker\money-tracker\src\components\QuickAdd.tsx', 'rb') as f:
    content = f.read()

# Find the problematic div
old1 = b'<div className="fixed inset-0 z-50 bg-white flex flex-col"'
old2 = b'        style={{ borderRadius: \'28px 28px 0 0\', maxHeight: \'92dvh\', overflowY: \'auto\', top: \'auto\' }}>'
old3 = b'</div>'

if old1 in content:
    # Replace with bottom-only fixed panel
    new = b'<div className="fixed inset-x-0 bottom-0 z-50 bg-white"\n        style={{ borderRadius: \'28px 28px 0 0\', maxHeight: \'92dvh\', overflowY: \'auto\' }}>'
    content = content.replace(old1, new)
    # Also remove top: auto if it's still there
    with open(r'D:\1kaifa\money-tracker\money-tracker\src\components\QuickAdd.tsx', 'wb') as f:
        f.write(content)
    print('Fixed QuickAdd panel div')
else:
    print('Not found')
    idx = content.find(b'inset-0')
    print(repr(content[idx:idx+100]))
