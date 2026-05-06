$updates = @(
    @{ id = "ChIJ8d31sryuQjQRYRWoyUaa2YM"; tags = @("child_seat") },
    @{ id = "ChIJb3wiSkWuQjQRYj2ArhtpNoU"; tags = @("child_seat", "kids_menu") },
    @{ id = "ChIJd2lnDKCpQjQReTq7BQlF8Kc"; tags = @("child_seat") },
    @{ id = "ChIJqX7CxKesQjQRWduxZ7juYTM"; tags = @("child_seat") }
)

$high = [char]0x9ad8
$mid = [char]0x4e2d
$info = "$([char]0x8cc7)$([char]0x8a0a)$([char]0x4e0d)$([char]0x8db3)"

foreach ($u in $updates) {
    $placeId = $u.id
    $filePath = "ai_review/$placeId.json"
    if (-not (Test-Path $filePath)) { Write-Host "Warning: File not found $filePath"; continue }
    
    $raw = [System.IO.File]::ReadAllText((Resolve-Path $filePath).Path, [System.Text.Encoding]::UTF8)
    $review = $raw | ConvertFrom-Json
    
    foreach ($tag in $u.tags) {
        if ($tag -eq "child_seat") {
            $key = if ($review.' child_seat available') { ' child_seat available' } else { 'child_seat available' }
            $review | Add-Member -MemberType NoteProperty -Name $key -Value @{ result = "Yes"; evidence = "Manual update"; confidence = 1.0 } -Force
        }
        if ($tag -eq "spacious_seating") {
            $review | Add-Member -MemberType NoteProperty -Name 'Spacious seating' -Value @{ result = "Yes"; evidence = "Manual update"; confidence = 1.0 } -Force
        }
        if ($tag -eq "kids_menu") {
            $review | Add-Member -MemberType NoteProperty -Name 'Kids menu available' -Value @{ result = "Yes"; evidence = "Manual update"; confidence = 1.0 } -Force
        }
        if ($tag -eq "kid_noise_tolerant") {
            $review | Add-Member -MemberType NoteProperty -Name 'kid_noise_tolerant' -Value @{ result = "Yes"; evidence = "Manual update"; confidence = 1.0 } -Force
        }
    }
    
    $pos = 0
    if (($review.' child_seat available' -and $review.' child_seat available'.result -eq "Yes") -or ($review.'child_seat available' -and $review.'child_seat available'.result -eq "Yes")) { $pos++ }
    if ($review.'Spacious seating' -and $review.'Spacious seating'.result -eq "Yes") { $pos++ }
    if ($review.'Kids menu available' -and $review.'Kids menu available'.result -eq "Yes") { $pos++ }
    if ($review.kid_noise_tolerant -and $review.kid_noise_tolerant.result -eq "Yes") { $pos++ }
    
    $review | Add-Member -MemberType NoteProperty -Name 'parent_friendly_score' -Value $pos -Force
    if ($pos -ge 3) { $review | Add-Member -MemberType NoteProperty -Name 'parent_friendly_level' -Value $high -Force }
    elif ($pos -ge 1) { $review | Add-Member -MemberType NoteProperty -Name 'parent_friendly_level' -Value $mid -Force }
    else { $review | Add-Member -MemberType NoteProperty -Name 'parent_friendly_level' -Value $info -Force }
    
    $review | Add-Member -MemberType NoteProperty -Name 'reason' -Value "Manual Update" -Force
    
    $finalJson = $review | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText((Resolve-Path $filePath).Path, $finalJson, [System.Text.Encoding]::UTF8)
    Write-Host "Updated $placeId - Score: $pos"
}
