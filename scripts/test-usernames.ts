import assert from "node:assert/strict";
import { loginSchema } from "../lib/validations";
import {
  emailForUsername,
  suggestedStaffUsername,
  slugifyUsername,
  uniqueUsername,
  resolveLoginLookup,
} from "../lib/username";

assert.equal(slugifyUsername("Sai Karan"), "saikaran");
assert.equal(suggestedStaffUsername({ name: "Lokesh", role: "SUPERVISOR" }), "lokesh");
assert.equal(suggestedStaffUsername({ name: "Rohith", role: "TRAINER" }), "rohit");
assert.equal(suggestedStaffUsername({ name: "Rahul" }), "rahul");
assert.equal(suggestedStaffUsername({ name: "Sai Karan" }), "saikaran");
assert.equal(suggestedStaffUsername({ name: "Gym Owner", role: "OWNER" }), "owner");
assert.equal(suggestedStaffUsername({ name: "Staff", email: "supervisor@impackt.gym" }), "lokesh");
assert.equal(emailForUsername("lokesh"), "lokesh@impackt.gym");

assert.deepEqual(resolveLoginLookup("owner"), { username: "owner" });
assert.deepEqual(resolveLoginLookup("  Lokesh "), { username: "lokesh" });
assert.deepEqual(resolveLoginLookup("owner@impackt.gym"), {
  username: "owner",
  email: "owner@impackt.gym",
});
assert.deepEqual(resolveLoginLookup("supervisor@impackt.gym"), {
  username: "lokesh",
  email: "supervisor@impackt.gym",
});

assert.equal(
  loginSchema.safeParse({ username: "owner@impackt.gym", password: "password123" }).success,
  true
);
assert.equal(loginSchema.safeParse({ username: "owner", password: "password123" }).success, true);

const used = new Set(["rohit"]);
assert.equal(uniqueUsername("rohit", used), "rohit2");

console.log("username helpers: ok");
