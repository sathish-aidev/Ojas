import assert from "node:assert/strict";
import { pickClosedBooksMonth } from "@/lib/gym-calendar";

function pick(
  today: { month: number; year: number },
  latestCult: { month: number; year: number } | null,
  latestActivity: { month: number; year: number } | null = null
) {
  return pickClosedBooksMonth({ today, latestCult, latestActivity });
}

const sep1 = pick({ month: 9, year: 2026 }, { month: 7, year: 2026 }, { month: 8, year: 2026 });
assert.equal(sep1.books.month, 7);
assert.equal(sep1.due?.month, 8);

const sep12 = pick({ month: 9, year: 2026 }, { month: 8, year: 2026 });
assert.equal(sep12.books.month, 8);
assert.equal(sep12.due, null);

const oct1 = pick({ month: 10, year: 2026 }, { month: 8, year: 2026 });
assert.equal(oct1.books.month, 8);
assert.equal(oct1.due?.month, 9);

const jan = pick({ month: 1, year: 2026 }, null, null);
assert.equal(jan.books.month, 1);
assert.equal(jan.books.year, 2026);

console.log("home books month: ok");
