/**
 * Migra i dati stats dal vecchio formato (string JSON) al nuovo formato (lista Redis)
 */

import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function POST() {
  try {
    const today = getTodayKey();
    const requestsKey = `lapa_stats:requests:${today}`;

    // Controlla il tipo della chiave
    const keyType = await kv.type(requestsKey);

    if (keyType === 'none') {
      return NextResponse.json({
        success: true,
        message: 'No data to migrate',
        keyType
      });
    }

    if (keyType === 'list') {
      return NextResponse.json({
        success: true,
        message: 'Data already in list format',
        keyType
      });
    }

    if (keyType === 'string') {
      // Leggi i dati dal vecchio formato
      const oldData = await kv.get<any[]>(requestsKey);

      if (!oldData || !Array.isArray(oldData)) {
        return NextResponse.json({
          success: false,
          message: 'Could not read old data',
          keyType
        });
      }

      // Cancella la vecchia chiave
      await kv.del(requestsKey);

      // Reinserisci i dati nel nuovo formato lista
      for (const record of oldData) {
        await kv.rpush(requestsKey, JSON.stringify(record));
      }

      // Imposta TTL
      await kv.expire(requestsKey, 86400 * 7);

      return NextResponse.json({
        success: true,
        message: `Migrated ${oldData.length} records from string to list format`,
        recordCount: oldData.length
      });
    }

    return NextResponse.json({
      success: false,
      message: `Unexpected key type: ${keyType}`,
      keyType
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
