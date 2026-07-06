# PT Payment Split — Test Plan

Run after any change to client creation, payment allocation, or trainer split logic:

```bash
npm run test:pt-split
```

## What it verifies

| # | Scenario | Expected |
|---|----------|----------|
| 1 | ₹20,000 for 2 months starting 03/05/2026 | 2 × ₹10,000 installments |
| 2 | Service months | May + June |
| 3 | Payable dates | 01/06/2026 and 01/07/2026 |
| 4 | Target not met | 40% of ₹10,000 = ₹4,000 trainer share |
| 5 | Target met | 45% of ₹10,000 = ₹4,500 trainer share |
| 6 | Empty optional `sessionsTotal` in form | No validation error |
| 7 | Odd amounts (₹20,001 / 3 months) | Installments sum exactly to total |

## Manual UI check

1. Owner → Clients → New Client
2. Enter: Sudarshan, Rohit, ₹20,000, 2 months, 03/05/2026 – 03/07/2026, UPI
3. Submit — should succeed (no "Number must be greater than 0")
4. Open client detail — two payment rows:
   - Month 1 of 2: ₹10,000, service May, payable June, 40% split
   - Month 2 of 2: ₹10,000, service June, payable July

## Business rules

- **Target** = total PT payments attributed to a trainer in that calendar month
- **Split %** applies to all payments in that month once target status is known
- **Multi-month packages** split the lump sum evenly; each portion counts in its service month
