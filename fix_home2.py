with open(r'D:\1kaifa\money-tracker\money-tracker\src\pages\Home.tsx', 'rb') as f:
    lines = f.read().split(b'\n')
print('L211 before:', lines[210])
# Replace with full timestamp display
new_line = b"                      {format(new Date(transaction.created_at || transaction.date), 'MM/dd HH:mm')}"
lines[210] = new_line
print('L211 after:', lines[210])
with open(r'D:\1kaifa\money-tracker\money-tracker\src\pages\Home.tsx', 'wb') as f:
    f.write(b'\n'.join(lines))
print('Done')
