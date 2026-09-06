import assert from "node:assert/strict";
import {
  hasActivePt,
  partitionClientsByActivePt,
  ptListBadge,
} from "../lib/client-pt-status";

const now = new Date("2026-09-06T12:00:00+05:30");

assert.equal(hasActivePt("2026-09-06", now), true);
assert.equal(hasActivePt("2026-09-05", now), false);
assert.equal(hasActivePt(null, now), false);
assert.equal(ptListBadge("2026-12-01", now).label, "Active PT");
assert.equal(ptListBadge("2026-01-01", now).label, "Ended");

const { active, past } = partitionClientsByActivePt(
  [
    { name: "Old", subEndDate: "2026-01-15" },
    { name: "Soon", subEndDate: "2026-09-10" },
    { name: "Later", subEndDate: "2026-11-01" },
    { name: "None" },
  ],
  now
);

assert.deepEqual(
  active.map((c) => c.name),
  ["Soon", "Later"]
);
assert.deepEqual(
  past.map((c) => c.name),
  ["Old", "None"]
);

console.log("client PT status: ok");
