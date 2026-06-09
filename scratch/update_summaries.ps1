$ai_dir = "ai_review"
$files = Get-ChildItem -Path $ai_dir -Filter *.json
$count = 0

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding utf8
        $data = ConvertFrom-Json $content
        
        $summary = $data.generated_summary
        if ($null -eq $summary) { $summary = "" }
        
        # Check if it uses the generic fallback summary
        $is_fallback = $false
        if ($summary -like "*較少提及與親子用餐相關*" -or $summary -like "*較少提及其他與親子用餐相關*" -or $summary -eq "目前評論中較少提及與親子用餐相關的具體資訊，建議前往前可先向店家確認。") {
            $is_fallback = $true
        }
        
        if ($is_fallback) {
            # Collect confirmed facilities
            $parts = @()
            
            if ($data." child_seat available" -and $data." child_seat available".result -eq "Yes") {
                $parts += "兒童座椅"
            }
            if ($data.has_tableware -and $data.has_tableware.result -eq "Yes") {
                $parts += "兒童餐具"
            }
            if ($data."Kids menu available" -and $data."Kids menu available".result -eq "Yes") {
                $parts += "兒童餐點"
            }
            if ($data.has_diaper_table -and $data.has_diaper_table.result -eq "Yes") {
                $ev = $data.has_diaper_table.evidence
                if ($ev -like "*百貨*" -or $ev -like "*商場*") {
                    $parts += "可使用商場附設之尿布台"
                } else {
                    $parts += "尿布台"
                }
            }
            if ($data.has_play_area -and $data.has_play_area.result -eq "Yes") {
                $parts += "遊戲區"
            }
            if ($data.kid_noise_tolerant -and $data.kid_noise_tolerant.result -eq "Yes") {
                $parts += "環境氣氛適合帶小孩"
            }
            
            if ($parts.Count -gt 0) {
                Write-Host "Updating summary for $($file.Name)..."
                
                $facility_str = $parts -join "、"
                $new_summary = "這家餐廳提供$facility_str。目前評論中較少提及其他親子用餐的具體細節，建議前往前可先向店家確認。"
                
                $data.generated_summary = $new_summary
                
                # Write back
                $new_json = $data | ConvertTo-Json -Depth 20
                [System.IO.File]::WriteAllText($file.FullName, $new_json, [System.Text.Encoding]::UTF8)
                
                Write-Host "  - New Summary: $new_summary"
                $count++
            }
        }
    } catch {
        Write-Host "Error processing $($file.Name): $_"
    }
}

Write-Host "Successfully updated summaries for $count files."
