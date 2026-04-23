$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map"
$dataJsPath = Join-Path $baseDir "data.js"
$aiReviewDir = Join-Path $baseDir "ai_review"

$dataJsRaw = [System.IO.File]::ReadAllText($dataJsPath, [System.Text.Encoding]::UTF8)

$aiFiles = Get-ChildItem -Path $aiReviewDir -Filter "*.json"
$scoreMap = @{}
$levelMap = @{}
$reasonMap = @{}

foreach ($file in $aiFiles) {
    $placeId = $file.BaseName
    $aiRaw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    
    if ($aiRaw -match '"parent_friendly_score"\s*:\s*([\d\.]+)') {
        $scoreMap[$placeId] = $matches[1]
    }
    if ($aiRaw -match '"parent_friendly_level"\s*:\s*"([^"]+)"') {
        $levelMap[$placeId] = $matches[1]
    }
    if ($aiRaw -match '"reason"\s*:\s*"([^"]+)"') {
        $reasonMap[$placeId] = $matches[1]
    }
}

Write-Output "Loaded data from ai_review."

$blocks = $dataJsRaw -split '(?=\n\s*\{\r?\n)'
$newBlocks = @()
$updateCount = 0

foreach ($block in $blocks) {
    if ($block -match '"place_id"\s*:\s*"([^"]+)"') {
        $placeId = $matches[1]
        
        # Remove old parent_friendly fields if they exist
        $block = $block -replace ',\s*"parent_friendly_score":[^,]+', ''
        $block = $block -replace ',\s*"parent_friendly_level":\s*"[^"]+"', ''
        $block = $block -replace ',\s*"reason":\s*"[^"]+"', ''
        
        if ($levelMap.Contains($placeId)) {
            $score = $scoreMap[$placeId]
            $level = $levelMap[$placeId]
            $reason = $reasonMap[$placeId]
            
            # Insert before place_id
            $insertion = "`"parent_friendly_score`": $score,`n    `"parent_friendly_level`": `"$level`",`n    `"reason`": `"$reason`",`n    `"place_id`""
            $block = $block -replace '"place_id"', $insertion
            $updateCount++
        }
    }
    $newBlocks += $block
}

$newDataJs = $newBlocks -join ''
[System.IO.File]::WriteAllText($dataJsPath, $newDataJs, [System.Text.Encoding]::UTF8)

Write-Output "Successfully added new fields to $updateCount entries in data.js!"
