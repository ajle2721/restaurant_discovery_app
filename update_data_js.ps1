$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map"
$dataJsPath = Join-Path $baseDir "data.js"
$aiReviewDir = Join-Path $baseDir "ai_review"

$dataJsRaw = [System.IO.File]::ReadAllText($dataJsPath, [System.Text.Encoding]::UTF8)

$aiFiles = Get-ChildItem -Path $aiReviewDir -Filter "*.json"
$seatMap = @{}

foreach ($file in $aiFiles) {
    $placeId = $file.BaseName
    $aiRaw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    
    # The key might be " child_seat available" or "child_seat available"
    # we just search for the first result after it
    $pattern = '(?i)" ?child_seat available"\s*:\s*\{[^}]*"result"\s*:\s*"([^"]+)"'
    if ($aiRaw -match $pattern) {
        $result = $matches[1].ToLower()
        $seatMap[$placeId] = $result
    }
}

Write-Output "Loaded $($seatMap.Count) records from ai_review."

$blocks = $dataJsRaw -split '(?=\n\s*\{\r?\n)'
$newBlocks = @()
$updateCount = 0

foreach ($block in $blocks) {
    if ($block -match '"place_id"\s*:\s*"([^"]+)"') {
        $placeId = $matches[1]
        if ($seatMap.Contains($placeId)) {
            $newVal = $seatMap[$placeId]
            $block = $block -replace '("high_chair_available"\s*:\s*)"[^"]+"', "`$1`"$newVal`""
            $updateCount++
        }
    }
    $newBlocks += $block
}

$newDataJs = $newBlocks -join ''
[System.IO.File]::WriteAllText($dataJsPath, $newDataJs, [System.Text.Encoding]::UTF8)

Write-Output "Successfully updated $updateCount entries in data.js!"
