# Ojas PT Tracker — Google Sheet Template

Spreadsheet name: **Ojas PT Tracker**  
Location: [Google Drive folder](https://drive.google.com/drive/folders/1Jb8g5gFUdiIdBEwHMaOEDLetK0GK9FHN)

## Tabs (exact names)

| Tab | Trainer in app |
|-----|----------------|
| Rohith | Rohith |
| Sai Karan | Sai Karan |
| Rahul | Rahul |

## Per-tab layout

**Row 1** — Instructions (do not delete):
```
Ojas PT Tracker | Trainer: Rohith | Master copy — source of truth | Dates: DD/MM/YYYY
```

**Row 2** — Headers (required):

| Customer | Start Date | End Date | Fee paid on | Amount | Months | Mode of Payment | Phone | Notes |

**Row 3** — Example (optional, delete after setup):
```
Sample Client | 01/03/2026 | 01/04/2026 | yes 01/03/2026 | 15000 | 1 | PhonePe | 9876543210 | optional
```

**Row 4+** — Client PT data

## Rules

- One row = one PT package (renewal = new row with new start date)
- Dates: `DD/MM/YYYY`
- `Fee paid on`: `yes`, `yes DD/MM/YYYY`, or a plain date
- Monthly breakdown columns (Jan PT, Feb PT, etc.) are **not needed**

## Sync

Owner or Supervisor → **Salaries** → **Sync from Google Sheets**

The Google Sheet is the **source of truth**. Add new clients in the sheet or via the portal, then sync to update the app.

## Backups

- **Weekly** (Sundays): full sheet copied to `Backups/YYYY-MM-DD/` in Drive
- **Monthly** (1st): sheet backup + payroll PDFs in `Reports/YYYY-MM/`
