# Impackt Gym — Business Requirements Document

**Version:** 1.0  
**Product:** Impackt Gym Webapp  
**Target market:** Indian gym owners (starting Hyderabad pilot)  
**Primary users:** Owner, Supervisor, Trainer

---

## 1. Executive Summary

Impackt Gym is a **personal training (PT) first** gym management web application. It replaces spreadsheets and WhatsApp-based tracking with a unified platform for client scheduling, PT payments, revenue splits, renewals, client progress, and monthly salary/payroll.

**Phase 1 (MVP):** Web app with three role-based modules. Mobile-responsive for in-gym trainer use. Native mobile apps deferred to Phase 2.

---

## 2. Problem Statement

Gym owners in India running PT businesses face:

- Trainers track clients via WhatsApp and paper — no unified schedule view
- PT payment and renewal dates are missed, causing revenue loss
- Revenue split between trainer and owner is calculated manually (40/60, 50/50, 55/45 vary per trainer)
- End-of-month salary = base salary + PT commission + incentives requires Excel reconciliation
- No single view of trainer performance, client progress, or renewal pipeline

---

## 3. User Roles

### 3.1 Owner (Administrator)
- Full gym access
- Creates trainer and supervisor accounts with temporary passwords
- Sets per-trainer revenue split % and base salary
- Views all trainers, clients, revenue dashboards
- Generates and pays salaries; exports PDF pay stubs
- Configures gym settings and renewal reminder days

### 3.2 Supervisor (Gym Manager / Coordinator)
- Views all trainers and clients (operations)
- Views PT tracking dashboard and renewal pipeline
- Views and records salary payments
- **Cannot:** create/delete users, change revenue split %, edit base salary rules

### 3.3 Trainer
- Manages own clients only
- Logs PT payments, subscriptions, sessions
- Day scheduler — open/blocked slots
- Client progress: goals, measurements, charts, pinned notes
- Optional: diet program, progress photos
- Views own earnings (trainer share MTD) and payroll history

---

## 4. Functional Requirements

### Module 1: Personal Training Tracker

| ID | Requirement | Priority |
|----|-------------|----------|
| PT-01 | Trainer can CRUD clients (name, phone, email, join date) | Must |
| PT-02 | Trainer can log PT package: amount, payment date, start/end dates | Must |
| PT-03 | Optional sessions count (total vs used) | Should |
| PT-04 | Auto-compute trainer/owner revenue split on each payment | Must |
| PT-05 | Day scheduler: add slots, mark open/blocked/booked | Must |
| PT-06 | Session log with optional start/end time; attendance status | Must |
| PT-07 | Renewal reminders when package end approaches (configurable days) | Must |
| PT-08 | Owner/Supervisor dashboard: all trainers, client counts, MTD revenue | Must |
| PT-09 | Per-trainer drill-down: clients, payments, split breakdown | Must |
| PT-10 | Renewal pipeline: clients due in 7/14/30 days | Must |
| PT-11 | PT module excludes base salary (separate Salaries module) | Must |

### Module 2: Client Progress

| ID | Requirement | Priority |
|----|-------------|----------|
| CP-01 | Set client goals (weight loss, fitness, muscle gain, custom) | Must |
| CP-02 | Log measurements: weight, body fat, body measurements | Must |
| CP-03 | Configurable frequency: daily, weekly, bi-weekly, monthly | Should |
| CP-04 | Progress charts per metric with goal reference line | Must |
| CP-05 | Pinned notes at top of client profile (injuries, limitations) | Must |
| CP-06 | General notes section per client | Must |
| CP-07 | Optional diet program with adherence notes | Should |
| CP-08 | Optional progress photo upload | Should |

### Module 3: Salaries

| ID | Requirement | Priority |
|----|-------------|----------|
| SL-01 | Employee types: Trainer, Gym Manager, Cleaning Staff | Must |
| SL-02 | Owner sets base salary per employee | Must |
| SL-03 | Auto-pull PT commission for trainers from Module 1 | Must |
| SL-04 | Incentives, deductions, expenses per payroll run | Should |
| SL-05 | Monthly payroll generation | Must |
| SL-06 | Mark payroll as paid with date (Owner + Supervisor) | Must |
| SL-07 | PDF pay stub export | Must |
| SL-08 | 12-month payroll history per employee | Must |
| SL-09 | Salaries module separate from PT tracking dashboard | Must |

### Authentication & Admin

| ID | Requirement | Priority |
|----|-------------|----------|
| AU-01 | Email/password login with role-based routing | Must |
| AU-02 | Owner creates user accounts with temp password | Must |
| AU-03 | Users can change password | Should |
| AU-04 | Owner can reset passwords and deactivate users | Must |

---

## 5. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NF-01 | Simple UI — one clear job per screen |
| NF-02 | Mobile-responsive (trainers use phones in gym) |
| NF-03 | Modular architecture for future modules (attendance, membership) |
| NF-04 | Multi-tenant ready (`gym_id` on all entities) |
| NF-05 | INR currency formatting |
| NF-06 | Sub-2-minute pay stub generation per trainer |

---

## 6. Out of Scope (MVP)

- Biometric/QR attendance
- Client-facing member app
- WhatsApp/SMS automation (hooks only)
- GST invoicing / UPI collection
- Multi-gym owner dashboard
- SaaS subscription billing

---

## 7. Future Modules (Post-MVP)

1. Attendance / check-in module
2. Gym membership billing (separate from PT)
3. Multi-gym / franchise rollup
4. SaaS billing (trial → 5-user plan → scale via Razorpay)
5. Native mobile apps (iOS/Android via Expo)
6. WhatsApp renewal reminders

---

## 8. Success Criteria (Hyderabad Pilot)

- [ ] All 3 trainers manage clients entirely in-app
- [ ] Owner revenue split accurate within 1% of manual calculation
- [ ] Pay stub generated in under 2 minutes per trainer
- [ ] Renewal reminders visible 7 days before package end
- [ ] Supervisor can mark salaries paid without Owner login

---

## 9. Glossary

| Term | Definition |
|------|------------|
| PT | Personal Training — one-on-one paid sessions |
| Split | Revenue share between trainer and gym owner |
| Subscription | A PT package with start/end dates and payment |
| Payroll Run | Monthly salary record for one employee |
