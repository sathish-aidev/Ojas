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

Owner or Supervisor: **Sync sheets** in the header (also on Revenue, PT Reports, and Salaries). Full history and **Run sheet backup** are on **Settings** (owner) or **Salaries** (supervisor).

The first Owner/Supervisor login each India day auto-syncs trainer PT tabs once.

The Google Sheet is the **source of truth**. Add new clients in the sheet or via the portal, then sync to update the app.



## Backups

- **Weekly** (Sundays 03:00 UTC): tries a full Drive copy into `Backups/YYYY-MM-DD/`. If the service account cannot copy the Google Sheet file (common on personal Gmail — `storageQuotaExceeded`), it exports an `.xlsx` into that folder so it is not empty. Last resort: hidden tabs named `Backup YYYY-MM-DD {Trainer}` (or `GOOGLE_BACKUP_SPREADSHEET_ID`). A DB snapshot is always saved.
- **Monthly** (1st): same sheet backup + payroll PDFs in `Reports/YYYY-MM/`
- **Manual:** header **Sync sheets**, or Settings → **Run sheet backup** (owner). Supervisor: Salaries panel.
- **Daily:** first Owner/Supervisor login of the day (India date) auto-syncs trainer PT tabs.
- Prefer a Shared Drive for `GOOGLE_DRIVE_FOLDER_ID` if you want a native Google Sheet copy in `Backups/`.
- Ensure `CRON_SECRET` is set in Vercel (Vercel Cron sends it as `Authorization: Bearer …`). Without it, scheduled backups return 401.

## Expenses tabs

Same spreadsheet as the PT tracker unless `GOOGLE_EXPENSES_SPREADSHEET_ID` is set.

### Expenses (owner gym costs)

Tab name: **Expenses**

Row 1 — instructions. Row 2 — headers:

| Id | Date | Type | Category | Description | Amount | Payment Mode | Paid By | Notes |

- Dates: `DD/MM/YYYY`
- Type: Owner bill or Cash given to supervisor (blank Type = Owner bill)
- Category: Rent, Power Bill, Repairs, Supplies, Internet, Phone, Salaries, Maintenance, Equipment, TDS, GST, CA fee, Others
- Leave **Id** blank for new historic rows. After **Sync from expense sheet**, the app writes Ids back.

### Supervisor spends (not in Revenue)

Tab name: **Supervisor spends**

Created when you open Expenses or run `npm run init:revenue`. Leftover supervisor-spend rows on **Expenses** are moved here.

Row 1 — instructions. Row 2 — headers:

| Id | Date | Category | Description | Amount | Payment Mode | Paid By | Notes |

- Every row is a supervisor spend (no Type column)
- Category: Repairs, Maintenance, Supplies, Equipment, Others
- These lines are tracked only. They are **not** deducted again in Revenue.

App and both tabs are editable until historic months are complete. See `docs/REVENUE.md`.
- Setup: `npm run init:revenue`


