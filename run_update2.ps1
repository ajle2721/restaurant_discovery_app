$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map"
$py = Get-Content (Join-Path $baseDir "update_child_seats.py") -Raw -Encoding UTF8
$chairMatch = [regex]::Match($py, 'CHAIR_KEYWORDS = \[\s*(.*?)\s*\]', [System.Text.RegularExpressions.RegexOptions]::Singleline)
$negMatch = [regex]::Match($py, 'NEGATIVE_WORDS = \[\s*(.*?)\s*\]', [System.Text.RegularExpressions.RegexOptions]::Singleline)

$chairStr = $chairMatch.Groups[1].Value -replace '[\s"n]', ''
$chairKeywords = $chairStr -split ',' | Where-Object { $_ }

$negStr = $negMatch.Groups[1].Value -replace '[\s"n]', ''
$negativeKeywords = $negStr -split ',' | Where-Object { $_ }

$chairPattern = ($chairKeywords -join '|')
$negativePattern = ($negativeKeywords -join '|')

Write-Output "Parsed chair keywords: $($chairKeywords.Count)"
Write-Output "Parsed negative keywords: $($negativeKeywords.Count)"

$responseDir = Join-Path $baseDir "response"
$aiReviewDir = Join-Path $baseDir "ai_review"
$files = Get-ChildItem -Path $responseDir -Filter "*.json"
$countYes = 0; $countNo = 0; $countUnknown = 0; $countUpdated = 0

Write-Output "Found $($files.Count) response files."

foreach ($file in $files) {
    $aiPath = Join-Path $aiReviewDir $file.Name
    if (-not (Test-Path $aiPath)) { continue }

    $respJsonRaw = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    try { $respData = ConvertFrom-Json $respJsonRaw -Depth 100 } catch { continue }

    $reviewsText = ""
    if ($null -ne $respData.reviews) {
        foreach ($r in $respData.reviews) {
            if ($null -ne $r.text -and $null -ne $r.text.text) { $reviewsText += $r.text.text + " " }
            elseif ($null -ne $r.originalText -and $null -ne $r.originalText.text) { $reviewsText += $r.originalText.text + " " }
        }
    }

    $result = "UNKNOWN"; $evidence = "null"; $confidence = 0.4
    $foundYes = $false; $foundNo = $false; $evidenceYes = $null; $evidenceNo = $null

    if (-not [string]::IsNullOrWhiteSpace($reviewsText)) {
        $sentences = $reviewsText -split '[。\uff01\uff0c\uff1b\uff1f\n\r~]'
        foreach ($s in $sentences) {
            $s = $s.Trim()
            if ([string]::IsNullOrWhiteSpace($s)) { continue }
            $sLower = $s.ToLower()
            if ($sLower -match $chairPattern) {
                if ($sLower -match $negativePattern) {
                    $foundNo = $true; if ($null -eq $evidenceNo) { $evidenceNo = $s }
                } else {
                    $foundYes = $true; if ($null -eq $evidenceYes) { $evidenceYes = $s }
                }
            }
        }
        
        if ($foundNo) {
            $result = "NO"; $evidence = "`"$($evidenceNo -replace '"','\"' -replace '\\','\\')`""; $confidence = 0.9
        } elseif ($foundYes) {
            $result = "YES"; $evidence = "`"$($evidenceYes -replace '"','\"' -replace '\\','\\')`""; $confidence = 0.9
        }
    }

    if ($result -eq "YES") { $countYes++ } elseif ($result -eq "NO") { $countNo++ } else { $countUnknown++ }

    $aiJsonRaw = Get-Content -Path $aiPath -Raw -Encoding UTF8
    $pattern = '(?i)"high[_ ]?chair[_ ]?available"\s*:\s*\{[^{}]*\}'
    $replacement = "`" child_seat available`": {`n        `"result`": `"$result`",`n        `"evidence`": $evidence,`n        `"confidence`": $confidence`n    }"
    
    if ($aiJsonRaw -match $pattern) {
        $newJson = $aiJsonRaw -replace $pattern, $replacement
        Set-Content -Path $aiPath -Value $newJson -Encoding UTF8
        $countUpdated++
    }
}

Write-Output "Updated $countUpdated files."
Write-Output "YES: $countYes, NO: $countNo, UNKNOWN: $countUnknown"
