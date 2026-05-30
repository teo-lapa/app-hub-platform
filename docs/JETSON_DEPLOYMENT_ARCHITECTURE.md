# Architettura Deployment: Sistema OCR Jetson

## Stato attuale (aggiornato 2026-05-08)

Sistema OCR locale GPU-accelerato per estrazione testo da PDF e immagini, integrato col cron Vercel `/api/cron/ocr-attachments` di hub.lapa.ch.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                         FLUSSO COMPLETO                            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

1. Email arriva â†’ Odoo crea project.task in [EMAIL] Paul/Laura/Gregorio/Mihai/Alessandro/LAPA
   con allegati PDF/JPG/PNG
   â†“
2. Cron Vercel (ogni 5 min) â†’ cerca task senza tag OCR_done/OCR_failed
   â†“
3. Per ogni allegato candidato:
   - Se ha giÃ  MD compagno â†’ skip
   - Se Ã¨ "junk" (loghi, banner < 30KB, dimensioni minime) â†’ skip
   - Altrimenti POST /jobs/start a Jetson, salva job_id in description "OCR_JOB:<id>:<ts>"
   â†“
4. Run successivo: GET /jobs/<id> â†’ se done, scarica markdown, allega .md compagno,
   rinomina PDF con header pulito, posta nel chatter risultato
   â†“
5. Quando tutti gli allegati di un task sono done/failed â†’ tag OCR_done o OCR_failed
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
- Hostname: `ubuntu`, utente `lapap`, password `__REDACTED__`

---

## Software Stack

```
Ubuntu 22.04 ARM64 + JetPack 6 (CUDA 12.6)
â”œâ”€â”€ Ollama (host, porta 11434) â€” motore inferenza GPU
â”‚   â”œâ”€â”€ glm-ocr:latest (1.1B params, F16, ~4.6GB VRAM) â€” modello OCR principale
â”‚   â””â”€â”€ qwen2.5vl:3b (3.8B params, Q4_K_M, ~3.2GB) â€” VLM generalista fallback
â”œâ”€â”€ Docker
â”‚   â”œâ”€â”€ ocr-service (FastAPI, porta 8500) â€” API OCR
â”‚   â”œâ”€â”€ ocr-redis (porta 127.0.0.1:6380â†’6379) â€” cache risultati + job queue
â”‚   â””â”€â”€ jetson-redis (porta 6379) â€” coda jobs
â”œâ”€â”€ ocr-port-bridge.service (systemd) â€” bridge porta 3100 â†’ 8500 per cloudflared tunnel
â””â”€â”€ cloudflared tunnel â€” espone OCR all'esterno
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

Cache Redis su hash file â†’ richieste duplicate ritornano in 0.04s.

---

## Performance reali

| Caso | Tempo | Note |
|---|---|---|
| Cold start (1Âª richiesta dopo riavvio) | 75-90s | carica modello in VRAM |
| Immagine warm (testo nitido) | ~3.7s | regime normale |
| PDF 3 pagine fattura italiana | ~30-40s | warm |
| File giÃ  OCRizzato (cache hit) | 0.04s | no-op |

Throughput steady state: **~15-20 immagini/min**, **~5-8 pagine PDF/min**.

Precisione: **95-98%** su PDF nativi e foto pulite, ~80-90% su foto storte/sgranate, 60-70% su manoscritto.

---

## Bug noti & recovery

### 1. IP cambia dopo reboot (RISOLTO 2026-05-08)
**Sintomo**: HTTP 502 da chi chiama l'OCR. Jetson non risponde su .171.
**Causa**: prima dell'8 maggio l'eth era in DHCP â†’ reboot = nuovo lease.
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
Attenzione: `pkill -9 -f containerd-shim` puÃ² troncare la sessione SSH se il container ospita la shell â€” eseguire da macchina separata o in nohup.

### 3. Job-id Redis scaduti â†’ orfani in Odoo (RISOLTO 2026-05-08)
**Sintomo**: attachment Odoo restano con `description = OCR_JOB:xxx:yyy` per giorni, MD non si crea mai. Cron logs mostrano `JOB STATUS ERR ... HTTP 404 job not found (forse scaduto)`.
**Causa**: Redis Jetson ha TTL ~24h sui job. Se il cron interroga dopo la scadenza, riceve 404 ma non resettava la description â†’ loop infinito.
**Fix permanente**: in `app/api/cron/ocr-attachments/route.ts` il catch su `jetsonJobStatus` adesso rileva `HTTP 404|not found|scaduto` e azzera la description, cosÃ¬ al prossimo run il sistema sottomette un nuovo job.
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
- ElettricitÃ  Jetson: ~â‚¬2-3 (~10W)
- Cloudflare tunnel: gratis
- Vercel function: incluso nel piano hub.lapa.ch
- **Totale: ~â‚¬3/mese** (zero costi cloud OCR)

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
