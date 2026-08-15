# Impackt Gym — API Specification

Base URL: `/api`  
Auth: Session cookie (NextAuth JWT)

---

## Auth

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/auth/[...nextauth]` | NextAuth handlers |

---

## Users (Owner only)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/users` | — | User[] with employee |
| POST | `/users` | createUserSchema | User 201 |
| PATCH | `/users/[id]` | `{ action: "reset-password", password }` | `{ success }` |
| PATCH | `/users/[id]` | `{ action: "toggle-active" }` | `{ success }` |
| PATCH | `/users/[id]` | employeeUpdateSchema | `{ success }` |
| DELETE | `/users/[id]` | — | `{ success }` |

---

## Clients

| Method | Path | Query/Body | Roles |
|--------|------|------------|-------|
| GET | `/clients` | `?trainerId=` | Owner, Supervisor, Trainer (own) |
| POST | `/clients` | clientSchema | Owner, Trainer |
| GET | `/clients/[id]` | — | All (scoped) |
| PATCH | `/clients/[id]` | partial clientSchema | Owner, Trainer (own) |
| DELETE | `/clients/[id]` | — | Owner, Trainer (own) |

---

## Subscriptions & Payments

| Method | Path | Body |
|--------|------|------|
| POST | `/subscriptions` | subscriptionSchema → creates subscription + payment with split |

---

## Sessions

| Method | Path | Body |
|--------|------|------|
| GET | `/sessions` | `?trainerId=&date=` |
| POST | `/sessions` | sessionSchema |
| PATCH | `/sessions` | `{ id, status, startTime, endTime, notes }` |

---

## Scheduler Slots

| Method | Path | Body |
|--------|------|------|
| GET | `/slots` | `?trainerId=` |
| POST | `/slots` | slotSchema + trainerId |
| DELETE | `/slots` | `?id=` |

---

## Client Progress

| Method | Path | Body |
|--------|------|------|
| POST | `/progress` | JSON: `{ type: "goal"|"measurement"|"note"|"diet", clientId, ... }` |
| POST | `/progress` | multipart: `{ type: "photo", clientId, file, caption? }` |

---

## Payroll

| Method | Path | Body |
|--------|------|------|
| GET | `/payroll` | `?month=&year=` |
| POST | `/payroll` | `{ action: "generate", month, year }` Owner |
| POST | `/payroll` | `{ action: "pay", payrollRunId, paidAt?, notes? }` Owner/Supervisor |
| POST | `/payroll` | `{ action: "adjust", payrollRunId, incentives, deductions, expenses }` Owner |
| GET | `/payroll/[id]/pdf` | — → PDF file |

---

## Revenue & expenses

| Method | Path | Body / query | Roles |
|--------|------|--------------|-------|
| GET | `/revenue/summary` | `?month=&year=&trend=1` | Owner |
| GET | `/revenue/cult-settlements` | `?month=&year=` | Owner |
| POST | `/revenue/cult-invoices` | Scan Drive / `{ action: "attach", fileId, month, year }` | Owner |
| GET | `/revenue/cult-invoices` | List Cult invoice PDFs from Drive | Owner |
| DELETE | `/revenue/cult-settlements/[id]` | — | Owner |
| GET | `/expenses` | `?month=&year=` | Owner, Supervisor |
| POST | `/expenses` | gymExpenseSchema | Owner, Supervisor |
| PATCH | `/expenses/[id]` | partial gymExpenseSchema | Owner, Supervisor |
| DELETE | `/expenses/[id]` | — | Owner, Supervisor |
| POST | `/expenses/sync` | merge Expenses sheet → DB | Owner, Supervisor |

---

## Gym Settings

| Method | Path | Body |
|--------|------|------|
| GET | `/gym` | — |
| GET | `/gym?type=renewals&days=30` | Renewal pipeline |
| PATCH | `/gym` | gymSettingsSchema (Owner) |

---

## Error Responses

```json
{ "error": "Message" }
```

Status codes: 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (not found)

---

## Validation

All request bodies validated with Zod schemas in `lib/validations.ts`.
