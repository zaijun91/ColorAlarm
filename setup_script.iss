; -- Inno Setup Script for Color Alarm --

[Setup]
AppName=颜色监控报警器
AppVersion=1.0
AppPublisher=Mr. Yang's Lab
DefaultDirName={autopf}\ColorAlarm
DefaultGroupName=颜色监控报警器
OutputDir=Output
OutputBaseFilename=ColorAlarmSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\ColorAlarm.exe

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"

[Files]
Source: "dist\ColorAlarm.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\颜色监控报警器"; Filename: "{app}\ColorAlarm.exe"
Name: "{autodesktop}\颜色监控报警器"; Filename: "{app}\ColorAlarm.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\ColorAlarm.exe"; Description: "{cm:LaunchProgram,颜色监控报警器}"; Flags: nowait postinstall skipifsilent
