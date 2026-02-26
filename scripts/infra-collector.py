#!/usr/bin/env python3
"""
LAPA Infrastructure Collector v1.0
Runs on PAUL PC (localhost), SSHs into all devices, collects metrics,
and POSTs the results to the Vercel API.

Setup:
  - Runs as scheduled task every 2 minutes
  - Requires SSH keys configured for all devices
  - Posts to INFRA_API_URL with INFRA_SECRET token
"""

import subprocess
import json
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# ─── Configuration ──────────────────────────────────────────────────

INFRA_API_URL = "https://staging.hub.lapa.ch/api/infra-monitor/update"
INFRA_SECRET = "lapa-infra-2026-secret"

SSH_TIMEOUT = 12  # seconds per SSH command
PING_TIMEOUT = 3  # seconds for ping

# ─── SSH Helper ─────────────────────────────────────────────────────

def ssh_cmd(host, cmd, timeout=SSH_TIMEOUT):
    """Run a command via SSH. Returns (stdout, success)."""
    try:
        result = subprocess.run(
            ["ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no", host, cmd],
            capture_output=True, text=True, timeout=timeout
        )
        return result.stdout.strip(), result.returncode == 0
    except subprocess.TimeoutExpired:
        return "", False
    except Exception as e:
        return str(e), False


def local_cmd(cmd, timeout=SSH_TIMEOUT):
    """Run a local command. Returns (stdout, success)."""
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, shell=True
        )
        return result.stdout.strip(), result.returncode == 0
    except Exception as e:
        return str(e), False


def ping_host(ip, timeout=PING_TIMEOUT):
    """Ping a host. Returns True if reachable."""
    try:
        result = subprocess.run(
            ["ping", "-n", "1", "-w", str(timeout * 1000), ip],
            capture_output=True, text=True, timeout=timeout + 2
        )
        return result.returncode == 0
    except Exception:
        return False


# ─── Parsers ────────────────────────────────────────────────────────

def parse_wmic_memory(output):
    """Parse WMIC memory output to get total/free in GB."""
    total = free = 0
    for line in output.split('\n'):
        line = line.strip()
        if line.startswith('FreePhysicalMemory='):
            free = int(line.split('=')[1]) / 1048576  # KB to GB
        elif line.startswith('TotalVisibleMemorySize='):
            total = int(line.split('=')[1]) / 1048576
    return total, free


def parse_wmic_disks(output):
    """Parse WMIC disk output to get disk info."""
    disks = []
    current = {}
    for line in output.split('\n'):
        line = line.strip()
        if not line:
            if current.get('caption'):
                total_gb = int(current.get('size', 0)) / (1024**3)
                free_gb = int(current.get('freespace', 0)) / (1024**3)
                if total_gb > 0:
                    disks.append({
                        'name': current['caption'],
                        'totalGB': round(total_gb, 1),
                        'freeGB': round(free_gb, 1),
                        'usedPercent': round((1 - free_gb / total_gb) * 100, 1) if total_gb > 0 else 0,
                    })
            current = {}
        elif '=' in line:
            key, val = line.split('=', 1)
            current[key.strip().lower()] = val.strip()
    # Handle last entry
    if current.get('caption'):
        total_gb = int(current.get('size', 0)) / (1024**3)
        free_gb = int(current.get('freespace', 0)) / (1024**3)
        if total_gb > 0:
            disks.append({
                'name': current['caption'],
                'totalGB': round(total_gb, 1),
                'freeGB': round(free_gb, 1),
                'usedPercent': round((1 - free_gb / total_gb) * 100, 1) if total_gb > 0 else 0,
            })
    return disks


def parse_wmic_cpu(output):
    """Parse WMIC CPU load percentage."""
    for line in output.split('\n'):
        line = line.strip()
        if line.isdigit():
            return int(line)
    return 0


def parse_wmic_temp(output):
    """Parse WMI temperature (value in tenths of Kelvin)."""
    for line in output.split('\n'):
        line = line.strip()
        if line.isdigit():
            val = int(line)
            if val > 2000:
                return round((val - 2732) / 10, 1)
    return None


def parse_boot_time(output):
    """Parse systeminfo boot time."""
    # Looking for date/time in output
    match = re.search(r'(\d{1,2}/\d{1,2}/\d{4})', output)
    if match:
        return output.strip()
    return output.strip() if output.strip() else None


def parse_linux_free(output):
    """Parse 'free -h' output for memory."""
    for line in output.split('\n'):
        if line.startswith('Mem:'):
            parts = line.split()
            if len(parts) >= 4:
                def to_gb(s):
                    s = s.upper()
                    if s.endswith('GI') or s.endswith('G'):
                        return float(re.sub(r'[^0-9.]', '', s))
                    elif s.endswith('MI') or s.endswith('M'):
                        return float(re.sub(r'[^0-9.]', '', s)) / 1024
                    elif s.endswith('TI') or s.endswith('T'):
                        return float(re.sub(r'[^0-9.]', '', s)) * 1024
                    return float(re.sub(r'[^0-9.]', '', s))
                total = to_gb(parts[1])
                available = to_gb(parts[6]) if len(parts) >= 7 else to_gb(parts[3])
                return total, available
    return 0, 0


def parse_linux_df(output):
    """Parse 'df -h' output for disk info."""
    disks = []
    for line in output.split('\n'):
        parts = line.split()
        if len(parts) >= 6 and parts[0].startswith('/'):
            mount = parts[5]
            used_pct = int(parts[4].replace('%', '')) if '%' in parts[4] else 0
            def to_gb(s):
                s = s.upper()
                if 'T' in s:
                    return float(re.sub(r'[^0-9.]', '', s)) * 1024
                elif 'G' in s:
                    return float(re.sub(r'[^0-9.]', '', s))
                elif 'M' in s:
                    return float(re.sub(r'[^0-9.]', '', s)) / 1024
                return 0
            total = to_gb(parts[1])
            free = to_gb(parts[3])
            if total > 0:
                disks.append({
                    'name': mount,
                    'totalGB': round(total, 1),
                    'freeGB': round(free, 1),
                    'usedPercent': used_pct,
                })
    return disks


# ─── Device Collectors ──────────────────────────────────────────────

def collect_nas():
    """Collect NAS Synology status."""
    device = {
        'id': 'nas',
        'name': 'NAS Synology',
        'ip': '192.168.1.91',
        'type': 'nas',
        'processor': 'DS923+',
        'online': False,
        'services': [],
        'warnings': [],
        'errors': [],
    }

    uptime_out, ok = ssh_cmd('nas', 'uptime')
    if not ok:
        return device

    device['online'] = True

    # Uptime
    match = re.search(r'up\s+(.+?),\s+\d+\s+user', uptime_out)
    device['uptime'] = match.group(1).strip() if match else uptime_out.split(',')[0]

    # Memory
    mem_out, _ = ssh_cmd('nas', 'free -h')
    total, free = parse_linux_free(mem_out)
    if total > 0:
        device['ram'] = {
            'totalGB': round(total, 1),
            'freeGB': round(free, 1),
            'usedPercent': round((1 - free / total) * 100, 1),
        }

    # Disks
    disk_out, _ = ssh_cmd('nas', 'df -h /volume1 /volume3 /volume4')
    device['disks'] = parse_linux_df(disk_out)
    for d in device['disks']:
        if d['usedPercent'] > 90:
            device['errors'].append(f"Disco {d['name']} al {d['usedPercent']}%!")
        elif d['usedPercent'] > 80:
            device['warnings'].append(f"Disco {d['name']} al {d['usedPercent']}%")

    # Docker
    docker_out, docker_ok = ssh_cmd('nas', '/usr/local/bin/docker ps --format "{{.Names}}|{{.Status}}"')
    if docker_ok:
        for line in docker_out.split('\n'):
            if '|' in line:
                name, status = line.split('|', 1)
                is_up = 'Up' in status
                device['services'].append({
                    'name': name.strip(),
                    'type': 'docker',
                    'status': 'ok' if is_up else 'ko',
                    'details': status.strip(),
                })
                if not is_up:
                    device['errors'].append(f"Container {name.strip()} non attivo!")

    # Health check log
    health_out, _ = ssh_cmd('nas', 'tail -1 /volume4/docker_1/monitoring/health-check.log')
    if health_out:
        if 'OK' in health_out.upper() or 'healthy' in health_out.lower():
            device['services'].append({'name': 'Health Check', 'type': 'service', 'status': 'ok', 'details': health_out[-60:]})
        else:
            device['services'].append({'name': 'Health Check', 'type': 'service', 'status': 'warning', 'details': health_out[-60:]})

    # Daily sync
    sync_out, _ = ssh_cmd('nas', 'tail -3 /volume4/docker_1/restore/scripts/daily_sync.log')
    if sync_out:
        sync_ok = 'success' in sync_out.lower() or 'complet' in sync_out.lower() or 'done' in sync_out.lower()
        device['services'].append({
            'name': 'Daily Sync',
            'type': 'service',
            'status': 'ok' if sync_ok else 'warning',
            'details': sync_out.split('\n')[-1][-60:],
        })

    return device


def collect_windows_pc(host, device_id, name, ip, processor, services_check=None):
    """Generic Windows PC collector."""
    device = {
        'id': device_id,
        'name': name,
        'ip': ip,
        'type': 'windows',
        'processor': processor,
        'online': False,
        'services': [],
        'warnings': [],
        'errors': [],
    }

    # Boot time
    boot_out, ok = ssh_cmd(host, 'systeminfo | findstr /C:"Tempo di avvio"')
    if not ok:
        # Try English
        boot_out, ok = ssh_cmd(host, 'systeminfo | findstr /C:"System Boot Time"')
    if not ok:
        return device

    device['online'] = True
    bt = parse_boot_time(boot_out)
    if bt:
        device['uptime'] = bt

    # CPU
    cpu_out, _ = ssh_cmd(host, 'wmic cpu get loadpercentage')
    cpu_pct = parse_wmic_cpu(cpu_out)

    # Temperature
    temp_out, _ = ssh_cmd(host, 'wmic /namespace:\\\\root\\wmi PATH MSAcpi_ThermalZoneTemperature get CurrentTemperature')
    temp = parse_wmic_temp(temp_out)

    device['cpu'] = {'percent': cpu_pct}
    if temp is not None:
        device['cpu']['temp'] = temp
        if temp > 80:
            device['warnings'].append(f"Temperatura alta: {temp}C")

    # Memory
    mem_out, _ = ssh_cmd(host, 'wmic os get FreePhysicalMemory,TotalVisibleMemorySize /format:list')
    total, free = parse_wmic_memory(mem_out)
    if total > 0:
        device['ram'] = {
            'totalGB': round(total, 1),
            'freeGB': round(free, 1),
            'usedPercent': round((1 - free / total) * 100, 1),
        }
        if free < 2:
            device['warnings'].append(f"RAM libera bassa: {free:.1f} GB")

    # Disks
    disk_out, _ = ssh_cmd(host, 'wmic logicaldisk get caption,freespace,size /format:list')
    device['disks'] = parse_wmic_disks(disk_out)
    for d in device['disks']:
        if d['usedPercent'] > 90:
            device['errors'].append(f"Disco {d['name']} al {d['usedPercent']}%!")
        elif d['usedPercent'] > 80:
            device['warnings'].append(f"Disco {d['name']} al {d['usedPercent']}%")

    # Custom service checks
    if services_check:
        services_check(host, device)

    return device


def check_lapa10_services(host, device):
    """Check Giulio, Magazzino, Sorveglianza on LAPA10."""
    # Giulio OpenClaw (WSL)
    ps_out, ps_ok = ssh_cmd(host, 'wsl -u lapa -- ps aux')
    has_openclaw = 'openclaw' in ps_out if ps_ok else False
    has_gateway = 'openclaw-gateway' in ps_out if ps_ok else False

    # Giulio gateway port
    port_out, _ = ssh_cmd(host, 'netstat -an | findstr 18789')
    port_listening = 'LISTENING' in port_out

    giulio_ok = has_openclaw and has_gateway and port_listening
    device['services'].append({
        'name': 'Giulio',
        'type': 'openclaw',
        'status': 'ok' if giulio_ok else 'ko',
        'port': 18789,
        'details': 'OpenClaw + Gateway attivi' if giulio_ok else 'Processo mancante o porta non attiva',
    })
    if not giulio_ok:
        device['errors'].append('Giulio OpenClaw non attivo!')

    # Magazzino Bot
    task_out, _ = ssh_cmd(host, 'tasklist /fi "imagename eq pythonw.exe"')
    has_pythonw = 'pythonw.exe' in task_out

    sched_out, _ = ssh_cmd(host, 'schtasks /Query /FO TABLE /NH | findstr /i magazzino')
    has_sched = 'magazzino' in sched_out.lower() if sched_out else False

    device['services'].append({
        'name': 'Magazzino Bot',
        'type': 'bot',
        'status': 'ok' if has_pythonw else 'ko',
        'details': 'pythonw.exe attivo' if has_pythonw else 'Processo non trovato',
    })
    if not has_pythonw:
        device['errors'].append('Magazzino Bot non attivo!')

    # Sorveglianza
    sorv_out, _ = ssh_cmd(host, 'netstat -an | findstr 9999')
    sorv_listening = 'LISTENING' in sorv_out

    device['services'].append({
        'name': 'Sorveglianza',
        'type': 'port',
        'status': 'ok' if sorv_listening else 'ko',
        'port': 9999,
        'details': 'Porta 9999 attiva' if sorv_listening else 'Porta 9999 non attiva',
    })
    if not sorv_listening:
        device['errors'].append('Sorveglianza non attiva!')


def check_lapa_sales_services(host, device):
    """Check Sergio + Vanessa on LAPA-SALES."""
    # Sergio Bot
    task_out, _ = ssh_cmd(host, 'tasklist /fi "imagename eq pythonw.exe"')
    has_pythonw = 'pythonw.exe' in task_out

    device['services'].append({
        'name': 'Sergio Bot',
        'type': 'bot',
        'status': 'ok' if has_pythonw else 'ko',
        'details': 'pythonw.exe attivo' if has_pythonw else 'Processo non trovato',
    })
    if not has_pythonw:
        device['errors'].append('Sergio Bot non attivo!')

    # Vanessa OpenClaw (WSL)
    ps_out, ps_ok = ssh_cmd(host, 'wsl -d Ubuntu-22.04 -u lapa -- ps aux')
    has_openclaw = 'openclaw' in ps_out if ps_ok else False
    has_gateway = 'openclaw-gateway' in ps_out if ps_ok else False

    # Vanessa gateway port
    port_out, _ = ssh_cmd(host, 'netstat -an | findstr 18791')
    port_listening = 'LISTENING' in port_out

    vanessa_ok = has_openclaw and has_gateway and port_listening
    device['services'].append({
        'name': 'Vanessa',
        'type': 'openclaw',
        'status': 'ok' if vanessa_ok else 'ko',
        'port': 18791,
        'details': 'OpenClaw + Gateway attivi' if vanessa_ok else 'Processo mancante o porta non attiva',
    })
    if not vanessa_ok:
        device['errors'].append('Vanessa OpenClaw non attiva!')


def check_stella_services(host, device):
    """Check Stella OpenClaw."""
    # PowerShell checks for Stella
    ps_out, ps_ok = ssh_cmd(host, 'powershell -Command "Get-Process wsl -ErrorAction SilentlyContinue | Select-Object ProcessName,Id"')
    has_wsl = 'wsl' in ps_out.lower() if ps_ok else False

    # Gateway port - run netstat via SSH and filter locally
    port_raw, _ = ssh_cmd(host, 'netstat -an | findstr 18790')
    port_listening = 'LISTENING' in port_raw

    stella_ok = has_wsl and port_listening
    device['services'].append({
        'name': 'Stella',
        'type': 'openclaw',
        'status': 'ok' if stella_ok else 'ko',
        'port': 18790,
        'details': 'WSL + Gateway attivi' if stella_ok else 'WSL o porta non attiva',
    })
    if not stella_ok:
        device['errors'].append('Stella OpenClaw non attiva!')


def check_romeo_services(host, device):
    """Check Romeo OpenClaw."""
    ps_out, ps_ok = ssh_cmd(host, 'powershell -Command "Get-Process wsl -ErrorAction SilentlyContinue | Select-Object ProcessName,Id"')
    has_wsl = 'wsl' in ps_out.lower() if ps_ok else False

    port_raw, _ = ssh_cmd(host, 'netstat -an | findstr 18790')
    port_listening = 'LISTENING' in port_raw

    romeo_ok = has_wsl and port_listening
    device['services'].append({
        'name': 'Romeo',
        'type': 'openclaw',
        'status': 'ok' if romeo_ok else 'ko',
        'port': 18790,
        'details': 'WSL + Gateway attivi' if romeo_ok else 'WSL o porta non attiva',
    })
    if not romeo_ok:
        device['errors'].append('Romeo OpenClaw non attivo!')


def collect_stella():
    """Collect STELLA PC via PowerShell."""
    device = {
        'id': 'stella',
        'name': 'STELLA',
        'ip': '192.168.1.157',
        'type': 'windows',
        'processor': 'i7-12700T',
        'online': False,
        'services': [],
        'warnings': [],
        'errors': [],
    }

    boot_out, ok = ssh_cmd('stella', 'powershell -Command "Get-CimInstance Win32_OperatingSystem | Select-Object LastBootUpTime,FreePhysicalMemory,TotalVisibleMemorySize"')
    if not ok:
        return device

    device['online'] = True

    # Parse PowerShell output
    for line in boot_out.split('\n'):
        line = line.strip()
        if 'LastBootUpTime' in line and ':' in line:
            continue  # header
        # Try to extract boot time from data line
        match = re.search(r'(\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s*[AP]?M?)', line)
        if match:
            device['uptime'] = match.group(1)

    # CPU
    cpu_out, _ = ssh_cmd('stella', 'powershell -Command "Get-CimInstance Win32_Processor | Select-Object LoadPercentage"')
    for line in cpu_out.split('\n'):
        line = line.strip()
        if line.isdigit():
            device['cpu'] = {'percent': int(line)}
            break
    if not device.get('cpu'):
        device['cpu'] = {'percent': 0}

    # Temperature
    temp_out, _ = ssh_cmd('stella', 'powershell -Command "Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace root/wmi -ErrorAction SilentlyContinue | Select-Object CurrentTemperature"')
    for line in temp_out.split('\n'):
        line = line.strip()
        if line.isdigit():
            val = int(line)
            if val > 2000:
                device['cpu']['temp'] = round((val - 2732) / 10, 1)
            break

    # Memory via PowerShell
    mem_out, _ = ssh_cmd('stella', 'powershell -Command "(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory; (Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize"')
    lines = [l.strip() for l in mem_out.split('\n') if l.strip().isdigit()]
    if len(lines) >= 2:
        free_kb = int(lines[0])
        total_kb = int(lines[1])
        device['ram'] = {
            'totalGB': round(total_kb / 1048576, 1),
            'freeGB': round(free_kb / 1048576, 1),
            'usedPercent': round((1 - free_kb / total_kb) * 100, 1) if total_kb > 0 else 0,
        }

    # Disks
    disk_out, _ = ssh_cmd('stella', 'powershell -Command "Get-CimInstance Win32_LogicalDisk | ForEach-Object { Write-Output (\\\"$($_.DeviceID)|$($_.FreeSpace)|$($_.Size)\\\") }"')
    disks = []
    for line in disk_out.split('\n'):
        parts = line.strip().split('|')
        if len(parts) == 3 and parts[2]:
            try:
                name = parts[0]
                free_gb = int(parts[1]) / (1024**3) if parts[1] else 0
                total_gb = int(parts[2]) / (1024**3) if parts[2] else 0
                if total_gb > 0:
                    disks.append({
                        'name': name,
                        'totalGB': round(total_gb, 1),
                        'freeGB': round(free_gb, 1),
                        'usedPercent': round((1 - free_gb / total_gb) * 100, 1),
                    })
            except ValueError:
                pass
    device['disks'] = disks

    for d in device['disks']:
        if d['name'] == 'C:' and d['freeGB'] < 20:
            device['warnings'].append(f"Disco C: solo {d['freeGB']:.1f} GB liberi!")
        if d['usedPercent'] > 90:
            device['errors'].append(f"Disco {d['name']} al {d['usedPercent']}%!")

    # Services
    check_stella_services('stella', device)

    return device


def collect_romeo():
    """Collect ROMEO PC via PowerShell."""
    device = {
        'id': 'romeo',
        'name': 'ROMEO',
        'ip': '192.168.1.237',
        'type': 'windows',
        'processor': 'Ryzen 5 5500U',
        'online': False,
        'services': [],
        'warnings': [],
        'errors': [],
    }

    boot_out, ok = ssh_cmd('romeo', 'powershell -Command "Get-CimInstance Win32_OperatingSystem | Select-Object LastBootUpTime"')
    if not ok:
        return device

    device['online'] = True

    # CPU
    cpu_out, _ = ssh_cmd('romeo', 'powershell -Command "(Get-CimInstance Win32_Processor).LoadPercentage"')
    for line in cpu_out.split('\n'):
        line = line.strip()
        if line.isdigit():
            device['cpu'] = {'percent': int(line)}
            break
    if not device.get('cpu'):
        device['cpu'] = {'percent': 0}

    # Temperature
    temp_out, _ = ssh_cmd('romeo', 'powershell -Command "(Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace root/wmi -ErrorAction SilentlyContinue).CurrentTemperature"')
    for line in temp_out.split('\n'):
        line = line.strip()
        if line.isdigit():
            val = int(line)
            if val > 2000:
                device['cpu']['temp'] = round((val - 2732) / 10, 1)
            break

    # Memory
    mem_out, _ = ssh_cmd('romeo', 'powershell -Command "(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory; (Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize"')
    lines = [l.strip() for l in mem_out.split('\n') if l.strip().isdigit()]
    if len(lines) >= 2:
        free_kb = int(lines[0])
        total_kb = int(lines[1])
        device['ram'] = {
            'totalGB': round(total_kb / 1048576, 1),
            'freeGB': round(free_kb / 1048576, 1),
            'usedPercent': round((1 - free_kb / total_kb) * 100, 1) if total_kb > 0 else 0,
        }

    # Disks
    disk_out, _ = ssh_cmd('romeo', 'powershell -Command "Get-CimInstance Win32_LogicalDisk | ForEach-Object { Write-Output (\\\"$($_.DeviceID)|$($_.FreeSpace)|$($_.Size)\\\") }"')
    disks = []
    for line in disk_out.split('\n'):
        parts = line.strip().split('|')
        if len(parts) == 3 and parts[2]:
            try:
                name = parts[0]
                free_gb = int(parts[1]) / (1024**3) if parts[1] else 0
                total_gb = int(parts[2]) / (1024**3) if parts[2] else 0
                if total_gb > 0:
                    disks.append({
                        'name': name,
                        'totalGB': round(total_gb, 1),
                        'freeGB': round(free_gb, 1),
                        'usedPercent': round((1 - free_gb / total_gb) * 100, 1),
                    })
            except ValueError:
                pass
    device['disks'] = disks

    # Services
    check_romeo_services('romeo', device)

    # Uptime from boot output
    match = re.search(r'(\d{1,2}/\d{1,2}/\d{4})', boot_out)
    if match:
        device['uptime'] = boot_out.split('\n')[-1].strip() if boot_out.strip() else None

    return device


def collect_jetson():
    """Collect JETSON status."""
    device = {
        'id': 'jetson',
        'name': 'JETSON',
        'ip': '192.168.1.171',
        'type': 'linux',
        'processor': 'Jetson AI',
        'online': False,
        'services': [],
        'warnings': [],
        'errors': [],
    }

    out, ok = ssh_cmd('jetson', 'uptime && free -h && df -h /')
    if not ok:
        return device

    device['online'] = True

    lines = out.split('\n')

    # Uptime
    if lines:
        match = re.search(r'up\s+(.+?),\s+\d+\s+user', lines[0])
        device['uptime'] = match.group(1).strip() if match else lines[0].split(',')[0]

    # CPU from uptime load average
    match = re.search(r'load average:\s*([\d.]+)', lines[0] if lines else '')
    if match:
        load = float(match.group(1))
        # Jetson has 6 cores, so load/6 * 100 = CPU%
        device['cpu'] = {'percent': min(round(load / 6 * 100), 100)}
    else:
        device['cpu'] = {'percent': 99}  # Normal for Jetson

    # Memory
    total, free = parse_linux_free(out)
    if total > 0:
        device['ram'] = {
            'totalGB': round(total, 1),
            'freeGB': round(free, 1),
            'usedPercent': round((1 - free / total) * 100, 1),
        }
        if free < 0.5:
            device['warnings'].append(f"RAM molto bassa: {free:.1f} GB liberi")

    # Disk
    device['disks'] = parse_linux_df(out)

    return device


def collect_book_paul():
    """Collect BOOK-PAUL status."""
    device = {
        'id': 'book-paul',
        'name': 'BOOK-PAUL',
        'ip': '192.168.1.55',
        'type': 'windows',
        'processor': 'Snapdragon X Elite',
        'online': False,
        'services': [],
        'warnings': [],
        'errors': [],
    }

    boot_out, ok = ssh_cmd('book-paul', 'powershell -Command "Get-CimInstance Win32_OperatingSystem | Select-Object LastBootUpTime"')
    if not ok:
        return device

    device['online'] = True

    # CPU
    cpu_out, _ = ssh_cmd('book-paul', 'powershell -Command "(Get-CimInstance Win32_Processor).LoadPercentage"')
    for line in cpu_out.split('\n'):
        line = line.strip()
        if line.isdigit():
            device['cpu'] = {'percent': int(line)}
            break
    if not device.get('cpu'):
        device['cpu'] = {'percent': 0}

    # Memory
    mem_out, _ = ssh_cmd('book-paul', 'powershell -Command "(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory; (Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize"')
    lines = [l.strip() for l in mem_out.split('\n') if l.strip().isdigit()]
    if len(lines) >= 2:
        free_kb = int(lines[0])
        total_kb = int(lines[1])
        device['ram'] = {
            'totalGB': round(total_kb / 1048576, 1),
            'freeGB': round(free_kb / 1048576, 1),
            'usedPercent': round((1 - free_kb / total_kb) * 100, 1) if total_kb > 0 else 0,
        }

    # Disks
    disk_out, _ = ssh_cmd('book-paul', 'powershell -Command "Get-CimInstance Win32_LogicalDisk | ForEach-Object { Write-Output (\\\"$($_.DeviceID)|$($_.FreeSpace)|$($_.Size)\\\") }"')
    disks = []
    for line in disk_out.split('\n'):
        parts = line.strip().split('|')
        if len(parts) == 3 and parts[2]:
            try:
                name = parts[0]
                free_gb = int(parts[1]) / (1024**3) if parts[1] else 0
                total_gb = int(parts[2]) / (1024**3) if parts[2] else 0
                if total_gb > 0:
                    disks.append({
                        'name': name,
                        'totalGB': round(total_gb, 1),
                        'freeGB': round(free_gb, 1),
                        'usedPercent': round((1 - free_gb / total_gb) * 100, 1),
                    })
            except ValueError:
                pass
    device['disks'] = disks

    return device


def collect_laura_pc():
    """Collect LAURA-PC (often offline)."""
    device = {
        'id': 'laura-pc',
        'name': 'LAURA-PC',
        'ip': '192.168.1.21',
        'type': 'windows',
        'online': False,
        'services': [],
        'warnings': [],
        'errors': [],
    }

    online = ping_host('192.168.1.21')
    device['online'] = online
    if not online:
        device['warnings'].append('PC spento (normale)')
    return device


def collect_rpi():
    """Collect RPI (often unplugged)."""
    device = {
        'id': 'rpi',
        'name': 'Raspberry Pi',
        'ip': '192.168.1.225',
        'type': 'linux',
        'online': False,
        'services': [],
        'warnings': [],
        'errors': [],
    }

    online = ping_host('192.168.1.225')
    device['online'] = online
    if not online:
        device['warnings'].append('Staccato (normale)')
    return device


def collect_paul_local():
    """Collect PAUL PC (localhost) — Paul Bot."""
    device = {
        'id': 'paul',
        'name': 'PAUL',
        'ip': '192.168.1.109',
        'type': 'local',
        'online': True,
        'services': [],
        'warnings': [],
        'errors': [],
    }

    # Paul Bot
    task_out, _ = local_cmd('tasklist /fi "imagename eq pythonw.exe"')
    has_pythonw = 'pythonw.exe' in task_out

    device['services'].append({
        'name': 'Paul Bot',
        'type': 'bot',
        'status': 'ok' if has_pythonw else 'ko',
        'details': 'pythonw.exe attivo' if has_pythonw else 'Processo non trovato',
    })
    if not has_pythonw:
        device['errors'].append('Paul Bot non attivo!')

    return device


# ─── Build Agents Summary ──────────────────────────────────────────

def build_agents_summary(devices):
    """Extract agent info from device services."""
    agents = []
    agent_map = {
        'Giulio': {'emoji': '\uD83E\uDD1E', 'device': 'LAPA10'},
        'Stella': {'emoji': '\u2B50', 'device': 'STELLA'},
        'Romeo': {'emoji': '\uD83C\uDFF9', 'device': 'ROMEO'},
        'Vanessa': {'emoji': '\uD83D\uDC83', 'device': 'LAPA-SALES'},
        'Sergio Bot': {'emoji': '\uD83D\uDCBC', 'device': 'LAPA-SALES'},
        'Magazzino Bot': {'emoji': '\uD83D\uDCE6', 'device': 'LAPA10'},
        'Paul Bot': {'emoji': '\uD83D\uDC51', 'device': 'PAUL'},
    }

    for dev in devices:
        for svc in dev.get('services', []):
            if svc['name'] in agent_map:
                info = agent_map[svc['name']]
                agents.append({
                    'name': svc['name'],
                    'type': svc['type'],
                    'device': info['device'],
                    'status': svc['status'],
                    'port': svc.get('port'),
                    'details': svc.get('details'),
                    'emoji': info['emoji'],
                })

    return agents


# ─── Build Summary ──────────────────────────────────────────────────

def build_summary(devices):
    """Build summary stats."""
    total = len(devices)
    online = sum(1 for d in devices if d['online'])
    offline = total - online

    all_services = []
    for d in devices:
        all_services.extend(d.get('services', []))

    return {
        'totalDevices': total,
        'online': online,
        'offline': offline,
        'totalServices': len(all_services),
        'servicesOk': sum(1 for s in all_services if s['status'] == 'ok'),
        'servicesWarning': sum(1 for s in all_services if s['status'] == 'warning'),
        'servicesKo': sum(1 for s in all_services if s['status'] == 'ko'),
    }


# ─── Main ───────────────────────────────────────────────────────────

def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] LAPA Infra Collector starting...")
    start = time.time()

    # Collect all devices in parallel
    collectors = [
        ('NAS', collect_nas),
        ('LAPA10', lambda: collect_windows_pc('lapa10', 'lapa10', 'LAPA10', '192.168.1.37', 'i7-1165G7', check_lapa10_services)),
        ('LAPA-SALES', lambda: collect_windows_pc('lapa-sales', 'lapa-sales', 'LAPA-SALES', '192.168.1.58', 'i5-1135G7', check_lapa_sales_services)),
        ('STELLA', collect_stella),
        ('ROMEO', collect_romeo),
        ('BOOK-PAUL', collect_book_paul),
        ('JETSON', collect_jetson),
        ('LAURA-PC', collect_laura_pc),
        ('RPI', collect_rpi),
        ('PAUL', collect_paul_local),
    ]

    devices = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(fn): name for name, fn in collectors}
        for future in as_completed(futures):
            name = futures[future]
            try:
                result = future.result(timeout=30)
                devices.append(result)
                status = 'ONLINE' if result['online'] else 'OFFLINE'
                svcs = len(result.get('services', []))
                errs = len(result.get('errors', []))
                print(f"  [{name}] {status} - {svcs} servizi, {errs} errori")
            except Exception as e:
                print(f"  [{name}] ERRORE: {e}")
                devices.append({
                    'id': name.lower().replace('-', '_'),
                    'name': name,
                    'ip': 'unknown',
                    'type': 'windows',
                    'online': False,
                    'services': [],
                    'warnings': [],
                    'errors': [f'Collector error: {str(e)}'],
                })

    # Build agents summary
    agents = build_agents_summary(devices)
    summary = build_summary(devices)

    # Odoo check (simple — just count orders)
    odoo = {'connected': False, 'ordersToday': 0}
    # We skip Odoo from the collector — it's checked via MCP in the API if needed

    # Build payload
    payload = {
        'timestamp': datetime.now().isoformat(),
        'devices': devices,
        'agents': agents,
        'odoo': odoo,
        'summary': summary,
    }

    elapsed = time.time() - start
    print(f"\n  Collection done in {elapsed:.1f}s")
    print(f"  Devices: {summary['totalDevices']} ({summary['online']} online, {summary['offline']} offline)")
    print(f"  Services: {summary['servicesOk']} OK, {summary['servicesWarning']} WARN, {summary['servicesKo']} KO")
    print(f"  Agents: {len(agents)}")

    # POST to API
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            INFRA_API_URL,
            data=data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {INFRA_SECRET}',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            print(f"  API response: {result.get('message', 'OK')}")
    except urllib.error.HTTPError as e:
        print(f"  API HTTP Error: {e.code} - {e.read().decode('utf-8', errors='replace')}")
    except Exception as e:
        print(f"  API Error: {e}")

    print(f"[{datetime.now().strftime('%H:%M:%S')}] Done.")


if __name__ == '__main__':
    main()
