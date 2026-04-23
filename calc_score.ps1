$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Unescape-Unicode([string]$str) {
    return [regex]::Replace($str, '\\u(?<Value>[a-fA-F0-9]{4})', {
        param($m)
        [char][int]::Parse($m.Groups['Value'].Value, [System.Globalization.NumberStyles]::HexNumber)
    })
}

$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\ai_review"
$files = Get-ChildItem -Path $baseDir -Filter "*.json"

$countUpdated = 0

foreach ($file in $files) {
    try {
        $raw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $data = ConvertFrom-Json $raw
        
        if ($null -ne $data.psobject.properties['Stroller accessible']) {
            $data.psobject.properties.Remove('Stroller accessible')
        }
        
        function Get-Score($resultStr) {
            if ([string]::IsNullOrWhiteSpace($resultStr)) { return 0.5 }
            $r = $resultStr.Trim().ToUpper()
            if ($r -eq 'YES') { return 1.0 }
            if ($r -eq 'NO') { return 0.0 }
            return 0.5
        }
        
        $seatVal = if ($null -ne $data.psobject.properties[' child_seat available']) { $data.psobject.properties[' child_seat available'].Value } else { $null }
        $seatRes = if ($null -ne $seatVal) { $seatVal.result } else { "UNKNOWN" }
        
        $menuVal = if ($null -ne $data.psobject.properties['Kids menu available']) { $data.psobject.properties['Kids menu available'].Value } else { $null }
        $menuRes = if ($null -ne $menuVal) { $menuVal.result } else { "UNKNOWN" }
        
        $spaceVal = if ($null -ne $data.psobject.properties['Spacious seating']) { $data.psobject.properties['Spacious seating'].Value } else { $null }
        $spaceRes = if ($null -ne $spaceVal) { $spaceVal.result } else { "UNKNOWN" }
        
        $noiseVal = if ($null -ne $data.psobject.properties['kid_noise_tolerant']) { $data.psobject.properties['kid_noise_tolerant'].Value } else { $null }
        $noiseRes = if ($null -ne $noiseVal) { $noiseVal.result } else { "UNKNOWN" }
        
        $seatScore = Get-Score $seatRes
        $menuScore = Get-Score $menuRes
        $spaceScore = Get-Score $spaceRes
        $noiseScore = Get-Score $noiseRes
        
        $totalScore = ($spaceScore * 1.5) + ($noiseScore * 1.5) + ($seatScore * 1.0) + ($menuScore * 0.5)
        
        $level = ""
        if ($totalScore -ge 3.5) {
            $level = "高"
        } elseif ($totalScore -ge 2.5) {
            $level = "中"
        } else {
            $level = "低"
        }
        
        if (($spaceRes.ToUpper() -eq 'NO' -or $noiseRes.ToUpper() -eq 'NO') -and $level -eq "高") {
            $level = "中"
        }
        
        $summary = ""
        if ($level -eq "高") {
            $summary = "具備完善的親子相關設施與空間，非常適合帶小孩用餐。"
        } elseif ($level -eq "中") {
            $summary = "部分條件適合小孩，作為家庭用餐是不錯的選擇。"
        } else {
            $summary = "目前缺乏親子相關的正面資訊，可能較不適合帶小孩。"
        }
        
        if ($null -ne $data.psobject.properties['parent_friendly_score']) { $data.psobject.properties.Remove('parent_friendly_score') }
        if ($null -ne $data.psobject.properties['parent_friendly_level']) { $data.psobject.properties.Remove('parent_friendly_level') }
        if ($null -ne $data.psobject.properties['summary']) { $data.psobject.properties.Remove('summary') }
        
        $data | Add-Member -MemberType NoteProperty -Name "parent_friendly_score" -Value $totalScore
        $data | Add-Member -MemberType NoteProperty -Name "parent_friendly_level" -Value $level
        $data | Add-Member -MemberType NoteProperty -Name "summary" -Value $summary
        
        $json = ConvertTo-Json $data -Depth 10
        $json = Unescape-Unicode $json
        
        [System.IO.File]::WriteAllText($file.FullName, $json, [System.Text.Encoding]::UTF8)
        $countUpdated++
    } catch {
        Write-Output "Error processing $($file.Name): $_"
    }
}

Write-Output "Successfully updated $countUpdated files with scores and levels."
