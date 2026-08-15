# Impackt Fitness PT Tracker — Google Sheet Template



Spreadsheet name: **Impackt Fitness PT Tracker**  

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

Impackt Fitness PT Tracker | Trainer: Rohith | Master copy — source of truth | Dates: DD/MM/YYYY

```



**Row 2** — Headers (required):



| Customer | Start Date | End Date | Fee paid on | Amount | Months | Mode of Payment | Phone | Notes |



**Row 3** — Example (optional, delete after setup):

```

Sample Client | 01/03/2026 | 01/04/2026 | 01/03/2026 | 15000 | 1 | PhonePe to Sathish | 9876543210 | optional

```



**Row 4+** — Client PT data



## Rules



- One row = one PT package (renewal = new row with new start date)

- Dates: `DD/MM/YYYY`

- `Fee paid on`: plain date `DD/MM/YYYY` (same as Start Date), or `yes` / `yes DD/MM/YYYY`

- Monthly breakdown columns (Jan PT, Feb PT, etc.) are **not needed**



## Sync



Owner or Supervisor → **Salaries** → **Sync from Google Sheets**



The Google Sheet is the **source of truth**. Add new clients in the sheet or via the portal, then sync to update the app.



## Backups

- **Weekly** (Sundays 03:00 UTC): tries a full Drive copy into `Backups/YYYY-MM-DD/`. If the service account cannot own Drive files (common on personal Gmail — `storageQuotaExceeded`), it falls back to copying trainer tabs into the PT tracker as hidden sheets named `Backup YYYY-MM-DD {Trainer}` (or into `GOOGLE_BACKUP_SPREADSHEET_ID` if set). A DB snapshot is always saved.
- **Monthly** (1st): same sheet backup + payroll PDFs in `Reports/YYYY-MM/`
- **Manual:** Salaries → **Run sheet backup**
- Ensure `CRON_SECRET` is set in Vercel (Vercel Cron sends it as `Authorization: Bearer …`). Without it, scheduled backups return 401.
- Prefer a Shared Drive for `GOOGLE_DRIVE_FOLDER_ID` if you want real file copies in `Backups/`.

## Expenses tab

Tab name: **Expenses** (same spreadsheet unless `GOOGLE_EXPENSES_SPREADSHEET_ID` is set).

Row 1 — instructions. Row 2 — headers:

| Id | Date | Category | Description | Amount | Payment Mode | Paid By | Notes |

- Dates: `DD/MM/YYYY`
- Category: Rent, Power Bill, Repairs, Supplies, Internet, Phone, Salaries, Maintenance, Others
- Leave **Id** blank for new historic rows. After **Sync from expense sheet**, the app writes Ids back.
- App and sheet are both editable until historic months are complete. See `docs/REVENUE.md`.
- Setup: `npm run init:revenue`


