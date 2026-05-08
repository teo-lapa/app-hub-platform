# Architettura Deployment: Sistema OCR Jetson

## Stato attuale (aggiornato 2026-05-08)

Sistema OCR locale GPU-accelerato per estrazione testo da PDF e immagini, integrato col cron Vercel `/api/cron/ocr-attachments` di hub.lapa.ch.

```
┌────────────────────────────────────────────────────────────────────┐
│                         FLUSSO COMPLETO                            │
└────────────────────────────────────────────────────────────────────┘

1. Email arriva → Odoo crea project.task in [EMAIL] Paul/Laura/Gregorio/Mihai/Alessandro/LAPA
   con allegati PDF/JPG/PNG
   ↓
2. Cron Vercel (ogni 5 min) → cerca task senza tag OCR_done/OCR_failed
   ↓
3. Per ogni allegato candidato:
   - Se ha già MD compagno → skip
   - Se è "junk" (loghi, banner < 30KB, dimensioni minime) → skip
   - Altrimenti POST /jobs/start a Jetson, salva job_id in description "OCR_JOB:<id>:<ts>"
   ↓
4. Run successivo: GET /jobs/<id> → se done, scarica markdown, allega .md compagno,
   rinomina PDF con header pulito, posta nel chatter risultato
   ↓
5. Quando tutti gli allegati di un task sono done/failed → tag OCR_done o OCR_failed
```

---

## Hardware Jetson

- **NVIDIA Jetson Orin Nano Super Developer Kit** (versione overclockata, ~67 TOPS INT8)
- 1024 CUDA cores + 32 Tensor cores (Ampere)
- 8GB RAM unificata CPU+GPU
- 6 core ARM Cortex
- SSD NVMe 2TB (~1.6TB liberi)
- Eth: `eno1` con **IP statico 192.168.1.171/24** via NetworkManager (no DHCP)
- WiFi: `wlP1p1s0` su DHCP (.35) come backup
- Power mode: nvpmodel default
- Hostname: `ubuntu`, utente `lapap`, password `lapa201180`

---

## Software Stack

```
Ubuntu 22.04 ARM64 + JetPack 6 (CUDA 12.6)
├── Ollama (host, porta 11434) — motore inferenza GPU
│   ├── glm-ocr:latest (1.1B params, F16, ~4.6GB VRAM) — modello OCR principale
│   └── qwen2.5vl:3b (3.8B params, Q4_K_M, ~3.2GB) — VLM generalista fallback
├── Docker
│   ├── ocr-service (FastAPI, porta 8500) — API OCR
│   ├── ocr-redis (porta 127.0.0.1:6380→6379) — cache risultati + job queue
│   └── jetson-redis (porta 6379) — coda jobs
├── ocr-port-bridge.service (systemd) — bridge porta 3100 → 8500 per cloudflared tunnel
└── cloudflared tunnel — espone OCR all'esterno
```

Tutti i container hanno `restart=unless-stopped`.

---

## API OCR (porta 8500 / bridge 3100)

```
GET  /health                   # health check
GET  /info                     # modelli caricati, dimensioni
POST /ocr-image                # OCR singola immagine, sincrono
POST /ocr-pdf                  # OCR PDF, sincrono
POST /ocr-pdf-stream           # OCR PDF con streaming
POST /ocr-auto                 # rileva tipo file e usa endpoint adatto
POST /ocr-classify             # classifica tipo documento
POST /ocr-batch                # batch
POST /jobs/start               # avvio job async (ritorna job_id)
GET  /jobs/{job_id}            # status + risultato (TTL Redis ~24h)
DELETE /jobs/{job_id}          # cancella job
```

Cache Redis su hash file → richieste duplicate ritornano in 0.04s.

---

## Performance reali

| Caso | Tempo | Note |
|---|---|---|
| Cold start (1ª richiesta dopo riavvio) | 75-90s | carica modello in VRAM |
| Immagine warm (testo nitido) | ~3.7s | regime normale |
| PDF 3 pagine fattura italiana | ~30-40s | warm |
| File già OCRizzato (cache hit) | 0.04s | no-op |

Throughput steady state: **~15-20 immagini/min**, **~5-8 pagine PDF/min**.

Precisione: **95-98%** su PDF nativi e foto pulite, ~80-90% su foto storte/sgranate, 60-70% su manoscritto.

---

## Bug noti & recovery

### 1. IP cambia dopo reboot (RISOLTO 2026-05-08)
**Sintomo**: HTTP 502 da chi chiama l'OCR. Jetson non risponde su .171.
**Causa**: prima dell'8 maggio l'eth era in DHCP → reboot = nuovo lease.
**Fix permanente**: IP statico `192.168.1.171/24` su connessione `Wired connection 1` (NetworkManager). Configurato manualmente con `nmcli`.

### 2. Container Docker bloccati con `AlreadyExists: task ... already exists`
**Sintomo**: dopo reboot non pulito (power-cut, kernel panic), `docker start` fallisce su tutti i container OCR.
**Causa**: containerd lascia task fantasma da processi morti.
**Recovery**:
```bash
sudo systemctl stop docker docker.socket containerd
sudo pkill -9 -f containerd-shim
sudo pkill -9 dockerd
sudo systemctl start containerd
sudo systemctl start docker.socket
sudo systemctl start docker
docker start ocr-redis ocr-service jetson-redis
```
Attenzione: `pkill -9 -f containerd-shim` può troncare la sessione SSH se il container ospita la shell — eseguire da macchina separata o in nohup.

### 3. Job-id Redis scaduti → orfani in Odoo (RISOLTO 2026-05-08)
**Sintomo**: attachment Odoo restano con `description = OCR_JOB:xxx:yyy` per giorni, MD non si crea mai. Cron logs mostrano `JOB STATUS ERR ... HTTP 404 job not found (forse scaduto)`.
**Causa**: Redis Jetson ha TTL ~24h sui job. Se il cron interroga dopo la scadenza, riceve 404 ma non resettava la description → loop infinito.
**Fix permanente**: in `app/api/cron/ocr-attachments/route.ts` il catch su `jetsonJobStatus` adesso rileva `HTTP 404|not found|scaduto` e azzera la description, così al prossimo run il sistema sottomette un nuovo job.
**Cleanup retroattivo eseguito**: 133 attachment con OCR_JOB orfani azzerati l'8 maggio.

---

## Modello Odoo

Progetti email (modello `project.task`):
| ID | Nome |
|---|---|
| 109 | [EMAIL] Paul Teodorescu |
| 110 | [EMAIL] Laura Teodorescu |
| 111 | [EMAIL] Gregorio |
| 112 | [EMAIL] Mihai |
| 113 | [EMAIL] Alessandro |
| 114 | [EMAIL] LAPA |

Tag finali: `OCR_done` (id 146), `OCR_failed` (id 147).

Quando un task ha tutti gli allegati processati, riceve uno dei due tag e viene escluso dalle scansioni successive.

---

## Cron Vercel

Definito in `vercel.json`:
```json
{ "path": "/api/cron/ocr-attachments", "schedule": "*/5 * * * *" }
```

Configurazione runtime (`route.ts`):
- `OCR_CRON_LOOKBACK_DAYS = 30` (cerca task creati ultimi N giorni)
- `OCR_CRON_MAX_TASKS = 50` (max task per singolo run)
- `SOFT_DEADLINE_MS = 240_000` (4 min, sotto i 5 min Vercel max)
- `maxDuration = 300` (limite Vercel function)

Auth: header `Authorization: Bearer ${CRON_SECRET}` richiesto.

---

## Costi operativi

Mensili:
- Elettricità Jetson: ~€2-3 (~10W)
- Cloudflare tunnel: gratis
- Vercel function: incluso nel piano hub.lapa.ch
- **Totale: ~€3/mese** (zero costi cloud OCR)

---

## Endpoint pubblici

Backend OCR raggiungibile via:
- LAN diretta: `http://192.168.1.171:3100` (porta bridge) o `:8500` (porta backend)
- Tunnel cloudflared (URL configurato in `.env` di hub-lapa-platform come `JETSON_OCR_URL`)

---

## SSH

```bash
ssh jetson    # alias configurato in ~/.ssh/config -> lapap@192.168.1.171
```
