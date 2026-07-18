$aiReviewDir = "ai_review"
$files = Get-ChildItem -Path $aiReviewDir -Filter "*.json" | Where-Object { $_.Name -ne "index.js" -and $_.Name -ne "index_new.js" }

foreach ($file in $files) {
    try {
        $raw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $data = $raw | ConvertFrom-Json
        
        $hasUpdate = $false
        $negatives = @()
        
        # Check negative attributes
        if ($data."Spacious seating".result -eq "No") { $negatives += "空間較擁擠" }
        if ($data.kid_noise_tolerant.result -eq "No") { $negatives += "環境較安靜" }
        if ($data." child_seat available".result -eq "No") { $negatives += "未提供兒童椅" }
        if ($data."Kids menu available".result -eq "No") { $negatives += "未提供兒童餐" }

        # If summary is generic but we have negatives, update it
        if ($data.generated_summary -like "*目前評論中較少提及*" -and $negatives.Count -gt 0) {
            $data.generated_summary = "根據評論顯示，該餐廳" + ($negatives -join "、") + "，帶小孩前往需多加留意。"
            $hasUpdate = $true
        }
        
        # Update card_summary as well if it's generic
        if ($data.card_summary -like "*親子相關資訊較有限*" -and $negatives.Count -gt 0) {
            $data.card_summary = "餐廳" + ($negatives -join "且") + "，帶小孩前往需多加留意。"
            $hasUpdate = $true
        }

        # Fix generated_signals if it's empty but we have evidence
        if ($data.generated_signals.GetType().Name -ne "Object[]" -or $data.generated_signals.Count -eq 0) {
            $newSignals = @()
            if ($data."Spacious seating".evidence) { $newSignals += $data."Spacious seating".evidence }
            if ($data.kid_noise_tolerant.evidence) { $newSignals += $data.kid_noise_tolerant.evidence }
            if ($data." child_seat available".evidence) { $newSignals += $data." child_seat available".evidence }
            if ($data."Kids menu available".evidence) { $newSignals += $data."Kids menu available".evidence }
            
            if ($newSignals.Count -gt 0) {
                $data.generated_signals = $newSignals
                $hasUpdate = $true
            }
        }

        if ($hasUpdate) {
            $newJson = $data | ConvertTo-Json -Depth 20
            [System.IO.File]::WriteAllText($file.FullName, $newJson, [System.Text.Encoding]::UTF8)
        }
    } catch { }
}
Write-Host "Inconsistencies fixed."