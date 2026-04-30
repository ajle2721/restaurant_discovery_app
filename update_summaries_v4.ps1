$aiReviewDir = "ai_review"
$files = Get-ChildItem -Path $aiReviewDir -Filter "*.json" | Where-Object { $_.Name -ne "index.js" -and $_.Name -ne "index_new.js" }

foreach ($file in $files) {
    try {
        $raw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $data = $raw | ConvertFrom-Json
        $summary = $data.generated_summary
        
        if (-not $summary) { continue }
        
        # 1. Take the positive part before any "but" or "limited info" phrases
        $clean = $summary
        $breakers = @("，但", "。但", "，不過", "。不過", "，目前評論中", "。目前評論中", "，建議前往前", "。建議前往前", "，但目前", "。但目前")
        foreach ($breaker in $breakers) {
            if ($clean.Contains($breaker)) {
                $clean = $clean.Split($breaker, [System.StringSplitOptions]::RemoveEmptyEntries)[0]
            }
        }
        
        # 2. Basic cleanup
        $clean = $clean.Replace("該餐廳", "").Replace("這間餐廳", "").Replace("餐廳環境", "環境").Replace("這家餐廳", "").Replace("...", "").Replace("…", "").Trim()
        
        # 3. Fallback if the clean summary is too short or empty
        if ($clean.Length -lt 10 -or $clean -like "*親子資訊較少*") {
            $level = $data.parent_friendly_level
            if ($level -eq "High" -or $level -eq "高") { $clean = "環境友善且適合帶小孩，是熱門的親子用餐選擇。" }
            elseif ($level -eq "Medium" -or $level -eq "中") { $clean = "環境舒適，是可以考慮的親子聚餐地點。" }
            else { $clean = "目前親子相關資訊較有限，建議前往前可先確認。" }
        } else {
            # 4. Handle long sentences by splitting on punctuation and re-joining
            if ($clean.Length -gt 45) {
                # Split by commas or periods
                $subParts = $clean.Split(@("，", "。"), [System.StringSplitOptions]::RemoveEmptyEntries)
                $combined = ""
                foreach ($part in $subParts) {
                    if (($combined + $part).Length -lt 43) {
                        if ($combined -eq "") { $combined = $part }
                        else { $combined += "，" + $part }
                    } else {
                        break
                    }
                }
                if ($combined -ne "") { $clean = $combined + "。" }
                else { $clean = $subParts[0].Substring(0, [Math]::Min($subParts[0].Length, 43)) + "。" }
            }
        }
        
        # Ensure it ends with a period
        if ($clean -notlike "*。") { $clean += "。" }
        
        $data.card_summary = $clean
        $newJson = $data | ConvertTo-Json -Depth 20
        [System.IO.File]::WriteAllText($file.FullName, $newJson, [System.Text.Encoding]::UTF8)
    } catch { }
}
Write-Host "Summaries updated (v4 - smart join)."