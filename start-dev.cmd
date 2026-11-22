@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>&1
if not errorlevel 1 (
  call npm.cmd run dev
  goto :done
)

if exist "%ProgramFiles%\nodejs\npm.cmd" (
  call "%ProgramFiles%\nodejs\npm.cmd" run dev
  goto :done
)

echo Node.js/npm was not found on this computer.
echo Install Node.js, then double-click this file again.
:done
pause
