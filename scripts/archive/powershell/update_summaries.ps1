$aiReviewDir = "ai_review"
$files = Get-ChildItem -Path $aiReviewDir -Filter "*.json" | Where-Object { $_.Name -ne "index.js" -and $_.Name -ne "index_new.js" }

foreach ($file in $files) {
    try {
        $raw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $data = $raw | ConvertFrom-Json
        $summary = $data.generated_summary
        
        if (-not $summary) { continue }
        
        $features = @()
        if ($summary -like "*遊戲區*") { $features += "遊戲區" }
        if ($summary -like "*兒童餐*") { $features += "兒童餐點" }
        if ($summary -like "*兒童椅*" -or $summary -like "*小椅子*") { $features += "兒童座椅" }
        if ($summary -like "*空間寬敞*" -or $summary -like "*位置很大*") { $features += "寬敞空間" }
        if ($summary -like "*不怕小孩吵*" -or $summary -like "*氣氛熱鬧*") { $features += "熱鬧環境" }
        if ($summary -like "*育嬰室*" -or $summary -like "*尿布台*") { $features += "育嬰設施" }
        if ($summary -like "*餐具*" -or $summary -like "*兒童碗*") { $features += "兒童餐具" }
        if ($summary -like "*草地*" -or $summary -like "*戶外*") { $features += "戶外空間" }
        if ($summary -like "*適合聚會*") { $features += "適合聚會" }
        if ($summary -like "*安靜*" -or $summary -like "*擁擠*") { 
             # Negative features handled differently or skipped for summary
        }

        $newSummary = ""
        if ($features.Count -gt 0) {
            $newSummary = "具有" + ($features -join "、")
            if ($summary -like "*適合帶小孩*") { $newSummary += "，非常適合帶孩子前往。" }
            elseif ($summary -like "*可以考慮*") { $newSummary += "，是可以考慮的親子選擇。" }
            else { $newSummary += "。" }
        } else {
            # Fallback: Just take a portion of the original and cleanup
            $newSummary = $summary.Replace("該餐廳", "").Replace("目前評論中較少提及與親子用餐相關的具體資訊", "親子資訊較少").Trim()
            if ($newSummary.Length -gt 35) { $newSummary = $newSummary.Substring(0, 32) + "..." }
        }
        
        $data.card_summary = $newSummary
        $newJson = $data | ConvertTo-Json -Depth 20
        [System.IO.File]::WriteAllText($file.FullName, $newJson, [System.Text.Encoding]::UTF8)
    } catch {
        Write-Host "Error processing $($file.Name): $_"
    }
}
Write-Host "Summaries updated."