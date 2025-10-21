'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Home, Search, Package } from 'lucide-react';

export default function InventarioPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [testMessage, setTestMessage] = useState('');

  const handleSearch = () => {
    setTestMessage(`Hai cercato: ${searchQuery}`);
    alert(`Cercando: ${searchQuery}`);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-white hover:text-gray-300">
          <Home className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Package className="w-6 h-6 text-green-500" />
          Inventario TEST
        </h1>
      </div>

      {/* Main Content */}
      <div className="p-8">
        <div className="bg-gray-800 rounded-lg p-6 max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-white mb-4">Test Input Funzionante</h2>

          {/* Test Input */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                console.log('Input cambiato:', e.target.value);
                setSearchQuery(e.target.value);
              }}
              placeholder="Scrivi qualcosa qui..."
              className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded"
            />
          </div>

          {/* Test Button */}
          <div className="mb-4">
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium"
            >
              Clicca Qui per Testare
            </button>
          </div>

          {/* Display Message */}
          {testMessage && (
            <div className="p-4 bg-blue-600 text-white rounded">
              {testMessage}
            </div>
          )}

          {/* Current Value Display */}
          <div className="mt-4 p-4 bg-gray-700 rounded">
            <p className="text-gray-300">Valore corrente input: <span className="text-white font-bold">{searchQuery}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}