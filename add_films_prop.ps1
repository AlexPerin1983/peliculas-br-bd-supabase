$filePath = "components\MeasurementList.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Substituir em uma linha específica
$lines = $content -split "`r`n"
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s+<CuttingOptimizationPanel$' -and $lines[$i+3] -match '^\s+optionId=') {
        $lines[$i+3] = $lines[$i+3] + "`r`n                            films={films}"
        break
    }
}

$newContent = $lines -join "`r`n"
Set-Content -Path $filePath -Value $newContent -Encoding UTF8 -NoNewline
Write-Host "Successfully updated MeasurementList.tsx"
