$responseDir = "response"
$outputDir = "ai_review"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$envPath = ".env"
$apiKey = $null
if (Test-Path $envPath) {
    $envLines = Get-Content $envPath
    foreach ($line in $envLines) {
        if ($line -match "^GEMINI_API_KEY=(.*)") {
            $apiKey = $matches[1].Trim()
        }
    }
}

if (-not $apiKey) {
    Write-Host "❌ 錯誤：找不到 GEMINI_API_KEY。請確認您的 .env 檔案中有設定 GEMINI_API_KEY=您的金鑰" -ForegroundColor Red
    exit
}

# 使用免費額度最穩定的 gemini-flash-lite-latest
$model = "gemini-flash-lite-latest"
$url = "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=$apiKey"

$systemPrompt = @"
You are an expert at analyzing restaurant reviews for kid-friendliness.
Evaluate the restaurant based on its reviews. 
Return ONLY a valid JSON object. Do not wrap it in markdown.

Labels to evaluate:
1. `" child_seat available`"
Strict: Only 'Yes' if explicitly mentions 兒童椅, 嬰兒椅, 餐椅, 兒童座椅, 嬰兒座椅, high chair, baby chair, booster seat, etc. `"椅子`" or `"座位`" alone do not count. 
If not explicitly mentioned, return 'Unknown'.
2. `"Spacious seating`"
Semantic: Describe the dining space/environment size or crowdedness. 
Yes: 空間大, 寬敞, 店內環境很舒服, 適合推車, 放得下推車. 
No: 空間不大, 很小, 擁擠, 狹小, 位子擠, 不適合推車. 
Do not count: 魚很大, 份量很大, 項目很多.
If unclear or not mentioned, return 'Unknown'.
3. `"Kids menu available`"
Strict: Only 'Yes' if explicitly mentions 兒童餐, 寶寶餐, kids menu, 寶寶粥. 
'No' if explicitly says no kids menu. 'Unknown' if not mentioned.
4. `"kid_noise_tolerant`"
Loose: Is the environment suitable for bringing kids/not afraid of noise?
Yes: 有家庭客, 親子友善, 小孩很多, 氣氛熱鬧, 適合帶小孩.
No: 很安靜, 適合約會, 氣氛安靜, 明確不適合小孩, 怕吵.
Note: `"適合悠閒吃飯`", `"放鬆`", `"舒適`" do NOT mean it's quiet or bad for kids. Do not mark as 'No' based on these. 
Understand the whole sentence context.

Key requirements:
1. `evidence` must be a complete sentence from the review. Do not just capture a fragment. If no evidence, set to null.
2. `generated_signals` must be an array of strings containing sentences related to the 4 labels. Deduplicate sentences with similar meanings, and keep a MAXIMUM of 5 sentences. If all 4 are Unknown, return [].
3. Do not guess. If no info, mark 'Unknown'.
4. `confidence`: If result is 'Unknown', confidence is 0.4. Otherwise 0.9.
5. `generated_summary`: Make it natural and extremely concise (maximum 1-2 sentences). Focus ONLY on the kid-friendly aspects found. If all are Unknown, write `"目前評論中較少提及與親子用餐相關的具體資訊，建議前往前可先向店家確認。`"

Output JSON Format:
{
  " child_seat available": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "Spacious seating": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "Kids menu available": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "kid_noise_tolerant": {"result": "Yes|No|Unknown", "evidence": "sentence or null", "confidence": 0.9},
  "generated_signals": ["sentence 1", "sentence 2"],
  "generated_summary": "fluent summary"
}
"@

function Get-AiAnalysis($restaurantName, $reviewsText) {
    $prompt = "$systemPrompt`n`nRestaurant Name: $restaurantName`nReviews:`n$reviewsText`n`nProvide the JSON:"
    
    $body = @{
        contents = @(
            @{
                parts = @(
                    @{ text = $prompt }
                )
            }
        )
        generationConfig = @{
            responseMimeType = "application/json"
            temperature = 0.2
        }
    }
    
    $jsonBody = $body | ConvertTo-Json -Depth 10 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
    
    $maxRetries = 5
    for ($retry = 0; $retry -lt $maxRetries; $retry++) {
        try {
            $response = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json; charset=utf-8" -Body $bytes
            $resultText = $response.candidates[0].content.parts[0].text
            return $resultText | ConvertFrom-Json
        } catch {
            $errMsg = "$_"
            if ($errMsg -match "429") {
                Write-Host "⏳ 遇到免費 API 頻率限制 (429)，等待 60 秒後大重試... ($($retry+1)/$maxRetries)" -ForegroundColor Yellow
                Start-Sleep -Seconds 60
            } else {
                Write-Host "API 呼叫失敗: $_" -ForegroundColor Red
                if ($_.ErrorDetails) {
                    Write-Host $_.ErrorDetails.Message -ForegroundColor Red
                }
                return $null
            }
        }
    }
    return $null
}

function Calculate-Score($analysis) {
    $score = 0
    $yesCount = 0
    $noCount = 0
    $unknownCount = 0
    
    $childSeat = if ($analysis." child_seat available") { $analysis." child_seat available".result } else { "Unknown" }
    $space = if ($analysis."Spacious seating") { $analysis."Spacious seating".result } else { "Unknown" }
    $kidsMenu = if ($analysis."Kids menu available") { $analysis."Kids menu available".result } else { "Unknown" }
    $noise = if ($analysis."kid_noise_tolerant") { $analysis."kid_noise_tolerant".result } else { "Unknown" }
    
    $tags = @($childSeat, $space, $kidsMenu, $noise)
    
    foreach ($tag in $tags) {
        if ($tag -eq "Yes") { $yesCount++ }
        elseif ($tag -eq "No") { $noCount++ }
        elseif ($tag -eq "Unknown") { $unknownCount++ }
    }
    
    if ($childSeat -eq "Yes") { $score += 1 }
    if ($space -eq "Yes") { $score += 1 }
    if ($kidsMenu -eq "Yes") { $score += 1 }
    if ($noise -eq "Yes") { $score += 1 }
    
    if ($childSeat -eq "No") { $score -= 1 }
    if ($space -eq "No") { $score -= 1 }
    if ($noise -eq "No") { $score -= 1 }
    
    $level = "Insufficient Info"
    if ($unknownCount -eq 4) {
        $level = "Insufficient Info"
    }
    elseif ($score -lt 1 -and $noCount -ge 1) {
        $level = "Needs Attention"
    }
    elseif (($score -ge 3) -or (($childSeat -eq "Yes" -or $kidsMenu -eq "Yes") -and ($noCount -eq 0) -and ($yesCount -ge 2))) {
        if ($childSeat -eq "No") { $level = "Medium" } else { $level = "High" }
    }
    elseif ($score -eq 1 -or $score -eq 2 -or $childSeat -eq "No") {
        $level = "Medium"
    }
    
    return @{ Score = $score; Level = $level }
}

$isTest = $false
if ($args -contains "--test") {
    $isTest = $true
}

$files = @(Get-ChildItem -Path $responseDir -Filter "*.json")
if ($isTest) {
    $files = $files | Select-Object -First 2
    Write-Host "🧪 測試模式：只處理 $($files.Count) 筆資料..." -ForegroundColor Cyan
} else {
    Write-Host "🚀 開始處理 $($files.Count) 筆資料..." -ForegroundColor Cyan
}

$count = 0
foreach ($file in $files) {
    $outPath = Join-Path $outputDir $file.Name
    if (-not $isTest -and (Test-Path $outPath)) {
        # 使用 Select-String 自動處理編碼問題，只要檔案內含關鍵字就跳過
        if (Select-String -Path $outPath -Pattern "AI語意綜合評估" -Quiet) {
            Write-Host "⏩ 已用新 AI 分析過，跳過: $($file.Name)" -ForegroundColor DarkGray
            continue
        }
    }
    
    try {
        $jsonContent = Get-Content $file.FullName -Raw -Encoding UTF8
        $data = $jsonContent | ConvertFrom-Json
        
        $name = "Unknown"
        if ($data.displayName -and $data.displayName.text) { $name = $data.displayName.text }
        
        $reviewsText = ""
        if ($data.reviews) {
            $i = 1
            foreach ($r in $data.reviews) {
                $text = ""
                if ($r.originalText -and $r.originalText.text) { $text = $r.originalText.text }
                elseif ($r.text -and $r.text.text) { $text = $r.text.text }
                if ($text) {
                    $reviewsText += "Review ${i}:`n${text}`n`n"
                    $i++
                }
            }
        }
        
        if (-not $reviewsText.Trim()) {
            Write-Host "⚠️ $($file.Name) ($name) 沒有評論資料，跳過。" -ForegroundColor Yellow
            continue
        }
        
        Write-Host "🔄 正在分析: $name ($($file.Name))..."
        $analysis = Get-AiAnalysis $name $reviewsText
        if (-not $analysis) { 
            Write-Host "❌ 失敗次數過多，跳過此筆並建立暫時存檔..." -ForegroundColor Red
            # 建立一個標註為「分析失敗」的暫存檔，避免下次又卡在同一家
            $failOutput = [ordered]@{
                "reason" = "分析失敗"
                "generated_summary" = "由於 API 限制，此餐廳暫時無法完成 AI 分析，請稍後再試。"
                "parent_friendly_level" = "Insufficient Info"
                "parent_friendly_score" = 0
            }
            $jsonFail = ConvertTo-Json $failOutput -Depth 10
            Set-Content -Path $outPath -Value $jsonFail -Encoding UTF8
            continue 
        }
        
        $scoreResult = Calculate-Score $analysis
        
        $finalOutput = [ordered]@{
            " child_seat available" = if ($analysis." child_seat available") { $analysis." child_seat available" } else { @{ result="Unknown"; evidence=$null; confidence=0.4 } }
            "Spacious seating" = if ($analysis."Spacious seating") { $analysis."Spacious seating" } else { @{ result="Unknown"; evidence=$null; confidence=0.4 } }
            "Kids menu available" = if ($analysis."Kids menu available") { $analysis."Kids menu available" } else { @{ result="Unknown"; evidence=$null; confidence=0.4 } }
            "kid_noise_tolerant" = if ($analysis."kid_noise_tolerant") { $analysis."kid_noise_tolerant" } else { @{ result="Unknown"; evidence=$null; confidence=0.4 } }
            "parent_friendly_score" = $scoreResult.Score
            "parent_friendly_level" = $scoreResult.Level
            "reason" = "AI語意綜合評估"
            "generated_signals" = if ($analysis.generated_signals -and ($analysis.generated_signals -is [array])) { $analysis.generated_signals } else { @() }
            "generated_summary" = if ($analysis.generated_summary) { $analysis.generated_summary } else { "目前評論中較少提及與親子用餐相關的具體資訊，建議前往前可先向店家確認。" }
        }
        
        $jsonOutput = ConvertTo-Json $finalOutput -Depth 10
        $jsonOutput = [System.Text.RegularExpressions.Regex]::Unescape($jsonOutput)
        Set-Content -Path $outPath -Value $jsonOutput -Encoding UTF8
        Write-Host "✅ 分析完成並已儲存！" -ForegroundColor Gray
        $count++
        
        if (-not $isTest) {
            Start-Sleep -Seconds 10
        }
    } catch {
        Write-Host "❌ 處理 $($file.Name) 時發生錯誤: $_" -ForegroundColor Red
    }
}

Write-Host "✅ 成功完成 $count 筆餐廳的 AI 分析！" -ForegroundColor Green
