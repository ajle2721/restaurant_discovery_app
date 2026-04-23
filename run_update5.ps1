$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map"
$responseDir = Join-Path $baseDir "response"
$aiReviewDir = Join-Path $baseDir "ai_review"

$chairPattern = "嬰兒椅|兒童椅|兒童餐椅|幼兒座椅|小孩椅子|寶寶椅|小孩椅|兒童用椅|幼兒椅|小孩餐椅|嬰兒餐椅|high chair|兒童座椅|兒童坐椅|嬰兒座椅|寶寶餐椅|提供餐椅|備有餐椅|有餐椅"
$negativePattern = "沒有|沒提供|無提供|未提供|不提供|沒看到|自備|沒有附|缺|不足"

$inferredYesPattern = "親子友善|很多家庭|帶小孩|適合小孩|適合帶小孩|家庭客|帶嬰兒|很多小朋友|溜小孩|親子餐廳|帶小朋友|兒童友善|對小孩友善"
$inferredNoPattern = "不適合小孩|不適合帶小孩|不適合兒童|拒接小孩|拒絕小孩|不接待兒童|不接待小孩|不能帶小孩"

Write-Output "Starting process v5 (Relaxed Criteria)..."

$files = Get-ChildItem -Path $responseDir -Filter "*.json"
$countExplicitYes = 0; $countInferredYes = 0; $countNo = 0; $countUnknown = 0; $countUpdated = 0

foreach ($file in $files) {
    $aiPath = Join-Path $aiReviewDir $file.Name
    if (-not (Test-Path $aiPath)) { continue }

    try {
        $respJsonRaw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $respData = ConvertFrom-Json $respJsonRaw 
    } catch { 
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
    
    $foundExplicitYes = $false; $foundExplicitNo = $false
    $foundInferredYes = $false; $foundInferredNo = $false
    
    $evidenceExplicitYes = $null; $evidenceExplicitNo = $null
    $evidenceInferredYes = $null; $evidenceInferredNo = $null

    if (-not [string]::IsNullOrWhiteSpace($reviewsText)) {
        $sentences = $reviewsText -split '[。\uff01\uff0c\uff1b\uff1f\n\r~]'
        foreach ($s in $sentences) {
            $s = $s.Trim()
            if ([string]::IsNullOrWhiteSpace($s)) { continue }
            $sLower = $s.ToLower()
            
            # Explicit checks
            if ($sLower -match $chairPattern) {
                if ($sLower -match $negativePattern) {
                    $foundExplicitNo = $true; if ($null -eq $evidenceExplicitNo) { $evidenceExplicitNo = $s }
                } else {
                    $foundExplicitYes = $true; if ($null -eq $evidenceExplicitYes) { $evidenceExplicitYes = $s }
                }
            }
            
            # Inferred checks
            if ($sLower -match $inferredYesPattern) {
                if ($sLower -match $negativePattern) {
                    # Usually people say "不適合帶小孩", handled by inferredNoPattern
                } else {
                    $foundInferredYes = $true; if ($null -eq $evidenceInferredYes) { $evidenceInferredYes = $s }
                }
            }
            if ($sLower -match $inferredNoPattern) {
                $foundInferredNo = $true; if ($null -eq $evidenceInferredNo) { $evidenceInferredNo = $s }
            }
        }
        
        # Priority logic
        if ($foundExplicitNo) {
            $result = "NO"; $evidence = "`"$($evidenceExplicitNo -replace '"','\"' -replace '\\','\\')`""; $confidence = 0.9
        } elseif ($foundExplicitYes) {
            $result = "YES"; $evidence = "`"$($evidenceExplicitYes -replace '"','\"' -replace '\\','\\')`""; $confidence = 0.9
        } elseif ($foundInferredNo) {
            $result = "NO"; $evidence = "`"$($evidenceInferredNo -replace '"','\"' -replace '\\','\\')`""; $confidence = 0.6
        } elseif ($foundInferredYes) {
            $result = "YES"; $evidence = "`"$($evidenceInferredYes -replace '"','\"' -replace '\\','\\')`""; $confidence = 0.6
        }
    }

    if ($result -eq "YES" -and $confidence -eq 0.9) { $countExplicitYes++ } 
    elseif ($result -eq "YES" -and $confidence -eq 0.6) { $countInferredYes++ } 
    elseif ($result -eq "NO") { $countNo++ } 
    else { $countUnknown++ }

    try {
        $aiJsonRaw = [System.IO.File]::ReadAllText($aiPath, [System.Text.Encoding]::UTF8)
        $pattern = '(?i)" child_seat available"\s*:\s*\{[^{}]*\}'
        
        if ($aiJsonRaw -match $pattern) {
            $replacement = "`" child_seat available`": {`n        `"result`": `"$result`",`n        `"evidence`": $evidence,`n        `"confidence`": $confidence`n    }"
            $newJson = [regex]::Replace($aiJsonRaw, $pattern, $replacement)
            [System.IO.File]::WriteAllText($aiPath, $newJson, [System.Text.Encoding]::UTF8)
            $countUpdated++
        } else {
            $pattern2 = '(?i)"high[_ ]?chair[_ ]?available"\s*:\s*\{[^{}]*\}'
            if ($aiJsonRaw -match $pattern2) {
                $replacement = "`" child_seat available`": {`n        `"result`": `"$result`",`n        `"evidence`": $evidence,`n        `"confidence`": $confidence`n    }"
                $newJson = [regex]::Replace($aiJsonRaw, $pattern2, $replacement)
                [System.IO.File]::WriteAllText($aiPath, $newJson, [System.Text.Encoding]::UTF8)
                $countUpdated++
            }
        }
    } catch {
        Write-Output "Warning: Could not process $($file.Name) : $_"
    }
}

Write-Output "Updated $countUpdated files."
Write-Output "YES (Explicit): $countExplicitYes, YES (Inferred): $countInferredYes, NO: $countNo, UNKNOWN: $countUnknown"
