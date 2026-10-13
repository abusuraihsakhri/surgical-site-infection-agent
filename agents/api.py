"""
FastAPI REST API Server for Surgical Site Infection Agent.
"""
from typing import Dict, Any, List
import time
from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic import BaseModel
from .base import AuditLogger, PHIGuard, SecurityException
from .models import SystemTaskPayload, ConsensusDossier
from .supervisor import SystemSupervisor
from .metrics import GLOBAL_METRICS

supervisor = SystemSupervisor(model_provider="mock")

app = FastAPI(
    title="Surgical Site Infection Agent API",
    description="Synthetic-data threshold demonstration; not CDC/NHSN SSI classification or clinical decision support.",
    version="3.0.0-ENTERPRISE",
)


class ChatRequest(BaseModel):
    query: str


@app.get("/health")
def health():
    return {"status": "HEALTHY", "service": "surgical-site-infection-agent", "domain": "Clinical & Biomedical AI", "standard": "ILLUSTRATIVE_RULES_NOT_NHSN", "version": "3.0.0-ENTERPRISE"}


@app.get("/metrics", response_class=PlainTextResponse)
def metrics():
    return PlainTextResponse(
        GLOBAL_METRICS.export_prometheus_text(),
        media_type="text/plain; version=0.0.4",
    )


@app.post("/api/audit")
def api_audit(payload: SystemTaskPayload):
    started = time.perf_counter()
    try:
        dossier = supervisor.process_task(payload)
    except SecurityException:
        GLOBAL_METRICS.record_phi_block()
        raise HTTPException(status_code=400, detail="Potential direct identifier detected. Use synthetic input only.")
    GLOBAL_METRICS.record_task(dossier.overall_urgency.value, time.perf_counter() - started)
    return dossier.to_dict()


@app.post("/api/chat")
def api_chat(req: ChatRequest):
    try:
        ans = supervisor.query_supervisory_chat(req.query)
        return {"response": ans}
    except SecurityException:
        GLOBAL_METRICS.record_phi_block()
        raise HTTPException(status_code=400, detail="Potential direct identifier detected. Use synthetic input only.")


@app.get("/api/audit/logs")
def api_audit_logs():
    return {"audit_trail": AuditLogger.get_trail(), "verified": AuditLogger.verify_integrity()}


# Mount after API routes so /api/* and /metrics remain reachable.
WEB_DIR = Path(__file__).resolve().parent.parent / "web"
if WEB_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
