$url = "https://raw.githubusercontent.com/ajle2721/restaurant_discovery_app/main/ai_review/index.js"
$content = Invoke-RestMethod -Uri $url
$start = $content.IndexOf("ChIJc_6fMzerQjQRHcqXwpPVxFo")
if ($start -ne -1) {
    Write-Output $content.Substring($start - 100, 1500)
} else {
    Write-Output "Not found on remote main branch"
}
