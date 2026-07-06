# Impackt Gym — Data Model

## Entity Relationship Overview

```
Gym 1──* User
Gym 1──* Employee
User 1──1 Employee (optional for owner)
Employee 1──* Client (trainers only)
Client 1──* PTSubscription
PTSubscription 1──* Payment
Client 1──* Session
Client 1──* Measurement / Goal / ClientNote / DietProgram / ProgressPhoto
Employee 1──* TrainerSlot
Employee 1──* PayrollRun
PayrollRun 1──* PayrollLineItem
```

---

## Entities

### Gym
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| name | string | |
| location | string? | |
| renewalReminderDays | int | Default 7 |

### User
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| email | string | Unique |
| passwordHash | string | bcrypt |
| name | string | |
| role | enum | OWNER, SUPERVISOR, TRAINER |
| gymId | FK | |
| isActive | boolean | |

### Employee
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| userId | FK | Unique |
| gymId | FK | |
| employeeType | enum | TRAINER, MANAGER, CLEANING |
| baseSalary | decimal | INR |
| revenueSplitPercent | decimal? | 0–100, trainers only |

### Client
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| gymId, trainerId | FK | |
| name, phone, email | | |
| status | enum | ACTIVE, TRIAL, EXPIRED, INACTIVE |

### PTSubscription
| Field | Type | Notes |
|-------|------|-------|
| amount | decimal | Package price |
| paymentDate, startDate, endDate | datetime | |
| sessionsTotal, sessionsUsed | int? | Optional session pack |
| status | enum | ACTIVE, EXPIRING, EXPIRED, CANCELLED |

### Payment
| Field | Type | Notes |
|-------|------|-------|
| amount | decimal | |
| trainerShareAmount | decimal | Computed at create |
| ownerShareAmount | decimal | Computed at create |

### Session
| Field | Type | Notes |
|-------|------|-------|
| scheduledAt | datetime | |
| startTime, endTime | datetime? | Optional attendance log |
| status | enum | SCHEDULED, COMPLETED, CANCELLED, NO_SHOW |

### TrainerSlot
| Field | Type | Notes |
|-------|------|-------|
| startAt, endAt | datetime | |
| isBlocked | boolean | Unavailable slot |
| clientId | FK? | Booked slot |

### Goal / Measurement / ClientNote / DietProgram / ProgressPhoto
See `prisma/schema.prisma` for full field definitions.

### PayrollRun
| Field | Type | Notes |
|-------|------|-------|
| employeeId, month, year | | Unique together |
| baseSalary, commission, incentives, deductions, expenses | decimal | |
| grossPay, netPay | decimal | |
| status | enum | PENDING, PAID |
| paidAt | datetime? | |

---

## Business Rules

1. **Revenue split:** `trainerShare = amount × (revenueSplitPercent / 100)`
2. **Renewal status:** If `endDate <= today + renewalReminderDays` → EXPIRING; if `endDate < today` → EXPIRED
3. **Session completion:** Increments `sessionsUsed` on active subscription if `sessionsTotal` set
4. **Payroll commission:** Sum of `trainerShareAmount` for trainer's clients in that month
5. **Supervisor guard:** Cannot PATCH employee split/salary or POST /api/users

---

## Indexes

Key indexes on: `gymId`, `trainerId`, `clientId`, `endDate`, `paidAt`, `scheduledAt`, `(employeeId, month, year)`.

See [`prisma/schema.prisma`](../prisma/schema.prisma) for source of truth.
