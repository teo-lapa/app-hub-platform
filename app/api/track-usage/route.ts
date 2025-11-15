import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import jwt from 'jsonwebtoken';

/**
 * API LEGGERA per tracking utilizzo app
 * NON blocca l'apertura delle app - Fire and forget
 */

export const runtime = 'edge'; // Edge runtime per performance ottimali

interface UsageEvent {
  userId: string;
  userName: string;
  userEmail: string;
  appId: string;
  appName: string;
  timestamp: number;
  sessionId: string;
  action: 'open' | 'close';
  duration?: number; // Solo per action: 'close'
}

export async function POST(request: NextRequest) {
  try {
    // Recupera token utente (non blocca se manca, usa "anonymous")
    const token = request.cookies.get('token')?.value;
    let userId = 'anonymous';
    let userName = 'Utente Anonimo';
    let userEmail = 'anonymous@app.local';

    if (token) {
      try {
        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, jwtSecret) as any;
        if (decoded) {
          userId = decoded.id || decoded.email || 'anonymous';
          userName = decoded.name || decoded.email || 'Utente';
          userEmail = decoded.email || 'unknown@app.local';
        }
      } catch {
        // Ignora errori di decodifica, usa anonymous
      }
    }

    const body = await request.json();
    const { appId, appName, action, sessionId, duration } = body;

    if (!appId || !action) {
      return NextResponse.json({
        success: false,
        error: 'appId e action sono richiesti'
      }, { status: 400 });
    }

    const event: UsageEvent = {
      userId,
      userName,
      userEmail,
      appId,
      appName: appName || appId,
      timestamp: Date.now(),
      sessionId: sessionId || `${userId}-${appId}-${Date.now()}`,
      action,
      duration: action === 'close' ? duration : undefined,
    };

    // Salva in KV con chiave temporale per facile query
    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const eventKey = `usage:${dateKey}:${event.sessionId}:${event.timestamp}`;

    // Salva evento (TTL: 90 giorni)
    await kv.set(eventKey, event, { ex: 90 * 24 * 60 * 60 });

    // Aggiorna contatore giornaliero per l'app
    const counterKey = `usage_counter:${dateKey}:${appId}`;
    await kv.incr(counterKey);
    await kv.expire(counterKey, 90 * 24 * 60 * 60);

    // Aggiorna lista utenti unici per l'app oggi
    const usersKey = `usage_users:${dateKey}:${appId}`;
    await kv.sadd(usersKey, userId);
    await kv.expire(usersKey, 90 * 24 * 60 * 60);

    // Se è una chiusura con durata, salva anche la durata totale
    if (action === 'close' && duration) {
      const durationKey = `usage_duration:${dateKey}:${appId}`;
      await kv.incrby(durationKey, Math.round(duration / 1000)); // Salva in secondi
      await kv.expire(durationKey, 90 * 24 * 60 * 60);
    }

    return NextResponse.json({
      success: true,
      message: 'Evento registrato',
      eventKey,
    });

  } catch (error) {
    console.error('[TRACK-USAGE] Errore:', error);
    // IMPORTANTE: Ritorna sempre 200 per non bloccare l'app
    return NextResponse.json({
      success: false,
      error: 'Errore nel tracking (non bloccante)'
    }, { status: 200 });
  }
}
