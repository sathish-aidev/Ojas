# Monthly Revenue & P&L

Owner modules: **Revenue** (P&L) and **Expenses**. Supervisor: **Expenses**.

## Formula

```
Cult income
  = Actual money received when known (centre + mid-month + gross payable, or Partner Share minus RDS)
    else Partner Share if entered
    else Tax Invoice Gross Total (interim, while settlement is delayed)
+ Owner PT share (existing PT tracker / payment splits)
− Manual gym expenses (owner bills + cash given to supervisor)
− PAID payroll netPay (Salaries module)
= Net monthly result
```

**RDS** (Cult TDS withheld) is shown on Monthly revenue and in the 12-month table but **not added to income**. Example Apr 2026: Partner Share ₹8,09,198, RDS ₹15,413, Cult income / money received ₹7,93,785.

Supervisor spends from cash given to the supervisor are tracked in Expenses but **not** deducted again.

PENDING payroll is shown but not deducted until marked Paid.

Do **not** re-enter trainer payroll under the Salaries expense category if it is already generated in Salaries.

Months stay editable. A later release may add month-lock after historic data is complete.

## Cult invoices (Drive)

Created under the gym Drive folder:

```
Cult_Invoices/
  Settlement_Statements/     # Draft Settlement Statement PDFs
  Tax_Invoices/              # Cult app / tax invoices
```

Upload files there. Opening **Revenue** (or clicking **Scan Drive for invoices**) lists new PDFs, matches months from filenames (`Apr'26`, `Apr2026`), links them, and reads Partner Share when the PDF has selectable text. Scanned image PDFs are linked as records only.

Canonical P&L number: **Partner Share** (e.g. Apr 2026 ₹8,09,198).  
Tax Invoice **Gross Total** is used only until Partner Share is saved.

## PT income

Reuses existing owner share on payments (`ownerShareAmount`) for the selected month. Same engine as PT Reports / Salaries.

## Expenses

Own page: Owner `/owner/expenses`, Supervisor `/supervisor/expenses` (sidebar + mobile nav). Revenue keeps a this-month total and links here.

Two ledgers:

1. **Gym costs (in Revenue):** owner bills (Rent, Power, Salaries, Equipment, Internet, Phone, TDS, GST, CA fee, direct repairs) and **cash given to supervisor** in lumps (Maintenance / Repairs). Existing rows default to owner bills.
2. **Supervisor spends (not in Revenue):** repairs, maintenance, small equipment, supplies, others paid from that cash. They reduce cash-on-hand only.

Cash with supervisor = all cash given − all supervisor spends. Top up when that balance is low. Owner records cash given; supervisor records spends. Supervisor cannot add Rent / Power / Salaries / TDS / GST / CA fee.

KPIs: gym cost this month (P&L), vs last month, cash with supervisor, year-to-date. Category bars and a 12-month trend use P&L rows for owner and spends for supervisor. Filter the list by ledger, month/year, category, type, and payment mode.

Fixed categories: Rent, Power Bill, Repairs, Supplies, Internet, Phone, Salaries, Maintenance, Equipment, TDS, GST, CA fee, Others.

### Dual edit (v1)

App database **and** two Google Sheet tabs are both editable until historic months are caught up.

- **Expenses** — owner gym costs only (Owner bill, Cash given to supervisor).
- **Supervisor spends** — many small supervisor lines (not in Revenue). Opening Expenses creates this tab if it is missing and moves leftover supervisor-spend rows off the owner tab.

- App save/delete tries to update the matching tab (DB still wins if the sheet write fails).
- **Sync from expense sheet** merges both tabs into the app, then rewrites them so new rows get Ids.
- After historic data is complete, choose a single source of truth (likely the app DB).

Owner sheet columns: `Id | Date | Type | Category | Description | Amount | Payment Mode | Paid By | Notes`  
Type: `Owner bill` or `Cash given to supervisor`. Rows without Type import as owner bills.

Supervisor sheet columns: `Id | Date | Category | Description | Amount | Payment Mode | Paid By | Notes`  
(No Type column — every row is a supervisor spend.)

Dates: `DD/MM/YYYY`. Leave Id blank for new historic rows.

Default location: tabs on the PT tracker spreadsheet. Optional env: `GOOGLE_EXPENSES_SPREADSHEET_ID`.

Setup: `npm run init:revenue`

Production deploys run `prisma db push` during the Vercel build so new enum values are applied automatically.

## Roadmap (not in this release)

- Lock a closed month
- OCR for scanned Cult image PDFs
- GST packs / GST-compliant invoicing
- Switch expenses to DB-only after historic catch-up
