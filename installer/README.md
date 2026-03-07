# Booky Windows Installer Build Guide

This directory contains all files needed to create a Windows installer for Booky.

## Prerequisites

Before building the installer, you need to install:

### 1. Required Software

| Software | Version | Download |
|----------|---------|----------|
| Node.js | 18+ | https://nodejs.org/ |
| Python | 3.8+ | https://python.org/ |
| Inno Setup | 6+ | https://jrsoftware.org/isdl.php |

### 2. Python Packages

```bash
pip install pyinstaller
```

## Building the Installer

### Quick Build (Recommended)

Run the batch file or PowerShell script:

```batch
# Using batch file (double-click or run in cmd)
build-installer.bat

# Using PowerShell
powershell -ExecutionPolicy Bypass -File build-installer.ps1
```

### Manual Build Steps

If you prefer to build manually:

#### Step 1: Build the React App

```bash
cd ..
npm install
npm run build
```

This creates the `dist/` folder with the production build.

#### Step 2: Build the Executable

```bash
cd installer
pip install pyinstaller
pyinstaller booky.spec --clean
```

This creates `installer/dist/Booky.exe`.

#### Step 3: Build the Installer

Open Inno Setup Compiler and compile `booky.iss`, or run:

```bash
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" booky.iss
```

The installer will be created in `installer/output/`.

## Files in This Directory

| File | Description |
|------|-------------|
| `booky_launcher.py` | Python launcher that serves the React app and handles API requests |
| `booky.spec` | PyInstaller configuration for creating the executable |
| `booky.iss` | Inno Setup script for creating the Windows installer |
| `build-installer.ps1` | PowerShell build script (full automation) |
| `build-installer.bat` | Batch build script (alternative) |
| `output/` | Output folder for the installer (created during build) |

## Customization

### Change App Version

Edit `booky.iss` and update:
```inno
#define MyAppVersion "1.0.0"
```

### Add Application Icon

Place a `favicon.ico` file in the `public/` folder. The build scripts will automatically use it.

### Change Default Port

Edit `booky_launcher.py` and change:
```python
HTTP_PORT = 5173
```

## Output

After a successful build, you'll find:

- **Executable**: `installer/dist/Booky.exe` (~15-30 MB)
- **Installer**: `installer/output/BookySetup-1.0.0.exe` (~10-20 MB)

## Troubleshooting

### "PyInstaller not found"

Install it with:
```bash
pip install pyinstaller
```

### "Inno Setup not found"

1. Download from https://jrsoftware.org/isdl.php
2. Install to the default location
3. Or specify custom path: `build-installer.ps1 -InnoSetupPath "C:\Path\To\ISCC.exe"`

### "dist folder not found"

Run `npm run build` in the project root first.

### Build fails with Python errors

Ensure you have Python 3.8+ and try:
```bash
pip install --upgrade pyinstaller
```

### Antivirus blocks the executable

PyInstaller executables are sometimes flagged as false positives. You may need to:
1. Add an exception in your antivirus
2. Sign the executable with a code signing certificate (for distribution)

## Distribution

The final installer (`BookySetup-x.x.x.exe`) can be:
- Distributed directly to users
- Uploaded to your website
- Published on software distribution platforms

Users just need to run the installer - no additional software required!
