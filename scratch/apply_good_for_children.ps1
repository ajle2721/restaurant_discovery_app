$ai_dir = "ai_review"
$resp_dir = "response"
$files = Get-ChildItem -Path $ai_dir -Filter *.json
$count = 0

$char_gao = [char]0x9ad8
$char_zhong = [char]0x4e2d
$str_insufficient = "$([char]0x8cc7)$([char]0x8a0a)$([char]0x4e0d)$([char]0x8db3)"

foreach ($file in $files) {
    try {
        $placeId = $file.BaseName
        $respPath = Join-Path $resp_dir "$placeId.json"
        if (-not (Test-Path $respPath)) { continue }
        
        $respRaw = Get-Content $respPath -Raw -Encoding utf8
        $respData = ConvertFrom-Json $respRaw
        
        if ($respData.goodForChildren -eq $true) {
            $aiRaw = Get-Content $file.FullName -Raw -Encoding utf8
            $aiData = ConvertFrom-Json $aiRaw
            
            $modified = $false
            
            # 1. child_seat available
            if ($null -eq $aiData." child_seat available" -or $aiData." child_seat available".result -ne "Yes") {
                # Only set if not already set to Yes by manual correction
                $aiData." child_seat available" = @{
                    result = "Yes"
                    evidence = "Google 官方登記適合兒童用餐"
                    confidence = 1.0
                }
                $modified = $true
            }
            
            # 2. has_tableware
            if ($null -eq $aiData.has_tableware -or $aiData.has_tableware.result -ne "Yes") {
                $aiData.has_tableware = @{
                    result = "Yes"
                    evidence = "Google 官方登記適合兒童用餐"
                    confidence = 1.0
                }
                $modified = $true
            }
            
            # 3. kid_noise_tolerant
            if ($null -eq $aiData.kid_noise_tolerant -or $aiData.kid_noise_tolerant.result -ne "Yes") {
                $aiData.kid_noise_tolerant = @{
                    result = "Yes"
                    evidence = "Google 官方登記適合兒童用餐"
                    confidence = 1.0
                }
                $modified = $true
            }
            
            if ($modified) {
                Write-Host "Updating $($file.Name) (Good for children: true)..."
                
                # Recalculate score
                $score = 0
                $has_no = $false
                
                # child_seat
                $cs_res = $aiData." child_seat available".result
                if ($cs_res -eq "Yes") { $score += 2 }
                if ($cs_res -eq "No") { $has_no = $true }
                
                # Spacious seating
                $ss_res = $aiData."Spacious seating".result
                if ($ss_res -eq "Yes") { $score += 1 }
                if ($ss_res -eq "No") { $has_no = $true }
                
                # Kids menu
                $km_res = $aiData."Kids menu available".result
                if ($km_res -eq "Yes") { $score += 1 }
                
                # noise tolerant
                $kn_res = $aiData.kid_noise_tolerant.result
                if ($kn_res -eq "Yes") { $score += 1 }
                if ($kn_res -eq "No") { $has_no = $true }
                
                if ($has_no) { $score -= 2 }
                
                # Map level
                $level = $str_insufficient
                if ($score -ge 3) {
                    $level = $char_gao
                } elseif ($score -gt 0) {
                    $level = $char_zhong
                }
                
                $old_score = $aiData.parent_friendly_score
                $old_level = $aiData.parent_friendly_level
                
                $aiData.parent_friendly_score = $score
                $aiData.parent_friendly_level = $level
                
                # Ensure signals contains the evidence
                $signals = @()
                if ($aiData.generated_signals) {
                    foreach ($s in $aiData.generated_signals) {
                        $signals += $s
                    }
                }
                if ($signals -notcontains "Google 官方登記適合兒童用餐") {
                    $signals += "Google 官方登記適合兒童用餐"
                }
                $aiData.generated_signals = $signals
                
                # Write back
                $new_json = $aiData | ConvertTo-Json -Depth 20
                [System.IO.File]::WriteAllText($file.FullName, $new_json, [System.Text.Encoding]::UTF8)
                
                Write-Host "  - Score: $old_score ($old_level) -> $score ($level)"
                $count++
            }
        }
    } catch {
        Write-Host "Error processing $($file.Name): $_"
    }
}

Write-Host "Successfully updated $count files based on Good for children tag."
