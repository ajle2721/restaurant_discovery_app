$baseDir = Get-Location
$aiReviewDir = Join-Path $baseDir "ai_review"
$responseDir = Join-Path $baseDir "response"
$outputPath = Join-Path $aiReviewDir "index.js"

# Chinese character definitions to avoid encoding bugs:
$script:c_zhong = [char]0x4e2d
$script:c_zheng = [char]0x6b63
$script:c_qu = [char]0x5340
$script:c_da = [char]0x5927
$script:c_tong = [char]0x540c
$script:c_shan = [char]0x5c71
$script:c_song = [char]0x677e
$script:c_an = [char]0x5b89
$script:c_wan = [char]0x842c
$script:c_hua = [char]0x83ef
$script:c_xin = [char]0x4fe1
$script:c_yi = [char]0x7fa9
$script:c_shi = [char]0x58eb
$script:c_lin = [char]0x6797
$script:c_bei = [char]0x5317
$script:c_tou = [char]0x6295
$script:c_nei = [char]0x5167
$script:c_hu = [char]0x6e56
$script:c_nan = [char]0x5357
$script:c_gang = [char]0x6e2f
$script:c_wen = [char]0x6587

$script:c_tai_old = [char]0x81fa
$script:c_tai_new = [char]0x53f0

$script:c_gao = [char]0x9ad8
$script:c_xu = [char]0x9700
$script:c_liu = [char]0x7559
$script:c_yee = [char]0x610f
$script:c_zi = [char]0x8cc7
$script:c_xun = [char]0x8a0a
$script:c_bu = [char]0x4e0d
$script:c_zu = [char]0x8db3
$script:c_zong = [char]0x7d9c
$script:c_he = [char]0x5408
$script:c_ping = [char]0x8a55
$script:c_gu = [char]0x4f30

$taipeiDistricts = @(
    "$script:c_zhong$script:c_zheng$script:c_qu",
    "$script:c_da$script:c_tong$script:c_qu",
    "$script:c_zhong$script:c_shan$script:c_qu",
    "$script:c_song$script:c_shan$script:c_qu",
    "$script:c_da$script:c_an$script:c_qu",
    "$script:c_wan$script:c_hua$script:c_qu",
    "$script:c_xin$script:c_yi$script:c_qu",
    "$script:c_shi$script:c_lin$script:c_qu",
    "$script:c_bei$script:c_tou$script:c_qu",
    "$script:c_nei$script:c_hu$script:c_qu",
    "$script:c_nan$script:c_gang$script:c_qu",
    "$script:c_wen$script:c_shan$script:c_qu"
)

function Normalize-Result($result) {
    if (-not $result) { return "unknown" }
    $val = $result.ToString().Trim().ToLower()
    if ($val -eq "yes") { return "yes" }
    if ($val -eq "no") { return "no" }
    return "unknown"
}

function Get-ChineseLevel($level) {
    switch ($level) {
        "High" { return "$script:c_gao" }
        "Medium" { return "$script:c_zhong" }
        "Needs Attention" { return "$script:c_xu$script:c_liu$script:c_yee" }
        "Insufficient Info" { return "$script:c_zi$script:c_xun$script:c_bu$script:c_zu" }
        default { return "$script:c_zi$script:c_xun$script:c_bu$script:c_zu" }
    }
}

$aiFiles = Get-ChildItem $aiReviewDir -Filter "*.json" | Where-Object { $_.Name -ne "index.js" } | Sort-Object Name
$records = @()

Write-Host "Packing restaurant data (8 attributes)..."

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
            $address = if ($response.formattedAddress) { $response.formattedAddress.Replace($script:c_tai_old, $script:c_tai_new) } else { "" }
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
                    "has_diaper_table" = Normalize-Result $aiReview.has_diaper_table.result
                }
                "ai_summary" = if ($aiReview.generated_summary) { $aiReview.generated_summary } else { "" }
                "card_summary" = if ($aiReview.card_summary) { $aiReview.card_summary } else { "" }
                "signals" = $signals
                "parent_friendly_score" = if ($null -ne $aiReview.parent_friendly_score) { $aiReview.parent_friendly_score } else { 0 }
                "parent_friendly_level" = Get-ChineseLevel $aiReview.parent_friendly_level
                "reason" = if ($aiReview.reason) { $aiReview.reason } else { "$script:c_zong$script:c_he$script:c_ping$script:c_gu" }
                "reviews" = if ($response.reviews) { $response.reviews } else { @() }
            }
            $records += $record
        } catch {}
    }
}

$jsonData = $records | ConvertTo-Json -Depth 10
$utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
$finalContent = "const restaurantData = $jsonData;"
[System.IO.File]::WriteAllText($outputPath, $finalContent, $utf8NoBOM)
Write-Host "Done! Packed $($records.Count) records."
