$content = [System.IO.File]::ReadAllText('ai_review/index.js', [System.Text.Encoding]::UTF8)
$json = $content.Trim().Substring(23)
if ($json.EndsWith(";")) { $json = $json.Substring(0, $json.Length - 1) }
$data = $json | ConvertFrom-Json

$searchNames = @(
    "$([char]0x6a02)$([char]0x96c5)$([char]0x6a02)", # 樂雅樂
    "Creative Pasta",
    "$([char]0x8cb3)$([char]0x6a13)", # 貳樓
    "$([char]0x9676)$([char]0x677f)$([char]0x5c4b)", # 陶板屋
    "$([char]0x6b23)$([char]0x8449)$([char]0x5c0f)$([char]0x805a)", # 欣葉小聚
    "$([char]0x6b23)$([char]0x8449)$([char]0x53f0)$([char]0x83dc)", # 欣葉台菜
    "$([char]0x6a02)$([char]0x5b50)the Diner" # 樂子the Diner
)

foreach ($s in $searchNames) {
    Write-Host "`nResults for: $s"
    $matches = $data | Where-Object { $_.name -like "*$s*" }
    foreach ($m in $matches) {
        Write-Host " - $($m.name) | $($m.place_id)"
    }
}
