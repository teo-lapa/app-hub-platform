# Credenziali Jetson Nano

## Informazioni di connessione

- **Host**: 192.168.1.171
- **Porta SSH**: 22
- **Porta API**: 3100
- **Username**: lapap
- **Password**: lapa201180

## Connessione SSH

### Con password:
```bash
ssh lapap@192.168.1.171
# Password: lapa201180
```

### Con chiave SSH (consigliato):
```bash
ssh -i ~/.ssh/id_rsa_jetson lapap@192.168.1.171
```

## Chiave SSH Privata

Salvare questo contenuto in `~/.ssh/id_rsa_jetson` (permessi 600):

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAQEAp+SnszspOlgYJq6LwFL3qLDRVDjjCe6vrOumGrafDzwpuEQJDG54
HoeLP+/z2O0lRVIes918puNERt1+EkXAtIc6pTY8ckHNAfnxxM8q2rc7JB0/kB3vSmrWYQ
TRpP8XtwK2pHSte7CQVqXgMrR+3ZyoTKRIfCxOVyS5e8RbY4gvtOvj7Nawfyvy1oxDmPcl
EaVloZFNmEitJ+hmS27ysA+rjI71B0HUhYZMfC1UoPAHpCdf6gN2yb+gT1r/+F52mUfFiH
6zKCcoI5ANbwZpGS2eIn6ikGR1YQJAYcWy7COvpk4YlVm8RqM/R6Q54sP1OHHhx9DyMmSx
9eAZcwLSAQAAA8DQ61nM0OtZzAAAAAdzc2gtcnNhAAABAQCn5KezOyk6WBgmrovAUveosN
FUOOMJ7q+s66Yatp8PPCm4RAkMbngeh4s/7/PY7SVFUh6z3Xym40RG3X4SRcC0hzqlNjxy
Qc0B+fHEzyratzskHT+QHe9KatZhBNGk/xe3ArakdK17sJBWpeAytH7dnKhMpEh8LE5XJL
l7xFtjiC+06+Ps1rB/K/LWjEOY9yURpWWhkU2YSK0n6GZLbvKwD6uMjvUHQdSFhkx8LVSg
8AekJ1/qA3bJv6BPWv/4XnaZR8WIfrMoJygjkA1vBmkZLZ4ifqKQZHVhAkBhxbLsI6+mTh
iVWbxGoz9HpDniw/U4ceHH0PIyZLH14BlzAtIBAAAAAwEAAQAAAQABruAjgtdR92oekSdj
gTFsZoFit8NG6TanpCEhKW2EyJSefUgd8MmRfMhflrc6GH6EKGOYaAME5Uhc8YF/C2X4KV
bkKxwGBTTZ7TiIQY9ra+TS4twtRK+Obm3BwTuczNXfBs7v7R+EGuwHglgyCe8vp49kXU1A
uWz7oKmfXQORhtrP45O7zGXOcPBmOCWtKaZbzJuJlaFfUolhsvkgHemPelJn3BDvz/tiV6
/u6j5Rv1iWbQ8ObdxtZsr7UcgJp+DS5204o5/sOLYgcNQgS9V7owHTjffB6ZAV3l8xz3wf
BOLS55YFBQwlw0hnwk5MtXB1LgHcvkp8hX/Q+kcdKVHBAAAAgQDfXkubhgoH7PNiyoRsB3
qBKXfc03Q1Aleo5POPbjF8MYZx4cbmMIKwnKJWa0Woth512nLXVssmplisLHYp8qVB5mP+
JGNRBOHqBN+vE4tH8D46buj/thQQes9feI5dyTP8X9loA9LBjfFrAEQZmH0W9WiyEWP5jE
f0aEIBGQZjzAAAAIEA4QESv8Jni8ieRSYindL0rKn3PDkyH0NoF7+XnodDrAW3Rb63j47d
o5erhasDmgQF+8/2bAj7nFsK1x7L61K9TxAINV2otG+3WLwOhET9a9DMg4Etrcp93JjLtq
Zgj6th8ABYSANaRdwx2h6RQdznIhgb6Xv8JyqkqjGaho86NXkAAACBAL8Fhec76tEAS+PJ
6qmMmp7OK+MyJSPUVAkKqUyaEnbUeSx0bX2tBpk6lnr9g6WTTaqBVWRMN3JLKYgTCa5ja/
mkbRp3qC/gUtcjVayS3dMEY6avbH/sva82sghMFIG91OcVoUpLcfRYvbN2uhsV8KHKCsBI
p4ER4vea7qVr/gbJAAAACWxhcGFAUGF1bAE=
-----END OPENSSH PRIVATE KEY-----
```

## Chiave SSH Pubblica

Già presente su Jetson in `~/.ssh/authorized_keys`:

```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCn5KezOyk6WBgmrovAUveosNFUOOMJ7q+s66Yatp8PPCm4RAkMbngeh4s/7/PY7SVFUh6z3Xym40RG3X4SRcC0hzqlNjxyQc0B+fHEzyratzskHT+QHe9KatZhBNGk/xe3ArakdK17sJBWpeAytH7dnKhMpEh8LE5XJLl7xFtjiC+06+Ps1rB/K/LWjEOY9yURpWWhkU2YSK0n6GZLbvKwD6uMjvUHQdSFhkx8LVSg8AekJ1/qVr/gbJAAAACWxhcGFAUGF1bAE= lapa@Paul
```

## API Endpoints

- **Health check**: `http://192.168.1.171:3100/api/v1/health`
- **Face recognition**: `http://192.168.1.171:3100/api/v1/face/recognize`
- **Banknote recognition**: `http://192.168.1.171:3100/api/v1/banknote/recognize`
- **OCR**: `http://192.168.1.171:3100/api/v1/ocr`

## Posizione sul Jetson

- **Home**: `/home/lapap/`
- **Server**: `/home/lapap/jetson-deployment/server/`
- **Servizio**: Avviato con PM2 o systemd

## Test connessione

```bash
# Test API
curl http://192.168.1.171:3100/api/v1/health

# Test SSH
ssh lapap@192.168.1.171 "hostname && uptime"
```
