# LAPA Sales Analysis - Quick Commands

## Run Analysis

```bash
# Execute the analysis script
node scripts/analyze-sales-data.js

# Save output to file
node scripts/analyze-sales-data.js > output.txt

# Save output with timestamp
node scripts/analyze-sales-data.js > "analysis-$(date +%Y%m%d-%H%M%S).txt"
```

## View Files

```bash
# View the main report
cat LAPA_SALES_ANALYSIS_REPORT.md

# View README
cat SALES_ANALYSIS_README.md

# View implementation guide
cat DASHBOARD_IMPLEMENTATION_GUIDE.md

# View JSON data
cat sales-analysis-data.json | jq '.'

# View critical products only
cat sales-analysis-data.json | jq '.critical_alerts.critical'
```

## File Locations

```bash
# All analysis files
ls -lh *SALES* *DASHBOARD* sales-analysis*

# Script location
ls -lh scripts/analyze-sales-data.js

# Check file sizes
du -h LAPA_SALES_ANALYSIS_REPORT.md DASHBOARD_IMPLEMENTATION_GUIDE.md sales-analysis-data.json
```

## Update Analysis (Daily)

```bash
# Manual update
cd /path/to/app-hub-platform
node scripts/analyze-sales-data.js > sales-analysis-report.txt

# With timestamp
node scripts/analyze-sales-data.js > "logs/analysis-$(date +%Y%m%d).txt"
```

## Setup Cron Job (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add this line to run daily at 6 AM
0 6 * * * cd /path/to/app-hub-platform && node scripts/analyze-sales-data.js > logs/analysis-$(date +\%Y\%m\%d).txt 2>&1
```

## Windows Task Scheduler

```powershell
# Create a batch file: run-analysis.bat
@echo off
cd C:\Users\lapa\Desktop\Claude Code\app-hub-platform
node scripts/analyze-sales-data.js > logs\analysis-%date:~-4,4%%date:~-10,2%%date:~-7,2%.txt
```

Then schedule it in Task Scheduler:
- Open Task Scheduler
- Create Basic Task
- Name: "LAPA Sales Analysis Daily"
- Trigger: Daily at 6:00 AM
- Action: Start a program
- Program: C:\path\to\run-analysis.bat

## Quick Checks

```bash
# Check critical products count
grep "CRITICAL PRODUCTS" sales-analysis-report.txt -A 20

# Check out of stock products
grep "OUT OF STOCK" sales-analysis-report.txt

# Check top 10 products
grep "TOP 30 PRODUCTS" sales-analysis-report.txt -A 15 | head -20

# View summary
grep "SUMMARY:" sales-analysis-report.txt -A 10
```

## Troubleshooting

```bash
# Test Odoo connection
node -e "fetch('https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com').then(() => console.log('✓ Odoo reachable')).catch(() => console.log('✗ Cannot reach Odoo'))"

# Check Node.js version (should be v14+)
node --version

# Check if script is valid JavaScript
node --check scripts/analyze-sales-data.js

# Run with debug output
NODE_DEBUG=* node scripts/analyze-sales-data.js
```

## API Testing (once implemented)

```bash
# Test critical products endpoint
curl http://localhost:3004/api/inventory/critical | jq '.'

# Test top movers
curl http://localhost:3004/api/inventory/top-movers?limit=10 | jq '.'

# Test patterns
curl http://localhost:3004/api/inventory/patterns/weekly | jq '.'

# Test suggestions
curl -X POST http://localhost:3004/api/inventory/suggestions \
  -H "Content-Type: application/json" \
  -d '{"product_id": 123}' | jq '.'
```

## Development Server

```bash
# Start Next.js dev server
npm run dev

# Access dashboard (once implemented)
open http://localhost:3004/apps/food-dashboard

# Build for production
npm run build

# Start production server
npm start
```

## Git Commands

```bash
# Add analysis files to git
git add LAPA_SALES_ANALYSIS_REPORT.md
git add DASHBOARD_IMPLEMENTATION_GUIDE.md
git add SALES_ANALYSIS_README.md
git add sales-analysis-data.json
git add scripts/analyze-sales-data.js

# Commit
git commit -m "Add complete sales analysis and dashboard implementation guide"

# Push
git push origin main
```

## Backup

```bash
# Backup all analysis files
tar -czf lapa-sales-analysis-backup-$(date +%Y%m%d).tar.gz \
  LAPA_SALES_ANALYSIS_REPORT.md \
  DASHBOARD_IMPLEMENTATION_GUIDE.md \
  SALES_ANALYSIS_README.md \
  sales-analysis-data.json \
  sales-analysis-report.txt \
  scripts/analyze-sales-data.js

# Extract backup
tar -xzf lapa-sales-analysis-backup-20251015.tar.gz
```

## Quick Stats

```bash
# Count total products analyzed
grep "Unique products found:" sales-analysis-report.txt

# Count critical products
grep "Critical products" sales-analysis-report.txt

# Count warning products
grep "Products to order soon" sales-analysis-report.txt

# Show top 5 products
grep "TOP 30 PRODUCTS" sales-analysis-report.txt -A 10 | head -15
```

## Performance

```bash
# Time the analysis
time node scripts/analyze-sales-data.js

# Memory usage
/usr/bin/time -v node scripts/analyze-sales-data.js 2>&1 | grep "Maximum resident"

# Profile (Node.js)
node --prof scripts/analyze-sales-data.js
node --prof-process isolate-*.log > profile.txt
```

## File Sizes

```bash
# Check all analysis files
ls -lh LAPA_SALES_ANALYSIS_REPORT.md DASHBOARD_IMPLEMENTATION_GUIDE.md sales-analysis-data.json sales-analysis-report.txt scripts/analyze-sales-data.js | awk '{print $9, $5}'

# Total size
du -ch LAPA_SALES_ANALYSIS_REPORT.md DASHBOARD_IMPLEMENTATION_GUIDE.md sales-analysis-data.json sales-analysis-report.txt scripts/analyze-sales-data.js | grep total
```

## Common Issues

### "Cannot find module"
```bash
# Check Node.js installation
which node
node --version

# Ensure you're in the right directory
pwd
# Should be: .../app-hub-platform
```

### "Authentication failed"
```bash
# Check .env.local file exists
ls -la .env.local

# Check Odoo credentials
grep ODOO .env.local
```

### "No sales data found"
```bash
# Check date range in script (line ~151)
grep "daysBack" scripts/analyze-sales-data.js

# Try with fewer days
# Edit script: const salesLines = await getSalesData(30);
```

## Useful Aliases (add to ~/.bashrc or ~/.zshrc)

```bash
alias lapa-analyze='cd ~/path/to/app-hub-platform && node scripts/analyze-sales-data.js'
alias lapa-view='cat ~/path/to/app-hub-platform/LAPA_SALES_ANALYSIS_REPORT.md | less'
alias lapa-critical='cat ~/path/to/app-hub-platform/sales-analysis-data.json | jq .critical_alerts.critical'
alias lapa-top='cat ~/path/to/app-hub-platform/sales-analysis-data.json | jq .top_products'
```

## Environment Variables

```bash
# Check Odoo config
echo $ODOO_URL
echo $ODOO_DB

# If not set, load from .env.local
export $(cat .env.local | grep ODOO | xargs)
```

## Documentation

```bash
# Generate PDF from markdown (requires pandoc)
pandoc LAPA_SALES_ANALYSIS_REPORT.md -o LAPA_SALES_ANALYSIS_REPORT.pdf

# Generate HTML
pandoc LAPA_SALES_ANALYSIS_REPORT.md -o LAPA_SALES_ANALYSIS_REPORT.html -s --toc

# Count words in report
wc -w LAPA_SALES_ANALYSIS_REPORT.md
```

---

**Last Updated:** 15 October 2025
