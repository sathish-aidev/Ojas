import assert from "node:assert/strict";
import { canManageClients, canRecordPayroll, canEditSalaryRules } from "@/lib/permissions";
import { parseMonthYearFromSearchParams } from "@/lib/parse-search-params";
import { defaultClosedViewMonth, getGymToday } from "@/lib/gym-calendar";

assert.equal(canManageClients("SUPERVISOR"), true);
assert.equal(canManageClients("OWNER"), true);
assert.equal(canManageClients("TRAINER"), true);
assert.equal(canRecordPayroll("SUPERVISOR"), true);
assert.equal(canEditSalaryRules("SUPERVISOR"), false);

const closed = defaultClosedViewMonth(new Date("2026-09-04T12:00:00+05:30"));
assert.equal(closed.month, 8);
assert.equal(closed.year, 2026);

const fromUrl = parseMonthYearFromSearchParams({}, "", closed);
assert.equal(fromUrl.month, 8);
assert.equal(fromUrl.year, 2026);

const explicit = parseMonthYearFromSearchParams({ month: "9", year: "2026" }, "", closed);
assert.equal(explicit.month, 9);
assert.equal(explicit.year, 2026);

const today = getGymToday();
const istToday = parseMonthYearFromSearchParams({});
assert.equal(istToday.month, today.month);
assert.equal(istToday.year, today.year);

console.log("supervisor live permissions and month defaults: ok");
