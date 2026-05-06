$content = [System.IO.File]::ReadAllText('ai_review/index.js', [System.Text.Encoding]::UTF8)
$json = $content.Trim()
if ($json.StartsWith("const restaurantData = ")) { $json = $json.Substring(23) }
if ($json.EndsWith(";")) { $json = $json.Substring(0, $json.Length - 1) }

$data = $json | ConvertFrom-Json
$names = $data | Select-Object -ExpandProperty name
[System.IO.File]::WriteAllLines("scratch/names_list.txt", $names, [System.Text.Encoding]::UTF8)
