$oldAttrs = [PSCustomObject]@{
    kids_menu = 'unknown'
    high_chair_available = 'unknown'
    spacious_seating = 'yes'
    kid_noise_tolerant = 'unknown'
}
$finalAttributes = @{
    kids_menu = 'unknown'
    high_chair_available = 'no'
    spacious_seating = 'unknown'
    kid_noise_tolerant = 'yes'
}

$changed = $false
foreach ($k in $finalAttributes.Keys) {
    if ($oldAttrs.$k -ne $finalAttributes[$k]) {
        Write-Output "Key $k changed: $($oldAttrs.$k) -> $($finalAttributes[$k])"
        $changed = $true
    }
}
Write-Output "Changed? $changed"