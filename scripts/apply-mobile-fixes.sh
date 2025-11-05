#!/bin/bash

# Script per applicare fix mobile/tablet a tutte le pagine Maestro AI
# Questo script usa sed per applicare le modifiche in batch

echo "🚀 Applicando fix mobile/tablet alle pagine Maestro AI..."

# Fix 1: KPI Grid - Dashboard principale
echo "📱 Fix 1: Grid KPI Dashboard..."
sed -i 's/grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4/grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4/g' app/maestro-ai/page.tsx

# Fix 2: Scroll heights responsivi - Performers List
echo "📱 Fix 2: Scroll heights responsivi..."
sed -i 's/max-h-\[400px\]/max-h-[250px] sm:max-h-[350px] md:max-h-[400px]/g' app/maestro-ai/page.tsx

# Fix 3: Touch targets - Churn alerts
echo "📱 Fix 3: Touch targets churn alerts..."
sed -i 's/\(<div className="p-4 bg-red-500\/5 border border-red-500\/20 rounded-lg hover:bg-red-500\/10 transition-colors cursor-pointer"\)/\1 min-h-[44px] flex flex-col justify-center/g' app/maestro-ai/page.tsx

# Fix 4: Daily Plan - Back button
echo "📱 Fix 4: Daily Plan back button..."
sed -i 's/mb-4 flex items-center gap-2 px-4 py-2/mb-4 flex items-center gap-2 px-4 py-2.5 min-h-[44px]/g' app/maestro-ai/daily-plan/page.tsx

# Fix 5: Daily Plan - Stats grid
echo "📱 Fix 5: Daily Plan stats grid..."
sed -i 's/grid grid-cols-1 md:grid-cols-4/grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4/g' app/maestro-ai/daily-plan/page.tsx

# Fix 6: Daily Plan - Padding
echo "📱 Fix 6: Daily Plan padding..."
sed -i 's/from-slate-900 via-slate-800 to-slate-900 p-6/from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6/g' app/maestro-ai/daily-plan/page.tsx

# Fix 7: Customer detail - Action buttons
echo "📱 Fix 7: Customer detail action buttons..."
sed -i 's/px-4 py-2 bg-blue-600/px-4 py-2.5 min-h-[44px] flex items-center justify-center bg-blue-600/g' app/maestro-ai/customers/\[id\]/page.tsx
sed -i 's/px-4 py-2 bg-green-600/px-4 py-2.5 min-h-[44px] flex items-center justify-center bg-green-600/g' app/maestro-ai/customers/\[id\]/page.tsx

# Fix 8: Customer detail - Grids
echo "📱 Fix 8: Customer detail grids..."
sed -i 's/grid grid-cols-2 md:grid-cols-4 gap-4/grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4/g' app/maestro-ai/customers/\[id\]/page.tsx

# Fix 9: Analytics pages - Grid breakpoints
echo "📱 Fix 9: Analytics grid breakpoints..."
for file in app/maestro-ai/analytics/*/page.tsx; do
  sed -i 's/grid grid-cols-2 sm:grid-cols-4/grid grid-cols-2 md:grid-cols-4/g' "$file"
  sed -i 's/grid grid-cols-1 sm:grid-cols-3/grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3/g' "$file"
  sed -i 's/grid grid-cols-1 md:grid-cols-3/grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3/g' "$file"
  sed -i 's/grid grid-cols-1 lg:grid-cols-2/grid grid-cols-1 md:grid-cols-2/g' "$file"
done

# Fix 10: Analytics - Scroll heights
echo "📱 Fix 10: Analytics scroll heights..."
for file in app/maestro-ai/analytics/*/page.tsx; do
  sed -i 's/max-h-\[500px\]/max-h-[350px] sm:max-h-[450px] md:max-h-[500px]/g' "$file"
  sed -i 's/max-h-\[600px\]/max-h-[400px] sm:max-h-[500px] md:max-h-[600px]/g' "$file"
done

echo "✅ Fix mobile/tablet applicati con successo!"
echo "📝 Ricordati di testare su device reali o Chrome DevTools"
