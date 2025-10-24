@echo off
REM Apply Customer Authentication System Migration (Windows)
REM This script creates the customer_users table and seeds test data

setlocal enabledelayedexpansion

echo ========================================
echo Customer Auth Migration Script (Windows)
echo ========================================
echo.

REM Load environment variables from .env.local
if exist .env.local (
    for /f "tokens=1,2 delims==" %%a in (.env.local) do (
        if "%%a"=="POSTGRES_URL" set POSTGRES_URL=%%b
    )
    echo ✅ Loaded POSTGRES_URL from .env.local
) else (
    echo ❌ Error: .env.local not found
    exit /b 1
)

if "%POSTGRES_URL%"=="" (
    echo ❌ Error: POSTGRES_URL not set
    exit /b 1
)

echo.
echo Database: %POSTGRES_URL%
echo.

REM Step 1: Create customer_users table
echo Step 1: Creating customer_users table...
psql "%POSTGRES_URL%" -f database\migrations\002_customer_users.sql

if %errorlevel% neq 0 (
    echo ❌ Error creating table
    exit /b 1
)

echo ✅ Table created successfully
echo.

REM Step 2: Seed test data
echo Step 2: Seeding test data...
echo ⚠️  This will insert 5 test users with password 'Test1234'
set /p confirm="Continue? (y/n): "

if /i "%confirm%"=="y" (
    psql "%POSTGRES_URL%" -f database\seeds\001_customer_users_seed.sql

    if %errorlevel% neq 0 (
        echo ❌ Error seeding data
        exit /b 1
    )

    echo ✅ Test data seeded successfully
) else (
    echo ⏭️  Skipping seed data
)

echo.

REM Step 3: Verify installation
echo Step 3: Verifying installation...
echo.
psql "%POSTGRES_URL%" -c "SELECT id, email, name, role, is_active, created_at FROM customer_users ORDER BY created_at DESC;"

echo.
echo ========================================
echo ✅ Migration completed successfully!
echo ========================================
echo.
echo Test users created:
echo   - giuseppe.verdi@bellavista.it (cliente_premium)
echo   - marco.rossi@pizzeriamarco.it (cliente_premium)
echo   - anna.bianchi@trattoriatoscana.it (cliente_premium)
echo   - info@barcentrale.it (cliente_gratuito)
echo   - test.disabled@example.com (DISABLED)
echo.
echo Password for all: Test1234
echo.
echo Next steps:
echo   1. Update customer_id values with real Odoo partner IDs
echo   2. Run: node test-customer-auth.js
echo   3. Test login: POST /api/auth/login-cliente
echo.

endlocal
