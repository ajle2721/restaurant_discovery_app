$aiReviewDir = "ai_review"
$responseDir = "response"
$outputPath = Join-Path $aiReviewDir "index.js"

function Normalize-Result ($val) {
    if ($null -eq $val) { return "Unknown" }
    if ($val.ToString().ToLower() -eq "yes") { return "yes" }
    if ($val.ToString().ToLower() -eq "no") { return "no" }
    return "Unknown"
}

function Map-Level ($level) {
    if ($null -eq $level) { return "Insufficient Info" }
    return $level
}

$files = Get-ChildItem -Path $aiReviewDir -Filter "*.json" | Where-Object { $_.Name -ne "index.js" }
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
        $address = if ($respData.formattedAddress) { $respData.formattedAddress } else { "" }
        $placeId = $file.BaseName
        
        $record = [ordered]@{
            place_id = $placeId
            name = $name
            address = $address
            formatted_address = $address
            district = ""
            rating = if ($respData.rating) { $respData.rating.ToString() } else { "" }
            user_ratings_total = if ($respData.userRatingCount) { [int]$respData.userRatingCount } else { 0 }
            latitude = if ($respData.location) { $respData.location.latitude } else { $null }
            longitude = if ($respData.location) { $respData.location.longitude } else { $null }
            url = "https://www.google.com/maps/search/?api=1&query=$([System.Web.HttpUtility]::UrlEncode($name))&query_place_id=$placeId"
            google_maps_url = "https://www.google.com/maps/search/?api=1&query=$([System.Web.HttpUtility]::UrlEncode($name))&query_place_id=$placeId"
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
            reason = if ($aiData.reason) { $aiData.reason } else { "" }
            reviews = if ($respData.reviews) { $respData.reviews } else { @() }
        }
        $records += $record
        $count++
    } catch { }
}

$json = $records | ConvertTo-Json -Depth 20
$jsContent = "const restaurantData = $json;"
[System.IO.File]::WriteAllText($outputPath, $jsContent, [System.Text.Encoding]::UTF8)
Write-Output "Done! Processed $count records."
