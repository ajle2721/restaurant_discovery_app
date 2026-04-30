$aiReviewDir = "ai_review"
$files = Get-ChildItem -Path $aiReviewDir -Filter "*.json" | Where-Object { $_.Name -ne "index.js" -and $_.Name -ne "index_new.js" }

foreach ($file in $files) {
    try {
        $data = Get-Content $file.FullName | ConvertFrom-Json
        
        if ($data.parent_friendly_level -eq "Needs Attention") {
            $positives = @()
            $negatives = @()
            
            # Identify Positive Traits
            if ($data.' child_seat available'.result -eq "Yes") { $positives += "設有兒童椅" }
            if ($data.'Spacious seating'.result -eq "Yes") { $positives += "空間較寬敞" }
            if ($data.'Kids menu available'.result -eq "Yes") { $positives += "提供兒童餐" }
            if ($data.'kid_noise_tolerant'.result -eq "Yes") { $positives += "對小孩聲音較為包容" }
            
            # Identify Negative Traits
            if ($data.' child_seat available'.result -eq "No") { $negatives += "未提供兒童椅" }
            if ($data.'Spacious seating'.result -eq "No") { $negatives += "空間較擁擠" }
            if ($data.'Kids menu available'.result -eq "No") { $negatives += "無兒童餐點" }
            if ($data.'kid_noise_tolerant'.result -eq "No") { $negatives += "環境較安靜" }
            
            if ($negatives.Count -gt 0) {
                $negativeStr = $negatives -join "且"
                if ($positives.Count -gt 0) {
                    $positiveStr = $positives[0] # Just take one main positive trait to keep it concise
                    $data.card_summary = "$positiveStr，但$negativeStr，前往時需多加留意。"
                } else {
                    $data.card_summary = "該餐廳$negativeStr，帶小孩前往需多加留意。"
                }
            } else {
                # If no specific negatives but labeled Needs Attention (usually lack of info)
                $data.card_summary = "目前親子友善資訊較有限，建議前往前可先向店家確認。"
            }
            
            # Final check: Ensure it's a complete sentence and ends with period.
            if ($data.card_summary -notmatch "。$") { $data.card_summary += "。" }
            
            $data | ConvertTo-Json -Depth 10 | Set-Content $file.FullName -Encoding UTF8
        }
    } catch {
        Write-Host "Error processing $($file.Name): $($_.Exception.Message)"
    }
}