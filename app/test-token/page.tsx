'use client';

import { useEffect, useState } from 'react';

export default function TestTokenPage() {
  const [tokenData, setTokenData] = useState<any>(null);

  useEffect(() => {
    // Leggi i cookie
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(c => c.trim().startsWith('token='));

    if (tokenCookie) {
      const token = tokenCookie.split('=')[1];

      try {
        // Decode JWT (solo payload, non verifichiamo la signature)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          setTokenData(payload);
          console.log('🔐 TOKEN PAYLOAD:', payload);
        }
      } catch (error) {
        console.error('Errore decode token:', error);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">🔐 Test Token JWT</h1>

        {tokenData ? (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-600">
            <h2 className="text-xl font-semibold text-emerald-400 mb-4">Dati nel Token:</h2>
            <pre className="bg-slate-900 p-4 rounded-lg overflow-auto text-sm text-slate-300">
{JSON.stringify(tokenData, null, 2)}
            </pre>

            <div className="mt-6 space-y-3">
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="text-slate-400 text-sm">userId</div>
                <div className="text-white font-mono">{tokenData.userId || 'N/A'}</div>
              </div>

              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="text-slate-400 text-sm">email</div>
                <div className="text-white font-mono">{tokenData.email || 'N/A'}</div>
              </div>

              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="text-slate-400 text-sm">role</div>
                <div className="text-white font-mono">{tokenData.role || 'N/A'}</div>
              </div>

              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="text-slate-400 text-sm">odooUserId</div>
                <div className="text-white font-mono">{tokenData.odooUserId || 'N/A'}</div>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="text-emerald-400 text-sm font-semibold mb-2">Tutte le chiavi nel token:</div>
                <div className="text-white font-mono text-xs">
                  {Object.keys(tokenData).join(', ')}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 text-slate-400">
            Nessun token trovato. Fai login prima!
          </div>
        )}
      </div>
    </div>
  );
}
