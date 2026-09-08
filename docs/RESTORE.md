# Restore the live gym on new accounts

Use this when Cursor, GitHub, Vercel, and Neon are **new**, and **Google stays the same** (same Drive folder and Ojas PT Tracker).

The GitHub repo is **code only**. Member data, passwords, and the Google service-account key are **not** in git.

Keep the old site ([ojas-chi.vercel.app](https://ojas-chi.vercel.app)) up until the new URL works.

---

## 1. Restore kit (this machine, off git)

Folder: `backups/prod-YYYY-MM-DD/` (gitignored).

| File | What |
|---|---|
| `MANIFEST.txt` | Git commit + table counts |
| `neon.dump` | Full Postgres dump (preferred restore) |
| `database.json` | Same data as JSON (fallback) |
| `google-sa.json` | Service account key — **secret** |
| `env-checklist.txt` | Env **names** to copy vs generate |
| `google-snapshot.json` | Drive folder + spreadsheet IDs |
| `*.xlsx` | Sheet export if Drive copy failed |

Refresh before cutover:

```powershell
npx tsx scripts/backup-prod-snapshot.ts
```

Copy that whole folder to an encrypted USB or zip. Never push it to GitHub.

---

## 2. New GitHub + Cursor

1. Create a **new** GitHub repo (private).
2. From this repo: `git remote add new https://github.com/NEW-USER/NEW-REPO.git` then `git push new main`.
3. New Cursor: clone that repo. Do not copy `.env`, `.env.vercel.production`, or `backups/` into git.

---

## 3. New Vercel + Neon

1. Import the **new** GitHub repo in Vercel (new team/account).
2. Framework: Next.js. Keep [vercel.json](../vercel.json) build (`prisma db push` then `next build`).
3. Storage → create **Postgres (Neon)**. That sets `DATABASE_URL` on the **new** database only.
4. Do **not** run `npm run db:seed` on this database.

---

## 4. Environment variables

Paste on the new Vercel project (Production).

**Copy from the old Vercel (same Google):**

- `GOOGLE_DRIVE_FOLDER_ID` — `1Jb8g5gFUdiIdBEwHMaOEDLetK0GK9FHN`
- `GOOGLE_SHEETS_SPREADSHEET_ID` — from `google-snapshot.json` or old Vercel
- `GOOGLE_SERVICE_ACCOUNT_JSON` — paste `google-sa.json` as one line, or base64
- `GOOGLE_EXPENSES_SPREADSHEET_ID` / `GOOGLE_BACKUP_SPREADSHEET_ID` if they were set
- `OWNER_REPORT_EMAIL`
- `NEXT_PUBLIC_APP_NAME` = `Impackt Fitness`
- `APP_ENV` = `production`
- `NEXT_PUBLIC_APP_ENV` = `production`

**Generate new:**

- `DATABASE_URL` — already from new Neon
- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_URL` — `https://YOUR-NEW-PROJECT.vercel.app` (exact new hostname)
- `CRON_SECRET` — another random string (weekly backup + monthly close)
- Optional Resend keys on a new Resend account

Staff logins come from the **database dump** (same user IDs and passwords). A new `AUTH_SECRET` only signs everyone out once.

---

## 5. Load gym data into the new Neon

On your PC, with `DATABASE_URL` = the **new** Neon URL (not ojas-chi):

```powershell
$env:CONFIRM_RESTORE="YES"
$env:DATABASE_URL="postgresql://USER:PASS@NEW-HOST/neondb?sslmode=require"
npx tsx scripts/restore-prod-snapshot.ts backups/prod-YYYY-MM-DD
```

The script refuses the current live Neon host. After it finishes, check `MANIFEST.txt` counts against Prisma Studio on the **new** DB.

---

## 6. Deploy and smoke-test

1. Deploy the new Vercel project.
2. Open the new URL. There must be **no** yellow TEST bar.
3. Sign in as owner / Lokesh with **current live passwords**.
4. Check Home, Clients, PT reports, Expenses / petty cash, logo → Home.
5. Sync sheets only after the same service account still has Editor on the live folder and spreadsheet.

Then give staff the **new** URL. Leave ojas-chi running for a few days; pause it later. Do not delete the old Vercel/Neon until you have logged in on the new URL.

---

## Do not

- Commit `backups/`, `.env`, or `.env.vercel.production`
- Point staging `APP_ENV=staging` at these Google IDs
- Seed the new live database
- Transfer the TEST gym unless you re-seed dummy data separately (`docs/STAGING.md`)
