$aiReviewDir = "ai_review"
$responseDir = "response"
$files = Get-ChildItem -Path $aiReviewDir -Filter "*.json" | Where-Object { $_.Name -ne "index.js" }
foreach ($file in $files) {
    $aiData = Get-Content $file.FullName -Raw | ConvertFrom-Json
    $respPath = Join-Path $responseDir $file.Name
    $reviewsText = ""
    if (Test-Path $respPath) {
        $respData = Get-Content $respPath -Raw | ConvertFrom-Json
        if ($respData.reviews) {
            foreach ($r in $respData.reviews) { $reviewsText += ($r.originalText.text + $r.text.text) }
        }
    }
    $level = $aiData.parent_friendly_level
    $aiSummary = $aiData.generated_summary
    $features = @()
    if ($reviewsText -match "主題") { $features += "主題特色餐廳" }
    if ($reviewsText -match "遊戲區|遊戲室|溜滑梯|球池") { $features += "設有兒童遊戲區" }
    if ($reviewsText -match "聚餐|聚會|家族") { $features += "適合大家庭聚餐" }
    if ($reviewsText -match "慶生|生日") { $features += "適合舉辦慶生活動" }
    if ($reviewsText -match "戶外|庭院|草地|草皮") { $features += "具備戶外活動空間" }
    if ($reviewsText -match "熱鬧|吵雜") { $features += "氣氛熱鬧自在" }
    if ($reviewsText -match "寵物|貓|狗|動物") { $features += "有可愛動物陪伴" }
    if ($reviewsText -match "甜點|下午茶") { $features += "適合帶小孩吃下午茶" }
    if ($reviewsText -match "景觀|風景") { $features += "擁有極佳景觀視野" }
    $cardSummary = ""
    if ($level -match "高|High") {
        if ($features.Count -gt 0) { $cardSummary = "$($features[0])，用餐氛圍輕鬆熱鬧，非常推薦家庭聚餐。" }
        else { $cardSummary = "氣氛輕鬆熱鬧，適合帶小孩一同前來用餐體驗。" }
    }
    elseif ($level -match "中|Medium") {
        if ($features.Count -gt 0) { $cardSummary = "$($features[0])，空間尚算舒適，適合作為親子用餐備選。" }
        else { $cardSummary = "空間舒適，適合家庭用餐，但建議前往前再確認設施。" }
    }
    elseif ($level -match "需留意|Needs Attention") {
        if ($aiSummary -match "空間" -and $aiSummary -match "小") { $cardSummary = "店內空間較小且座位有限，帶小孩前往需多加留意。" }
        elseif ($aiSummary -match "安靜") { $cardSummary = "環境氛圍較為安靜，帶小孩用餐建議先評估情境。" }
        else { $cardSummary = "部分用餐條件較受限，建議查看詳情後再做決定。" }
    }
    else { $cardSummary = "目前親子友善資訊較有限，建議前往前可先向店家確認。" }
    if ($cardSummary.Length -gt 45) { $cardSummary = $cardSummary.Substring(0, 42) + "..." }
    $aiData | Add-Member -MemberType NoteProperty -Name "card_summary" -Value $cardSummary -Force
    $aiData | ConvertTo-Json -Depth 10 | Set-Content -Path $file.FullName -Encoding utf8
}
Write-Host "Done"
