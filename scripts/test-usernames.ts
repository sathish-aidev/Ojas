import assert from "node:assert/strict";
import {
  emailForUsername,
  suggestedStaffUsername,
  slugifyUsername,
  uniqueUsername,
} from "../lib/username";

assert.equal(slugifyUsername("Sai Karan"), "saikaran");
assert.equal(suggestedStaffUsername({ name: "Lokesh", role: "SUPERVISOR" }), "lokesh");
assert.equal(suggestedStaffUsername({ name: "Rohith", role: "TRAINER" }), "rohit");
assert.equal(suggestedStaffUsername({ name: "Rahul" }), "rahul");
assert.equal(suggestedStaffUsername({ name: "Sai Karan" }), "saikaran");
assert.equal(suggestedStaffUsername({ name: "Gym Owner", role: "OWNER" }), "owner");
assert.equal(suggestedStaffUsername({ name: "Staff", email: "supervisor@impackt.gym" }), "lokesh");
assert.equal(emailForUsername("lokesh"), "lokesh@impackt.gym");

const used = new Set(["rohit"]);
assert.equal(uniqueUsername("rohit", used), "rohit2");

console.log("username helpers: ok");
