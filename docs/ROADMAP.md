# Impackt Gym — Product Roadmap

## Phase 0 — Bootstrap ✅
- Next.js + Prisma + PostgreSQL
- Documentation (BRD, competitive analysis, user stories)
- Seed data for Hyderabad pilot gym

## Phase 1 — Auth & Roles ✅
- Login, JWT sessions, middleware RBAC
- Owner user management
- Role dashboards (owner, supervisor, trainer)

## Phase 2 — PT Tracker MVP ✅
- Clients, subscriptions, payments with revenue split
- Sessions and scheduler slots
- Renewal pipeline and status sync
- Owner/supervisor/trainer dashboards

## Phase 3 — Client Progress ✅
- Goals, measurements, charts
- Pinned notes, diet programs
- Progress photo upload

## Phase 4 — Salaries ✅
- Employee types (trainer, manager, cleaning)
- Payroll generation with auto commission
- PDF pay stubs, payment recording, history

## Phase 5 — Pilot Polish ✅
- Mobile-responsive trainer UI
- Seed data, README, deployment notes

## Phase 6 — SaaS Prep (Next)
- [ ] Multi-gym tenant onboarding
- [ ] Seat limits (5-user plan)
- [ ] Razorpay subscription billing
- [ ] Trial period + exception list
- [ ] Custom domain per gym

## Phase 7 — Mobile Apps
- [ ] PWA manifest + offline hints
- [ ] React Native (Expo) app reusing API
- [ ] Push notifications for renewals

## Phase 8 — Extended Modules
- [ ] QR/biometric attendance
- [ ] Gym membership billing (non-PT)
- [ ] WhatsApp renewal reminders
- [ ] GST-compliant invoicing
- [ ] UPI payment links

---

## Pilot Checklist (Your Gym)

1. Run seed and login as owner
2. Verify 3 trainers see only their clients
3. Log a new PT payment — check split on owner dashboard
4. Generate payroll — verify commission matches payments
5. Download PDF pay stub
6. Login as supervisor — mark payroll paid
7. Trainer adds client on phone browser

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.1.0 | 2026 | MVP webapp — PT + Progress + Salaries |
