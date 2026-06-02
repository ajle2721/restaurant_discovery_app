$content = [System.IO.File]::ReadAllText("ai_review/index.js", [System.Text.Encoding]::UTF8)
$start = $content.IndexOf("ChIJc_6fMzerQjQRHcqXwpPVxFo")
if ($start -ne -1) {
    Write-Output $content.Substring($start - 100, 1500)
} else {
    Write-Output "Not found"
}
