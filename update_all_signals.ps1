$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map"
$dataJsPath = Join-Path $baseDir "data.js"
$aiReviewDir = Join-Path $baseDir "ai_review"

$dataJsRaw = [System.IO.File]::ReadAllText($dataJsPath, [System.Text.Encoding]::UTF8)

$startIndex = $dataJsRaw.IndexOf('[')
$endIndex = $dataJsRaw.LastIndexOf(']')
if ($startIndex -eq -1 -or $endIndex -eq -1) {
    Write-Output "Failed to find JSON array in data.js"
    exit
}

$prefix = $dataJsRaw.Substring(0, $startIndex)
$suffix = $dataJsRaw.Substring($endIndex + 1)
$jsonStr = $dataJsRaw.Substring($startIndex, $endIndex - $startIndex + 1)

$data = ConvertFrom-Json $jsonStr

$updateCount = 0
$signalAddedCount = 0

foreach ($item in $data) {
    $placeId = $item.place_id
    if ([string]::IsNullOrEmpty($placeId)) { continue }

    $aiPath = Join-Path $aiReviewDir "$placeId.json"
    if (-not (Test-Path $aiPath)) { continue }

    $aiRaw = [System.IO.File]::ReadAllText($aiPath, [System.Text.Encoding]::UTF8)
    $aiData = ConvertFrom-Json $aiRaw

    $attributes = $item.attributes
    if ($null -eq $attributes) { continue }

    $currentSignals = @()
    if ($null -ne $item.signals) {
        $currentSignals = @($item.signals)
    }

    $newSignals = @()

    # high_chair_available
    if ($attributes.high_chair_available -eq "yes") {
        $res = $null
        if ($null -ne $aiData." child_seat available") { $res = $aiData." child_seat available" }
        elseif ($null -ne $aiData."child_seat available") { $res = $aiData."child_seat available" }
        
        if ($null -ne $res -and $res.result -match "(?i)^yes$") {
            if (-not [string]::IsNullOrWhiteSpace($res.evidence) -and $res.evidence -notmatch "(?i)^null|none|unknown|n/a$") {
                $newSignals += $res.evidence.Trim()
            }
        }
    }

    # spacious_seating
    if ($attributes.spacious_seating -eq "yes") {
        $res = $aiData."Spacious seating"
        if ($null -ne $res -and $res.result -match "(?i)^yes$") {
            if (-not [string]::IsNullOrWhiteSpace($res.evidence) -and $res.evidence -notmatch "(?i)^null|none|unknown|n/a$") {
                $newSignals += $res.evidence.Trim()
            }
        }
    }

    # kids_menu
    if ($attributes.kids_menu -eq "yes") {
        $res = $aiData."Kids menu available"
        if ($null -ne $res -and $res.result -match "(?i)^yes$") {
            if (-not [string]::IsNullOrWhiteSpace($res.evidence) -and $res.evidence -notmatch "(?i)^null|none|unknown|n/a$") {
                $newSignals += $res.evidence.Trim()
            }
        }
    }

    # kid_noise_tolerant
    if ($attributes.kid_noise_tolerant -eq "yes") {
        $res = $aiData.kid_noise_tolerant
        if ($null -ne $res -and $res.result -match "(?i)^yes$") {
            if (-not [string]::IsNullOrWhiteSpace($res.evidence) -and $res.evidence -notmatch "(?i)^null|none|unknown|n/a$") {
                $newSignals += $res.evidence.Trim()
            }
        }
    }

    $addedToThis = $false
    foreach ($s in $newSignals) {
        $alreadyHas = $false
        foreach ($cs in $currentSignals) {
            if ($cs.Contains($s) -or $s.Contains($cs)) { $alreadyHas = $true; break }
        }
        if (-not $alreadyHas) {
            $currentSignals += $s
            $signalAddedCount++
            $addedToThis = $true
        }
    }

    if ($addedToThis) {
        $item.signals = $currentSignals
        $updateCount++
    }
}

$newJsonStr = ConvertTo-Json $data -Depth 100
# Regex unescape to fix ConvertTo-Json unicode escaping \uXXXX -> actual chars
$newJsonStr = [System.Text.RegularExpressions.Regex]::Replace($newJsonStr, "\\u([0-9A-Fa-f]{4})", {
    param($match)
    [char][int]::Parse($match.Groups[1].Value, [System.Globalization.NumberStyles]::HexNumber)
})

[System.IO.File]::WriteAllText($dataJsPath, $prefix + $newJsonStr + $suffix, [System.Text.Encoding]::UTF8)

Write-Output "Updated $updateCount restaurants, added $signalAddedCount new signals."
