@echo off
REM Script per deployare su staging in modo rapido
REM Autore: Claude Code
REM Data: 21 Ottobre 2025

echo.
echo ================================
echo   DEPLOY TO STAGING
echo ================================
echo.

REM Vai su branch staging
echo [1/5] Switching to staging branch...
git checkout staging
if %errorlevel% neq 0 (
    echo ERROR: Failed to switch to staging branch
    pause
    exit /b 1
)

REM Pull delle ultime modifiche
echo.
echo [2/5] Pulling latest changes...
git pull origin staging
if %errorlevel% neq 0 (
    echo ERROR: Failed to pull from staging
    pause
    exit /b 1
)

REM Mostra lo stato
echo.
echo [3/5] Current status:
git status

REM Chiedi conferma
echo.
echo [4/5] Do you want to commit and push? (Y/N)
set /p confirm=
if /i not "%confirm%"=="Y" (
    echo Deployment cancelled.
    pause
    exit /b 0
)

REM Commit
echo.
set /p message="Enter commit message: "
git add .
git commit -m "%message%"

REM Push
echo.
echo [5/5] Pushing to staging...
git push origin staging
if %errorlevel% neq 0 (
    echo ERROR: Failed to push to staging
    pause
    exit /b 1
)

echo.
echo ================================
echo   SUCCESS!
echo ================================
echo.
echo Vercel is deploying your changes...
echo Check: https://app-hub-platform-git-staging-teo-lapas-projects.vercel.app
echo.

REM Aspetta 5 secondi
timeout /t 5

REM Mostra i deployment
echo Checking Vercel deployments...
npx vercel ls

echo.
pause
