; Booky Installer Script for Inno Setup
; Website: https://jrsoftware.org/isinfo.php
; Download Inno Setup: https://jrsoftware.org/isdl.php

#define MyAppName "Booky"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Booky Team"
#define MyAppURL "https://github.com/programming2055/Booky"
#define MyAppExeName "Booky.exe"

[Setup]
; NOTE: The value of AppId uniquely identifies this application.
; Do not use the same AppId value in installers for other applications.
AppId={{8A9E7B3C-5D4F-4E2A-9B1C-7F8E6D5C4B3A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
; Output settings
OutputDir=output
OutputBaseFilename=BookySetup-{#MyAppVersion}
; Compression
Compression=lzma2
SolidCompression=yes
; Visual settings
WizardStyle=modern
; Require admin for Program Files installation
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
; Windows version requirement
MinVersion=10.0
; Uninstall settings
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode

[Files]
; Main executable (built with PyInstaller)
Source: "dist\Booky.exe"; DestDir: "{app}"; Flags: ignoreversion

; Application icon (if exists)
Source: "..\public\favicon.ico"; DestDir: "{app}"; Flags: ignoreversion; Check: FileExists(ExpandConstant('{src}\..\public\favicon.ico'))

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Registry]
; Associate .epub files (optional)
Root: HKCR; Subkey: ".epub"; ValueType: string; ValueName: ""; ValueData: "BookyEpubFile"; Flags: uninsdeletevalue; Tasks: ; Check: False
Root: HKCR; Subkey: "BookyEpubFile"; ValueType: string; ValueName: ""; ValueData: "EPUB Ebook"; Flags: uninsdeletekey; Tasks: ; Check: False
Root: HKCR; Subkey: "BookyEpubFile\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: ; Check: False

[Code]
function FileExists(FileName: String): Boolean;
begin
  Result := FileExists(FileName);
end;

procedure InitializeWizard();
begin
  // Custom initialization if needed
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  // Add any setup initialization checks here
end;
