$content = [System.IO.File]::ReadAllText('ai_review/index.js')
$keywords = @(
    "$([char]0x8cb3)$([char]0x6a13)",
    "$([char]0x6a02)$([char]0x96c5)$([char]0x6a02)",
    "$([char]0x91d1)$([char]0x8272)$([char]0x4e09)$([char]0x9ea5)",
    "$([char]0x99饗)$([char]0x98df)$([char]0x5929)$([char]0x5802)",
    "$([char]0x6b23)$([char]0x8449)",
    "$([char]0x74e6)$([char]0x57ce)",
    "$([char]0x9ede)$([char]0x9ede)$([char]0x5fc3)",
    "$([char]0x9f0e)$([char]0x6cf0)$([char]0x8c50)",
    "Q Burger",
    "$([char]0x9ea5)$([char]0x5473)$([char]0x767b)",
    "$([char]0x62c9)$([char]0x4e9e)$([char]0x6f22)$([char]0x5821)",
    "$([char]0x8def)$([char]0x6613)$([char]0x838e)",
    "$([char]0x661f)$([char]0x5df4)$([char]0x514b)",
    "$([char]0x6469)$([char]0x65af)",
    "$([char]0x5927)$([char]0x6a39)$([char]0x5148)$([char]0x751f)",
    "$([char]0x8c61)$([char]0x5712)",
    "$([char]0x5496)$([char]0x5561)$([char]0x5f04)",
    "$([char]0x83ab)$([char]0x51e1)$([char]0x5f7c)",
    "$([char]0x53e4)$([char]0x62c9)$([char]0x7232)",
    "$([char]0x805a)$([char]0x65e5)$([char]0x5f0f)$([char]0x934b)",
    "$([char]0x77f3)$([char]0x4e8c)$([char]0x934b)",
    "$([char]0x9676)$([char]0x677f)$([char]0x5c4b)",
    "$([char]0x897f)$([char]0x5824)",
    "$([char]0x54c1)$([char]0x7530)$([char]0x7267)$([char]0x5834)",
    "$([char]0x5b9a)$([char]0x98df)8",
    "$([char]0x722d)$([char]0x9bae)",
    "$([char]0x58fd)$([char]0x53f8)$([char]0x90ce)",
    "$([char]0x85cf)$([char]0x58fd)$([char]0x53f8)"
)

Write-Host "Detected chain restaurants:"
foreach ($k in $keywords) {
    if ($content.Contains($k)) {
        Write-Host "- $k"
    }
}
