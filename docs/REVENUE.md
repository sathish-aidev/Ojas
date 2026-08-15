# Monthly Revenue & P&L

Owner module: **Revenue**. Supervisor: **Expenses**.

## Formula

```
Cult income
  = Partner Share if entered
  else Tax Invoice Gross Total (interim, while settlement is delayed)
+ Owner PT share (existing PT tracker / payment splits)
− Manual gym expenses (this module)
− PAID payroll netPay (Salaries module)
= Net monthly result
```

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

Upload files there, then paste Drive URLs on the Revenue Cult form.

Canonical P&L number: **Partner Share** (e.g. Apr 2026 ₹8,09,198).  
Tax Invoice **Gross Total** is used only until Partner Share is saved.

## PT income

Reuses existing owner share on payments (`ownerShareAmount`) for the selected month. Same engine as PT Reports / Salaries.

## Expenses

Fixed categories: Rent, Power Bill, Repairs, Supplies, Internet, Phone, Salaries, Maintenance, Others.

Owner and Supervisor can add, edit, and delete.

### Dual edit (v1)

App database **and** the Google Sheet **Expenses** tab are both editable until historic months are caught up.

- App save/delete tries to update the sheet (DB still wins if the sheet write fails).
- **Sync from expense sheet** merges sheet rows into the app, then rewrites the tab so new rows get Ids.
- After historic data is complete, choose a single source of truth (likely the app DB).

Sheet columns: `Id | Date | Category | Description | Amount | Payment Mode | Paid By | Notes`  
Dates: `DD/MM/YYYY`. Leave Id blank for new historic rows.

Default location: a tab named **Expenses** on the PT tracker spreadsheet. Optional env: `GOOGLE_EXPENSES_SPREADSHEET_ID`.

Setup: `npm run init:revenue`

After deploy, apply schema: `npx prisma db push` (production database). Local DB was not running during this change.

## Roadmap (not in this release)

- Lock a closed month
- Auto-parse Cult PDFs / watch the Drive folders
- GST packs
- Switch expenses to DB-only after historic catch-up
