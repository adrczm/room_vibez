@echo off
rem Windows: double-click to start the viewer and open it in your default browser.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Install the LTS version from https://nodejs.org & pause & exit /b 1)
if not exist node_modules (echo First run: installing dependencies... & call npm install || (pause & exit /b 1))
start "" cmd /c "timeout /t 4 >nul & start http://127.0.0.1:18777/"
echo Starting viewer at http://127.0.0.1:18777/ - close this window to stop it.
call npm run dev
