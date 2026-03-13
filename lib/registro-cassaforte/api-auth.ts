/**
 * API Authentication for Registro Cassaforte
 *
 * Since the app runs on an internal tablet, we use a simple API key
 * approach rather than requiring user login on the tablet.
 * The key is set via env var and sent as a header from the frontend.
 */

import { NextRequest, NextResponse } from 'next/server';

const CASSAFORTE_API_KEY = process.env.CASSAFORTE_API_KEY || '';

/**
 * Verify the request is authorized.
 * If CASSAFORTE_API_KEY is not set, all requests pass (dev mode).
 * In production, the frontend sends the key as X-Cassaforte-Key header.
 */
export function verifyCassaforteAuth(request: NextRequest): NextResponse | null {
  // If no API key configured, skip auth (dev/backward compat)
  if (!CASSAFORTE_API_KEY) return null;

  const key = request.headers.get('x-cassaforte-key');
  if (key === CASSAFORTE_API_KEY) return null;

  return NextResponse.json(
    { success: false, error: 'Non autorizzato' },
    { status: 401 }
  );
}

/**
 * Get the configured Cash Journal ID from env
 */
export function getCashJournalId(): number {
  const id = parseInt(process.env.CASSAFORTE_CASH_JOURNAL_ID || '8', 10);
  if (isNaN(id)) return 8;
  return id;
}
