$count = 0
Get-ChildItem -Path ai_review/*.json | ForEach-Object {
    $text = [System.IO.File]::ReadAllText($_.FullName)
    if ($text -match '"has_private_room":\s*\{\s*"result":\s*"Yes"') {
        $count++
    }
}
Write-Output "Count: $count"
