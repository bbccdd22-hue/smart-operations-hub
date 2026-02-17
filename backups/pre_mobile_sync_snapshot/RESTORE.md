# Restore from pre_mobile_sync_snapshot

Use this if you need to roll back after the mobile access changes.

## 1. Restore Source Code (Git)

```bash
cd c:\Users\kings\Desktop\smart-operations-hub
git reset --hard 9567d8a
```

Or revert to the snapshot commit:
```bash
git log --oneline
git checkout 9567d8a
```

## 2. Restore Database

### Option A: Full SQLite Replace (simplest)

```powershell
# Stop Django if running, then:
copy backups\pre_mobile_sync_snapshot\db.sqlite3 backend\db.sqlite3
```

### Option B: Django loaddata (Brand/Branch/DailySale only)

First clear and re-apply:

```bash
cd backend
set USE_SQLITE=1
python manage.py flush --no-input
python manage.py loaddata ..\backups\pre_mobile_sync_snapshot\dumpdata_Branch_Brand_DailySale.json
```

**Note:** `flush` removes ALL data. Use only if you want to restore exactly the Branch, Brand, and DailySale state from the backup. Other tables (users, etc.) will be empty—re-run migrations or restore the full `db.sqlite3` instead.

## 3. Verify

- Start backend: `cd backend && run_server.bat`
- Start frontend: `cd frontend && npm run dev`
- Log in and check Brands, Branches, and DailySales
