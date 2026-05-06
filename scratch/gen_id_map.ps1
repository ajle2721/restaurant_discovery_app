$content = [System.IO.File]::ReadAllText('ai_review/index.js', [System.Text.Encoding]::UTF8)
$json = $content.Trim().Substring(23)
if ($json.EndsWith(";")) { $json = $json.Substring(0, $json.Length - 1) }
$data = $json | ConvertFrom-Json
$data | ForEach-Object { "$($_.name) | $($_.place_id)" } | Set-Content "scratch/id_map.txt" -Encoding UTF8
