#!/bin/bash
# Script per avviare Cloudflare Tunnel sul Jetson

echo "🚀 Avvio Cloudflare Tunnel per Jetson OCR Server..."
echo ""

# Controlla se cloudflared è installato
if ! command -v cloudflared &> /dev/null; then
    echo "📦 Installazione cloudflared..."

    # Scarica cloudflared per ARM64 (Jetson)
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -O cloudflared

    chmod +x cloudflared
    sudo mv cloudflared /usr/local/bin/

    echo "✅ cloudflared installato!"
else
    echo "✅ cloudflared già installato"
fi

echo ""
echo "🌐 Avvio tunnel verso localhost:3100..."
echo ""

# Avvia il tunnel in background
nohup cloudflared tunnel --url http://localhost:3100 > /tmp/cloudflare-tunnel.log 2>&1 &

# Aspetta 3 secondi per il tunnel si avvii
sleep 3

# Trova l'URL del tunnel nei log
TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflare-tunnel.log | head -1)

if [ -z "$TUNNEL_URL" ]; then
    echo "❌ Errore: Tunnel non avviato"
    echo "Controlla i log: tail -f /tmp/cloudflare-tunnel.log"
    exit 1
fi

echo "✅ Tunnel attivo!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  URL PUBBLICO:"
echo "  $TUNNEL_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Questo URL funziona da qualsiasi posto (anche Vercel)!"
echo ""
echo "Per vedere i log: tail -f /tmp/cloudflare-tunnel.log"
echo "Per fermare: pkill cloudflared"
echo ""
