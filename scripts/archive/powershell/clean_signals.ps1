$aiReviewDir = "ai_review"
$files = Get-ChildItem -Path $aiReviewDir -Filter "*.json" | Where-Object { $_.Name -ne "index.js" -and $_.Name -ne "index_new.js" }

foreach ($file in $files) {
    try {
        $data = Get-Content $file.FullName | ConvertFrom-Json
        
        if ($data.generated_signals) {
            $cleanedSignals = @()
            foreach ($s in $data.generated_signals) {
                if ($s -eq $null) { continue }
                
                # 1. Deduplicate early
                if ($cleanedSignals -contains $s) { continue }
                
                # 2. Cleanup prefix
                $s = $s -replace "^結論：", ""
                
                # 3. Filter segments (if long)
                if ($s.Length -gt 50) {
                    $segments = $s -split "[，。！；]"
                    $relevantSegments = @()
                    foreach ($seg in $segments) {
                        # Keep segments with parenting keywords
                        if ($seg -match "小孩|空間|位子|吵|安靜|氣氛|擁擠|推車|餐椅|餐具|兒童|設施") {
                            $relevantSegments += $seg.Trim()
                        }
                    }
                    if ($relevantSegments.Count -gt 0) {
                        $s = $relevantSegments -join "，"
                    }
                }
                
                # 4. Final deduplicate check after cleaning
                if ($cleanedSignals -contains $s -or $s.Length -lt 2) { continue }
                
                $cleanedSignals += $s
            }
            $data.generated_signals = $cleanedSignals
        }
        
        $data | ConvertTo-Json -Depth 10 | Set-Content $file.FullName -Encoding UTF8
    } catch {
        Write-Host "Error processing $($file.Name): $($_.Exception.Message)"
    }
}