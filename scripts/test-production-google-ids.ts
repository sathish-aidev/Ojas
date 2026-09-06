import assert from "node:assert/strict";
import {
  KNOWN_PRODUCTION_DRIVE_FOLDER_ID,
  isProductionGoogleId,
  productionGoogleIdDenylist,
  assertGoogleIdAllowed,
} from "../lib/google/production-google-ids";

process.env.APP_ENV = "staging";
process.env.PRODUCTION_GOOGLE_SHEETS_SPREADSHEET_ID = "prod-sheet-id";
delete process.env.ALLOW_PRODUCTION_GOOGLE;

assert.equal(isProductionGoogleId(KNOWN_PRODUCTION_DRIVE_FOLDER_ID), true);
assert.equal(isProductionGoogleId("prod-sheet-id"), true);
assert.equal(isProductionGoogleId("test-folder-id"), false);
assert.ok(productionGoogleIdDenylist().has("prod-sheet-id"));

assert.throws(
  () => assertGoogleIdAllowed("Drive folder", KNOWN_PRODUCTION_DRIVE_FOLDER_ID),
  /Refusing to use the live Google/
);
assert.doesNotThrow(() => assertGoogleIdAllowed("Drive folder", "staging-folder"));

process.env.APP_ENV = "production";
assert.doesNotThrow(() => assertGoogleIdAllowed("Drive folder", KNOWN_PRODUCTION_DRIVE_FOLDER_ID));

console.log("production google ids: ok");
