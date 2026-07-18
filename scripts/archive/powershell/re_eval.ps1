$responseDir = "response"
$outputDir = "ai_review"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$patterns = @{
    "high_chair_available" = @{
        "Yes" = @("??*(?咱璊戭啣?璊擗?|撠?摮擃璊?", "??.*(?咱璊戭啣?璊擗?|撠?摮?", "??.*(?咱璊戭啣?璊擗?)")
        "No"  = @("瘝?.*(?咱璊戭啣?璊擗?)", "瘝?*(?咱璊戭啣?璊擗?)", "??*(?咱璊戭啣?璊擗?)", "銝?靘?*(?咱璊戭啣?璊擗?)")
    }
    "spacious_seating" = @{
        "Yes" = @("蝛粹?(敺??(憭坑撖祆?)", "撖祆?", "?刻?(敺???嫣噶", "憟賣頠?, "?臭誑?刻?", "?拙??刻?", "?曉?銝頠?, "蝛粹?敺?")
        "No"  = @("蝛粹?(???撠?, "撠?(???摨?, "摨找?(???(敺憭泜頛??(?餈撠?", "雿蔭(敺憭泜頛??(?餈撠?", "雿?(敺憭泜頛??(?餈撠?", "銝?頠?, "?刻??脖???, "瘝?寞?刻?", "????, "頛???, "?寧?")
    }
    "kids_menu" = @{
        "Yes" = @("?咱擗?, "撖嗅窄蝎?, "撠???", "撖嗅窄擗?)
        "No"  = @("瘝??咱擗?, "瘝?蝡仿?", "?∪?蝡仿?", "瘝?撖嗅窄蝎?, "銝?靘?蝡仿?")
    }
    "kid_noise_tolerant" = @{
        "Yes" = @("?拙?撣嗅?摮?, "閬芸???", "?咱??", "甇∟?撠酋", "?拙?閬芸?", "撠?摮拙???, "撠酋摮???, "撠?????, "?虜?拙?(撣??撠???)
        "No"  = @("敺???, "瘞??摨?, "雓?撠酋", "銝敺?撠酋|撠???", "銝??撣??(撠酋|戭啣?|撠???", "??撠酋", "?", "皛踹???)
    }
}

function Split-IntoSentences($text) {
    if (-not $text) { return @() }
    $parts = $text -split '[??\!\嚗?嚗?嚗?\n]'
    $results = @()
    foreach ($p in $parts) {
        $trimmed = $p.Trim()
        if ($trimmed) { $results += $trimmed }
    }
    return $results
}

$files = Get-ChildItem -Path $responseDir -Filter "*.json"
Write-Host "Re-evaluating $($files.Count) response files with strict logic..."

$count = 0

foreach ($file in $files) {
    try {
        $jsonContent = Get-Content $file.FullName -Raw -Encoding UTF8
        $data = $jsonContent | ConvertFrom-Json
        
        $reviews = $data.reviews
        $allSentences = @()
        
        if ($reviews) {
            foreach ($r in $reviews) {
                $text = ""
                if ($null -ne $r.originalText -and $null -ne $r.originalText.text) {
                    $text = $r.originalText.text
                } elseif ($null -ne $r.text -and $null -ne $r.text.text) {
                    $text = $r.text.text
                }
                
                if ($text) {
                    $allSentences += Split-IntoSentences $text
                }
            }
        }
        
        $analysis = @{}
        $allSignals = @()
        
        foreach ($tag in $patterns.Keys) {
            $yesSentences = @()
            $noSentences = @()
            
            foreach ($s in $allSentences) {
                foreach ($pat in $patterns[$tag]["Yes"]) {
                    if ($s -match $pat) {
                        $yesSentences += $s
                        break
                    }
                }
                foreach ($pat in $patterns[$tag]["No"]) {
                    if ($s -match $pat) {
                        $noSentences += $s
                        break
                    }
                }
            }
            
            $result = "Unknown"
            if ($yesSentences.Count -gt 0 -and $noSentences.Count -eq 0) {
                $result = "Yes"
            } elseif ($noSentences.Count -gt 0 -and $yesSentences.Count -eq 0) {
                $result = "No"
            } elseif ($yesSentences.Count -gt 0 -and $noSentences.Count -gt 0) {
                $result = "No"
            }
            
            $evidence = @()
            if ($yesSentences.Count -gt 0) { $evidence += $yesSentences }
            if ($noSentences.Count -gt 0) { $evidence += $noSentences }
            
            $evidence = $evidence | Select-Object -Unique
            if ($evidence) { $allSignals += $evidence }
            
            $conf = 0.4
            if ($result -ne "Unknown") { $conf = 0.9 }
            
            $analysis[$tag] = @{
                "result" = $result
                "evidence" = if ($evidence.Count -gt 0) { $evidence[0] } else { $null }
                "confidence" = $conf
            }
        }
        
        $allSignals = $allSignals | Select-Object -Unique
        
        $positives = @()
        $negatives = @()
        
        if ($analysis["high_chair_available"]["result"] -eq "Yes") { $positives += "???咱璊? }
        elseif ($analysis["high_chair_available"]["result"] -eq "No") { $negatives += "?芣?靘?蝡交?" }
        
        if ($analysis["spacious_seating"]["result"] -eq "Yes") { $positives += "蝛粹?撖祆?" }
        elseif ($analysis["spacious_seating"]["result"] -eq "No") { $negatives += "摨找?頛???蝛粹???" }
        
        if ($analysis["kids_menu"]["result"] -eq "Yes") { $positives += "??蝡仿?暺? }
        
        if ($analysis["kid_noise_tolerant"]["result"] -eq "Yes") { $positives += "撠扛摮振摨剖??? }
        elseif ($analysis["kid_noise_tolerant"]["result"] -eq "No") { $negatives += "瘞??摰?/銝?葆撠酋" }
        
        $summary = ""
        if ($positives.Count -eq 0 -and $negatives.Count -eq 0) {
            $summary = "?桀?閰?銝剛?撠???閬芸??券??賊??擃?閮?撱箄降?????摨振蝣箄???
        } else {
            $parts = @()
            if ($positives.Count -gt 0) { $parts += "閰???振擗輒" + ($positives -join "??) }
            if ($negatives.Count -gt 0) { $parts += "雿???" + ($negatives -join "??) }
            $summary = ($parts -join "嚗?) + "??
        }
        
        $score = 0
        if ($analysis["high_chair_available"]["result"] -eq "Yes") { $score += 2 }
        if ($analysis["spacious_seating"]["result"] -eq "Yes") { $score += 1 }
        if ($analysis["kids_menu"]["result"] -eq "Yes") { $score += 1 }
        if ($analysis["kid_noise_tolerant"]["result"] -eq "Yes") { $score += 1 }
        
        if ($analysis["high_chair_available"]["result"] -eq "No" -or $analysis["spacious_seating"]["result"] -eq "No" -or $analysis["kid_noise_tolerant"]["result"] -eq "No") {
            $score -= 2
        }
        
        $level = "鞈?銝雲"
        if ($score -ge 3) { $level = "擃? }
        elseif ($score -gt 0) { $level = "銝? }
        
        $finalOutput = [ordered]@{
            " child_seat available" = $analysis["high_chair_available"]
            "Spacious seating" = $analysis["spacious_seating"]
            "Kids menu available" = $analysis["kids_menu"]
            "kid_noise_tolerant" = $analysis["kid_noise_tolerant"]
            "parent_friendly_score" = $score
            "parent_friendly_level" = $level
            "reason" = "蝬?閰摯"
            "generated_signals" = $allSignals
            "generated_summary" = $summary
        }
        
        $outPath = Join-Path $outputDir $file.Name
        $finalOutput | ConvertTo-Json -Depth 10 | Set-Content -Path $outPath -Encoding UTF8
        $count++
        
    } catch {
        Write-Host "Error processing $($file.Name): $_"
    }
}

Write-Host "Successfully re-evaluated $count AI analysis files."
