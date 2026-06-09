$ai_dir = "ai_review"
$files = Get-ChildItem -Path $ai_dir -Filter *.json
$results = @()
$results += "Auditing $($files.Count) files..."
foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding utf8
        $data = ConvertFrom-Json $content
        
        # Check child_seat
        $cs = $data." child_seat available"
        if ($cs -and $cs.result -eq "Yes") {
            $ev = $cs.evidence
            if ($ev -like "*Google*" -or $ev -like "*官方*") {
                $results += "[CHILD_SEAT] $($file.Name): $ev"
            }
        }
        
        # Check Kids menu
        $km = $data."Kids menu available"
        if ($km -and $km.result -eq "Yes") {
            $ev = $km.evidence
            if ($ev -like "*Google*" -or $ev -like "*官方*") {
                $results += "[KIDS_MENU] $($file.Name): $ev"
            }
        }
        
        # Check diaper table
        $dt = $data.has_diaper_table
        if ($dt -and $dt.result -eq "Yes") {
            $ev = $dt.evidence
            if (($ev -like "*Google*" -or $ev -like "*官方*") -and ($ev -notlike "*百貨*") -and ($ev -notlike "*商場*")) {
                $results += "[DIAPER_TABLE] $($file.Name): $ev"
            }
        }
    } catch {
        # Ignore
    }
}
$results += "Audit completed."
$results | Out-File -FilePath "scratch/audit_results.txt" -Encoding utf8
