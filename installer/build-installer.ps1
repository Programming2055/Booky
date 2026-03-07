# Booky Windows Installer Build Script
# Requirements:
#   - Node.js and npm
#   - Python 3.8+
#   - PyInstaller (pip install pyinstaller)
#   - Inno Setup 6+ (https://jrsoftware.org/isdl.php)

param(
    [switch]$SkipNpmBuild,
    [switch]$SkipPyInstaller,
    [switch]$SkipInnoSetup,
    [switch]$Debug,
    [string]$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Step { param($msg) Write-Host "`n[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-ErrorMsg { param($msg) Write-Host "  ✗ $msg" -ForegroundColor Red }

# Get script directory and project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$InstallerDir = $ScriptDir
$DistDir = Join-Path $ProjectRoot "dist"
$OutputDir = Join-Path $InstallerDir "output"

Write-Host "============================================" -ForegroundColor Magenta
Write-Host "        Booky Installer Build Script       " -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Project Root: $ProjectRoot"
Write-Host "Installer Dir: $InstallerDir"
Write-Host ""

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Success "Created output directory"
}

# Step 1: Build React App
if (-not $SkipNpmBuild) {
    Write-Step "Building React application..."
    
    Push-Location $ProjectRoot
    try {
        # Check if node_modules exists
        if (-not (Test-Path "node_modules")) {
            Write-Host "  Installing npm dependencies..."
            npm install
            if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
        }
        
        # Build the React app
        Write-Host "  Running npm build..."
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm build failed" }
        
        Write-Success "React app built successfully"
    }
    finally {
        Pop-Location
    }
} else {
    Write-Warning "Skipping npm build (using existing dist folder)"
}

# Verify dist folder exists
if (-not (Test-Path $DistDir)) {
    Write-ErrorMsg "dist folder not found at $DistDir"
    Write-ErrorMsg "Please run 'npm run build' first or remove -SkipNpmBuild flag"
    exit 1
}

# Step 2: Build executable with PyInstaller
if (-not $SkipPyInstaller) {
    Write-Step "Building executable with PyInstaller..."
    
    Push-Location $InstallerDir
    try {
        # Check if PyInstaller is installed
        $pyinstaller = Get-Command pyinstaller -ErrorAction SilentlyContinue
        if (-not $pyinstaller) {
            Write-Host "  Installing PyInstaller..."
            pip install pyinstaller
            if ($LASTEXITCODE -ne 0) { throw "Failed to install PyInstaller" }
        }
        
        # Clean previous build
        if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
        if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
        
        # Build with PyInstaller
        Write-Host "  Running PyInstaller..."
        if ($Debug) {
            pyinstaller booky.spec --clean
        } else {
            pyinstaller booky.spec --clean 2>&1 | Out-Null
        }
        
        if ($LASTEXITCODE -ne 0) { throw "PyInstaller build failed" }
        
        # Verify executable was created
        $exePath = Join-Path $InstallerDir "dist\Booky.exe"
        if (-not (Test-Path $exePath)) {
            throw "Executable not found at $exePath"
        }
        
        $exeSize = (Get-Item $exePath).Length / 1MB
        Write-Success "Executable built: Booky.exe ($([math]::Round($exeSize, 2)) MB)"
    }
    finally {
        Pop-Location
    }
} else {
    Write-Warning "Skipping PyInstaller build"
}

# Verify executable exists
$exePath = Join-Path $InstallerDir "dist\Booky.exe"
if (-not (Test-Path $exePath)) {
    Write-ErrorMsg "Executable not found at $exePath"
    Write-ErrorMsg "Please run PyInstaller first or remove -SkipPyInstaller flag"
    exit 1
}

# Step 3: Build installer with Inno Setup
if (-not $SkipInnoSetup) {
    Write-Step "Building installer with Inno Setup..."
    
    # Find Inno Setup compiler
    $isccPaths = @(
        $InnoSetupPath,
        "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        "C:\Program Files\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
    )
    
    $iscc = $null
    foreach ($path in $isccPaths) {
        if (Test-Path $path) {
            $iscc = $path
            break
        }
    }
    
    if (-not $iscc) {
        Write-ErrorMsg "Inno Setup not found!"
        Write-ErrorMsg "Please install Inno Setup from: https://jrsoftware.org/isdl.php"
        Write-ErrorMsg "Or specify path with -InnoSetupPath parameter"
        exit 1
    }
    
    Write-Host "  Using Inno Setup: $iscc"
    
    # Run Inno Setup compiler
    Push-Location $InstallerDir
    try {
        & $iscc "booky.iss"
        if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed" }
        
        # Find the output file
        $setupFile = Get-ChildItem -Path $OutputDir -Filter "BookySetup*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($setupFile) {
            $setupSize = $setupFile.Length / 1MB
            Write-Success "Installer created: $($setupFile.Name) ($([math]::Round($setupSize, 2)) MB)"
            Write-Host ""
            Write-Host "  Output location: $($setupFile.FullName)" -ForegroundColor White
        }
    }
    finally {
        Pop-Location
    }
} else {
    Write-Warning "Skipping Inno Setup build"
}

# Done!
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "           Build Complete!                 " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Test the installer from: $OutputDir"
Write-Host "  2. Distribute the installer to users"
Write-Host ""
