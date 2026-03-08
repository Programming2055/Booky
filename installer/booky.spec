# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Booky Desktop Application
Run with: pyinstaller booky.spec
"""

import os
import sys

# SPECPATH is already the directory containing the spec file
SPEC_DIR = os.path.abspath(SPECPATH)
# Go up one level to get project root
PROJECT_ROOT = os.path.dirname(SPEC_DIR)
# The dist folder is inside project root
DIST_DIR = os.path.join(PROJECT_ROOT, 'dist')

# Debug: print paths
print(f"SPECPATH: {SPECPATH}")
print(f"SPEC_DIR: {SPEC_DIR}")
print(f"PROJECT_ROOT: {PROJECT_ROOT}")
print(f"DIST_DIR: {DIST_DIR}")
print(f"DIST exists: {os.path.exists(DIST_DIR)}")

block_cipher = None

a = Analysis(
    ['booky_launcher.py'],
    pathex=[SPEC_DIR],
    binaries=[],
    datas=[
        # Include the built React app
        (DIST_DIR, 'dist'),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# Use directory mode (onedir) - less likely to trigger antivirus
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Booky',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Set to True for debugging
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(PROJECT_ROOT, 'public', 'favicon.ico') if os.path.exists(os.path.join(PROJECT_ROOT, 'public', 'favicon.ico')) else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Booky',
)
