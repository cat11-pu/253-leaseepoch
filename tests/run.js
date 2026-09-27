import assert from "node:assert";
import { canAcquire, holdsLease } from "../lease.js";
import { step, close } from "../epochrun.js";
import { render } from "../app.js";

const base = {
  state: { epoch: 0, active: {}, expired: [], reclaimed: [], applied: [] },
  events: [], budget: 1, capacity: 1,
  held_error_code: "E_LEASE_HELD", none_error_code: "E_NO_LEASE", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("canAcquire returns a flag", () => {
  assert.strictEqual(typeof canAcquire(base.state, 1), "boolean");
});

check("holdsLease returns a flag", () => {
  assert.strictEqual(typeof holdsLease(base.state, 1), "boolean");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
