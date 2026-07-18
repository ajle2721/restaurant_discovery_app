$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\ai_review"
$files = Get-ChildItem -Path $baseDir -Filter "*.json"

$highCount = 0
$midCount = 0
$lowCount = 0

foreach ($file in $files) {
    $raw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    if ($raw -match '"parent_friendly_level"\s*:\s*"高"') {
        $highCount++
    } elseif ($raw -match '"parent_friendly_level"\s*:\s*"中"') {
        $midCount++
    } elseif ($raw -match '"parent_friendly_level"\s*:\s*"資訊不足"') {
        $lowCount++
    }
}

Write-Output "高: $highCount"
Write-Output "中: $midCount"
Write-Output "資訊不足: $lowCount"
