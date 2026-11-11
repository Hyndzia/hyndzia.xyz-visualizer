
[CmdletBinding()]
param(
    [switch]$SkipBackend,

    [ValidateSet('NSIS', 'Portable', 'All')]
    [string]$Package = 'Portable'
)

$ErrorActionPreference = 'Stop'

trap {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$BuildScriptDir = $PSScriptRoot
$ProjectRoot = Split-Path $BuildScriptDir -Parent

$DesktopRoot = Join-Path $ProjectRoot 'desktop'
$BackendDir = Join-Path $DesktopRoot 'backend'
$BackendExe = Join-Path $BackendDir 'Visualizer.exe'

$Python = Join-Path $ProjectRoot 'venv\Scripts\python.exe'

$BuildRoot = $BuildScriptDir
$FinalDist = Join-Path $ProjectRoot 'dist'

$FinalNsisExe = Join-Path $FinalDist 'VisualizerDesktop-Setup.exe'
$FinalPortableExe = Join-Path $FinalDist 'VisualizerDesktop-Portable.exe'

$Launcher = Join-Path $BuildScriptDir 'visualizer_launcher.py'

# Select npm build script.
$NpmBuildScript = switch ($Package) {
    'NSIS'     { 'dist:nsis' }
    'Portable' { 'dist:portable' }
    'All'      { 'dist:all' }
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '       HYNDZIA VISUALIZER BUILDER' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host "Package: $Package" -ForegroundColor Yellow
Write-Host "Backend: $(if ($SkipBackend) { 'Skipped' } else { 'Build' })"
Write-Host ''

# Check Electron project.
if (-not (Test-Path -LiteralPath $DesktopRoot -PathType Container)) {
    throw "Electron project not found at $DesktopRoot."
}

# Build Python backend.
if (-not $SkipBackend) {
    if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
        throw "Python venv not found at $Python. Create it first: python -m venv venv"
    }

    & $Python -c "import PyInstaller" 2>$null

    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller is not installed in the venv. Run: .\venv\Scripts\python.exe -m pip install pyinstaller"
    }

    New-Item -ItemType Directory -Path $BackendDir, $BuildRoot -Force | Out-Null

    Write-Host 'Building Python backend...' -ForegroundColor Cyan

    Push-Location $ProjectRoot

    try {
        & $Python -m PyInstaller `
            --noconfirm `
            --clean `
            --onefile `
            --console `
            --name Visualizer `
            --distpath $BackendDir `
            --workpath (Join-Path $BuildRoot 'backend') `
            --specpath (Join-Path $BuildRoot 'backend') `
            --add-data "$(Join-Path $ProjectRoot 'templates');templates" `
            --add-data "$(Join-Path $ProjectRoot 'static');static" `
            --collect-all yt_dlp `
            $Launcher

        if ($LASTEXITCODE -ne 0) {
            throw "PyInstaller failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

# Check backend executable.
if (-not (Test-Path -LiteralPath $BackendExe -PathType Leaf)) {
    throw "Backend executable not found at $BackendExe. Run without -SkipBackend to build it."
}

# Check Node.js and npm.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js was not found in PATH.'
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm was not found in PATH.'
}

# Build Electron application.
Push-Location $DesktopRoot

try {
    if (-not (Test-Path -LiteralPath (Join-Path $DesktopRoot 'node_modules\electron'))) {
        Write-Host 'Installing Electron dependencies...' -ForegroundColor Cyan

        & npm.cmd ci --no-audit --no-fund

        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed with exit code $LASTEXITCODE."
        }
    }

    # Start from a clean Electron output directory.
    $ElectronDist = Join-Path $DesktopRoot 'dist'

    if (Test-Path -LiteralPath $ElectronDist) {
        Remove-Item -LiteralPath $ElectronDist -Recurse -Force
    }

    # Prevent automatic code-signing certificate discovery.
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

    Write-Host ''
    Write-Host "Building Electron application: $NpmBuildScript" -ForegroundColor Cyan

    & npm.cmd run $NpmBuildScript

    if ($LASTEXITCODE -ne 0) {
        throw "electron-builder failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

$ElectronDist = Join-Path $DesktopRoot 'dist'

$ArtifactsToCopy = @()

if ($Package -eq 'NSIS' -or $Package -eq 'All') {
    $BuiltNsis = Get-ChildItem -LiteralPath $ElectronDist -File -Filter 'Visualizer-Setup.exe' |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $BuiltNsis) {
        throw 'NSIS build finished, but Visualizer-Setup.exe was not found.'
    }

    $ArtifactsToCopy += [PSCustomObject]@{
        Source = $BuiltNsis.FullName
        Destination = $FinalNsisExe
        Name = 'NSIS Installer'
    }
}

if ($Package -eq 'Portable' -or $Package -eq 'All') {
    $BuiltPortable = Get-ChildItem -LiteralPath $ElectronDist -File -Filter 'Visualizer-Portable.exe' |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $BuiltPortable) {
        throw 'Portable build finished, but Visualizer-*-Portable.exe was not found.'
    }

    $ArtifactsToCopy += [PSCustomObject]@{
        Source = $BuiltPortable.FullName
        Destination = $FinalPortableExe
        Name = 'Portable'
    }
}

# Copy final builds.
New-Item -ItemType Directory -Path $FinalDist -Force | Out-Null

Write-Host ''
Write-Host 'Copying build artifacts...' -ForegroundColor Cyan

foreach ($Artifact in $ArtifactsToCopy) {
    Copy-Item -LiteralPath $Artifact.Source -Destination $Artifact.Destination -Force

    $SizeMb = [math]::Round(
        (Get-Item -LiteralPath $Artifact.Destination).Length / 1MB,
        1
    )

    Write-Host ''
    Write-Host "[$($Artifact.Name)]" -ForegroundColor Green
    Write-Host "Built: $($Artifact.Destination)"
    Write-Host "Size: $SizeMb MB"
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '          BUILD COMPLETED!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host "Output directory: $FinalDist" -ForegroundColor Cyan

Get-ChildItem -LiteralPath $FinalDist -File |
    Where-Object { $_.Name -like 'VisualizerDesktop-*.exe' } |
    Select-Object Name, @{
        Name = 'Size (MB)'
        Expression = { [math]::Round($_.Length / 1MB, 1) }
    } |
    Format-Table -AutoSize
