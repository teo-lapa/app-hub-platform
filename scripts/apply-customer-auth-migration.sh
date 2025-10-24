#!/bin/bash

# Apply Customer Authentication System Migration
# This script creates the customer_users table and seeds test data

set -e  # Exit on error

echo "========================================"
echo "Customer Auth Migration Script"
echo "========================================"
echo ""

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep POSTGRES_URL | xargs)
    echo "✅ Loaded POSTGRES_URL from .env.local"
else
    echo "❌ Error: .env.local not found"
    exit 1
fi

if [ -z "$POSTGRES_URL" ]; then
    echo "❌ Error: POSTGRES_URL not set"
    exit 1
fi

echo ""
echo "Database: ${POSTGRES_URL%%\?*}"  # Print URL without query params
echo ""

# Step 1: Create customer_users table
echo "Step 1: Creating customer_users table..."
psql "$POSTGRES_URL" -f database/migrations/002_customer_users.sql

if [ $? -eq 0 ]; then
    echo "✅ Table created successfully"
else
    echo "❌ Error creating table"
    exit 1
fi

echo ""

# Step 2: Seed test data
echo "Step 2: Seeding test data..."
echo "⚠️  This will insert 5 test users with password 'Test1234'"
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    psql "$POSTGRES_URL" -f database/seeds/001_customer_users_seed.sql

    if [ $? -eq 0 ]; then
        echo "✅ Test data seeded successfully"
    else
        echo "❌ Error seeding data"
        exit 1
    fi
else
    echo "⏭️  Skipping seed data"
fi

echo ""

# Step 3: Verify installation
echo "Step 3: Verifying installation..."
echo ""
psql "$POSTGRES_URL" -c "SELECT id, email, name, role, is_active, created_at FROM customer_users ORDER BY created_at DESC;"

echo ""
echo "========================================"
echo "✅ Migration completed successfully!"
echo "========================================"
echo ""
echo "Test users created:"
echo "  - giuseppe.verdi@bellavista.it (cliente_premium)"
echo "  - marco.rossi@pizzeriamarco.it (cliente_premium)"
echo "  - anna.bianchi@trattoriatoscana.it (cliente_premium)"
echo "  - info@barcentrale.it (cliente_gratuito)"
echo "  - test.disabled@example.com (DISABLED)"
echo ""
echo "Password for all: Test1234"
echo ""
echo "Next steps:"
echo "  1. Update customer_id values with real Odoo partner IDs"
echo "  2. Run: node test-customer-auth.js"
echo "  3. Test login: POST /api/auth/login-cliente"
echo ""
