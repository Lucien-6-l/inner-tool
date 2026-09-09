@echo off
rem ============================================================
rem  inner-tool daily backup
rem  copy backend/prisma/dev.db and backend/uploads -> backup\YYYYMMDD\
rem  auto-clean backups older than 14 days
rem  triggered daily by scheduled task: inner-tool-daily-backup
rem ============================================================
setlocal
cd /d "%~dp0"

set "PS=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
set "XCOPY=C:\Windows\System32\xcopy.exe"
set "STAMPFILE=%TEMP%\inner_tool_backup_stamp.tmp"

"%PS%" -NoProfile -Command "Get-Date -Format yyyyMMdd" > "%STAMPFILE%"
set /p STAMP=<"%STAMPFILE%"
del "%STAMPFILE%" >nul 2>&1

set "DEST=%~dp0backup\%STAMP%"
set "DB_SRC=%~dp0backend\prisma\dev.db"
set "UP_SRC=%~dp0backend\uploads"

if not exist "%DB_SRC%" (
  echo [backup] dev.db not found, skip database backup
) else (
  if not exist "%DEST%" mkdir "%DEST%"
  copy /y "%DB_SRC%" "%DEST%\dev.db" >nul
  echo [backup] database copied -^> %DEST%\dev.db
)

if exist "%UP_SRC%" (
  if not exist "%DEST%" mkdir "%DEST%"
  "%XCOPY%" /e /i /y /q "%UP_SRC%" "%DEST%\uploads" >nul
  echo [backup] uploads copied -^> %DEST%\uploads
) else (
  echo [backup] uploads not found, skip
)

if exist "%~dp0backup" (
  "%PS%" -NoProfile -Command "Get-ChildItem -Path '%~dp0backup' -Directory | Where-Object { $_.Name -match '^\d{8}$' -and $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item -Recurse -Force"
  echo [backup] old backups cleaned
)

echo [backup] done: %DEST%
endlocal
