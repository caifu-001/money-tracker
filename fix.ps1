$f = 'D:\1kaifa\money-tracker\money-tracker\src\App.tsx'
$content = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::GetEncoding('GB2312'))
$content = $content -replace 'localStorage\.setItem\([^)]+qianji_current_ledger[^)]+\)\s*\r?\n\s*return', 'return'
$content = $content -replace 'localStorage\.setItem\([^)]+qianji_current_ledger[^)]+\)\s*\r?\n\s*\}', '}'
$content = $content -replace 'localStorage\.setItem\([^)]+qianji_current_ledger[^)]+\)\s*\r?\n\s*\}', '}'
[System.IO.File]::WriteAllText($f, $content, [System.Text.Encoding]::GetEncoding('GB2312'))
Write-Host "Done"
