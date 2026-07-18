$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$dataJsPath = "data.js"
$dataJsRaw = [System.IO.File]::ReadAllText($dataJsPath, [System.Text.Encoding]::UTF8)

# The content is currently: const restaurantData = { "value": [ ... ], "Count": 421 };
# We need it to be: const restaurantData = [ ... ];

$pattern = "(?s)const restaurantData = \{\s*`"value`":\s*(\[.*?\]),\s*`"Count`":\s*\d+\s*\};?"
if ($dataJsRaw -match $pattern) {
    $arrayContent = $matches[1]
    $newContent = "const restaurantData = $arrayContent;"
    [System.IO.File]::WriteAllText($dataJsPath, $newContent, [System.Text.Encoding]::UTF8)
    Write-Output "Successfully fixed data.js"
} else {
    Write-Output "Pattern not matched. It might already be an array or different structure."
}
