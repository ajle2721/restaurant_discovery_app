$aiReviewDir = Join-Path (Get-Location) "ai_review"
$indexJsPath = Join-Path $aiReviewDir "index.js"

if (-not (Test-Path $indexJsPath)) {
    Write-Error "Error: $indexJsPath does not exist."
    exit 1
}

Write-Output "Unpacking index.js back to individual JSON files (PowerShell version)..."

# Read index.js content as UTF8
$content = [System.IO.File]::ReadAllText($indexJsPath, [System.Text.Encoding]::UTF8)

# Find JSON array
$start = $content.IndexOf("[")
$end = $content.LastIndexOf("]")

if ($start -eq -1 -or $end -eq -1) {
    Write-Error "Error: Could not locate JSON array inside index.js."
    exit 1
}

$jsonStr = $content.Substring($start, $end - $start + 1)

try {
    $records = ConvertFrom-Json $jsonStr
} catch {
    Write-Error "Error parsing JSON from index.js: $_"
    exit 1
}

Write-Output "Parsed $($records.Count) records from index.js."

$updatedCount = 0
$createdCount = 0

function Map-Value($val) {
    if ($null -eq $val) { return "Unknown" }
    $v = ($val.ToString()).Trim().ToLower()
    if ($v -eq "yes") { return "Yes" }
    if ($v -eq "no") { return "No" }
    return "Unknown"
}

foreach ($record in $records) {
    $placeId = $record.place_id
    if (-not $placeId) { continue }

    $jsonPath = Join-Path $aiReviewDir "$placeId.json"

    # Load existing or create new hashtable
    if (Test-Path $jsonPath) {
        try {
            $fileContent = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
            # Remove BOM if any
            if ($fileContent.StartsWith("`u{FEFF}")) {
                $fileContent = $fileContent.Substring(1)
            }
            $jsonData = ConvertFrom-Json $fileContent
            $updatedCount++
        } catch {
            Write-Warning "Error reading existing file $jsonPath. Overwriting."
            $jsonData = [PSCustomObject]@{}
            $createdCount++
        }
    } else {
        $jsonData = [PSCustomObject]@{}
        $createdCount++
    }

    # Ensure attributes object exists
    $attrs = $record.attributes

    # Determine child seat key in existing JSON
    $highChairKey = "child_seat available"
    foreach ($k in @(" child_seat available", "child_seat available", "High chair available")) {
        if (Get-Member -InputObject $jsonData -Name $k -MemberType Properties) {
            $highChairKey = $k
            break
        }
    }

    $attrMapping = @{
        "high_chair_available" = $highChairKey
        "kids_menu"            = "Kids menu available"
        "spacious_seating"     = "Spacious seating"
        "kid_noise_tolerant"   = "kid_noise_tolerant"
        "has_play_area"        = "has_play_area"
        "has_private_room"     = "has_private_room"
        "has_tableware"        = "has_tableware"
        "has_diaper_table"     = "has_diaper_table"
    }

    foreach ($entry in $attrMapping.GetEnumerator()) {
        $indexKey = $entry.Key
        $jsonKey = $entry.Value

        if (Get-Member -InputObject $attrs -Name $indexKey -MemberType Properties) {
            $rawVal = $attrs.$indexKey
            $newVal = Map-Value $rawVal

            if (Get-Member -InputObject $jsonData -Name $jsonKey -MemberType Properties) {
                # Update existing
                $jsonData.$jsonKey.result = $newVal
            } else {
                # Create new
                $conf = if ($newVal -ne "Unknown") { 1.0 } else { 0.4 }
                Add-Member -InputObject $jsonData -NotePropertyName $jsonKey -NotePropertyValue ([PSCustomObject]@{
                    result = $newVal
                    evidence = $null
                    confidence = $conf
                })
            }
        }
    }

    # Top-level fields
    $jsonData | Add-Member -NotePropertyName "generated_summary" -NotePropertyValue $record.ai_summary -Force
    $jsonData | Add-Member -NotePropertyName "card_summary" -NotePropertyValue $record.card_summary -Force
    $jsonData | Add-Member -NotePropertyName "generated_signals" -NotePropertyValue $record.signals -Force
    $jsonData | Add-Member -NotePropertyName "parent_friendly_score" -NotePropertyValue $record.parent_friendly_score -Force
    $jsonData | Add-Member -NotePropertyName "parent_friendly_level" -NotePropertyValue $record.parent_friendly_level -Force
    $jsonData | Add-Member -NotePropertyName "reason" -NotePropertyValue $record.reason -Force

    # Convert back to JSON and write to file
    $outputJson = ConvertTo-Json -InputObject $jsonData -Depth 10
    [System.IO.File]::WriteAllText($jsonPath, $outputJson, [System.Text.Encoding]::UTF8)
}

Write-Output "Done! Updated $updatedCount files, created $createdCount files in $aiReviewDir."
