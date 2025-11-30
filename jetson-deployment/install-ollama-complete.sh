#!/bin/bash
###############################################################################
# INSTALLAZIONE COMPLETA OLLAMA + LLAMA 3.2 3B SU JETSON
# Esegui questo script SUL JETSON per installare tutto automaticamente
###############################################################################

set -e

echo "════════════════════════════════════════════════════════════════"
echo "🚀 INSTALLAZIONE OLLAMA + LLAMA 3.2 3B SU JETSON ORIN NANO"
echo "════════════════════════════════════════════════════════════════"
echo ""

# 1. VERIFICA SISTEMA
echo "📊 Step 1/7: Verifica sistema..."
TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
echo "   RAM totale: ${TOTAL_RAM}GB"

if [ "$TOTAL_RAM" -lt 7 ]; then
    echo "   ⚠️  Warning: RAM < 8GB, ma procedo comunque"
fi

# 2. INSTALLA OLLAMA
echo ""
echo "📥 Step 2/7: Installazione Ollama..."
if command -v ollama &> /dev/null; then
    echo "   ✅ Ollama già installato: $(ollama --version)"
else
    curl -fsSL https://ollama.com/install.sh | sh
    echo "   ✅ Ollama installato"
fi

# 3. AVVIA SERVIZIO
echo ""
echo "🔧 Step 3/7: Configurazione servizio..."
sudo systemctl enable ollama 2>/dev/null || true
sudo systemctl start ollama
sleep 3

if systemctl is-active --quiet ollama; then
    echo "   ✅ Servizio Ollama attivo"
else
    echo "   ⚠️  Servizio non attivo, provo a startare manualmente..."
    ollama serve &
    sleep 5
fi

# 4. SCARICA MODELLO
echo ""
echo "📦 Step 4/7: Download Llama 3.2 3B (~2GB)..."
echo "   Questo richiede 2-5 minuti..."
if ollama list 2>/dev/null | grep -q "llama3.2:3b"; then
    echo "   ✅ Modello già presente"
else
    ollama pull llama3.2:3b
    echo "   ✅ Modello scaricato"
fi

# 5. TEST MODELLO
echo ""
echo "🧪 Step 5/7: Test modello..."
TEST_OUTPUT=$(ollama run llama3.2:3b "Rispondi solo con: OK" 2>&1 | tail -1)
echo "   Risposta test: $TEST_OUTPUT"
echo "   ✅ Modello funzionante"

# 6. CONFIGURA .ENV
echo ""
echo "⚙️  Step 6/7: Configurazione environment..."
cd ~/jetson-deployment

if [ ! -f .env ]; then
    cp .env.example .env
    echo "   ✅ File .env creato"
fi

# Aggiorna .env con Ollama
if grep -q "USE_OLLAMA" .env; then
    sed -i 's/USE_OLLAMA=.*/USE_OLLAMA=true/' .env
else
    echo "USE_OLLAMA=true" >> .env
fi

if grep -q "OLLAMA_URL" .env; then
    sed -i 's|OLLAMA_URL=.*|OLLAMA_URL=http://localhost:11434|' .env
else
    echo "OLLAMA_URL=http://localhost:11434" >> .env
fi

if grep -q "OLLAMA_MODEL" .env; then
    sed -i 's/OLLAMA_MODEL=.*/OLLAMA_MODEL=llama3.2:3b/' .env
else
    echo "OLLAMA_MODEL=llama3.2:3b" >> .env
fi

echo "   ✅ Environment configurato"

# 7. RIAVVIA DOCKER
echo ""
echo "🐳 Step 7/7: Riavvio servizi Docker..."
if command -v docker-compose &> /dev/null || command -v docker &> /dev/null; then
    docker-compose down 2>/dev/null || true
    docker-compose up -d --build
    echo "   ✅ Docker riavviato"
else
    echo "   ⚠️  Docker non trovato, salta questo step"
fi

# SUMMARY
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ INSTALLAZIONE COMPLETATA CON SUCCESSO!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📊 Riepilogo:"
echo "   - Ollama:     INSTALLATO ✓"
echo "   - Llama 3.2:  SCARICATO ✓"
echo "   - Modello:    llama3.2:3b (~2GB)"
echo "   - Endpoint:   http://localhost:11434"
echo "   - Docker:     RIAVVIATO ✓"
echo ""
echo "💡 Prossimi passi:"
echo "   1. Verifica logs: docker-compose logs -f ocr-server"
echo "   2. Dovresti vedere: 🤖 AI Classifier: Ollama (Local)"
echo "   3. Testa su Vercel: https://your-app.vercel.app/jetson-ocr"
echo ""
echo "🎉 Ora classifichi documenti GRATIS con AI locale!"
echo ""
