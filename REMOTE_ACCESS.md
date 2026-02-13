# Remote Access Configuration

Smart Operations Hub can be accessed via local network IP or secure tunnels for branch devices.

## 1. Local IP Access

Run the backend and frontend, then access from branch devices on the same network:

**Backend** (default: `http://localhost:8000`):
```powershell
cd backend
$env:DB_ENGINE='django.db.backends.sqlite3'
$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1,192.168.1.100'  # Add your machine's local IP
python manage.py runserver 0.0.0.0:8000
```

**Frontend**:
```powershell
cd frontend
npm run dev
# Access at http://YOUR_IP:5173
```

**CORS**: Ensure `FRONTEND_ORIGINS` includes your IP, e.g.:
```
FRONTEND_ORIGINS=http://localhost:5173,http://192.168.1.100:5173
```

## 2. Cloudflare Tunnel (Recommended)

1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/).
2. Authenticate: `cloudflared tunnel login`
3. Create tunnel: `cloudflared tunnel create smart-ops`
4. Configure `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: ~/.cloudflared/<TUNNEL_ID>.json
   ingress:
     - hostname: smartops.yourdomain.com
       service: http://localhost:8000
     - service: http_status:404
   ```
5. Run: `cloudflared tunnel run smart-ops`

## 3. Ngrok

```powershell
ngrok http 8000
# Use the HTTPS URL for API_BASE
```

Set `VITE_API_BASE` to the ngrok URL when building the frontend for branch devices.

## 4. Security Log

Shift closings are logged in `ShiftSecurityLog`. To view who closed which shift:

```python
from shifts.models import ShiftSecurityLog
for log in ShiftSecurityLog.objects.select_related('user','shift','branch').order_by('-created_at')[:50]:
    print(f"{log.created_at} | {log.user.username} | {log.branch} | {log.action}")
```

Consider adding a Security Log page in the admin or a dedicated API for Owners.
