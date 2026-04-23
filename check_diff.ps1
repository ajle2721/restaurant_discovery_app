$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\ai_review"
$files = Get-ChildItem -Path $baseDir -Filter "*.json"

$diffCount = 0
$totalCount = 0

foreach ($file in $files) {
    $raw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $data = ConvertFrom-Json $raw
    $totalCount++
    
    $stroller = $data.'Stroller accessible'
    $spacious = $data.'Spacious seating'
    
    if ($null -ne $stroller -and $null -ne $spacious) {
        $strollerStr = @($stroller.result, $stroller.evidence, $stroller.confidence) -join "|"
        $spaciousStr = @($spacious.result, $spacious.evidence, $spacious.confidence) -join "|"
        
        if ($strollerStr -ne $spaciousStr) {
            $diffCount++
            # Write-Output "Diff in $($file.Name):"
            # Write-Output "  Stroller: $strollerStr"
            # Write-Output "  Spacious: $spaciousStr"
        }
    }
}

Write-Output "Checked $totalCount files."
Write-Output "Files with differences: $diffCount"
