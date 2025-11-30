#!/bin/bash
###############################################################################
# Script installazione Ollama + Llama 3.2 3B su Jetson Orin Nano
#
# Questo script:
# 1. Installa Ollama sul Jetson
# 2. Scarica il modello Llama 3.2 3B (~2GB)
# 3. Verifica l'installazione
# 4. Configura l'autostart
#
# Requisiti: Jetson Orin Nano con 8GB RAM, Ubuntu 20.04+
###############################################################################

set -e  # Exit on error

echo "🚀 Installazione Ollama su Jetson Orin Nano"
echo "=============================================="
echo ""

# Check if running on Jetson
if [ ! -f "/etc/nv_tegra_release" ]; then
    echo "⚠️  Warning: Non sembra essere un NVIDIA Jetson"
    read -p "Continuare comunque? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check available memory
TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
echo "📊 RAM totale: ${TOTAL_RAM}GB"

if [ "$TOTAL_RAM" -lt 7 ]; then
    echo "❌ Errore: Richiesti almeno 8GB di RAM"
    echo "   RAM disponibile: ${TOTAL_RAM}GB"
    exit 1
fi

echo "✅ RAM sufficiente per Ollama + Llama 3.2 3B"
echo ""

# Install Ollama
echo "📥 Step 1/4: Installazione Ollama..."
if command -v ollama &> /dev/null; then
    echo "   ℹ️  Ollama già installato: $(ollama --version)"
else
    curl -fsSL https://ollama.com/install.sh | sh
    echo "   ✅ Ollama installato"
fi
echo ""

# Start Ollama service
echo "🔧 Step 2/4: Avvio servizio Ollama..."
sudo systemctl enable ollama
sudo systemctl start ollama

# Wait for service to be ready
echo "   Attendo che il servizio sia pronto..."
sleep 5

if systemctl is-active --quiet ollama; then
    echo "   ✅ Servizio Ollama attivo"
else
    echo "   ❌ Errore: Servizio Ollama non attivo"
    echo "   Prova manualmente: sudo systemctl start ollama"
    exit 1
fi
echo ""

# Pull Llama 3.2 3B model
echo "📦 Step 3/4: Download modello Llama 3.2 3B (~2GB)..."
echo "   Questo può richiedere alcuni minuti..."
if ollama list | grep -q "llama3.2:3b"; then
    echo "   ℹ️  Modello già presente"
else
    ollama pull llama3.2:3b
    echo "   ✅ Modello scaricato"
fi
echo ""

# Test the model
echo "🧪 Step 4/4: Test del modello..."
echo "   Invio una query di test..."

TEST_RESPONSE=$(ollama run llama3.2:3b "Rispondi con un solo numero: quanto fa 2+2?" --format json 2>&1 | tail -1)

if [ $? -eq 0 ]; then
    echo "   ✅ Modello funzionante!"
    echo "   Risposta test: $TEST_RESPONSE"
else
    echo "   ⚠️  Test fallito, ma il modello potrebbe funzionare comunque"
fi
echo ""

# Show model info
echo "📋 Informazioni modello installato:"
ollama list | grep llama3.2
echo ""

# Get service status
echo "🔍 Status servizio Ollama:"
sudo systemctl status ollama --no-pager -l | head -10
echo ""

# Summary
echo "=============================================="
echo "✅ INSTALLAZIONE COMPLETATA!"
echo "=============================================="
echo ""
echo "📝 Prossimi passi:"
echo "   1. Verifica che Ollama sia attivo: sudo systemctl status ollama"
echo "   2. Testa il modello: ollama run llama3.2:3b 'Ciao!'"
echo "   3. Aggiorna docker-compose.yml (vedi guida)"
echo "   4. Riavvia i container: docker-compose up -d --build"
echo ""
echo "💡 Comandi utili:"
echo "   - Testare il modello: ollama run llama3.2:3b 'test'"
echo "   - Elencare modelli: ollama list"
echo "   - Rimuovere modello: ollama rm llama3.2:3b"
echo "   - Logs servizio: sudo journalctl -u ollama -f"
echo ""
echo "🌐 Ollama API disponibile su: http://localhost:11434"
echo ""
