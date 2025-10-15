import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Leggi i dati REALI dall'analisi
    const dataPath = path.join(process.cwd(), 'lib', 'smart-ordering', 'real-analysis-data.json');

    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({
        success: false,
        error: 'Dati non trovati. Esegui prima: node scripts/analyze-real-sales.js'
      });
    }

    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const analysisData = JSON.parse(rawData);

    // Raggruppa prodotti per fornitore
    const supplierMap = new Map();

    analysisData.products.forEach((product: any) => {
      if (!product.supplier) return;

      const supplierId = product.supplier.id;

      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, {
          id: supplierId,
          name: product.supplier.name,
          leadTime: product.supplier.leadTime,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          totalProducts: 0,
          totalKg: 0,
          totalPz: 0,
          estimatedValue: 0,
          products: []
        });
      }

      const supplier = supplierMap.get(supplierId);

      // Conta per livello di urgenza
      if (product.urgencyLevel === 'CRITICAL') supplier.criticalCount++;
      if (product.urgencyLevel === 'HIGH') supplier.highCount++;
      if (product.urgencyLevel === 'MEDIUM') supplier.mediumCount++;
      if (product.urgencyLevel === 'LOW') supplier.lowCount++;

      supplier.totalProducts++;

      // Calcola quantità suggerita (per coprire lead time + safety stock)
      const leadTimeDemand = product.avgDailySales * product.leadTime;
      const safetyStock = product.avgDailySales * 7; // 1 settimana di safety
      const suggestedQty = Math.ceil(leadTimeDemand + safetyStock - product.currentStock);

      // Solo se il prodotto è critico o alto
      if (['CRITICAL', 'HIGH'].includes(product.urgencyLevel) && suggestedQty > 0) {
        // Conta KG vs PZ
        if (product.uom.toLowerCase().includes('kg') || product.uom.toLowerCase().includes('kilo')) {
          supplier.totalKg += suggestedQty;
        } else {
          supplier.totalPz += suggestedQty;
        }

        // Stima valore (prezzo medio * quantità)
        supplier.estimatedValue += (product.avgPrice || product.listPrice || 10) * suggestedQty;
      }

      // Aggiungi prodotto alla lista
      supplier.products.push({
        id: product.id,
        name: product.name,
        currentStock: product.currentStock,
        avgDailySales: product.avgDailySales,
        daysRemaining: product.daysRemaining,
        urgencyLevel: product.urgencyLevel,
        totalSold3Months: product.totalSold3Months,
        suggestedQty: Math.max(0, suggestedQty),
        uom: product.uom,
        avgPrice: product.avgPrice,
        listPrice: product.listPrice,
        supplier: {
          name: product.supplier.name,
          leadTime: product.supplier.leadTime
        }
      });
    });

    // Converti in array e ordina per priorità (più critici prima)
    const suppliers = Array.from(supplierMap.values());
    suppliers.sort((a, b) => {
      // Prima ordina per critici
      if (a.criticalCount !== b.criticalCount) {
        return b.criticalCount - a.criticalCount;
      }
      // Poi per alti
      if (a.highCount !== b.highCount) {
        return b.highCount - a.highCount;
      }
      // Poi per valore
      return b.estimatedValue - a.estimatedValue;
    });

    // Filtra solo fornitori con prodotti critici o alti
    const urgentSuppliers = suppliers.filter(s =>
      s.criticalCount > 0 || s.highCount > 0
    );

    return NextResponse.json({
      success: true,
      analyzedAt: analysisData.analyzedAt,
      period: {
        from: analysisData.periodFrom,
        to: analysisData.periodTo
      },
      totalSuppliers: suppliers.length,
      urgentSuppliers: urgentSuppliers.length,
      suppliers: urgentSuppliers,
      summary: {
        totalCritical: suppliers.reduce((sum, s) => sum + s.criticalCount, 0),
        totalHigh: suppliers.reduce((sum, s) => sum + s.highCount, 0),
        totalEstimatedValue: suppliers.reduce((sum, s) => sum + s.estimatedValue, 0)
      }
    });

  } catch (error: any) {
    console.error('❌ Errore API suppliers:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
