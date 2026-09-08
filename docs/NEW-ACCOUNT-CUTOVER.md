# Impackt Fitness — new Cursor / GitHub / Vercel / Neon cutover

**Audience:** a Cursor agent (or human) on **brand-new** Cursor, GitHub, Vercel, and Neon accounts.

**Goal:** make the **live gym** run again with current members, logins, expenses, and payroll. Google Drive and the PT spreadsheet **stay on the existing Google account**.

If you are that agent: follow the numbered steps in order. Do not invent a seed. Do not deploy an empty database. Do not use the old production hostname as `AUTH_URL`.

---

## What this product is

- App name: **Impackt Fitness** (repo historically `Ojas`)
- Stack: Next.js 15 App Router, Prisma, PostgreSQL (Neon), NextAuth credentials, Vercel
- Roles: `OWNER`, `SUPERVISOR`, `TRAINER` — login is **User ID** (e.g. `owner`, `lokesh`), not email
- Old live URL (leave it running until the new URL works): https://ojas-chi.vercel.app
- Old TEST URL (dummy data, ignore unless asked): https://ojas-staging-nine.vercel.app
- Yellow **TEST ENVIRONMENT** bar must **not** appear on the new live app (`APP_ENV=production`)

---

## Two things you must have

The GitHub repo is **code only**. Gym data is **not** in git (`/backups/` is gitignored).

| Input | Where |
|---|---|
| Code | Clone of `main` (includes this file, `scripts/restore-prod-snapshot.ts`, `prisma/schema.prisma`) |
| Restore kit | Folder `backups/prod-2026-09-07/` copied onto the new machine (USB / encrypted zip) |

If the kit is missing, **stop**. Ask the operator to copy `D:\impackt_Fitness_App\backups\prod-2026-09-07` from the old PC. Do not restore from `prisma/seed.ts`.

Place the kit at:

```
<repo-root>/backups/prod-2026-09-07/
```

Confirm these files exist before continuing:

| File | Approx size | Purpose |
|---|---|---|
| `MANIFEST.txt` | ~1 KB | Table counts to verify after restore |
| `neon.dump` | ~741 KB | Preferred Postgres dump (Neon 17) |
| `database.json` | ~1.2 MB | Fallback JSON of all tables |
| `google-sa.json` | ~2 KB | Google service account **private key** — never commit |
| `env-checklist.txt` | ~1 KB | Env names to copy vs generate |
| `google-snapshot.json` | ~400 B | Live Drive + spreadsheet IDs |
| `Impackt-PT-Tracker-PROD-SNAPSHOT-2026-09-07.xlsx` | ~227 KB | Offline copy of PT tracker |
| `README-FOR-NEW-CURSOR.md` | this playbook copy in the kit | Same instructions next to the dump |

Kit snapshot time: **2026-09-08** (UTC). Git commit at dump time: `a96001b`. Restore scripts/docs landed later on `main`.

### Expected row counts (verify after restore)

| Table | Rows |
|---|---|
| gym | 1 |
| user | 7 |
| employee | 7 |
| trainerSplitRule | 5 |
| client | 77 |
| pTSubscription | 112 |
| payment | 173 |
| payrollRun | 49 |
| payrollLineItem | 85 |
| gymExpense | 51 |
| cultSettlement | 7 |
| sheetSyncRun | 12 |
| sheetTabSnapshot | 36 |
| session, trainerSlot, goals, photos, notes | 0 |

---

## Hard rules

1. **Never** `git add backups/` or `.env` or `.env.vercel.production` or `google-sa.json`.
2. **Never** `npm run db:seed` or `db:seed-staging` on the new **live** database.
3. **Never** set `APP_ENV=staging` on this new live project.
4. **Never** restore into the old live Neon. `scripts/restore-prod-snapshot.ts` refuses hosts matching `ep-delicate-bonus` / `lingering-surf-62682822`.
5. **Never** `vercel link` to old projects `ojas` or `ojas-staging`.
6. Do not click/rely on Google **file copy** via the service account (Drive quota is 0). Sheets API on the existing spreadsheet still works if the SA has Editor.
7. Keep https://ojas-chi.vercel.app up until the operator has logged into the **new** URL.

---

## Google (unchanged)

| Item | Value |
|---|---|
| Drive folder `Impackt1_App` | `1Jb8g5gFUdiIdBEwHMaOEDLetK0GK9FHN` |
| Drive URL | https://drive.google.com/drive/folders/1Jb8g5gFUdiIdBEwHMaOEDLetK0GK9FHN |
| PT spreadsheet (Ojas PT Tracker) | `19AyjQAWIURrw6Qvos2_gyVGPGb1xdXsnBTHG8TmFJhI` |
| Service account | `ojas-sheets-sync@ojasfit.iam.gserviceaccount.com` |
| Key file in kit | `backups/prod-2026-09-07/google-sa.json` |

That SA must remain **Editor** on the folder and spreadsheet. Do not create a new Google project unless the operator asks.

---

## Step 1 — New GitHub repo

On the **old** machine (already done if `main` was pushed):

```powershell
cd D:\impackt_Fitness_App
git remote add new https://github.com/NEW-OWNER/NEW-REPO.git
git push -u new main
```

Repo should be **private**. Confirm `docs/NEW-ACCOUNT-CUTOVER.md` and `scripts/restore-prod-snapshot.ts` are on `main`.

---

## Step 2 — New Cursor

1. Sign in to the **new** Cursor account.
2. Clone **NEW-OWNER/NEW-REPO**.
3. Copy the restore kit into `backups/prod-2026-09-07/` inside that clone.
4. Open this file (`docs/NEW-ACCOUNT-CUTOVER.md`) and continue from Step 3.
5. `npm install`

---

## Step 3 — New Vercel project + new Neon

1. New Vercel account/team → **Add New → Project** → import the **new** GitHub repo (not `sathish-aidev/Ojas` unless that is still the code remote).
2. Framework: **Next.js**. Root: `.`
3. Build command is already in `vercel.json`:

   `npx tsx scripts/ensure-usernames.ts && npx prisma db push --accept-data-loss && next build`

4. **Storage → Create Database → Postgres (Neon)** and attach it to this project. This creates a **new** `DATABASE_URL`. It starts **empty**.
5. Note the new production URL, e.g. `https://something.vercel.app`. That becomes `AUTH_URL`.

Do not deploy for users yet. Env and data first.

---

## Step 4 — Environment variables (Production)

Vercel → Project → Settings → Environment Variables → Production.

### Copy (same Google)

| Name | Value |
|---|---|
| `GOOGLE_DRIVE_FOLDER_ID` | `1Jb8g5gFUdiIdBEwHMaOEDLetK0GK9FHN` |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | `19AyjQAWIURrw6Qvos2_gyVGPGb1xdXsnBTHG8TmFJhI` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Entire contents of `google-sa.json` as **one line** (or base64 of that file) |
| `OWNER_REPORT_EMAIL` | `sparkversefitness@gmail.com` unless the operator says otherwise |
| `NEXT_PUBLIC_APP_NAME` | `Impackt Fitness` |
| `APP_ENV` | `production` |
| `NEXT_PUBLIC_APP_ENV` | `production` |

How to one-line the SA JSON in PowerShell (prints only that you should paste into Vercel; do not commit the output):

```powershell
(Get-Content -Raw backups\prod-2026-09-07\google-sa.json) -replace '\s+', ' '
```

### Generate new

| Name | How |
|---|---|
| `DATABASE_URL` | Already set by Vercel Neon (use the **pooled** URL Neon/Vercel created) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://YOUR-NEW-PROJECT.vercel.app` — must match the new hostname |
| `CRON_SECRET` | another random string (Vercel crons: weekly sheet backup, monthly close) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | optional; skip if no new Resend |

Neon also injects `POSTGRES_*` / `PG*` keys. Leave those as Vercel set them. Do **not** paste the **old** `DATABASE_URL` or `PGPASSWORD`.

---

## Step 5 — Restore gym data into the new Neon

On the new machine, `DATABASE_URL` = **new** Neon only.

Docker is required for `psql` against Neon 17 (image `postgres:17-alpine`).

```powershell
cd <repo-root>
$env:CONFIRM_RESTORE="YES"
$env:DATABASE_URL="postgresql://....NEW-NEON..../neondb?sslmode=require"
npx tsx scripts/restore-prod-snapshot.ts backups/prod-2026-09-07
```

The script:

1. Applies `neon.dump` (preferred).
2. Runs `prisma db push` so schema matches the app.
3. If `neon.dump` is missing, loads `database.json` instead.

**Success:** no error; then `npx prisma studio` (same `DATABASE_URL`) shows ~77 clients and 7 users.

**Failure — dump refused:** `DATABASE_URL` still points at the old live host. Fix the URL.

**Failure — Docker / psql:** install Docker Desktop, retry. JSON fallback:

If dump apply fails but JSON exists, temporarily rename `neon.dump` and re-run so JSON restore runs — only if the operator agrees.

---

## Step 6 — Deploy the new app

```powershell
npx vercel link --yes --project <NEW-PROJECT-NAME>
npx vercel deploy --prod --yes
```

Or: Vercel dashboard → Deploy. After the first env change, trigger a **redeploy**.

`npx vercel whoami` / `.vercel/project.json` must be the **new** project, never `ojas` / `ojas-staging`.

---

## Step 7 — Smoke test (must pass before staff switch)

Open the **new** URL only.

- [ ] Title **Impackt Fitness** with **no** TEST banner and no “(TEST)” in the logo
- [ ] Sign in as **owner** with the **current live** password (from the dump, not `password123` unless that is still the live password)
- [ ] Sign in as **lokesh** (supervisor)
- [ ] Logo → that role’s Home
- [ ] Clients: many real names, not only “Test Anika…”
- [ ] PT reports / PT by Trainer load
- [ ] Expenses / petty cash (Owner sent, spends, balance)
- [ ] Change password overlay opens fully (Close + three fields) — do not have to submit
- [ ] `/trainer` as a trainer ID from the dump sees only their clients

Dummy TEST logins (`password123` on ojas-staging-nine) are **not** the live gym.

When that works, give staff the **new** URL. Pause the old Vercel project later. Do not delete old Neon until a few days of successful logins.

---

## Commands cheat sheet

| Action | Command |
|---|---|
| Refresh kit on the **old** PC | `npx tsx scripts/backup-prod-snapshot.ts` |
| Restore into **new** Neon | `npx tsx scripts/restore-prod-snapshot.ts backups/prod-2026-09-07` |
| Local schema | `npx prisma db push` (new URL only) |
| Do not | `npm run db:seed` |

---

## Out of scope unless the operator asks

- Recreating the TEST gym (`docs/STAGING.md`, dummy names, `APP_ENV=staging`)
- Playwright cloud UAT
- New Google Cloud project
- Custom domain (new `*.vercel.app` is enough unless they attach a domain and then `AUTH_URL` must match)

---

## If something is missing

| Symptom | Cause |
|---|---|
| Empty gym / demo seed data | Seed was run, or restore skipped |
| TEST yellow bar | `APP_ENV` is staging |
| Cannot sign in | Wrong `AUTH_URL`, or restore did not load `user` rows |
| Google Sync errors | SA JSON missing/invalid, or SA not Editor on the sheet |
| Restore blocked | `DATABASE_URL` is still the old live Neon |
