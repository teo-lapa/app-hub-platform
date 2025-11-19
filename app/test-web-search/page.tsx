'use client';

import { useState } from 'react';

export default function TestWebSearchPage() {
  const [companyName, setCompanyName] = useState('MIGROS');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/test-web-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          location,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Errore nella ricerca');
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Test Web Search API</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nome Azienda
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="es. MIGROS"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Location (opzionale)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="es. Zurigo"
              />
            </div>

            <button
              onClick={handleSearch}
              disabled={loading || !companyName}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300"
            >
              {loading ? 'Cercando...' : 'Cerca'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-800 mb-2">Errore</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Risultato</h2>

            <div className="space-y-4">
              <div>
                <span className="font-semibold">Found: </span>
                <span className={result.found ? 'text-green-600' : 'text-red-600'}>
                  {result.found ? '✓ Sì' : '✗ No'}
                </span>
              </div>

              <div>
                <span className="font-semibold">Source: </span>
                <span>{result.source}</span>
              </div>

              <div>
                <span className="font-semibold">Query: </span>
                <span className="text-gray-600">{result.searchQuery}</span>
              </div>

              {result.found && (
                <>
                  {result.legalName && (
                    <div>
                      <span className="font-semibold">Legal Name: </span>
                      <span>{result.legalName}</span>
                    </div>
                  )}

                  {result.website && (
                    <div>
                      <span className="font-semibold">Website: </span>
                      <a
                        href={result.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {result.website}
                      </a>
                    </div>
                  )}

                  {result.businessActivity && (
                    <div>
                      <span className="font-semibold">Business Activity: </span>
                      <p className="text-gray-600 mt-1">{result.businessActivity}</p>
                    </div>
                  )}
                </>
              )}

              <div className="mt-6">
                <details>
                  <summary className="font-semibold cursor-pointer">
                    Raw Data (clicca per espandere)
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-50 rounded overflow-auto text-xs">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
