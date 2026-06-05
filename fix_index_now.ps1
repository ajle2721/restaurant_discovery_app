$baseDir = Get-Location
$aiReviewDir = Join-Path $baseDir "ai_review"
$responseDir = Join-Path $baseDir "response"
$outputPath = Join-Path $aiReviewDir "index.js"

$taipeiDistricts = @(
    "$([char]0x4e2d)$([char]0x6b63)$([char]0x5340)",
    "$([char]0x5927)$([char]0x540c)$([char]0x5340)",
    "$([char]0x4e2d)$([char]0x5c71)$([char]0x5340)",
    "$([char]0x677e)$([char]0x5c71)$([char]0x5340)",
    "$([char]0x5927)$([char]0x5b89)$([char]0x5340)",
    "$([char]0x842c)$([char]0x83ef)$([char]0x5340)",
    "$([char]0x4fe1)$([char]0x7fa9)$([char]0x5340)",
    "$([char]0x58eb)$([char]0x6797)$([char]0x5340)",
    "$([char]0x5317)$([char]0x6295)$([char]0x5340)",
    "$([char]0x5167)$([char]0x6e56)$([char]0x5340)",
    "$([char]0x5357)$([char]0x6e2f)$([char]0x5340)",
    "$([char]0x6587)$([char]0x5c71)$([char]0x5340)"
)

function Normalize-Result($result) {
    if (-not $result) { return "unknown" }
    $val = $result.ToString().Trim().ToLower()
    if ($val -eq "yes") { return "yes" }
    if ($val -eq "no") { return "no" }
    return "unknown"
}

function Get-ChineseLevel($level) {
    $insufficient = "$([char]0x8cc7)$([char]0x8a0a)$([char]0x4e0d)$([char]0x8db3)"
    if ($null -eq $level) { return $insufficient }
    $val = $level.ToString().Trim()
    if ($val -match "[^\x00-\x7F]") { return $val }
    switch ($val) {
        "High" { return [char]0x9ad8 }
        "Medium" { return [char]0x4e2d }
        "Needs Attention" { return "$([char]0x9700)$([char]0x7559)$([char]0x610f)" }
        "Insufficient Info" { return $insufficient }
        default { return $insufficient }
    }
}

$aiFiles = Get-ChildItem $aiReviewDir -Filter "*.json" | Sort-Object Name
$records = @()

foreach ($file in $aiFiles) {
    $placeId = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $responsePath = Join-Path $responseDir "$placeId.json"
    if (Test-Path $responsePath) {
        try {
            $respRaw = [System.IO.File]::ReadAllText($responsePath, [System.Text.Encoding]::GetEncoding("utf-8"))
            $aiRaw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::GetEncoding("utf-8"))
            $response = $respRaw | ConvertFrom-Json
            $aiReview = $aiRaw | ConvertFrom-Json
            $name = if ($response.displayName) { $response.displayName.text } else { "" }
            
            $address = if ($response.formattedAddress) { $response.formattedAddress.Replace([char]0x81fa, [char]0x53f0).Replace([char]0x533a, [char]0x5340) } else { "" }
            $district = ""
            foreach ($d in $taipeiDistricts) { if ($address.Contains($d)) { $district = $d; break } }
            if ($address.Contains("$([char]0x4e2d)$([char]0x6b63)")) { $district = "$([char]0x4e2d)$([char]0x6b63)$([char]0x5340)" }
            
            $priceLevel = if ($response.priceLevel) { $response.priceLevel } else { $null }
            $cuisineMap = @{
                'italian_restaurant' = "$([char]0x7fa9)$([char]0x5927)$([char]0x5229)$([char]0x6599)$([char]0x7406)"
                'japanese_restaurant' = "$([char]0x65e5)$([char]0x5f0f)$([char]0x6599)$([char]0x7406)"
                'korean_restaurant' = "$([char]0x97d3)$([char]0x5f0f)$([char]0x6599)$([char]0x7406)"
                'chinese_restaurant' = "$([char]0x4e2d)$([char]0x5f0f)$([char]0x6599)$([char]0x7406)"
                'thai_restaurant' = "$([char]0x6cf0)$([char]0x5f0f)$([char]0x6599)$([char]0x7406)"
                'french_restaurant' = "$([char]0x6cd5)$([char]0x5f0f)$([char]0x6599)$([char]0x7406)"
                'american_restaurant' = "$([char]0x7f8e)$([char]0x5f0f)$([char]0x6599)$([char]0x7406)"
                'mexican_restaurant' = "$([char]0x58a8)$([char]0x897f)$([char]0x54e5)$([char]0x6599)$([char]0x7406)"
                'vietnamese_restaurant' = "$([char]0x8d8a)$([char]0x5357)$([char]0x6599)$([char]0x7406)"
                'vegetarian_restaurant' = "$([char]0x852c)$([char]0x98df)$([char]0x6599)$([char]0x7406)"
                'steak_house' = "$([char]0x725b)$([char]0x6392)$([char]0x9928)"
                'sushi_restaurant' = "$([char]0x583d)$([char]0x53f8)"
                'pizza_restaurant' = "$([char]0x62ab)$([char]0x85a9)"
                'ramen_restaurant' = "$([char]0x62c9)$([char]0x9eb5)"
                'cafe' = "$([char]0x5496)$([char]0x5561)$([char]0x5ef3)"
                'bakery' = "$([char]0x70d8)$([char]0x57f9)/$([char]0x751c)$([char]0x9ede)"
                'bar' = "$([char]0x9152)$([char]0x5427)/$([char]0x9910)$([char]0x9152)$([char]0x9928)"
                'bistro' = "$([char]0x5c0f)$([char]0x9152)$([char]0x9928)/$([char]0x9910)$([char]0x9152)$([char]0x9928)"
                'brunch_restaurant' = "$([char]0x65e9)$([char]0x5348)$([char]0x9910)"
            }
            $cuisine = $null
            if ($response.types -is [array]) {
                foreach ($t in $response.types) {
                    if ($cuisineMap.ContainsKey($t)) {
                        $cuisineLabel = $cuisineMap[$t]
                        if (-not $name.Contains($cuisineLabel)) {
                            $cuisine = $cuisineLabel
                            break
                        }
                    }
                }
            }

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
                "price_level" = $priceLevel
                "cuisine" = $cuisine
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
                "reason" = if ($aiReview.reason) { $aiReview.reason } else { "AI Review" }
                "reviews" = if ($response.reviews) { $response.reviews } else { @() }
            }
            $records += $record
        } catch {}
    }
}

$jsonData = ConvertTo-Json $records -Depth 10
$finalContent = "const restaurantData = $jsonData;"
[System.IO.File]::WriteAllText($outputPath, $finalContent, [System.Text.Encoding]::UTF8)
Write-Host "Build Complete: $($records.Count) restaurants processed."