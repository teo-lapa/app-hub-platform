'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function InventarioHtmlPage() {
  const router = useRouter();

  useEffect(() => {
    // Inject HTML content after component mounts
    const htmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestione Ubicazioni - LAPA</title>
    <style>
        /* Import the complete CSS from the original HTML */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary: #3b82f6;
            --primary-dark: #1d4ed8;
            --secondary: #1f2937;
            --accent: #f59e0b;
            --success: #10b981;
            --warning: #f59e0b;
            --error: #ef4444;
            --info: #06b6d4;
            --background: #0f172a;
            --surface: #1e293b;
            --surface-light: #334155;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --border: #475569;
            --glass-bg: rgba(30, 41, 59, 0.8);
            --glass-border: rgba(148, 163, 184, 0.2);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, var(--background) 0%, #0c1220 100%);
            color: var(--text);
            min-height: 100vh;
            line-height: 1.6;
        }

        .glass {
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
        }

        .glass-strong {
            background: rgba(30, 41, 59, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 30px;
            padding: 20px;
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
        }

        .back-button {
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            color: var(--text);
            padding: 10px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .back-button:hover {
            background: var(--surface-light);
        }

        .title {
            font-size: 24px;
            font-weight: bold;
            color: var(--primary);
        }

        .subtitle {
            color: var(--text-muted);
            font-size: 14px;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
        }

        .status-connected {
            background: rgba(16, 185, 129, 0.2);
            color: #10b981;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .status-disconnected {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .scanner-section {
            margin-bottom: 30px;
            padding: 30px;
            text-align: center;
        }

        .scanner-icon {
            width: 48px;
            height: 48px;
            color: var(--primary);
            margin: 0 auto 20px;
        }

        .scanner-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 10px;
        }

        .scanner-description {
            color: var(--text-muted);
            margin-bottom: 30px;
        }

        .scanner-controls {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
        }

        .location-input {
            flex: 1;
            min-width: 300px;
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            color: var(--text);
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 16px;
        }

        .location-input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .btn {
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            color: var(--text);
            padding: 12px 16px;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 500;
        }

        .btn:hover {
            background: var(--surface-light);
        }

        .btn-primary {
            background: var(--primary);
            border-color: var(--primary);
        }

        .btn-primary:hover {
            background: var(--primary-dark);
        }

        .location-info {
            margin-bottom: 30px;
            padding: 20px;
            border-left: 4px solid var(--primary);
        }

        .location-name {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .location-code {
            color: var(--text-muted);
        }

        .products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .product-card {
            padding: 20px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .product-card:hover {
            background: rgba(59, 130, 246, 0.1);
            transform: translateY(-2px);
        }

        .product-header {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 16px;
        }

        .product-image {
            width: 60px;
            height: 60px;
            background: var(--surface);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .product-info {
            flex: 1;
            min-width: 0;
        }

        .product-name {
            font-weight: 600;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .product-code {
            color: var(--text-muted);
            font-size: 14px;
        }

        .product-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .product-quantity {
            font-size: 18px;
            font-weight: bold;
            color: var(--primary);
        }

        .product-status {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }

        .status-counted-recent {
            background: rgba(16, 185, 129, 0.2);
            color: #10b981;
        }

        .status-counted-old {
            background: rgba(245, 158, 11, 0.2);
            color: #f59e0b;
        }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
        }

        .empty-icon {
            width: 64px;
            height: 64px;
            color: var(--text-muted);
            margin: 0 auto 20px;
        }

        .empty-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .empty-description {
            color: var(--text-muted);
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            padding: 16px 20px;
            border-radius: 12px;
            font-weight: 500;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            animation: slideIn 0.3s ease-out;
        }

        .notification-success {
            background: rgba(16, 185, 129, 0.9);
            color: white;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .notification-error {
            background: rgba(239, 68, 68, 0.9);
            color: white;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .notification-info {
            background: rgba(6, 182, 212, 0.9);
            color: white;
            border: 1px solid rgba(6, 182, 212, 0.3);
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .loading-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .loading-content {
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            padding: 40px;
            border-radius: 16px;
            text-align: center;
        }

        .spinner {
            width: 32px;
            height: 32px;
            border: 4px solid var(--primary);
            border-top: 4px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        /* Responsive */
        @media (max-width: 768px) {
            .container {
                padding: 16px;
            }

            .header {
                flex-direction: column;
                align-items: flex-start;
                gap: 12px;
            }

            .scanner-controls {
                flex-direction: column;
            }

            .location-input {
                min-width: auto;
                width: 100%;
            }

            .products-grid {
                grid-template-columns: 1fr;
            }
        }

        .hidden {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <button class="back-button" onclick="goBack()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m12 19-7-7 7-7"/>
                    <path d="M19 12H5"/>
                </svg>
            </button>
            <div>
                <h1 class="title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    Gestione Inventario
                </h1>
                <p class="subtitle">Scanner → Prodotti → Modifica</p>
            </div>
            <div id="connectionStatus" class="status-indicator status-disconnected">
                <div class="status-dot" style="background: currentColor;"></div>
                <span id="statusText">Non connesso</span>
            </div>
        </div>

        <!-- Scanner Section -->
        <div class="glass-strong scanner-section">
            <svg class="scanner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/>
                <polyline points="7,10 12,15 17,10"/>
            </svg>
            <h2 class="scanner-title">Scanner Ubicazione</h2>
            <p class="scanner-description">
                📱 Usa pistola scanner o fotocamera per leggere il barcode dell'ubicazione
            </p>
            <div class="scanner-controls">
                <input
                    type="text"
                    id="locationScanner"
                    class="location-input"
                    placeholder="Scansiona o inserisci codice ubicazione"
                    autocomplete="off"
                >
                <button class="btn" onclick="openCamera()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <span class="hidden-mobile">Camera</span>
                </button>
                <button class="btn" onclick="openProductSearch()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.35-4.35"/>
                    </svg>
                    <span class="hidden-mobile">Aggiungi</span>
                </button>
                <button class="btn btn-primary" onclick="openBufferTransfer()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/>
                    </svg>
                    <span class="hidden-mobile">Buffer</span>
                </button>
            </div>
        </div>

        <!-- Location Info -->
        <div id="locationInfo" class="glass-strong location-info hidden">
            <h3 class="location-name" id="locationName"></h3>
            <p class="location-code" id="locationCode"></p>
        </div>

        <!-- Products Grid -->
        <div id="productsContainer" class="hidden">
            <div id="productsGrid" class="products-grid"></div>
        </div>

        <!-- Empty State -->
        <div id="emptyState" class="glass-strong empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
            <h3 class="empty-title">Nessuna ubicazione selezionata</h3>
            <p class="empty-description">
                Scansiona un'ubicazione per vedere i prodotti contenuti
            </p>
        </div>
    </div>

    <!-- Loading Overlay -->
    <div id="loadingOverlay" class="loading-overlay hidden">
        <div class="loading-content">
            <div class="spinner"></div>
            <p>Caricamento...</p>
        </div>
    </div>

    <script>
        // Integrate the complete JavaScript from the original HTML here
        // This is where we'll put all the working JavaScript code

        function goBack() {
            window.history.back();
        }

        function openCamera() {
            alert('Camera scanner - da implementare');
        }

        function openProductSearch() {
            alert('Product search - da implementare');
        }

        function openBufferTransfer() {
            alert('Buffer transfer - da implementare');
        }

        // Add more JavaScript functionality here...
        console.log('App inventario HTML caricata');
    </script>
</body>
</html>
    `;

    // This is a temporary approach - we'll load the HTML in an iframe or use dangerouslySetInnerHTML
    // For now, let's redirect to a dedicated HTML page

  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header with back button */}
      <div className="glass-strong border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="glass p-2 rounded-xl hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">App Inventario HTML</h1>
              <p className="text-sm text-muted-foreground">
                Versione HTML originale che funziona
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded HTML content */}
      <div className="p-4">
        <div className="glass-strong rounded-xl p-6">
          <p className="text-center text-lg mb-4">
            🚀 L'app HTML originale verrà caricata qui
          </p>
          <p className="text-center text-muted-foreground mb-6">
            Questa è la versione che funziona perfettamente con Odoo
          </p>

          <div className="text-center">
            <button
              onClick={() => {
                // Open the original HTML in a new window/tab
                window.open('/api/inventory/html-app', '_blank');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
            >
              📱 Apri App HTML Originale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}