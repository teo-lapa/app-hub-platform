import os
import sys
import json
import time
import shutil
import subprocess
import requests
from datetime import datetime
from pathlib import Path

API_BASE = "https://hub.lapa.ch/api/catalogo-foto"
WORKER_KEY = os.environ.get("CATALOGO_WORKER_KEY", "catalogo-foto-worker-2026")
CLAUDE_CMD = r"C:\Users\lapa\AppData\Roaming\npm\claude.cmd"
TEMP_DIR = r"C:\Users\lapa\catalogo-foto-temp"
WORKING_DIR = r"C:\Users\lapa"
POLL_INTERVAL = 30
CREATE_NO_WINDOW = 0x08000000

headers = {"X-Worker-Key": WORKER_KEY, "Content-Type": "application/json"}

ODOO_URL = "https://lapa.ch"
ODOO_DB = "lapadevadmin-lapa-v2-main-18596196"
ODOO_USER = "paul@lapa.ch"
ODOO_PASS = "admin123"


def get_odoo_session():
    r = requests.post(f"{ODOO_URL}/web/session/authenticate", json={
        "jsonrpc": "2.0", "params": {"db": ODOO_DB, "login": ODOO_USER, "password": ODOO_PASS}
    }, timeout=15)
    return r.cookies.get("session_id")


def post_odoo_chatter(product_id, message):
    sid = get_odoo_session()
    requests.post(f"{ODOO_URL}/web/dataset/call_kw", json={
        "jsonrpc": "2.0", "method": "call",
        "params": {
            "model": "product.template", "method": "message_post",
            "args": [[product_id]],
            "kwargs": {"body": message, "message_type": "comment", "subtype_xmlid": "mail.mt_note"}
        }
    }, headers={"Content-Type": "application/json"}, cookies={"session_id": sid}, timeout=15)


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def poll_job():
    resp = requests.get(f"{API_BASE}/jobs", params={"status": "pending", "limit": 1}, headers=headers, timeout=15)
    resp.raise_for_status()
    data = resp.json().get("data", [])
    if data and len(data) > 0:
        return data[0]
    return None


def patch_job(job_id, data):
    resp = requests.patch(f"{API_BASE}/jobs/{job_id}", json=data, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()


def download_photos(photos):
    temp = Path(TEMP_DIR)
    temp.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, photo_url in enumerate(photos):
        ext = Path(photo_url.split("?")[0]).suffix or ".jpg"
        path = temp / f"foto_{i+1}{ext}"
        resp = requests.get(photo_url, timeout=60)
        resp.raise_for_status()
        path.write_bytes(resp.content)
        paths.append(str(path))
        log(f"  Downloaded: {path.name}")
    return paths


def build_prompt(job_id, photo_paths, operator_notes, photo_urls=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    photos_list = "\n".join(f"- {p}" for p in photo_paths)
    urls_list = ""
    if photo_urls:
        urls_list = "\nFOTO_URLS_ORIGINALI (da passare a Gemini):\n" + "\n".join(f"- {u}" for u in photo_urls) + "\n"
    notes = f"\nNote operatore: {operator_notes}" if operator_notes else ""
    return (
        f"[{ts} | Catalogo Foto - Job {job_id}]\n"
        f"ESEGUI LA SKILL /sistema-prodotto con queste foto:\n"
        f"{photos_list}\n"
        f"{urls_list}"
        f"{notes}\n"
        f'Usa il tool Skill con skill="sistema-prodotto" IMMEDIATAMENTE.\n'
        f"MODALITA AUTOMATICA: NON chiedere conferma. Dopo la tabella di confronto, CORREGGI TUTTO automaticamente, rigenera la foto e scrivi le traduzioni. Procedi senza aspettare risposta.\n"
        f'Alla fine scrivi SOLO un JSON: {{"product_found": true/false, "odoo_product_id": ID, "odoo_product_name": "nome", "corrections": ["lista correzioni"], "photo_regenerated": true/false}}'
    )


def run_claude(prompt):
    env = os.environ.copy()
    env.pop("CLAUDECODE", None)
    result = subprocess.run(
        [CLAUDE_CMD, "-p", "-", "--output-format", "json", "--dangerously-skip-permissions", "--model", "opus", "--max-turns", "25"],
        input=prompt,
        encoding="utf-8",
        capture_output=True,
        cwd=WORKING_DIR,
        creationflags=CREATE_NO_WINDOW,
        env=env,
        timeout=600,
    )
    return json.loads(result.stdout)


def cleanup_temp():
    temp = Path(TEMP_DIR)
    if temp.exists():
        shutil.rmtree(temp, ignore_errors=True)


def process_job(job):
    job_id = job["id"]
    log(f"Processing job {job_id}")

    patch_job(job_id, {"status": "processing"})

    photos = job.get("photos", job.get("photo_urls", []))
    photo_paths = download_photos(photos)

    operator_notes = job.get("operator_notes", "") or job.get("notes", "")
    prompt = build_prompt(job_id, photo_paths, operator_notes, photo_urls=photos)

    log(f"  Running Claude Code...")
    claude_result = run_claude(prompt)

    result_text = claude_result.get("result", "")
    result_json = None
    try:
        start = result_text.index("{")
        end = result_text.rindex("}") + 1
        result_json = json.loads(result_text[start:end])
    except (ValueError, json.JSONDecodeError):
        result_json = {"raw_result": result_text}

    update = {"status": "completed", "result_json": result_json}
    if result_json.get("odoo_product_id"):
        update["odoo_product_id"] = result_json["odoo_product_id"]
    if result_json.get("odoo_product_name"):
        update["odoo_product_name"] = result_json["odoo_product_name"]

    patch_job(job_id, update)

    # Write chatter message on Odoo product
    odoo_pid = result_json.get("odoo_product_id")
    if odoo_pid:
        try:
            post_odoo_chatter(odoo_pid, "✅ Catalogato da App Catalogo Foto")
            log(f"  Chatter message posted on product {odoo_pid}")
        except Exception as e:
            log(f"  Chatter post failed: {e}")

    log(f"  Job {job_id} completed")


def main():
    log("Catalogo Foto Worker started")
    while True:
        try:
            job = poll_job()
            if job:
                try:
                    process_job(job)
                except Exception as e:
                    log(f"  ERROR: {e}")
                    try:
                        patch_job(job["id"], {"status": "failed", "error_message": str(e)})
                    except Exception:
                        pass
                finally:
                    cleanup_temp()
            else:
                log("No pending jobs")
        except Exception as e:
            log(f"Poll error: {e}")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
