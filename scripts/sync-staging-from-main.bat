@echo off
REM Script per sincronizzare staging con main (dopo un hotfix)
REM Autore: Claude Code
REM Data: 21 Ottobre 2025

echo.
echo ================================
echo   SYNC STAGING FROM MAIN
echo ================================
echo.
echo This will merge main into staging
echo Use this after a hotfix has been merged to main
echo.

REM Chiedi conferma
set /p confirm="Continue? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo Operation cancelled.
    pause
    exit /b 0
)

REM Vai su main e pull
echo.
echo [1/4] Updating main...
git checkout main
if %errorlevel% neq 0 (
    echo ERROR: Failed to checkout main
    pause
    exit /b 1
)

git pull origin main
if %errorlevel% neq 0 (
    echo ERROR: Failed to pull main
    pause
    exit /b 1
)

REM Vai su staging
echo.
echo [2/4] Switching to staging...
git checkout staging
if %errorlevel% neq 0 (
    echo ERROR: Failed to checkout staging
    pause
    exit /b 1
)

git pull origin staging
if %errorlevel% neq 0 (
    echo ERROR: Failed to pull staging
    pause
    exit /b 1
)

REM Merge main in staging
echo.
echo [3/4] Merging main into staging...
git merge main
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Merge conflict detected!
    echo Please resolve conflicts manually, then:
    echo   git add .
    echo   git commit
    echo   git push origin staging
    pause
    exit /b 1
)

REM Push
echo.
echo [4/4] Pushing to staging...
git push origin staging
if %errorlevel% neq 0 (
    echo ERROR: Failed to push staging
    pause
    exit /b 1
)

echo.
echo ================================
echo   SUCCESS!
echo ================================
echo.
echo Staging is now in sync with main
echo Vercel is deploying the updated staging...
echo.

pause
