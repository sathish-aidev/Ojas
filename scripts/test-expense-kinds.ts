/**
 * Expense kind / petty-cash rules — run after expense ledger changes:
 *   npm run test:expense-kinds
 */
import { gymExpenseSchema } from "../lib/validations";
import {
  authorizeExpenseWrite,
  canCreateExpenseKind,
  canMutateExpenseKind,
  defaultKindForRole,
  isCategoryAllowedForKind,
  parseExpenseKind,
  pettyCashFromRows,
  sumPnlExpenses,
} from "../lib/services/expense-kinds";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function main() {
  console.log("\n=== Expense kinds / petty cash ===\n");

  console.log("1. Parse type labels");
  assert(parseExpenseKind("Owner bill") === "OWNER_BILL", "Owner bill");
  assert(parseExpenseKind("Cash given to supervisor") === "SUPERVISOR_ADVANCE", "Cash given");
  assert(parseExpenseKind("Supervisor spend") === "SUPERVISOR_SPEND", "Supervisor spend");
  assert(parseExpenseKind("type 2") === "SUPERVISOR_SPEND", "type 2 alias");
  assert(parseExpenseKind("") === null, "Empty type is null");
  assert(parseExpenseKind("not a type") === null, "Unknown type is null");

  console.log("\n2. Roles");
  assert(defaultKindForRole("OWNER") === "OWNER_BILL", "Owner defaults to gym bill");
  assert(defaultKindForRole("SUPERVISOR") === "SUPERVISOR_SPEND", "Supervisor defaults to spend");
  assert(canCreateExpenseKind("OWNER", "SUPERVISOR_ADVANCE"), "Owner can give cash");
  assert(!canCreateExpenseKind("SUPERVISOR", "OWNER_BILL"), "Supervisor cannot add gym bills");
  assert(!canCreateExpenseKind("SUPERVISOR", "SUPERVISOR_ADVANCE"), "Supervisor cannot record cash given");
  assert(canCreateExpenseKind("SUPERVISOR", "SUPERVISOR_SPEND"), "Supervisor can add spends");
  assert(!canMutateExpenseKind("SUPERVISOR", "OWNER_BILL"), "Supervisor cannot edit gym bills");
  assert(canMutateExpenseKind("SUPERVISOR", "SUPERVISOR_SPEND"), "Supervisor can edit spends");

  console.log("\n3. Categories");
  assert(isCategoryAllowedForKind("OWNER_BILL", "RENT"), "Rent is a gym bill");
  assert(isCategoryAllowedForKind("OWNER_BILL", "EQUIPMENT"), "Equipment is a gym bill");
  assert(!isCategoryAllowedForKind("SUPERVISOR_SPEND", "RENT"), "Supervisor cannot spend as Rent");
  assert(!isCategoryAllowedForKind("SUPERVISOR_SPEND", "SALARIES"), "Supervisor cannot spend as Salaries");
  assert(isCategoryAllowedForKind("SUPERVISOR_SPEND", "REPAIRS"), "Supervisor can spend on repairs");
  assert(isCategoryAllowedForKind("SUPERVISOR_ADVANCE", "MAINTENANCE"), "Cash given uses Maintenance");
  assert(!isCategoryAllowedForKind("SUPERVISOR_ADVANCE", "EQUIPMENT"), "Cash given is not Equipment");

  console.log("\n4. P&L vs float (₹10,000 given, ₹2,500 + ₹800 spent, ₹50,000 rent)");
  const rows = [
    { kind: "OWNER_BILL" as const, amount: 50000 },
    { kind: "SUPERVISOR_ADVANCE" as const, amount: 10000 },
    { kind: "SUPERVISOR_SPEND" as const, amount: 2500 },
    { kind: "SUPERVISOR_SPEND" as const, amount: 800 },
  ];
  assert(sumPnlExpenses(rows) === 60000, "Revenue expenses = rent + cash given = ₹60,000");
  const petty = pettyCashFromRows(rows);
  assert(petty.issued === 10000, "Issued ₹10,000");
  assert(petty.spent === 3300, "Spent ₹3,300");
  assert(petty.remaining === 6700, "Remaining ₹6,700");

  console.log("\n5. Overdrawn float");
  const over = pettyCashFromRows([
    { kind: "SUPERVISOR_ADVANCE", amount: 8000 },
    { kind: "SUPERVISOR_SPEND", amount: 9000 },
  ]);
  assert(over.remaining === -1000, "Remaining is −₹1,000 when overdrawn");
  assert(
    sumPnlExpenses([
      { kind: "SUPERVISOR_ADVANCE", amount: 8000 },
      { kind: "SUPERVISOR_SPEND", amount: 9000 },
    ]) === 8000,
    "Overspend still does not increase Revenue beyond cash given"
  );

  console.log("\n6. Authorize writes");
  assert(
    authorizeExpenseWrite({
      role: "SUPERVISOR",
      action: "create",
      requestedKind: "OWNER_BILL",
    }).ok === false,
    "Supervisor create gym bill rejected"
  );
  assert(
    authorizeExpenseWrite({
      role: "OWNER",
      action: "create",
      requestedKind: "SUPERVISOR_ADVANCE",
    }).ok === true,
    "Owner create cash given allowed"
  );
  assert(
    authorizeExpenseWrite({
      role: "SUPERVISOR",
      action: "delete",
      requestedKind: "SUPERVISOR_ADVANCE",
      existingKind: "SUPERVISOR_ADVANCE",
    }).ok === false,
    "Supervisor cannot delete cash given"
  );

  console.log("\n7. Form schema accepts kind + Equipment");
  const parsed = gymExpenseSchema.safeParse({
    date: "2026-08-25",
    kind: "SUPERVISOR_SPEND",
    category: "EQUIPMENT",
    description: "Small dumbbells",
    amount: 1500,
  });
  assert(parsed.success, "Spend + Equipment validates");

  const bill = gymExpenseSchema.safeParse({
    date: "2026-08-25",
    category: "RENT",
    description: "August rent",
    amount: "85000",
  });
  assert(bill.success, "Owner bill without kind still validates");

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
