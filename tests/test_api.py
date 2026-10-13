"""Regression checks for the actual HTTP server and synthetic-data handling."""
from fastapi.testclient import TestClient
from agents.api import app
from agents.base import AuditTrail
from agents.models import SystemTaskPayload
from agents.supervisor import SystemSupervisor
from pydantic import ValidationError
import pytest

client = TestClient(app)

def sample(**changes):
    values = dict(task_id="CASE-TEST", target_identifier="SYNTH-01",
                  primary_metric=10.0, secondary_metric=2.0,
                  status_descriptor="NOMINAL", is_critical_flag=False)
    values.update(changes)
    return values

def test_html_frontend_and_health():
    assert client.get("/health").status_code == 200
    page = client.get("/")
    assert page.status_code == 200
    assert "Synthetic threshold demonstrator" in page.text
    assert client.get("/engine.js").status_code == 200

def test_audit_and_prometheus_metrics():
    response = client.post("/api/audit", json=sample())
    assert response.status_code == 200
    assert response.json()["overall_urgency"] == "ROUTINE"
    assert len(response.json()["audit_hash"]) == 64
    metrics = client.get("/metrics")
    assert metrics.status_code == 200
    assert "text/plain" in metrics.headers["content-type"]
    assert "system_tasks_total" in metrics.text

def test_api_rejects_phi_identifiers_and_nested_notes():
    response = client.post("/api/audit", json=sample(target_identifier="MRN-123456"))
    assert response.status_code == 400
    response = client.post("/api/audit", json=sample(attributes={"notes": "Reach test@example.com"}))
    assert response.status_code == 400
    assert client.post("/api/chat", json={"query": "Contact test@example.com"}).status_code == 400

def test_invalid_numeric_and_identifier_inputs():
    assert client.post("/api/audit", json=sample(primary_metric="NaN")).status_code == 422
    assert client.post("/api/audit", json=sample(task_id="")).status_code == 422

def test_tamper_detection_includes_hmac_and_defensive_copy():
    trail = AuditTrail(secret_key="synthetic-test-key")
    trail.log("worker", "tier", "EVALUATE", {"case": "SYNTH-1"})
    trail.log("worker", "tier", "EVALUATE", {"case": "SYNTH-2"})
    assert trail.verify_integrity()
    exported = trail.get_trail()
    exported[0]["payload_hash"] = "tampered"
    assert trail.verify_integrity()
    trail.logs[0]["payload_hash"] = "tampered"
    assert not trail.verify_integrity()
    # Spoofing linked hashes without the key must not pass.
    assert len(trail.get_trail()) == 2

def test_llm_unimplemented_provider_is_explicit():
    with pytest.raises(ValueError):
        SystemSupervisor(model_provider="openai")
