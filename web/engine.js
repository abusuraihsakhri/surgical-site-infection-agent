/*
 * Deterministic demonstration thresholds mirrored from agents/workers.py.
 * Not CDC/NHSN SSI criteria, a diagnosis, or a clinical risk model.
 */
(function (root) {
  "use strict";

  function evaluate(input) {
    if (!input || typeof input !== "object") throw new TypeError("A payload is required.");
    const taskId = String(input.task_id ?? "").trim();
    const targetId = String(input.target_identifier ?? "").trim();
    const status = String(input.status_descriptor ?? "NOMINAL").trim();
    if (!taskId || !targetId || taskId.length > 128 || targetId.length > 128) {
      throw new Error("Enter synthetic task and target identifiers (1–128 characters).");
    }
    if (status.length > 128) throw new Error("Status descriptor is too long.");
    const primary = Number(input.primary_metric);
    const secondary = Number(input.secondary_metric);
    if (input.primary_metric === "" || input.secondary_metric === "" ||
        !Number.isFinite(primary) || !Number.isFinite(secondary)) {
      throw new Error("Primary and secondary metrics must be finite numbers.");
    }
    if (typeof input.is_critical_flag !== "boolean") {
      throw new Error("The critical flag must be a boolean.");
    }

    const alerts = [];
    function add(worker, urgency, summary, details) {
      alerts.push({
        alert_id: "DEMO-" + (alerts.length + 1),
        origin_worker: worker,
        urgency,
        summary,
        technical_details: details,
        actionable_remediation: "Review the synthetic inputs and demonstration rule.",
        standard_reference: "Illustrative thresholds only; no validated clinical standard"
      });
    }
    if (primary > 25) {
      add("InvariantQCWorker", "ELEVATED_RISK",
          "Primary Metric Threshold Exceeded",
          "Primary index " + primary.toFixed(2) + " exceeds demo threshold 25.");
    }
    if (input.is_critical_flag || secondary > 12) {
      add("SafetyEscalationWorker",
          input.is_critical_flag ? "CRITICAL_STAT_PANIC" : "ELEVATED_RISK",
          "Demonstration Safety Flag Triggered",
          "Critical flag: " + input.is_critical_flag + "; secondary index: " + secondary.toFixed(2) + ".");
    }
    if (["DISCORDANT", "ANOMALY", "MUTANT", "VIOLATION", "FAIL", "REJECT"]
        .some(word => status.toUpperCase().includes(word))) {
      add("ProtocolConformanceWorker", "ELEVATED_RISK",
          "Descriptor Flag Detected", "Synthetic status: " + status);
    }
    const critical = alerts.filter(a => a.urgency === "CRITICAL_STAT_PANIC").length;
    const elevated = alerts.some(a => a.urgency === "ELEVATED_RISK");
    const urgency = critical ? "CRITICAL_STAT_PANIC" : (elevated ? "ELEVATED_RISK" : "ROUTINE");
    const integrity = critical ? "RECALIBRATION_REQUIRED" :
        (elevated ? "DISCORDANT_ANOMALY" : "VALIDATED_OPTIMAL");

    return {
      execution_mode: "LOCAL_BROWSER_DEMO",
      task_id: taskId,
      target_identifier: targetId,
      overall_urgency: urgency,
      integrity_status: integrity,
      total_alerts: alerts.length,
      critical_alerts_count: critical,
      alerts,
      consensus_summary: "Illustrative threshold assessment only; not a CDC/NHSN SSI classification.",
      timestamp: new Date().toISOString(),
      audit_hash: null
    };
  }

  root.SsiDemoEngine = Object.freeze({ evaluate });
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { evaluate };
  }
})(typeof window === "undefined" ? globalThis : window);
