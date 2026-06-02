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
function Get-ChineseLevel($level) {
    switch ($level) {
        "High" { return "高" }
        "Medium" { return "中" }
        "Needs Attention" { return "需留意" }
        "Insufficient Info" { return "資訊不足" }
        default { return "資訊不足" }
    }
}
$aiFiles = Get-ChildItem $aiReviewDir -Filter "*.json" | Sort-Object Name
$records = @()
Write-Host "🚀 正在打包餐廳資料..."
foreach ($file in $aiFiles) {
    $placeId = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $responsePath = Join-Path $responseDir "$placeId.json"
    if (Test-Path $responsePath) {
        try {
            $respRaw = [System.IO.File]::ReadAllText($responsePath, [System.Text.Encoding]::UTF8)
            $aiRaw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
            $response = $respRaw | ConvertFrom-Json
            $aiReview = $aiRaw | ConvertFrom-Json
            $name = if ($response.displayName) { $response.displayName.text } else { "" }
            $address = if ($response.formattedAddress) { $response.formattedAddress.Replace("臺", "台") } else { "" }
            $district = ""
            foreach ($d in $taipeiDistricts) { if ($address.Contains($d)) { $district = $d; break } }
            $googleMapsUrl = "https://www.google.com/maps/search/?api=1&query=$([Uri]::EscapeDataString($name))&query_place_id=$placeId"
            $signals = if ($aiReview.generated_signals -is [array]) { $aiReview.generated_signals } else { @($aiReview.generated_signals) }
            $highChair = "unknown"
            if ($aiReview.' child_seat available') { $highChair = Normalize-Result $aiReview.' child_seat available'.result }
            elseif ($aiReview.'child_seat available') { $highChair = Normalize-Result $aiReview.'child_seat available'.result }
            $record = [ordered]@{
                "place_id" = $placeId
                "name" = $name
                "address" = $address
                "formatted_address" = $address
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
                }
                "ai_summary" = if ($aiReview.generated_summary) { $aiReview.generated_summary } else { "" }
                "card_summary" = if ($aiReview.card_summary) { $aiReview.card_summary } else { "" }
                "signals" = $signals
                "parent_friendly_score" = if ($null -ne $aiReview.parent_friendly_score) { $aiReview.parent_friendly_score } else { 0 }
                "parent_friendly_level" = Get-ChineseLevel $aiReview.parent_friendly_level
                "reason" = if ($aiReview.reason) { $aiReview.reason } else { "綜合評估" }
                "reviews" = if ($response.reviews) { $response.reviews } else { @() }
            }
            $records += $record
        } catch {}
    }
}
$jsonData = ConvertTo-Json $records -Depth 10
$finalContent = "const restaurantData = $jsonData;"
[System.IO.File]::WriteAllText($outputPath, $finalContent, [System.Text.Encoding]::UTF8)
Write-Host "✨ 打包成功！已處理 $($records.Count) 間餐廳。"