(function () {
  "use strict";

  const form = document.getElementById("audit-form");
  const output = document.getElementById("output");
  const message = document.getElementById("message");
  const count = document.getElementById("task-count");
  const modeLabel = document.getElementById("result-mode");
  const exportBtn = document.getElementById("export");
  const submitBtn = document.getElementById("execute");
  let completed = 0;
  let lastResult = null;

  function value(id) { return document.getElementById(id).value; }
  function show(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    lastResult = null;
    exportBtn.disabled = true;
    const primaryValue = value("primary");
    const secondaryValue = value("secondary");
    if (primaryValue.trim() === "" || secondaryValue.trim() === "") {
      show("Both numeric measurements are required.", true);
      return;
    }
    const payload = {
      task_id: value("task"),
      target_identifier: value("target"),
      primary_metric: Number(primaryValue),
      secondary_metric: Number(secondaryValue),
      status_descriptor: value("descriptor"),
      is_critical_flag: document.getElementById("critical").checked
    };
    const mode = value("mode");
    submitBtn.disabled = true;
    show(mode === "api" ? "Contacting this origin's backend…" : "Computing locally…");
    try {
      let result;
      if (mode === "api") {
        const response = await fetch("./api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          const detail = body && body.detail ? JSON.stringify(body.detail) : response.statusText;
          throw new Error("Backend returned HTTP " + response.status + ": " + detail);
        }
        if (!body || typeof body !== "object" || !body.dossier_id) {
          throw new Error("Unexpected backend response; verify the API endpoint.");
        }
        result = { ...body, execution_mode: "BACKEND_API" };
      } else {
        result = window.SsiDemoEngine.evaluate(payload);
      }
      lastResult = result;
      output.textContent = JSON.stringify(result, null, 2);
      completed += 1;
      count.textContent = String(completed);
      modeLabel.textContent = mode === "api" ? "Backend signed" : "Local, unsigned";
      exportBtn.disabled = false;
      show(mode === "api"
        ? "Backend response received. Integrity depends on the server's key and audit storage."
        : "Local illustration complete. No request was sent and no HMAC was generated.");
    } catch (error) {
      output.textContent = "No result generated.";
      modeLabel.textContent = "Error";
      show(error instanceof Error ? error.message : "Unexpected error.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  exportBtn.addEventListener("click", function () {
    if (!lastResult) return;
    const file = new Blob([JSON.stringify(lastResult, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ssi-demo-result.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById("mode").addEventListener("change", function () {
    show(this.value === "api"
      ? "Backend mode requires this page to be served by the FastAPI application. GitHub Pages cannot run that API."
      : "Browser mode computes illustrative rules without uploading input.");
  });
})();
