$content = [System.IO.File]::ReadAllText('ai_review/index.js', [System.Text.Encoding]::UTF8)
$json = $content.Trim().Substring(23)
if ($json.EndsWith(";")) { $json = $json.Substring(0, $json.Length - 1) }
$data = $json | ConvertFrom-Json

$updates = @(
    @{ name = "樂雅樂餐廳 敦化店"; tags = @("child_seat", "kids_menu") },
    @{ name = "Creative Pasta 創義麵 士林店"; tags = @("child_seat") },
    @{ name = "Second Floor 貳樓南港車站店"; tags = @("child_seat", "spacious_seating", "kids_menu", "kid_noise_tolerant") },
    @{ name = "Second Floor 貳樓西湖店"; tags = @("child_seat", "spacious_seating", "kids_menu", "kid_noise_tolerant") },
    @{ name = "陶板屋 台北重慶南店"; tags = @("child_seat") },
    @{ name = "陶板屋 新北投光明店"; tags = @("child_seat", "kids_menu") },
    @{ name = "欣葉小聚 南港店"; tags = @("child_seat") },
    @{ name = "欣葉台菜 信義新天地A9店"; tags = @("child_seat") },
    @{ name = "樂子the Diner 南港店"; tags = @("child_seat", "kids_menu", "kid_noise_tolerant") },
    @{ name = "樂子the Diner 瑞安店"; tags = @("child_seat", "kids_menu", "kid_noise_tolerant") }
)

foreach ($u in $updates) {
    $target = $u.name
    $item = $data | Where-Object { $_.name -like "*$target*" } | Select-Object -First 1
    if (-not $item) { Write-Host "Warning: Could not find $target"; continue }
    
    $pid = $item.place_id
    $filePath = "ai_review/$pid.json"
    if (-not (Test-Path $filePath)) { Write-Host "Warning: File not found $filePath"; continue }
    
    $review = Get-Content $filePath -Raw | ConvertFrom-Json
    
    foreach ($tag in $u.tags) {
        if ($tag -eq "child_seat") {
            $key = if ($review.' child_seat available') { ' child_seat available' } else { 'child_seat available' }
            $review.$key = @{ result = "Yes"; evidence = "Manual update"; confidence = 1.0 }
        }
        if ($tag -eq "spacious_seating") {
            $review.'Spacious seating' = @{ result = "Yes"; evidence = "Manual update"; confidence = 1.0 }
        }
        if ($tag -eq "kids_menu") {
            $review.'Kids menu available' = @{ result = "Yes"; evidence = "Manual update"; confidence = 1.0 }
        }
        if ($tag -eq "kid_noise_tolerant") {
            $review.kid_noise_tolerant = @{ result = "Yes"; evidence = "Manual update"; confidence = 1.0 }
        }
    }
    
    # Recalculate score
    $pos = 0
    if ($review.' child_seat available'.result -eq "Yes" -or $review.'child_seat available'.result -eq "Yes") { $pos++ }
    if ($review.'Spacious seating'.result -eq "Yes") { $pos++ }
    if ($review.'Kids menu available'.result -eq "Yes") { $pos++ }
    if ($review.kid_noise_tolerant.result -eq "Yes") { $pos++ }
    
    $review.parent_friendly_score = $pos
    if ($pos -ge 3) { $review.parent_friendly_level = "高" }
    elseif ($pos -ge 1) { $review.parent_friendly_level = "中" }
    else { $review.parent_friendly_level = "資訊不足" }
    
    $review.reason = "手動更新資料"
    
    $review | ConvertTo-Json -Depth 10 | Set-Content $filePath -Encoding UTF8
    Write-Host "Updated $target ($pid) - Score: $pos"
}
