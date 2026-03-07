# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Booky Desktop Application
Run with: pyinstaller booky.spec
"""

import os
import sys

# Get the project root directory
SPEC_DIR = os.path.dirname(os.path.abspath(SPECPATH))
PROJECT_ROOT = os.path.dirname(SPEC_DIR)
DIST_DIR = os.path.join(PROJECT_ROOT, 'dist')

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

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
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
