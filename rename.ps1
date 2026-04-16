# Copy logo
Copy-Item -Path "D:\1kaifa\money-tracker\logo.png" -Destination "D:\1kaifa\money-tracker\public\logo.png" -Force
Write-Host "Logo copied"

# Update index.html
$html = Get-Content "D:\1kaifa\money-tracker\index.html" -Raw -Encoding UTF8
$html = $html -replace '记账系统', '游游记账'
$html | Set-Content "D:\1kaifa\money-tracker\index.html" -Encoding UTF8 -NoNewline
Write-Host "index.html updated"

# Update manifest.json
$json = Get-Content "D:\1kaifa\money-tracker\public\manifest.json" -Raw -Encoding UTF8
$json = $json -replace '记账系统', '游游记账'
$json | Set-Content "D:\1kaifa\money-tracker\public\manifest.json" -Encoding UTF8 -NoNewline
Write-Host "manifest.json updated"

Write-Host "All done"
