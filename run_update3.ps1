$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map"
$responseDir = Join-Path $baseDir "response"
$aiReviewDir = Join-Path $baseDir "ai_review"

$chairPattern = "嬰兒椅|兒童椅|兒童餐椅|幼兒座椅|小孩椅子|寶寶椅|小孩椅|兒童用椅|幼兒椅|小孩餐椅|嬰兒餐椅|high chair|兒童座椅|兒童坐椅|嬰兒座椅|寶寶餐椅|提供餐椅|備有餐椅|有餐椅"
$negativePattern = "沒有|沒提供|無提供|未提供|不提供|沒看到|自備|沒有附|缺|不足"

Write-Output "Starting process..."

$files = Get-ChildItem -Path $responseDir -Filter "*.json"
$countYes = 0; $countNo = 0; $countUnknown = 0; $countUpdated = 0

foreach ($file in $files) {
    $aiPath = Join-Path $aiReviewDir $file.Name
    if (-not (Test-Path $aiPath)) { continue }

    $respJsonRaw = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    try { 
        # ConvertFrom-Json in PS5.1 does not have -Depth
        $respData = ConvertFrom-Json $respJsonRaw 
    } catch { 
        Write-Output "Failed to parse JSON for $($file.Name)"
        continue 
    }

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
        # use char literals to avoid parser issues if encoding somehow fails
        $sentences = $reviewsText -split '[。！，；？\n\r~]'
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
