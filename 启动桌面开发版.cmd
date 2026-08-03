@echo off
setlocal
set "CODEX_NODE=C:\Users\02\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "CODEX_BIN=C:\Users\02\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback"
set "PATH=%CODEX_NODE%;%CODEX_BIN%;%PATH%"
cd /d "%~dp0app"
if errorlevel 1 goto :failed
echo Starting Sale Manager desktop development mode...
echo Keep this window open while using the application.
echo.
call "%CODEX_BIN%\pnpm.cmd" desktop:dev
echo.
echo The development process has stopped. Exit code: %errorlevel%
pause
exit /b

:failed
echo Failed to open the app directory:
echo %~dp0app
pause
