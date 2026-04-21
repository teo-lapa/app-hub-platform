#!/usr/bin/env python3
"""
Recupero Clienti — notifica mattutina a Mihai (Telegram).

Chiamato da Windows Task Scheduler su LAPA-SALES:
  - Lun-Sab 08:00 → genera messaggio con priorita del giorno + link pagina

Uso:
  python recupero_clienti_notifica.py           # invia a Mihai
  python recupero_clienti_notifica.py --dry     # stampa senza inviare
  python recupero_clienti_notifica.py --to paul # invia a Paul (test)

Requisiti:
  - send_telegram.py nella stessa cartella (o ../send_telegram.py)
  - Connessione internet
"""

import sys
import os
import ssl
import json
import argparse
import datetime
import urllib.request
import urllib.parse

API_URL = "https://hub.lapa.ch/api/recupero-clienti"
PAGE_URL = "https://hub.lapa.ch/recupero-clienti"
TOP_N = 8  # top clienti da mostrare nel messaggio
DESTINATARIO_DEFAULT = "mihai"

# Telegram destinatari (chat_id + bot token)
TELEGRAM_BOT_TOKEN = "7648467709:AAFwVugpRSHPf57D7wFIcChr057fk9fPPtA"  # LAPACLOUD bot
TELEGRAM_CHATS = {
    "paul": 8530759441,
    "laura": 7999589412,
    "mihai": 2023502981,
}

# Zone per giorno della settimana (0=Lun, 1=Mar, 2=Mer, 3=Gio, 4=Ven, 5=Sab)
# Mihai fa zone fisse: Lun/Mer=Zurigo, Mar/Gio=Basilea/Aargau, Ven=ufficio, Sab=libero
GIORNO_ZONA = {
    0: ("lunedi", "Nord/Winterthur"),     # Lun
    1: ("giovedi", "Basilea/Aargau"),      # Mar (in realta zona Gio-list per Basilea? no)
    2: ("mercoledi", "Zurigo Centro"),     # Mer
    3: ("giovedi", "Lago/Sud-Est"),        # Gio
    4: ("mercoledi", "Zurigo + chiamate"), # Ven (giro residuo)
    5: ("lunedi", "recuperi"),             # Sab (recuperi se serve)
}

GIORNO_NOME = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato", "domenica"]

SSL_CTX = ssl.create_default_context()
try:
    import certifi
    SSL_CTX.load_verify_locations(certifi.where())
except ImportError:
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE


def fetch_clients():
    req = urllib.request.Request(API_URL)
    with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_message(data, giorno_idx: int, oggi: datetime.date) -> str:
    clients = data.get("clients", [])
    zona, zona_label = GIORNO_ZONA.get(giorno_idx, ("mercoledi", "zona default"))
    giorno_nome = GIORNO_NOME[giorno_idx].capitalize()

    # Top clienti con allarme nella zona del giorno
    in_zona = [c for c in clients if c.get("zona") == zona]
    in_zona_allarmi = [c for c in in_zona if c.get("allarme") in ("GRAVE", "SI")]
    # Ordina per gravita + fatturato
    allarme_rank = {"GRAVE": 0, "SI": 1, "NO": 2}
    in_zona_allarmi.sort(key=lambda c: (allarme_rank.get(c.get("allarme"), 9), -c.get("fatturato_6m", 0)))
    top = in_zona_allarmi[:TOP_N]

    tot_allarmi_settimana = len([c for c in clients if c.get("allarme") in ("GRAVE", "SI")])
    fat_rischio = sum(c.get("fatturato_6m", 0) for c in clients if c.get("allarme") in ("GRAVE", "SI"))

    lines = []
    lines.append(f"Buongiorno Mihai!")
    lines.append(f"Oggi {giorno_nome} {oggi.strftime('%d/%m')} — zona {zona_label}.")
    lines.append("")
    lines.append(f"Settimana: {tot_allarmi_settimana} clienti in allarme ({fat_rischio:,.0f} CHF a rischio).".replace(",", "'"))
    lines.append("")

    if not top:
        lines.append(f"Nessun allarme nella tua zona oggi. Buon giro!")
    else:
        lines.append(f"Priorita oggi ({len(top)} di {len(in_zona_allarmi)} in zona):")
        for i, c in enumerate(top, 1):
            emoji = "🔴" if c.get("allarme") == "GRAVE" else "🟡"
            nome = c.get("name", "?")[:40]
            tel = c.get("phone") or ""
            silenzio = c.get("silenzioGiorni", "?")
            citta = c.get("city", "")
            azione = f"☎ {tel}" if tel else "🚗 visita"
            lines.append(f"{i}. {emoji} {nome} ({citta}) — {silenzio}gg silenzio · {azione}")

    lines.append("")
    lines.append(f"Lista completa + feedback: {PAGE_URL}")
    return "\n".join(lines)


def send_telegram(to: str, text: str):
    """Invia messaggio Telegram diretto (telegram.org API). Self-contained."""
    chat_id = TELEGRAM_CHATS.get(to)
    if chat_id is None:
        # Prova come chat_id diretto
        try:
            chat_id = int(to)
        except ValueError:
            raise ValueError(f"Destinatario '{to}' non trovato (disponibili: {list(TELEGRAM_CHATS)})")

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    chunks = [text[i:i+4000] for i in range(0, len(text), 4000)] or [""]
    for chunk in chunks:
        data = urllib.parse.urlencode({"chat_id": chat_id, "text": chunk}).encode("utf-8")
        req = urllib.request.Request(url, data=data)
        with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            if not result.get("ok"):
                raise RuntimeError(f"Telegram API error: {result}")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry", action="store_true", help="Stampa senza inviare")
    parser.add_argument("--to", default=DESTINATARIO_DEFAULT, help="Destinatario (default: mihai)")
    parser.add_argument("--date", default=None, help="Data override YYYY-MM-DD (per test)")
    args = parser.parse_args()

    oggi = datetime.date.today() if not args.date else datetime.date.fromisoformat(args.date)
    giorno_idx = oggi.weekday()

    if giorno_idx == 6:  # Domenica → nessun invio automatico
        print("Domenica: nessuna notifica automatica.")
        sys.exit(0)

    print(f"[{oggi}] Fetch API...")
    data = fetch_clients()
    print(f"Clienti regolari totali: {data.get('stats', {}).get('total', 0)}")

    msg = build_message(data, giorno_idx, oggi)
    print("---")
    print(msg)
    print("---")

    if args.dry:
        print("[DRY RUN] non inviato.")
        return

    send_telegram(args.to, msg)
    print(f"Inviato a {args.to}.")


if __name__ == "__main__":
    main()
