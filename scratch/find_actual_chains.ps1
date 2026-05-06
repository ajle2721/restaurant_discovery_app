$content = [System.IO.File]::ReadAllText('ai_review/index.js', [System.Text.Encoding]::UTF8)
$json = $content.Trim()
if ($json.StartsWith("const restaurantData = ")) {
    $json = $json.Substring(23)
}
if ($json.EndsWith(";")) {
    $json = $json.Substring(0, $json.Length - 1)
}

$data = $json | ConvertFrom-Json
$names = $data | Select-Object -ExpandProperty name

Write-Host "Total names found: $($names.Count)"

$chains = @{}
$dian = [char]0x5e97
$fen = [char]0x5206
$paren1 = [char]0xff08
$paren2 = [char]0x0028

foreach ($n in $names) {
    $base = $n
    # Heuristic to remove branch names
    if ($base.Contains($dian)) { $base = $base.Split($dian)[0] }
    if ($base.Contains($fen)) { $base = $base.Split($fen)[0] }
    if ($base.Contains($paren1)) { $base = $base.Split($paren1)[0] }
    if ($base.Contains($paren2)) { $base = $base.Split($paren2)[0] }
    $base = $base.Trim()
    
    # Handle known English chain prefixes
    if ($base -like "Second Floor*") { $base = "Second Floor" }
    if ($base -like "Q Burger*") { $base = "Q Burger" }
    
    if (-not $chains.ContainsKey($base)) { $chains[$base] = @() }
    $chains[$base] += $n
}

Write-Host "`nActual Chain Restaurants in your 421 list:"
foreach ($key in ($chains.Keys | Sort-Object)) {
    if ($chains[$key].Count -gt 1) {
        Write-Host "- $key ($($chains[$key].Count) sites)"
    }
}
