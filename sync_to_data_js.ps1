$dataJsPath = "data.js"
$aiReviewDir = "ai_review"

$dataContent = [System.IO.File]::ReadAllText($dataJsPath, [System.Text.Encoding]::UTF8)

# The data is like: const restaurantData = [ ... ];
# We will parse the JSON part, update it, and write it back.
$jsonPart = $dataContent -replace "^const restaurantData = ", ""
$jsonPart = $jsonPart -replace ";$", ""

$data = $jsonPart | ConvertFrom-Json

$countUpdated = 0

foreach ($restaurant in $data) {
    $placeId = $restaurant.place_id
    if ($placeId) {
        $aiFilePath = Join-Path $aiReviewDir "$placeId.json"
        if (Test-Path $aiFilePath) {
            $aiData = [System.IO.File]::ReadAllText($aiFilePath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
            
            $restaurant.attributes.high_chair_available = $aiData." child_seat available".result.ToLower()
            $restaurant.attributes.spacious_seating = $aiData."Spacious seating".result.ToLower()
            $restaurant.attributes.kids_menu = $aiData."Kids menu available".result.ToLower()
            $restaurant.attributes.kid_noise_tolerant = $aiData."kid_noise_tolerant".result.ToLower()
            
            $restaurant.parent_friendly_score = $aiData.parent_friendly_score
            $restaurant.parent_friendly_level = $aiData.parent_friendly_level
            
            if ($null -ne $aiData.generated_signals) {
                $restaurant.signals = $aiData.generated_signals
            } else {
                $restaurant.signals = @()
            }
            
            $restaurant.ai_summary = $aiData.generated_summary
            
            $countUpdated++
        }
    }
}

$newJsonPart = $data | ConvertTo-Json -Depth 10 -Compress
$finalContent = "const restaurantData = " + $newJsonPart + ";"

Set-Content -Path $dataJsPath -Value $finalContent -Encoding UTF8 -Force
Write-Host "Successfully synced $countUpdated restaurants to data.js."
