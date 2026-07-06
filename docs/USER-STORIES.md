# Impackt Gym — User Stories

Format: `[ROLE-###] As a {role}, I want {action}, so that {benefit}.`

---

## Owner Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| OWN-001 | As an owner, I want to log in and see total PT revenue and my share, so that I know how the gym is performing. | Dashboard shows MTD revenue, owner share, trainer count, active clients |
| OWN-002 | As an owner, I want to create trainer accounts with temp passwords, so that trainers can start using the app. | Create form; email unique; role TRAINER; employee profile created |
| OWN-003 | As an owner, I want to set each trainer's revenue split %, so that payments auto-calculate correctly. | Split % stored on employee; applied on each payment |
| OWN-004 | As an owner, I want to set base salary per employee, so that payroll includes fixed pay. | Base salary editable on employee; shown in salaries |
| OWN-005 | As an owner, I want to see all trainers with client counts and MTD revenue, so that I can compare performance. | Trainers list with metrics |
| OWN-006 | As an owner, I want a renewal pipeline, so that I can follow up before clients churn. | List of subscriptions ending in 30 days |
| OWN-007 | As an owner, I want to generate monthly payroll for all staff, so that I don't use spreadsheets. | Generate pulls base + PT commission |
| OWN-008 | As an owner, I want PDF pay stubs, so that I can give trainers documentation. | PDF download with line items |
| OWN-009 | As an owner, I want to configure renewal reminder days, so that alerts match my workflow. | Gym setting 1–60 days |
| OWN-010 | As an owner, I want to reset trainer passwords, so that I can recover locked accounts. | Reset via team management |

---

## Supervisor Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| SUP-001 | As a supervisor, I want to view all trainers and clients, so that I can run daily operations. | Read access to trainer/client lists |
| SUP-002 | As a supervisor, I want to see the renewal pipeline, so that I can remind trainers to follow up. | Same renewals view as owner |
| SUP-003 | As a supervisor, I want to view salaries and mark them paid, so that the owner doesn't need to every month. | Can mark PAID; cannot edit split/salary rules |
| SUP-004 | As a supervisor, I want to download pay stub PDFs, so that I can distribute them. | PDF link works |
| SUP-005 | As a supervisor, I should NOT create trainers or change split %, so that business rules stay with owner. | API returns 403 |

---

## Trainer Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| TRN-001 | As a trainer, I want to see today's sessions on login, so that I know my schedule. | Today dashboard with session list |
| TRN-002 | As a trainer, I want to add a new client quickly on my phone, so that I can onboard at the gym. | Mobile-friendly form; min 44px tap targets |
| TRN-003 | As a trainer, I want to log PT payment with dates and amount, so that revenue is tracked. | Subscription + payment created with split |
| TRN-004 | As a trainer, I want to schedule and complete sessions, so that attendance is recorded. | Session CRUD; completed increments session count |
| TRN-005 | As a trainer, I want to manage time slots, so that I know availability for new clients. | Add open/blocked slots |
| TRN-006 | As a trainer, I want renewal alerts for my clients, so that I can retain them. | Expiring clients on dashboard |
| TRN-007 | As a trainer, I want to pin important notes (injuries), so that I don't forget limitations. | Pinned notes at top of client profile |
| TRN-008 | As a trainer, I want to track weight and measurements with charts, so that clients see progress. | Measurements + Recharts graphs |
| TRN-009 | As a trainer, I want to set client goals, so that we track toward targets. | Goals with target/current/deadline |
| TRN-010 | As a trainer, I want to see my MTD earnings, so that I know my commission. | Earnings page with payment list |
| TRN-011 | As a trainer, I want optional diet program tracking, so that I can support nutrition clients. | Diet program CRUD |
| TRN-012 | As a trainer, I want to upload progress photos, so that I can compare visually. | Photo upload to /uploads |

---

## Cross-Cutting Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| SYS-001 | As any user, I want role-based navigation, so that I only see relevant modules. | Middleware redirects by role |
| SYS-002 | As any user, I want to sign out securely. | Sign out clears session |
| SYS-003 | As the system, I should mark subscriptions EXPIRING/EXPIRED based on dates. | syncSubscriptionStatuses runs on dashboard load |

---

## Implementation Status (MVP)

All stories above are implemented in the webapp MVP except:
- WhatsApp/email notifications (in-app/dashboard only)
- Password change UI (reset by owner works; self-service deferred)
- Drag-and-drop scheduler (list/form based in MVP)
