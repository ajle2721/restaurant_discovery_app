$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map"
$dataJsPath = Join-Path $baseDir "data.js"
$aiReviewDir = Join-Path $baseDir "ai_review"

$dataJsRaw = [System.IO.File]::ReadAllText($dataJsPath, [System.Text.Encoding]::UTF8)
$startIndex = $dataJsRaw.IndexOf('[')
$endIndex = $dataJsRaw.LastIndexOf(']')
$jsonStr = $dataJsRaw.Substring($startIndex, $endIndex - $startIndex + 1)
$data = ConvertFrom-Json $jsonStr

$reportPath = Join-Path $baseDir "updated_restaurants_report.md"
$reportContent = "# Updated Restaurants Report`n`n"

$count = 0

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

    $matchedEvidences = @()

    # high_chair_available
    if ($attributes.high_chair_available -eq "yes") {
        $res = $null
        if ($null -ne $aiData." child_seat available") { $res = $aiData." child_seat available" }
        elseif ($null -ne $aiData."child_seat available") { $res = $aiData."child_seat available" }
        if ($null -ne $res -and $res.result -match "(?i)^yes$") {
            if (-not [string]::IsNullOrWhiteSpace($res.evidence) -and $res.evidence -notmatch "(?i)^null|none|unknown|n/a$") {
                $matchedEvidences += $res.evidence.Trim()
            }
        }
    }

    if ($attributes.spacious_seating -eq "yes") {
        $res = $aiData."Spacious seating"
        if ($null -ne $res -and $res.result -match "(?i)^yes$") {
            if (-not [string]::IsNullOrWhiteSpace($res.evidence) -and $res.evidence -notmatch "(?i)^null|none|unknown|n/a$") {
                $matchedEvidences += $res.evidence.Trim()
            }
        }
    }

    if ($attributes.kids_menu -eq "yes") {
        $res = $aiData."Kids menu available"
        if ($null -ne $res -and $res.result -match "(?i)^yes$") {
            if (-not [string]::IsNullOrWhiteSpace($res.evidence) -and $res.evidence -notmatch "(?i)^null|none|unknown|n/a$") {
                $matchedEvidences += $res.evidence.Trim()
            }
        }
    }

    if ($attributes.kid_noise_tolerant -eq "yes") {
        $res = $aiData.kid_noise_tolerant
        if ($null -ne $res -and $res.result -match "(?i)^yes$") {
            if (-not [string]::IsNullOrWhiteSpace($res.evidence) -and $res.evidence -notmatch "(?i)^null|none|unknown|n/a$") {
                $matchedEvidences += $res.evidence.Trim()
            }
        }
    }

    $foundInSignals = @()
    foreach ($me in $matchedEvidences) {
        foreach ($cs in $currentSignals) {
            if ($cs.Contains($me) -or $me.Contains($cs)) {
                if ($foundInSignals -notcontains $me) {
                    $foundInSignals += $me
                }
            }
        }
    }

    if ($foundInSignals.Count -gt 0) {
        $count++
        $reportContent += "- **$($item.name)** ($($item.district)):`n"
        foreach ($ev in $foundInSignals) {
            $reportContent += "  - $ev`n"
        }
    }
}

$reportContent += "`n**Total $count restaurants** have AI review signals."
[System.IO.File]::WriteAllText($reportPath, $reportContent, [System.Text.Encoding]::UTF8)
Write-Output 'Report generated'
