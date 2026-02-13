# Mobile Access Guide – Smart Operations Hub

## 1. Local Network (Wi‑Fi) Access

### Your Local IP Addresses

Try these URLs on your phone (connected to the **same Wi‑Fi** as your PC):

```
http://192.168.1.5:5173
http://192.168.195.113:5173
```

One of these is your active network interface; use the one that works on your home Wi‑Fi.

### Steps

1. **Start the backend** (from the project root):
   ```bash
   cd backend
   python manage.py runserver 0.0.0.0:8000
   ```
   `0.0.0.0` makes Django listen on all interfaces so your phone can reach it.

2. **Start the frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   Vite is configured with `host: true`, so it listens on your LAN IP.

3. **Find your PC’s IP** (if the addresses above don’t work):
   - **Windows**: Run `ipconfig` and use the **IPv4 Address** for your active adapter.
   - **macOS/Linux**: Run `ifconfig` or `ip addr`.

4. **On your phone**: Open a browser and go to `http://YOUR_IP:5173`.

### Backend CORS and API URL

For mobile/other devices to reach the API, set:

1. **Environment variable** (before starting Django):
   - **Windows CMD**: `set FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.5:5173`
   - **Windows PowerShell**: `$env:FRONTEND_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.5:5173"`
   - Use your actual LAN IP(s). This allows CORS from those origins.

2. **Frontend API URL** – create or edit `frontend/.env`:
   ```env
   VITE_API_BASE=http://192.168.1.5:8000/api
   ```
   Replace with your PC’s IP. Restart the frontend after changing.

---

## 2. Access from Outside Your Home

### Option A: Localtunnel

1. **Install** (one time):
   ```bash
   npm install -g localtunnel
   ```

2. **Run** (with frontend on port 5173):
   ```bash
   npx localtunnel --port 5173
   ```
   You’ll get a URL like `https://random-name.loca.lt`.

3. **Backend**: Start a separate tunnel for port 8000:
   ```bash
   npx localtunnel --port 8000
   ```

4. **Update frontend API URL** temporarily:
   - In `.env`: `VITE_API_BASE=https://YOUR-TUNNEL-URL.loca.lt/api`
   - Or set it at build time when using a tunnel.

### Option B: Ngrok

1. **Install**: https://ngrok.com/download

2. **Sign up** at ngrok.com and get your auth token.

3. **Start the frontend tunnel**:
   ```bash
   ngrok http 5173
   ```

4. **Start the backend tunnel** (another terminal):
   ```bash
   ngrok http 8000
   ```

5. **Configure**:
   - Copy the `https://xxxx.ngrok.io` URLs.
   - Set `VITE_API_BASE` to your backend ngrok URL (e.g. `https://abc123.ngrok.io/api`).
   - Rebuild or restart the frontend if needed.

### Security Note

Public URLs (localtunnel/ngrok) expose your app to the internet. Use them only for testing and avoid production data. Add authentication and HTTPS for any real deployment.

---

## 3. Mobile Responsiveness

The app uses responsive layouts for:

- **Glassmorphism cards**: Touch-friendly padding and spacing on small screens.
- **Toggle switches**: Sized for touch (min 44×44 pt).
- **Tables**: Horizontal scroll where needed.
- **Navigation**: Collapsible / scrollable on narrow viewports.
- **Dropdowns**: Max width and alignment adjusted for mobile.

If something looks off on your device, report the screen size and page for targeted fixes.
