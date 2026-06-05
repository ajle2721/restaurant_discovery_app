$baseDir = Get-Location
$responseDir = Join-Path $baseDir "response"
$envFile = Join-Path $baseDir ".env"
if (-not (Test-Path $envFile)) {
    $envFile = Join-Path $baseDir ".env.txt"
}

# 1. Load API Key
$apiKey = ""
if (Test-Path $envFile) {
    $lines = Get-Content $envFile
    foreach ($line in $lines) {
        if ($line -match "GOOGLE_MAP_KEY\s*=\s*`"(.*?)`"") {
            $apiKey = $Matches[1]
            break
        }
        elseif ($line -match "GOOGLE_MAP_KEY\s*=\s*(.*)") {
            $apiKey = $line.Split("=")[1].Trim().Trim('"').Trim("'")
            break
        }
    }
}

if (-not $apiKey) {
    Write-Error "Error: GOOGLE_MAP_KEY not found in .env.txt"
    exit 1
}

if (-not (Test-Path $responseDir)) {
    Write-Error "Error: response directory does not exist."
    exit 1
}

Write-Host "Step 1: Scanning response JSON files for missing priceLevel..."
$files = Get-ChildItem -Path $responseDir -Filter "*.json"
$missing = @()

foreach ($f in $files) {
    try {
        $content = Get-Content $f.FullName -Raw -Encoding utf8 | ConvertFrom-Json
        if (-not $content.priceLevel) {
            $missing += [PSCustomObject]@{
                PlaceId = $f.BaseName
                Name = if ($content.displayName) { $content.displayName.text } else { "Unknown" }
            }
        }
    } catch {
        # Ignore invalid/empty files
    }
}

$totalMissing = $missing.Count
Write-Host "Found $totalMissing restaurants lacking priceLevel info."

if ($totalMissing -eq 0) {
    Write-Host "All restaurants already have priceLevel info. No action needed."
    exit 0
}

# 2. Start batch fetch
$twoYearsAgo = (Get-Date).AddDays(-730)
$successCount = 0

Write-Host "`nStep 2: Starting batch fetch from Google Places API..."
for ($i = 0; $i -lt $totalMissing; $i++) {
    $place = $missing[$i]
    Write-Host "[$($i + 1)/$totalMissing] Fetching: $($place.Name) ($($place.PlaceId))"
    
    $url = "https://places.googleapis.com/v1/places/$($place.PlaceId)"
    
    try {
        # Place Details (New) requires field mask in header
        $headers = @{
            "X-Goog-Api-Key" = $apiKey
            "X-Goog-FieldMask" = "id,displayName,formattedAddress,rating,userRatingCount,reviews,types,location,websiteUri,internationalPhoneNumber,priceLevel"
        }
        
        $details = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
        
        # Filter reviews within last 2 years
        $filteredReviews = @()
        if ($details.reviews) {
            foreach ($r in $details.reviews) {
                if ($r.publishTime) {
                    try {
                        # PublishTime is in ISO-8601 UTC format, e.g. "2025-11-01T13:16:01.870715812Z"
                        $dt = [DateTime]::Parse($r.publishTime).ToUniversalTime()
                        if ($dt -ge $twoYearsAgo.ToUniversalTime()) {
                            $filteredReviews += $r
                        }
                    } catch {}
                }
            }
        }
        $details.reviews = $filteredReviews
        
        # Save back to file
        $jsonOut = ConvertTo-Json $details -Depth 10
        $outPath = Join-Path $responseDir "$($place.PlaceId).json"
        [System.IO.File]::WriteAllText($outPath, $jsonOut, [System.Text.Encoding]::UTF8)
        
        $priceVal = if ($details.priceLevel) { $details.priceLevel } else { "NONE" }
        Write-Host "  - Updated. Price: $priceVal"
        $successCount++
    } catch {
        Write-Host "  - Failed to fetch details for $($place.Name): $_"
    }
    
    # Throttle to avoid rate limiting (0.5s per request)
    Start-Sleep -Milliseconds 500
}

Write-Host "`nCompleted! Successfully updated $successCount/$totalMissing restaurants."
