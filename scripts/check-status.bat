@echo off
REM Script per controllare lo stato del progetto
REM Autore: Claude Code
REM Data: 21 Ottobre 2025

echo.
echo ================================
echo   PROJECT STATUS CHECK
echo ================================
echo.

REM Branch corrente
echo [GIT] Current branch:
git branch --show-current
echo.

REM Stato Git
echo [GIT] Repository status:
git status -s
echo.

REM Commit non pushati
echo [GIT] Unpushed commits on current branch:
git log @{u}.. --oneline 2>nul
if %errorlevel% neq 0 (
    echo No remote tracking branch set
)
echo.

REM Differenze staging vs main
echo [GIT] Commits in staging not in main:
git log main..staging --oneline 2>nul
if %errorlevel% neq 0 (
    echo Unable to compare (check if you're on the right branch)
)
echo.

REM Vercel deployments
echo [VERCEL] Recent deployments:
npx vercel ls 2>nul | head -10
echo.

echo ================================
echo   ENVIRONMENT URLs
echo ================================
echo.
echo PRODUCTION:  https://hub.lapa.ch
echo STAGING:     https://app-hub-platform-git-staging-teo-lapas-projects.vercel.app
echo VERCEL DASH: https://vercel.com/teo-lapas-projects
echo.

pause
