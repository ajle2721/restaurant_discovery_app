$baseDir = Get-Location
$aiReviewDir = Join-Path $baseDir "ai_review"
$indexJsPath = Join-Path $aiReviewDir "index.js"

if (-not (Test-Path $indexJsPath)) {
    Write-Error "Error: index.js not found."
    exit 1
}

# Read index.js content as UTF-8
$content = [System.IO.File]::ReadAllText($indexJsPath, [System.Text.Encoding]::UTF8)

# Extract JSON array
$start = $content.IndexOf("[")
$end = $content.LastIndexOf("]")
if ($start -eq -1 -or $end -eq -1) {
    Write-Error "Error: Could not locate JSON array."
    exit 1
}

$jsonStr = $content.Substring($start, $end - $start + 1)
$records = ConvertFrom-Json $jsonStr
Write-Output "Parsed $($records.Count) records from index.js."

$updatedCount = 0

foreach ($record in $records) {
    $placeId = $record.place_id
    if (-not $placeId) { continue }
    
    $jsonPath = Join-Path $aiReviewDir "$placeId.json"
    if (Test-Path $jsonPath) {
        $aiRaw = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
        if ($aiRaw.StartsWith("`u{FEFF}")) { $aiRaw = $aiRaw.Substring(1) }
        $aiData = $aiRaw | ConvertFrom-Json
        
        $hasPrivateRoom = "unknown"
        if ($aiData.has_private_room) {
            $res = $aiData.has_private_room.result.ToString().Trim().ToLower()
            if ($res -eq "yes") { $hasPrivateRoom = "yes" }
            elseif ($res -eq "no") { $hasPrivateRoom = "no" }
        }
        
        # Update attribute inside record in index.js
        if ($record.attributes) {
            if ($record.attributes.has_private_room -ne $hasPrivateRoom) {
                $record.attributes.has_private_room = $hasPrivateRoom
                $updatedCount++
            }
        }
    }
}

# Convert back to JSON (using piping to ensure a JSON array is produced) and write to file
$jsonData = $records | ConvertTo-Json -Depth 20
$utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
$finalContent = "const restaurantData = $jsonData;"
[System.IO.File]::WriteAllText($indexJsPath, $finalContent, $utf8NoBOM)

Write-Output "Done! Updated $updatedCount records inside index.js."
