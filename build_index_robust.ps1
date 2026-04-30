$aiReviewDir = "ai_review"
$responseDir = "response"
$outputPath = Join-Path $aiReviewDir "index.js"

function Normalize-String ($s) {
    if ($null -eq $s) { return "" }
    return $s.Replace("区", "區").Replace("台", "臺").Replace("台北市", "臺北市")
}

function Extract-District ($address) {
    $norm = Normalize-String $address
    if ($norm -like "*臺北市*") {
        $parts = $norm -split "臺北市"
        if ($parts.Count -gt 1) {
            $district = $parts[1].Trim().Substring(0, 3)
            return $district
        }
    }
    return ""
}

function Build-GoogleMapsUrl ($name, $placeId) {
    return "https://www.google.com/maps/search/?api=1&query=$([System.Web.HttpUtility]::UrlEncode($name))&query_place_id=$placeId"
}

function Normalize-Result ($val) {
    if ($val -eq "yes") { return "yes" }
    if ($val -eq "no") { return "no" }
    return "Unknown"
}

function Map-Level ($level) {
    switch ($level) {
        "High" { return "高" }
        "Medium" { return "中" }
        "Needs Attention" { return "需留意" }
        "Insufficient Info" { return "資訊不足" }
        default { return "資訊不足" }
    }
}

$files = Get-ChildItem -Path $aiReviewDir -Filter "*.json" | Where-Object { $_.Name -ne "index.js" -and $_.Name -ne "index_new.js" }
$records = @()
$count = 0

foreach ($file in $files) {
    try {
        $aiRaw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $aiData = $aiRaw | ConvertFrom-Json
        
        $respPath = Join-Path $responseDir $file.Name
        if (-not (Test-Path $respPath)) { continue }
        $respRaw = [System.IO.File]::ReadAllText($respPath, [System.Text.Encoding]::UTF8)
        $respData = $respRaw | ConvertFrom-Json
        
        $name = if ($respData.displayName) { $respData.displayName.text } else { "" }
        $rawAddress = if ($respData.formattedAddress) { $respData.formattedAddress } else { "" }
        $address = Normalize-String $rawAddress
        $placeId = $file.BaseName
        
        $record = [ordered]@{
            place_id = $placeId
            name = $name
            address = $address
            formatted_address = $address
            district = Extract-District $address
            rating = if ($respData.rating) { $respData.rating.ToString() } else { "" }
            user_ratings_total = if ($respData.userRatingCount) { [int]$respData.userRatingCount } else { 0 }
            latitude = if ($respData.location) { $respData.location.latitude } else { $null }
            longitude = if ($respData.location) { $respData.location.longitude } else { $null }
            url = Build-GoogleMapsUrl $name $placeId
            google_maps_url = Build-GoogleMapsUrl $name $placeId
            attributes = @{
                high_chair_available = Normalize-Result $aiData." child_seat available".result
                kids_menu = Normalize-Result $aiData."Kids menu available".result
                spacious_seating = Normalize-Result $aiData."Spacious seating".result
                kid_noise_tolerant = Normalize-Result $aiData.kid_noise_tolerant.result
            }
            ai_summary = if ($aiData.generated_summary) { $aiData.generated_summary } else { "" }
            card_summary = if ($aiData.card_summary) { $aiData.card_summary } else { $aiData.generated_summary }
            signals = if ($aiData.generated_signals) { $aiData.generated_signals } else { @() }
            parent_friendly_score = if ($aiData.parent_friendly_score) { [int]$aiData.parent_friendly_score } else { 0 }
            parent_friendly_level = Map-Level $aiData.parent_friendly_level
            reason = if ($aiData.reason) { $aiData.reason } else { "綜合評估" }
            reviews = if ($respData.reviews) { $respData.reviews } else { @() }
        }
        $records += $record
        $count++
    } catch { }
}

$json = $records | ConvertTo-Json -Depth 20
$jsContent = "const restaurantData = $json;"
$utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outputPath, $jsContent, $utf8NoBOM)
Write-Host "Done! Processed $count records."