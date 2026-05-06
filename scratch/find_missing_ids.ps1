$content = [System.IO.File]::ReadAllText('ai_review/index.js', [System.Text.Encoding]::UTF8)
$json = $content.Trim().Substring(23)
if ($json.EndsWith(";")) { $json = $json.Substring(0, $json.Length - 1) }
$data = $json | ConvertFrom-Json

$missing = @(
    "Creative Pasta",
    "陶板屋",
    "欣葉小聚"
)

foreach ($m in $missing) {
    Write-Host "`nSearching for: $m"
    $matches = $data | Where-Object { $_.name -like "*$m*" }
    foreach ($res in $matches) {
        Write-Host " - $($res.name) | $($res.place_id)"
    }
}
