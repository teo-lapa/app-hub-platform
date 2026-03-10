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

# --- Configuration ---

INFRA_API_URL = "https://staging.hub.lapa.ch/api/infra-monitor/update"
INFRA_SECRET = "lapa-infra-2026-secret"

SSH_TIMEOUT = 25
PING_TIMEOUT = 3

# Explicit paths for Task Scheduler context
import os
SSH_CONFIG = os.path.expanduser("~/.ssh/config")
SSH_KEY = os.path.expanduser("~/.ssh/id_ed25519")
HOME_DIR = os.path.expanduser("~")
# Use Git for Windows SSH (not Windows OpenSSH which has different behavior)
SSH_EXE = r"C:\Program Files\Git\usr\bin\ssh.exe"
if not os.path.exists(SSH_EXE):
    SSH_EXE = "ssh"  # fallback


def ssh_cmd(host, cmd, timeout=SSH_TIMEOUT):
    try:
        ssh_args = [
            SSH_EXE,
            "-F", "C:/Users/lapa/.ssh/config",
            "-i", "C:/Users/lapa/.ssh/id_ed25519",
            "-o", "ConnectTimeout=8",
            "-o", "StrictHostKeyChecking=no",
            "-o", "BatchMode=yes",
            "-o", "UserKnownHostsFile=C:/Users/lapa/.ssh/known_hosts",
            host, cmd
        ]
        # Romeo uses id_rsa
        if host in ('romeo', 'romeo-ts'):
            ssh_args[4] = "C:/Users/lapa/.ssh/id_rsa"
        env = {**os.environ, "HOME": "C:\\Users\\lapa", "USERPROFILE": "C:\\Users\\lapa"}
        result = subprocess.run(
            ssh_args, capture_output=True, text=True, timeout=timeout, env=env
        )
        return result.stdout.strip(), result.returncode == 0
    except subprocess.TimeoutExpired:
        return "", False
    except Exception as e:
        return str(e), False


def local_cmd(cmd, timeout=SSH_TIMEOUT):
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, shell=True
        )
        return result.stdout.strip(), result.returncode == 0
    except Exception as e:
        return str(e), False


def ping_host(ip, timeout=PING_TIMEOUT):
    try:
        result = subprocess.run(
            ["ping", "-n", "1", "-w", str(timeout * 1000), ip],
            capture_output=True, text=True, timeout=timeout + 2
        )
        return result.returncode == 0
    except Exception:
        return False


def parse_wmic_memory(output):
    total = free = 0
    for line in output.split('\n'):
        line = line.strip()
        if line.startswith('FreePhysicalMemory='):
            free = int(line.split('=')[1]) / 1048576
        elif line.startswith('TotalVisibleMemorySize='):
            total = int(line.split('=')[1]) / 1048576
    return total, free


def parse_wmic_disks(output):
    disks = []
    current = {}
    for line in output.split('\n'):
        line = line.strip()
        if '=' in line:
            key, val = line.split('=', 1)
            current[key.strip().lower()] = val.strip()
        # Process record when we have all 3 fields (caption, freespace, size)
        if current.get('caption') and current.get('size') and current.get('freespace'):
            try:
                total_gb = int(current['size']) / (1024**3)
                free_gb = int(current['freespace']) / (1024**3)
                if total_gb > 0:
                    disks.append({
                        'name': current['caption'],
                        'totalGB': round(total_gb, 1),
                        'freeGB': round(free_gb, 1),
                        'usedPercent': round((1 - free_gb / total_gb) * 100, 1),
                    })
            except (ValueError, ZeroDivisionError):
                pass
            current = {}
    return disks


def parse_wmic_cpu(output):
    for line in output.split('\n'):
        line = line.strip()
        if line.isdigit():
            return int(line)
    return 0


def parse_wmic_temp(output):
    for line in output.split('\n'):
        line = line.strip()
        if line.isdigit():
            val = int(line)
            if val > 2000:
                return round((val - 2732) / 10, 1)
    return None


def parse_boot_time(output):
    return output.strip() if output.strip() else None


def parse_linux_free(output):
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


# --- Device Collectors ---

def collect_nas():
    device = {
        'id': 'nas', 'name': 'NAS Synology', 'ip': '192.168.1.91',
        'type': 'nas', 'processor': 'DS923+', 'online': False,
        'services': [], 'warnings': [], 'errors': [],
    }
    uptime_out, ok = ssh_cmd('nas', 'uptime')
    if not ok:
        return device
    device['online'] = True
    match = re.search(r'up\s+(.+?),\s+\d+\s+user', uptime_out)
    device['uptime'] = match.group(1).strip() if match else uptime_out.split(',')[0]

    mem_out, _ = ssh_cmd('nas', 'free -h')
    total, free = parse_linux_free(mem_out)
    if total > 0:
        device['ram'] = {'totalGB': round(total, 1), 'freeGB': round(free, 1),
                         'usedPercent': round((1 - free / total) * 100, 1)}

    disk_out, _ = ssh_cmd('nas', 'df -h /volume1 /volume3 /volume4')
    device['disks'] = parse_linux_df(disk_out)
    for d in device['disks']:
        if d['usedPercent'] > 90:
            device['errors'].append(f"Disco {d['name']} al {d['usedPercent']}%!")
        elif d['usedPercent'] > 80:
            device['warnings'].append(f"Disco {d['name']} al {d['usedPercent']}%")

    docker_out, docker_ok = ssh_cmd('nas', '/usr/local/bin/docker ps --format "{{.Names}}|{{.Status}}"')
    if docker_ok:
        for line in docker_out.split('\n'):
            if '|' in line:
                name, status = line.split('|', 1)
                is_up = 'Up' in status
                device['services'].append({
                    'name': name.strip(), 'type': 'docker',
                    'status': 'ok' if is_up else 'ko', 'details': status.strip(),
                })
                if not is_up:
                    device['errors'].append(f"Container {name.strip()} non attivo!")

    health_out, _ = ssh_cmd('nas', 'tail -1 /volume4/docker_1/monitoring/health-check.log')
    if health_out:
        hok = 'OK' in health_out.upper() or 'healthy' in health_out.lower()
        device['services'].append({'name': 'Health Check', 'type': 'service',
                                   'status': 'ok' if hok else 'warning', 'details': health_out[-60:]})

    sync_out, _ = ssh_cmd('nas', 'tail -3 /volume4/docker_1/restore/scripts/daily_sync.log')
    if sync_out:
        sok = any(w in sync_out.lower() for w in ['success', 'complet', 'done'])
        device['services'].append({'name': 'Daily Sync', 'type': 'service',
                                   'status': 'ok' if sok else 'warning',
                                   'details': sync_out.split('\n')[-1][-60:]})
    return device


def collect_windows_pc(host, device_id, name, ip, processor, services_check=None):
    device = {
        'id': device_id, 'name': name, 'ip': ip, 'type': 'windows',
        'processor': processor, 'online': False,
        'services': [], 'warnings': [], 'errors': [],
    }
    boot_out, ok = ssh_cmd(host, 'systeminfo | findstr /C:"Tempo di avvio"')
    if not ok:
        boot_out, ok = ssh_cmd(host, 'systeminfo | findstr /C:"System Boot Time"')
    if not ok:
        return device
    device['online'] = True
    device['uptime'] = parse_boot_time(boot_out)

    cpu_out, _ = ssh_cmd(host, 'wmic cpu get loadpercentage')
    cpu_pct = parse_wmic_cpu(cpu_out)
    temp_out, _ = ssh_cmd(host, 'wmic /namespace:\\\\root\\wmi PATH MSAcpi_ThermalZoneTemperature get CurrentTemperature')
    temp = parse_wmic_temp(temp_out)
    device['cpu'] = {'percent': cpu_pct}
    if temp is not None:
        device['cpu']['temp'] = temp
        if temp > 80:
            device['warnings'].append(f"Temperatura alta: {temp}C")

    mem_out, _ = ssh_cmd(host, 'wmic os get FreePhysicalMemory,TotalVisibleMemorySize /format:list')
    total, free = parse_wmic_memory(mem_out)
    if total > 0:
        device['ram'] = {'totalGB': round(total, 1), 'freeGB': round(free, 1),
                         'usedPercent': round((1 - free / total) * 100, 1)}
        if free < 2:
            device['warnings'].append(f"RAM libera bassa: {free:.1f} GB")

    disk_out, _ = ssh_cmd(host, 'wmic logicaldisk get caption,freespace,size /format:list')
    device['disks'] = parse_wmic_disks(disk_out)
    for d in device['disks']:
        if d['usedPercent'] > 90:
            device['errors'].append(f"Disco {d['name']} al {d['usedPercent']}%!")
        elif d['usedPercent'] > 80:
            device['warnings'].append(f"Disco {d['name']} al {d['usedPercent']}%")

    if services_check:
        services_check(host, device)
    return device


def check_lapa10_services(host, device):
    ps_out, ps_ok = ssh_cmd(host, 'wsl -u lapa -- ps aux')
    has_openclaw = 'openclaw' in ps_out if ps_ok else False
    port_out, _ = ssh_cmd(host, 'netstat -an | findstr 18789')
    port_listening = 'LISTENING' in port_out
    giulio_ok = has_openclaw and port_listening
    device['services'].append({
        'name': 'Giulio', 'type': 'openclaw', 'status': 'ok' if giulio_ok else 'ko',
        'port': 18789, 'details': 'OpenClaw + Gateway attivi' if giulio_ok else 'Processo mancante o porta non attiva',
    })
    if not giulio_ok:
        device['errors'].append('Giulio OpenClaw non attivo!')

    task_out, _ = ssh_cmd(host, 'tasklist /fi "imagename eq pythonw.exe"')
    has_pythonw = 'pythonw.exe' in task_out
    device['services'].append({
        'name': 'Magazzino Bot', 'type': 'bot',
        'status': 'ok' if has_pythonw else 'ko',
        'details': 'pythonw.exe attivo' if has_pythonw else 'Processo non trovato',
    })
    if not has_pythonw:
        device['errors'].append('Magazzino Bot non attivo!')

    sorv_out, _ = ssh_cmd(host, 'netstat -an | findstr 9999')
    sorv_listening = 'LISTENING' in sorv_out
    device['services'].append({
        'name': 'Sorveglianza', 'type': 'port', 'status': 'ok' if sorv_listening else 'ko',
        'port': 9999, 'details': 'Porta 9999 attiva' if sorv_listening else 'Porta 9999 non attiva',
    })
    if not sorv_listening:
        device['errors'].append('Sorveglianza non attiva!')


def check_lapa_sales_services(host, device):
    task_out, _ = ssh_cmd(host, 'tasklist /fi "imagename eq pythonw.exe"')
    has_pythonw = 'pythonw.exe' in task_out
    device['services'].append({
        'name': 'Sergio Bot', 'type': 'bot',
        'status': 'ok' if has_pythonw else 'ko',
        'details': 'pythonw.exe attivo' if has_pythonw else 'Processo non trovato',
    })
    if not has_pythonw:
        device['errors'].append('Sergio Bot non attivo!')

    ps_out, ps_ok = ssh_cmd(host, 'wsl -d Ubuntu-22.04 -u lapa -- ps aux')
    has_openclaw = 'openclaw' in ps_out if ps_ok else False
    port_out, _ = ssh_cmd(host, 'netstat -an | findstr 18791')
    port_listening = 'LISTENING' in port_out
    vanessa_ok = has_openclaw and port_listening
    device['services'].append({
        'name': 'Vanessa', 'type': 'openclaw', 'status': 'ok' if vanessa_ok else 'ko',
        'port': 18791, 'details': 'OpenClaw + Gateway attivi' if vanessa_ok else 'Processo mancante o porta non attiva',
    })
    if not vanessa_ok:
        device['errors'].append('Vanessa OpenClaw non attiva!')


def collect_powershell_pc(host, device_id, name, ip, processor, services_check=None):
    """Collect metrics from Windows PCs using a single combined PowerShell command."""
    device = {
        'id': device_id, 'name': name, 'ip': ip, 'type': 'windows',
        'processor': processor, 'online': False,
        'services': [], 'warnings': [], 'errors': [],
    }
    # Single combined PowerShell command (base64 encoded to avoid quoting issues)
    import base64
    ps_script = (
        '$os=Get-CimInstance Win32_OperatingSystem;'
        '$cpu=Get-CimInstance Win32_Processor;'
        '$disks=Get-CimInstance Win32_LogicalDisk;'
        '$temp=try{(Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace root/wmi -EA Stop).CurrentTemperature}catch{0};'
        'Write-Output "BOOT|$($os.LastBootUpTime)";'
        'Write-Output "CPU|$($cpu.LoadPercentage)";'
        'Write-Output "TEMP|$temp";'
        'Write-Output "MEM|$($os.FreePhysicalMemory)|$($os.TotalVisibleMemorySize)";'
        'foreach($d in $disks){Write-Output "DISK|$($d.DeviceID)|$($d.FreeSpace)|$($d.Size)"}'
    )
    encoded = base64.b64encode(ps_script.encode('utf-16-le')).decode('ascii')
    out, ok = ssh_cmd(host, f'powershell -EncodedCommand {encoded}', timeout=30)
    if not ok:
        return device
    device['online'] = True

    for line in out.split('\n'):
        line = line.strip()
        if not line or '|' not in line:
            continue
        parts = line.split('|')
        tag = parts[0]

        if tag == 'BOOT' and len(parts) >= 2:
            device['uptime'] = parts[1].strip()

        elif tag == 'CPU' and len(parts) >= 2:
            try:
                device['cpu'] = {'percent': int(parts[1].strip())}
            except ValueError:
                device['cpu'] = {'percent': 0}

        elif tag == 'TEMP' and len(parts) >= 2:
            try:
                val = int(parts[1].strip())
                if val > 2000:
                    if 'cpu' not in device:
                        device['cpu'] = {'percent': 0}
                    device['cpu']['temp'] = round((val - 2732) / 10, 1)
            except ValueError:
                pass

        elif tag == 'MEM' and len(parts) >= 3:
            try:
                free_kb = int(parts[1].strip())
                total_kb = int(parts[2].strip())
                if total_kb > 0:
                    device['ram'] = {
                        'totalGB': round(total_kb / 1048576, 1),
                        'freeGB': round(free_kb / 1048576, 1),
                        'usedPercent': round((1 - free_kb / total_kb) * 100, 1),
                    }
            except ValueError:
                pass

        elif tag == 'DISK' and len(parts) >= 4:
            try:
                dn = parts[1].strip()
                fg = int(parts[2].strip()) / (1024**3) if parts[2].strip() else 0
                tg = int(parts[3].strip()) / (1024**3) if parts[3].strip() else 0
                if tg > 0:
                    device.setdefault('disks', []).append({
                        'name': dn, 'totalGB': round(tg, 1), 'freeGB': round(fg, 1),
                        'usedPercent': round((1 - fg / tg) * 100, 1),
                    })
            except ValueError:
                pass

    if 'cpu' not in device:
        device['cpu'] = {'percent': 0}
    if 'disks' not in device:
        device['disks'] = []

    for d in device.get('disks', []):
        if d['name'] == 'C:' and d['freeGB'] < 20:
            device['warnings'].append(f"Disco C: solo {d['freeGB']:.1f} GB liberi!")
        if d['usedPercent'] > 90:
            device['errors'].append(f"Disco {d['name']} al {d['usedPercent']}%!")

    if services_check:
        services_check(host, device)
    return device


def check_stella_services(host, device):
    ps_out, ps_ok = ssh_cmd(host, 'powershell -Command "Get-Process wsl -ErrorAction SilentlyContinue | Select-Object ProcessName,Id"')
    has_wsl = 'wsl' in ps_out.lower() if ps_ok else False
    port_raw, _ = ssh_cmd(host, 'netstat -an | findstr 18790')
    port_listening = 'LISTENING' in port_raw
    stella_ok = has_wsl and port_listening
    device['services'].append({
        'name': 'Stella', 'type': 'openclaw', 'status': 'ok' if stella_ok else 'ko',
        'port': 18790, 'details': 'WSL + Gateway attivi' if stella_ok else 'WSL o porta non attiva',
    })
    if not stella_ok:
        device['errors'].append('Stella OpenClaw non attiva!')


def check_romeo_services(host, device):
    ps_out, ps_ok = ssh_cmd(host, 'powershell -Command "Get-Process wsl -ErrorAction SilentlyContinue | Select-Object ProcessName,Id"')
    has_wsl = 'wsl' in ps_out.lower() if ps_ok else False
    port_raw, _ = ssh_cmd(host, 'netstat -an | findstr 18790')
    port_listening = 'LISTENING' in port_raw
    romeo_ok = has_wsl and port_listening
    device['services'].append({
        'name': 'Romeo', 'type': 'openclaw', 'status': 'ok' if romeo_ok else 'ko',
        'port': 18790, 'details': 'WSL + Gateway attivi' if romeo_ok else 'WSL o porta non attiva',
    })
    if not romeo_ok:
        device['errors'].append('Romeo OpenClaw non attivo!')


def collect_jetson():
    device = {
        'id': 'jetson', 'name': 'JETSON', 'ip': '192.168.1.171',
        'type': 'linux', 'processor': 'Jetson AI', 'online': False,
        'services': [], 'warnings': [], 'errors': [],
    }
    out, ok = ssh_cmd('jetson', 'uptime && free -h && df -h /')
    if not ok:
        return device
    device['online'] = True
    lines = out.split('\n')
    if lines:
        match = re.search(r'up\s+(.+?),\s+\d+\s+user', lines[0])
        device['uptime'] = match.group(1).strip() if match else lines[0].split(',')[0]
    match = re.search(r'load average:\s*([\d.]+)', lines[0] if lines else '')
    if match:
        load = float(match.group(1))
        device['cpu'] = {'percent': min(round(load / 6 * 100), 100)}
    else:
        device['cpu'] = {'percent': 99}
    total, free = parse_linux_free(out)
    if total > 0:
        device['ram'] = {'totalGB': round(total, 1), 'freeGB': round(free, 1),
                         'usedPercent': round((1 - free / total) * 100, 1)}
        if free < 0.5:
            device['warnings'].append(f"RAM molto bassa: {free:.1f} GB liberi")
    device['disks'] = parse_linux_df(out)
    return device


def collect_simple_ping(device_id, name, ip, note, device_type='windows'):
    device = {
        'id': device_id, 'name': name, 'ip': ip, 'type': device_type,
        'online': False, 'services': [], 'warnings': [], 'errors': [],
    }
    device['online'] = ping_host(ip)
    if not device['online']:
        device['warnings'].append(note)
    return device


def collect_paul_local():
    device = {
        'id': 'paul', 'name': 'PAUL', 'ip': '192.168.1.109',
        'type': 'local', 'processor': 'i7-11700', 'online': True,
        'services': [], 'warnings': [], 'errors': [],
    }
    # CPU
    cpu_out, _ = local_cmd('wmic cpu get loadpercentage')
    device['cpu'] = {'percent': parse_wmic_cpu(cpu_out)}
    temp_out, _ = local_cmd('wmic /namespace:\\\\root\\wmi PATH MSAcpi_ThermalZoneTemperature get CurrentTemperature')
    temp = parse_wmic_temp(temp_out)
    if temp is not None:
        device['cpu']['temp'] = temp
        if temp > 80:
            device['warnings'].append(f"Temperatura alta: {temp}C")
    # RAM
    mem_out, _ = local_cmd('wmic os get FreePhysicalMemory,TotalVisibleMemorySize /format:list')
    total, free = parse_wmic_memory(mem_out)
    if total > 0:
        device['ram'] = {'totalGB': round(total, 1), 'freeGB': round(free, 1),
                         'usedPercent': round((1 - free / total) * 100, 1)}
        if free < 2:
            device['warnings'].append(f"RAM libera bassa: {free:.1f} GB")
    # Disks
    disk_out, _ = local_cmd('wmic logicaldisk get caption,freespace,size /format:list')
    device['disks'] = parse_wmic_disks(disk_out)
    for d in device['disks']:
        if d['usedPercent'] > 90:
            device['errors'].append(f"Disco {d['name']} al {d['usedPercent']}%!")
        elif d['usedPercent'] > 80:
            device['warnings'].append(f"Disco {d['name']} al {d['usedPercent']}%")
    # Uptime
    boot_out, _ = local_cmd('systeminfo | findstr /C:"Tempo di avvio"')
    if not boot_out:
        boot_out, _ = local_cmd('systeminfo | findstr /C:"System Boot Time"')
    device['uptime'] = parse_boot_time(boot_out) if boot_out else None
    # Paul Bot
    task_out, _ = local_cmd('tasklist')
    has_pythonw = 'pythonw' in task_out.lower()
    device['services'].append({
        'name': 'Paul Bot', 'type': 'bot',
        'status': 'ok' if has_pythonw else 'ko',
        'details': 'pythonw attivo' if has_pythonw else 'Processo non trovato',
    })
    if not has_pythonw:
        device['errors'].append('Paul Bot non attivo!')
    return device


def build_agents_summary(devices):
    agents = []
    agent_map = {
        'Giulio': {'emoji': '\U0001F91E', 'device': 'LAPA10'},
        'Stella': {'emoji': '\u2B50', 'device': 'STELLA'},
        'Romeo': {'emoji': '\U0001F3F9', 'device': 'ROMEO'},
        'Vanessa': {'emoji': '\U0001F483', 'device': 'LAPA-SALES'},
        'Sergio Bot': {'emoji': '\U0001F4BC', 'device': 'LAPA-SALES'},
        'Magazzino Bot': {'emoji': '\U0001F4E6', 'device': 'LAPA10'},
        'Paul Bot': {'emoji': '\U0001F451', 'device': 'PAUL'},
    }
    for dev in devices:
        for svc in dev.get('services', []):
            if svc['name'] in agent_map:
                info = agent_map[svc['name']]
                agents.append({
                    'name': svc['name'], 'type': svc['type'],
                    'device': info['device'], 'status': svc['status'],
                    'port': svc.get('port'), 'details': svc.get('details'),
                    'emoji': info['emoji'],
                })
    return agents


def build_summary(devices):
    total = len(devices)
    online = sum(1 for d in devices if d['online'])
    all_services = []
    for d in devices:
        all_services.extend(d.get('services', []))
    return {
        'totalDevices': total, 'online': online, 'offline': total - online,
        'totalServices': len(all_services),
        'servicesOk': sum(1 for s in all_services if s['status'] == 'ok'),
        'servicesWarning': sum(1 for s in all_services if s['status'] == 'warning'),
        'servicesKo': sum(1 for s in all_services if s['status'] == 'ko'),
    }


def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] LAPA Infra Collector starting...")
    start = time.time()

    collectors = [
        ('NAS', collect_nas),
        ('LAPA10', lambda: collect_windows_pc('lapa10', 'lapa10', 'LAPA10', '192.168.1.37', 'i7-1165G7', check_lapa10_services)),
        ('LAPA-SALES', lambda: collect_windows_pc('lapa-sales', 'lapa-sales', 'LAPA-SALES', '192.168.1.58', 'i5-1135G7', check_lapa_sales_services)),
        ('STELLA', lambda: collect_powershell_pc('stella', 'stella', 'STELLA', '192.168.1.157', 'i7-12700T', check_stella_services)),
        ('ROMEO', lambda: collect_powershell_pc('romeo', 'romeo', 'ROMEO', '192.168.1.237', 'Ryzen 5 5500U', check_romeo_services)),
        ('BOOK-PAUL', lambda: collect_powershell_pc('book-paul', 'book-paul', 'BOOK-PAUL', '192.168.1.55', 'Snapdragon X Elite')),
        ('JETSON', collect_jetson),
        ('LAURA-PC', lambda: collect_simple_ping('laura-pc', 'LAURA-PC', '192.168.1.21', 'PC spento (normale)')),
        ('RPI', lambda: collect_simple_ping('rpi', 'Raspberry Pi', '192.168.1.225', 'Staccato (normale)', device_type='linux')),
        ('PAUL', collect_paul_local),
    ]

    devices = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fn): name for name, fn in collectors}
        for future in as_completed(futures):
            name = futures[future]
            try:
                result = future.result(timeout=60)
                devices.append(result)
                status = 'ONLINE' if result['online'] else 'OFFLINE'
                svcs = len(result.get('services', []))
                errs = len(result.get('errors', []))
                print(f"  [{name}] {status} - {svcs} servizi, {errs} errori")
            except Exception as e:
                print(f"  [{name}] ERRORE: {e}")
                devices.append({
                    'id': name.lower().replace('-', '_'), 'name': name, 'ip': 'unknown',
                    'type': 'windows', 'online': False,
                    'services': [], 'warnings': [], 'errors': [f'Collector error: {str(e)}'],
                })

    agents = build_agents_summary(devices)
    summary = build_summary(devices)

    # Check Odoo production (Odoo.sh)
    odoo = {'connected': False, 'ordersToday': 0}
    try:
        odoo_req = urllib.request.Request(
            'https://lapadevadmin-lapa-v2.odoo.com/web/login',
            headers={'User-Agent': 'LAPA-InfraCollector/1.0'},
        )
        with urllib.request.urlopen(odoo_req, timeout=10) as resp:
            odoo['connected'] = resp.status == 200
            odoo['details'] = 'Odoo.sh raggiungibile'
    except urllib.error.HTTPError as e:
        # Even 303/302 redirects mean server is alive
        if e.code in (301, 302, 303):
            odoo['connected'] = True
            odoo['details'] = 'Odoo.sh raggiungibile (redirect)'
        else:
            odoo['connected'] = False
            odoo['details'] = f'HTTP {e.code}'
    except Exception as e:
        odoo['connected'] = False
        odoo['details'] = f'Non raggiungibile: {str(e)[:50]}'

    payload = {
        'timestamp': datetime.now().isoformat(),
        'devices': devices, 'agents': agents,
        'odoo': odoo, 'summary': summary,
    }

    elapsed = time.time() - start
    print(f"\n  Collection done in {elapsed:.1f}s")
    print(f"  Devices: {summary['totalDevices']} ({summary['online']} online, {summary['offline']} offline)")
    print(f"  Services: {summary['servicesOk']} OK, {summary['servicesWarning']} WARN, {summary['servicesKo']} KO")
    print(f"  Agents: {len(agents)}")

    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            INFRA_API_URL, data=data,
            headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {INFRA_SECRET}'},
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
