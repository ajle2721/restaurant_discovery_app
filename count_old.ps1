$data = Get-Content 'data.js' -Raw
$yesCount = ([regex]::Matches($data, '"high_chair_available": "yes"')).Count
$noCount = ([regex]::Matches($data, '"high_chair_available": "no"')).Count
$unknownCount = ([regex]::Matches($data, '"high_chair_available": "unknown"')).Count
Write-Output "From data.js (which was generated from the old ai_review files):"
Write-Output "YES: $yesCount"
Write-Output "NO: $noCount"
Write-Output "UNKNOWN: $unknownCount"
