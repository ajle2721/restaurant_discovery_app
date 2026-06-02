
$baseDir = Get-Location
$aiReviewDir = Join-Path $baseDir "ai_review"
$responseDir = Join-Path $baseDir "response"
$outputPath = Join-Path $aiReviewDir "index.js"

$taipeiDistricts = @("中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區")

function Normalize-Result($result) {
    if (-not $result) { return "unknown" }
    $val = $result.ToString().Trim().ToLower()
    if ($val -eq "yes") { return "yes" }
    if ($val -eq "no") { return "no" }
    return "unknown"
}

# 標籤翻譯對照表 (確保前端 app.js 能正確讀取)
function Get-ChineseLevel($level) {
    switch ($level) {
        "High" { return "高" }
        "Medium" { return "中" }
        "Needs Attention" { return "需留意" }
        "Insufficient Info" { return "資訊不足" }
        default { return "資訊不足" }
    }
}

function Read-Utf8File($path) {
    return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

function Build-Record($placeId) {
    $responsePath = Join-Path $responseDir "$placeId.json"
    $aiReviewPath = Join-Path $aiReviewDir "$placeId.json"
    
    $response = Read-Utf8File $responsePath | ConvertFrom-Json
    $aiReview = Read-Utf8File $aiReviewPath | ConvertFrom-Json
    
    $name = if ($response.displayName) { $response.displayName.text } else { "" }
    $formattedAddress = if ($response.formattedAddress) { $response.formattedAddress } else { "" }
    
    $district = ""
    foreach ($d in $taipeiDistricts) {
        if ($formattedAddress.Contains($d)) { $district = $d; break }
    }
    
    $googleMapsUrl = "https://www.google.com/maps/search/?api=1&query=$([Uri]::EscapeDataString($name))&query_place_id=$placeId"
    
    $signals = @()
    if ($aiReview.generated_signals) {
        if ($aiReview.generated_signals -is [array]) { $signals = $aiReview.generated_signals } else { $signals = @($aiReview.generated_signals) }
    }
    
    $highChair = "unknown"
    if ($aiReview.' child_seat available') { $highChair = Normalize-Result $aiReview.' child_seat available'.result }
    elseif ($aiReview.'child_seat available') { $highChair = Normalize-Result $aiReview.'child_seat available'.result }

    # 翻譯等級標籤
    $level = Get-ChineseLevel $aiReview.parent_friendly_level
    
    $record = [ordered]@{
        "place_id" = $placeId
        "name" = $name
        "address" = $formattedAddress
        "formatted_address" = $formattedAddress
        "district" = $district
        "rating" = if ($response.rating) { $response.rating.ToString() } else { "" }
        "user_ratings_total" = if ($response.userRatingCount) { $response.userRatingCount } else { 0 }
        "latitude" = if ($response.location) { $response.location.latitude } else { $null }
        "longitude" = if ($response.location) { $response.location.longitude } else { $null }
        "url" = $googleMapsUrl
        "google_maps_url" = $googleMapsUrl
        "attributes" = @{
            "high_chair_available" = $highChair
            "kids_menu" = Normalize-Result $aiReview.'Kids menu available'.result
            "spacious_seating" = Normalize-Result $aiReview.'Spacious seating'.result
            "kid_noise_tolerant" = Normalize-Result $aiReview.kid_noise_tolerant.result
            "has_play_area" = Normalize-Result $aiReview.has_play_area.result
            "has_private_room" = Normalize-Result $aiReview.has_private_room.result
            "has_tableware" = Normalize-Result $aiReview.has_tableware.result
            "has_diaper_table" = Normalize-Result $aiReview.has_diaper_table.result
        }
        "ai_summary" = if ($aiReview.generated_summary) { $aiReview.generated_summary } else { "" }
        "card_summary" = if ($aiReview.card_summary) { $aiReview.card_summary } else { "" }
        "signals" = $signals
        "parent_friendly_score" = if ($null -ne $aiReview.parent_friendly_score) { $aiReview.parent_friendly_score } else { 0 }
        "parent_friendly_level" = $level
        "reason" = if ($aiReview.reason) { $aiReview.reason } else { "綜合評估" }
        "reviews" = if ($response.reviews) { $response.reviews } else { @() }
    }
    return $record
}

$aiFiles = Get-ChildItem $aiReviewDir -Filter "*.json" | Sort-Object Name
$records = @()
Write-Host "🚀 正在打包並同步標籤格式..." -ForegroundColor Cyan
foreach ($file in $aiFiles) {
    $placeId = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    if (Test-Path (Join-Path $responseDir "$placeId.json")) {
        try { $records += Build-Record $placeId } catch { }
    }
}
$jsonData = ConvertTo-Json $records -Depth 10
$finalContent = "const restaurantData = $jsonData;"
$utf8withBOM = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText($outputPath, $finalContent, $utf8withBOM)
Write-Host "✅ 完成！請重新整理網頁檢查。" -ForegroundColor Green