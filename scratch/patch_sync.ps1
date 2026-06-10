$appJsPath = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\app.js"
$content = [System.IO.File]::ReadAllText($appJsPath, [System.Text.Encoding]::UTF8)

# Detect if the file uses CRLF or LF
$usesCrlf = $content.Contains("`r`n")
# Normalize content to LF for matching
$contentLf = $content.Replace("`r`n", "`n")

$old_sync = "    if (!searchStateMatches) {
        console.log('Syncing search state from URL...');"

$new_sync = "    if (!searchStateMatches) {
        console.log('Syncing search state from URL...');
        state.recommendedLimit = 30; // Reset pagination limit
        state.othersLimit = 30; // Reset pagination limit"

if ($contentLf.Contains($old_sync)) {
    $contentLf = $contentLf.Replace($old_sync, $new_sync)
    Write-Output "Successfully matched and replaced block 5!"
} else {
    Write-Warning "Could not find match for block 5!"
}

# Restore line endings
if ($usesCrlf) {
    $contentFinal = $contentLf.Replace("`n", "`r`n")
} else {
    $contentFinal = $contentLf
}

[System.IO.File]::WriteAllText($appJsPath, $contentFinal, [System.Text.Encoding]::UTF8)
Write-Output "Completed."
