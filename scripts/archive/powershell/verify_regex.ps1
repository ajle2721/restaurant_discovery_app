[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map"
$dataJs = Join-Path $baseDir "data.js"
$respDir = Join-Path $baseDir "response"
Copy-Item $dataJs "$dataJs.bak3" -Force
$content = [System.IO.File]::ReadAllText($dataJs, [System.Text.Encoding]::UTF8)

$posChair = @("兒童椅","嬰兒椅","寶寶椅","兒童餐椅","幼兒座椅","小孩椅子","兒童用椅","提供餐椅","備有餐椅","high chair","兒童坐椅","兒童座椅","嬰兒座椅","餐椅")
$negChair = @("沒有兒童椅","沒提供餐椅","沒提供兒童椅","無兒童椅","未提供兒童椅","沒有提供兒童座椅","沒兒童椅","不提供兒童椅","沒有提供餐椅","沒有嬰兒椅","無提供兒童椅","無餐椅")
$posSpace = @("空間寬敞","推車方便","環境寬敞","座位寬敞","寬敞舒適","推嬰兒車方便","位子寬敞","座位大","場地大","很有空間")
$negSpace = @("擁擠","狹小","座位很近","小小的店","空間偏小","空間不大","太擠","很擠","偏擠","位子很擠","空間小","間距近","間距小","座位間很近")
$posMenu = @("兒童餐","寶寶粥","小人餐","兒童菜單","小孩餐","兒童專屬")
$negMenu = @("沒有兒童餐","沒提供兒童餐","無兒童餐","不提供兒童餐")
$posNoise = @("親子友善","對小孩友善","對兒童友善","歡迎小孩","適合小孩","適合帶小孩","很多家庭","很多小朋友","友善小孩","家庭友善","親子餐廳")
$negNoise = @("不接待小孩","拒絕小孩","不適合小孩","不適合帶小孩","不能帶小孩","白眼","不歡迎小孩","謝絕兒童","不接待兒童")

function tryMatch($s, $list) { foreach ($kw in $list) { if ($s.Contains($kw)) { return $true } }; return $false }
function capStr($s) { if ($s.Length -gt 80) { $s.Substring(0,80) } else { $s } }

$placeIds = [regex]::Matches($content, "\"place_id\":\"([^\"]+)\"") | ForEach-Object { $_.Groups[1].Value }
Write-Output "Found $($placeIds.Count) place IDs"
$updated = 0

foreach ($pid in $placeIds) {
  $rp = Join-Path $respDir "$pid.json"
  if (-not (Test-Path $rp)) { continue }
  $rd = Get-Content $rp -Encoding UTF8 -Raw | ConvertFrom-Json
  $text = ""
  if ($rd.reviews) { foreach ($rev in $rd.reviews) { $t = if ($rev.text -and $rev.text.text) { $rev.text.text } elseif ($rev.originalText -and $rev.originalText.text) { $rev.originalText.text } else { "" }; $text += $t + "`n" } }
  
  $vChair = "unknown"; $vSpace = "unknown"; $vMenu = "unknown"; $vNoise = "unknown"
  $sigs = @()
  $sentences = $text -split "[。！？`n`r；，,]+"
  foreach ($s in $sentences) {
    $s = $s.Trim(); if ($s.Length -lt 3) { continue }
    $cap = capStr $s
    if (tryMatch $s $negChair) { $vChair = "no"; if ($sigs -notcontains $cap) { $sigs += $cap } }
    elseif ($vChair -ne "no" -and (tryMatch $s $posChair)) { $vChair = "yes"; if ($sigs -notcontains $cap) { $sigs += $cap } }
    if (tryMatch $s $negSpace) { $vSpace = "no"; if ($sigs -notcontains $cap) { $sigs += $cap } }
    elseif ($vSpace -ne "no" -and (tryMatch $s $posSpace)) { $vSpace = "yes"; if ($sigs -notcontains $cap) { $sigs += $cap } }
    if (tryMatch $s $negMenu) { $vMenu = "no"; if ($sigs -notcontains $cap) { $sigs += $cap } }
    elseif ($vMenu -ne "no" -and (tryMatch $s $posMenu)) { $vMenu = "yes"; if ($sigs -notcontains $cap) { $sigs += $cap } }
    if (tryMatch $s $negNoise) { $vNoise = "no"; if ($sigs -notcontains $cap) { $sigs += $cap } }
    elseif ($vNoise -ne "no" -and (tryMatch $s $posNoise)) { $vNoise = "yes"; if ($sigs -notcontains $cap) { $sigs += $cap } }
  }
  
  $score = 0
  foreach ($v in @($vChair,$vSpace,$vMenu,$vNoise)) { if ($v -eq "yes") { $score++ } }
  $level = if ($score -ge 3) { "高" } elseif ($score -ge 1) { "中" } else { "資訊不足" }
  
  $posN = @(); if ($vChair -eq "yes") { $posN += "兒童椅" }; if ($vMenu -eq "yes") { $posN += "兒童餐" }
  $negN = @(); if ($vChair -eq "no") { $negN += "未提供兒童椅" }; if ($vMenu -eq "no") { $negN += "無兒童餐" }
  if ($vSpace -eq "no") { $negN += "空間較為擁擠" }; if ($vNoise -eq "no") { $negN += "較不適合帶小孩" }
  $sparts = @()
  if ($posN.Count -gt 0) { $sparts += "餐廳提供" + ($posN -join "與") + "。" }
  if ($vSpace -eq "yes") { $sparts += "空間寬敞，適合家庭用餐。" }
  if ($vNoise -eq "yes") { $sparts += "整體氛圍對親子友善。" }
  if ($negN.Count -gt 0) { $sparts += "不過評論指出" + ($negN -join "、") + "，建議家長斟酌。" }
  $summary = if ($sparts.Count -gt 0) { $sparts -join " " } elseif ($sigs.Count -gt 0) { "目前缺乏明確的親子友善標籤，請參考下方評論線索。" } else { "目前缺乏親子友善相關的詳細資訊。" }
  
  # Build new signals JSON
  $sigsJson = "[" + (($sigs | ForEach-Object { "\"" + ($_ -replace "\\","\\\\") -replace "`"","\\`"" + "\"" }) -join ",") + "]"
  $summaryEsc = $summary -replace "\\","\\\\"; $summaryEsc = $summaryEsc -replace "`"","\\`""
  
  # Use regex to update fields for this specific place_id in the content
  # We find the block for this restaurant and patch specific fields
  $pidEsc = [regex]::Escape($pid)
  # Update attributes
  $attrNew = "{`"kids_menu`":`"$vMenu`",`"high_chair_available`":`"$vChair`",`"spacious_seating`":`"$vSpace`",`"kid_noise_tolerant`":`"$vNoise`"}"
  # Match attributes block near this place_id and replace
  # Strategy: find the JSON object boundaries for this restaurant by searching for the pid occurrence
  # Then do targeted field replacements within that region
  $pidPos = $content.IndexOf("`"place_id`":`"$pid`"")
  if ($pidPos -lt 0) { continue }
  # Find start of this restaurant object (search backward for {)
  $objStart = $pidPos
  while ($objStart -gt 0 -and $content[$objStart] -ne "{") { $objStart-- }
  # Find end: track brace depth
  $depth = 0; $objEnd = $objStart
  for ($i=$objStart; $i -lt $content.Length; $i++) {
    if ($content[$i] -eq "{") { $depth++ }
    elseif ($content[$i] -eq "}") { $depth--; if ($depth -eq 0) { $objEnd = $i; break } }
  }
  $before = $content.Substring(0, $objStart)
  $obj = $content.Substring($objStart, $objEnd - $objStart + 1)
  $after = $content.Substring($objEnd + 1)
  
  $newObj = [regex]::Replace($obj, "\"attributes\":\{[^}]+\}", "\"attributes\":$attrNew")
  $newObj = [regex]::Replace($newObj, "\"signals\":\[[^\]]*\]", "\"signals\":$sigsJson")
  $newObj = [regex]::Replace($newObj, "\"ai_summary\":\"[^\"]*\"", "\"ai_summary`\":\"$summaryEsc\"")
  $newObj = [regex]::Replace($newObj, "\"parent_friendly_score\":\d+", "\"parent_friendly_score\":$score")
  $newObj = [regex]::Replace($newObj, "\"parent_friendly_level\":\"[^\"]*\"", "\"parent_friendly_level\":\"$level\"")
  
  if ($newObj -ne $obj) {
    $content = $before + $newObj + $after
    $updated++
  }
}

[System.IO.File]::WriteAllText($dataJs, $content, [System.Text.Encoding]::UTF8)
Write-Output "Done. Updated $updated restaurants."
