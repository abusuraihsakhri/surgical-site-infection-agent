const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluate } = require("../web/engine.js");

function payload(changes = {}) {
  return { task_id: "DEMO", target_identifier: "SYNTH-01", primary_metric: 10,
    secondary_metric: 4, status_descriptor: "NOMINAL", is_critical_flag: false, ...changes };
}
test("routine case produces no alert or forged audit hash", () => {
  const r = evaluate(payload());
  assert.equal(r.overall_urgency, "ROUTINE");
  assert.equal(r.total_alerts, 0);
  assert.equal(r.audit_hash, null);
  assert.equal(r.execution_mode, "LOCAL_BROWSER_DEMO");
});
test("boundaries use strict exceedance and critical override", () => {
  assert.equal(evaluate(payload({ primary_metric: 25, secondary_metric: 12 })).total_alerts, 0);
  const r = evaluate(payload({ primary_metric: 26, secondary_metric: 13,
    status_descriptor: "DISCORDANT", is_critical_flag: true }));
  assert.equal(r.total_alerts, 3);
  assert.equal(r.critical_alerts_count, 1);
  assert.equal(r.overall_urgency, "CRITICAL_STAT_PANIC");
});
test("noncritical safety alert remains elevated", () => {
  const r = evaluate(payload({ secondary_metric: 13 }));
  assert.equal(r.overall_urgency, "ELEVATED_RISK");
  assert.equal(r.critical_alerts_count, 0);
});
test("reject invalid or nonfinite numeric and malformed identifiers", () => {
  for (const p of [payload({ primary_metric: Infinity }), payload({ secondary_metric: NaN }),
      payload({ task_id: "" }), payload({ is_critical_flag: "false" })]) {
    assert.throws(() => evaluate(p));
  }
});
