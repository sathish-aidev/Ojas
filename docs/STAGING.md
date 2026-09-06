# Test gym handoff

Live gym for staff: **https://ojas-chi.vercel.app** — do not use this for QA.

Test gym (dummy data only): **https://ojas-staging-nine.vercel.app**

You should see an amber **TEST ENVIRONMENT** bar and a **TEST** chip next to the logo. If those are missing, you are on the live gym — stop.

---

## Access

| | |
|---|---|
| URL | https://ojas-staging-nine.vercel.app |
| Live gym (do not test here) | https://ojas-chi.vercel.app |
| Reset dummy data (operator) | Seed against the staging Neon DB only — never production |

| Role | User ID | Password |
|------|---------|----------|
| Owner | `owner` | `password123` |
| Supervisor (Lokesh) | `lokesh` | `password123` |
| Trainer | `rahul` | `password123` |
| Trainer | `rohit` | `password123` |
| Trainer | `saikaran` | `password123` |

Old emails (`owner@impackt.gym`, etc.) also work.

Housekeeping logins `yashoda` / `rama` exist for salary tracking only and are not for day-to-day QA.

---

## What is already in the dummy gym

All names start with **Test** so they cannot be confused with live members.

**Active PT (top of Clients)**

- Test Anika Sharma — Rahul — until 17/10/2026
- Test Bharat Reddy — Rahul — until 10/09/2026 (renewal this week)
- Test Chitra Nair — Rohith — until 01/11/2026
- Test Dev Patel — Sai Karan — until 15/10/2026

**Past clients (below)**

- Test Old Meera, Test Old Kiran, Test Old Farah, Test Old Gopal

Also seeded: July Cult figures, owner bills, a supervisor spend, June payroll marked paid, July payroll pending, a morning slot on Rahul’s schedule, a session for Sai Karan.

You may add, edit, delete, generate payroll, and change passwords. That stays in the **test** database. It does **not** touch live Neon, the live PT tracker, or live Drive files.

---

## What to test

Use Chrome **device mode** (~400px) and desktop.

**All roles**

- Logo → that role’s Home
- Key icon → full Change password form (Close, three fields, Update password)
- Sign out → login
- Bottom nav (phone) and sidebar (desktop)

**Owner** (`owner`)

- Home, Clients, Revenue, Expenses, Pay, Settings
- Clients: Active PT on top, Past clients below (not every card labelled ACTIVE)
- Add PT, trainers / PT reports / renewals from Home or desktop sidebar

**Supervisor** (`lokesh`) — same checks as Lokesh’s first pass

- Home, Clients, Spend, Renew, Pay
- Add PT, Trainers, PT Reports from Home

**Trainer** (`rahul` / `rohit` / `saikaran`)

- Home, own Clients only, Add PT, Schedule, Pay
- Schedule has a dummy morning slot / session

---

## Out of scope for this round

- **Google Sheet Sync** and **Drive PDF upload** — the test Google folders stay empty (service account has no Drive storage). Skip Sync / Cult Drive scan, or expect errors.
- **Live gym** at ojas-chi.vercel.app — staff data; not for testers.
- Do not copy test data back onto production.

---

## Operator notes

Production snapshot (this operator machine): `backups/prod-2026-09-05/` (`database.json` + PT sheet `.xlsx`).

Hosted test database: separate Neon project `ojas-staging-db` (dummy gym only). Local Docker `impackt_gym_staging` on port 5433 is optional for operator use. Live database is untouched.

After testing, testers can stop. Production URL never moved.
