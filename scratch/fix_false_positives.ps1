$ai_dir = "ai_review"
$files = Get-ChildItem -Path $ai_dir -Filter *.json
$count = 0

$char_gao = [char]0x9ad8
$char_zhong = [char]0x4e2d
$str_insufficient = "$([char]0x8cc7)$([char]0x8a0a)$([char]0x4e0d)$([char]0x8db3)"

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding utf8
        $data = ConvertFrom-Json $content
        
        $cs = $data." child_seat available"
        if ($cs -and $cs.result -eq "Yes" -and ($cs.evidence -like "*Google*" -or $cs.evidence -like "*官方*")) {
            Write-Host "Fixing $($file.Name)..."
            
            # Reset child_seat to Unknown
            $data." child_seat available".result = "Unknown"
            $data." child_seat available".evidence = $null
            $data." child_seat available".confidence = 0.4
            
            # Recalculate score
            $score = 0
            $has_no = $false
            
            # child_seat
            $cs_res = $data." child_seat available".result
            if ($cs_res -eq "Yes") { $score += 2 }
            if ($cs_res -eq "No") { $has_no = $true }
            
            # Spacious seating
            $ss_res = $data."Spacious seating".result
            if ($ss_res -eq "Yes") { $score += 1 }
            if ($ss_res -eq "No") { $has_no = $true }
            
            # Kids menu
            $km_res = $data."Kids menu available".result
            if ($km_res -eq "Yes") { $score += 1 }
            
            # noise tolerant
            $kn_res = $data.kid_noise_tolerant.result
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
            
            $old_score = $data.parent_friendly_score
            $old_level = $data.parent_friendly_level
            
            $data.parent_friendly_score = $score
            $data.parent_friendly_level = $level
            
            # Remove the Google Maps Attributes evidence from generated_signals if it was there for child_seat
            $new_signals = @()
            if ($data.generated_signals) {
                foreach ($s in $data.generated_signals) {
                    if ($s -ne "Google Maps Attributes" -and $s -ne "Google Maps Attributes: Good for children" -and $s -ne "Google Maps Attributes: Good for children (官方標記：適合兒童)") {
                        $new_signals += $s
                    }
                }
            }
            # Keep noise tolerant evidence if kid_noise_tolerant is Yes
            if ($data.kid_noise_tolerant.result -eq "Yes" -and $data.kid_noise_tolerant.evidence) {
                if ($new_signals -notcontains $data.kid_noise_tolerant.evidence) {
                    $new_signals += $data.kid_noise_tolerant.evidence
                }
            }
            $data.generated_signals = $new_signals
            
            # Write back
            $new_json = $data | ConvertTo-Json -Depth 20
            [System.IO.File]::WriteAllText($file.FullName, $new_json, [System.Text.Encoding]::UTF8)
            
            Write-Host "  - Score: $old_score ($old_level) -> $score ($level)"
            $count++
        }
    } catch {
        Write-Host "Error fixing $($file.Name): $_"
    }
}

Write-Host "Successfully fixed $count files."
