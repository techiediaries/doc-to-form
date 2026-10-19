# Windows version of batch_convert.sh.
# Convert all downloaded .doc files to .docx via LibreOffice, then generate HTML forms.
# Needs: LibreOffice (https://www.libreoffice.org) and Python 3 with requirements.txt installed.
# Run:   powershell -ExecutionPolicy Bypass -File .\batch_convert.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Python prints Arabic file names; force UTF-8 so it never crashes on a Windows code page.
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'

# LibreOffice is usually not on PATH on Windows - look in the standard install folders.
$soffice = (Get-Command soffice -ErrorAction SilentlyContinue).Source
if (-not $soffice) {
    $soffice = @(
        "$env:ProgramFiles\LibreOffice\program\soffice.exe",
        "${env:ProgramFiles(x86)}\LibreOffice\program\soffice.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $soffice) {
    Write-Error 'LibreOffice not found. Install it from https://www.libreoffice.org and run again.'
}

# "python3" is often a Microsoft Store stub on Windows - prefer the py launcher.
$python = if (Get-Command py -ErrorAction SilentlyContinue) { 'py' } else { 'python' }

New-Item -ItemType Directory -Force converted, forms | Out-Null

Write-Host '=== Step 1: .doc -> .docx (LibreOffice) ==='
foreach ($f in Get-ChildItem downloaded -Filter *.doc) {
    $out = Join-Path converted ($f.BaseName + '.docx')
    if (Test-Path -LiteralPath $out) {
        Write-Host "  skip (exists): $($f.BaseName).docx"
        continue
    }
    Write-Host "  Converting: $($f.BaseName)"
    & $soffice --headless --convert-to docx $f.FullName --outdir converted | Out-Null
}

Write-Host ''
Write-Host '=== Step 2: .docx -> HTML forms (python-docx) ==='
& $python convert_docx.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Done. Open index.html in a browser.'
