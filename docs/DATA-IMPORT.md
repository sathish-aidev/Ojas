# Historical Data Import

One-time CLI import for Google Sheet CSV exports in `resources/`.

## Prerequisites

1. Database running and seeded (`npm run db:seed` if fresh)
2. Trainers **Sai Karan**, **Rohith**, **Rahul** exist with correct target/split settings:

```bash
npx tsx scripts/setup-trainers-for-import.ts
```

3. CSV files exported from Google Sheets (one tab per trainer) placed in `resources/`

## Commands

Dry-run (no DB writes):

```bash
npm run import:clients -- --file "resources/Impackt1_Gym - PT-Sai.csv" --trainer "Sai Karan" --dry-run
npm run import:clients -- --file "resources/Impackt1_Gym - PT-Rohith.csv" --trainer Rohith --dry-run
npm run import:clients -- --file "resources/Impackt1_Gym - PT-Rahul.csv" --trainer Rahul --dry-run
```

Execute import (remove `--dry-run`):

```bash
npm run import:clients -- --file "resources/Impackt1_Gym - PT-Sai.csv" --trainer "Sai Karan"
npm run import:clients -- --file "resources/Impackt1_Gym - PT-Rohith.csv" --trainer Rohith
npm run import:clients -- --file "resources/Impackt1_Gym - PT-Rahul.csv" --trainer Rahul
```

## What the script does

1. Skips header/metadata rows until `Customer` + `Start Date` columns are found
2. Parses dates as D/M/YYYY (flexible day/month width)
3. Auto-parses **Fee paid on** (`yes DD/MM/YYYY`, plain dates, or `yes` → start date)
4. Ignores monthly PT breakdown columns — recalculates via app split logic
5. Finds or creates clients by `(trainer, name)`; each row = new subscription (renewals)
6. Recalculates trainer month splits chronologically after each file

## Column mapping

| Sheet column | App field |
|--------------|-----------|
| Customer | Client.name |
| Start Date | PTSubscription.startDate |
| End Date | PTSubscription.endDate |
| Fee paid on | paymentDate + Payment.collectedAt |
| Amount | PTSubscription.amount |
| Months | PTSubscription.monthsCount |
| Mode of Payment | PaymentMode enum + notes |

## Tests

```bash
npm run test:import-csv
npm run test:pt-split
```

## Verification

After import, check in the app:

- Owner → Clients (filter by trainer)
- Open 2–3 clients — confirm installment rows and payable dates
- Owner → Trainers — MTD revenue and split % for affected months
