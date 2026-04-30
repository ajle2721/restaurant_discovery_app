$content = [System.IO.File]::ReadAllText('data.js', [System.Text.Encoding]::UTF8)
$startIdx = $content.IndexOf('[')
$endIdx = $content.LastIndexOf(']')
$jsonStr = $content.Substring($startIdx, $endIdx - $startIdx + 1)
$restaurants = ConvertFrom-Json -InputObject $jsonStr

Write-Output $restaurants[0].attributes