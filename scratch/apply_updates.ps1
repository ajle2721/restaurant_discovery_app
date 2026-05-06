$updates = @{
    "ChIJVQR_uWusQjQRYNp5Wdmei40" = @{ "child_seat" = "Yes"; "kids_meal" = "Yes" }
    "ChIJaSZ-CpupQjQRaqvVbaJ4FaM" = @{ "child_seat" = "Yes" }
    "ChIJo5uKl5ipQjQRUDGwOBCHUWs" = @{ "child_seat" = "Yes" }
    "ChIJoaP21WOpQjQRujwXUxC4FME" = @{ "child_seat" = "Yes" }
    "ChIJoZlomYarQjQRQ6dO-drU7eg" = @{ "child_seat" = "Yes"; "spacious" = "Yes" }
    "ChIJfepvyousQjQRq2rFXvS-esU" = @{ "child_seat" = "Yes"; "spacious" = "Yes" }
    "ChIJ67abfVavQjQRscMhuF5_tQA" = @{ "child_seat" = "Yes"; "spacious" = "Yes" }
    "ChIJsS8FHNyvQjQRwtaRVpPMyAI" = @{ "child_seat" = "Yes"; "spacious" = "Yes" }
    "ChIJ2VWqSkKuQjQRuQkg3lsruls" = @{ "child_seat" = "Yes" }
}

$aiDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\ai_review"

foreach ($key in $updates.Keys) {
    $path = Join-Path $aiDir "$key.json"
    if (Test-Path $path) {
        $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
        $data = ConvertFrom-Json $raw
        $u = $updates[$key]
        
        if ($u.ContainsKey("child_seat")) {
            $data." child_seat available" = @{ "result" = $u["child_seat"]; "evidence" = "User provided info"; "confidence" = 1.0 }
        }
        if ($u.ContainsKey("kids_meal")) {
            $data."Kids menu available" = @{ "result" = $u["kids_meal"]; "evidence" = "User provided info"; "confidence" = 1.0 }
        }
        if ($u.ContainsKey("spacious")) {
            $data."Spacious seating" = @{ "result" = $u["spacious"]; "evidence" = "User provided info"; "confidence" = 1.0 }
        }
        
        $json = ConvertTo-Json $data -Depth 10
        [System.IO.File]::WriteAllText($path, $json, [System.Text.Encoding]::UTF8)
        Write-Output "Updated $key"
    }
}
