# Automated Backup System – Setup & Testing

## Quick Test (Run Now)

From the project root:

```powershell
cd backend
$env:DB_ENGINE='django.db.backends.sqlite3'
python manage.py backup
```

Expected output:
```
Sources: ['db.sqlite3']
Created: C:\Users\kings\Desktop\smart-operations-hub\backend\backups\backup_2026_02_10.zip
Backup complete.
```

Verify the file:

```powershell
dir backups
```

**Dry run** (no files created):

```powershell
python manage.py backup --dry-run
```

**With external drive** (e.g. `E:\Backups`):

```powershell
python manage.py backup --external "E:\Backups"
```

---

## Windows Task Scheduler (Nightly 2 AM)

### Option A: GUI

1. Open **Task Scheduler** (search in Start).
2. **Create Basic Task**:
   - Name: `SmartOpsHub Backup`
   - Trigger: **Daily**, 2:00 AM
3. **Action**: Start a program
   - Program: `python`
   - Arguments: `manage.py backup`
   - Start in: `C:\Users\kings\Desktop\smart-operations-hub\backend`
4. Check **Open Properties** and in the created task:
   - **Conditions**: uncheck "Start only if on AC power" if needed
   - **Settings**: allow run on demand
5. Optional env for external path:
   - **General** → **Configure for** → Windows 10
   - **Actions** → Edit → add `set BACKUP_EXTERNAL_PATH=E:\Backups` in a wrapper script (see Option B)

### Option B: Batch Script + Task

Create `backend/run_backup.bat`:

```batch
@echo off
cd /d "C:\Users\kings\Desktop\smart-operations-hub\backend"
set DB_ENGINE=django.db.backends.sqlite3
set BACKUP_EXTERNAL_PATH=E:\Backups
python manage.py backup
```

Then in Task Scheduler, set **Program**: `C:\Users\kings\Desktop\smart-operations-hub\backend\run_backup.bat`.

### Option C: schtasks (Command Line)

```powershell
schtasks /create /tn "SmartOpsHub Backup" /tr "python manage.py backup" /sc daily /st 02:00 /ru SYSTEM /rp "" /f /wd "C:\Users\kings\Desktop\smart-operations-hub\backend"
```

Adjust `/wd` to your backend path.

---

## Parameters

| Parameter     | Default                    | Description                          |
|--------------|----------------------------|--------------------------------------|
| `--local`    | `backend/backups`          | Local backup folder                  |
| `--external` | `BACKUP_EXTERNAL_PATH` env | Second destination (USB, etc.)      |
| `--retention`| 30                         | Days to keep; older backups deleted |
| `--dry-run`  | -                          | Print plan without writing files    |

---

## What Is Backed Up

- `db.sqlite3` (SQLite database)
- `media/excel_uploads/` (uploaded Excel files)
- `media/foodics_archives/` (if present)

Output: `backup_YYYY_MM_DD.zip` in each destination. Backups older than `--retention` days are removed automatically.
