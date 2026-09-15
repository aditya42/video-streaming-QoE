from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .db import get_run, init_db, insert_run, list_runs, summary
from .qoe import analyze_qoe

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"

app = FastAPI(title="Streaming QoE Validation API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=WEB), name="static")


class RunSubmission(BaseModel):
    assetUrl: str
    protocol: Literal["hls", "dash", "progressive", "unknown"] = "unknown"
    browser: str | None = None
    networkProfile: str | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    telemetry: dict[str, Any] = Field(default_factory=dict)
    thresholds: dict[str, float] | None = None


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/runs")
def create_run(submission: RunSubmission) -> dict[str, Any]:
    analysis = analyze_qoe(submission.metrics, submission.thresholds)
    run = {
        "id": str(uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        **submission.model_dump(exclude={"thresholds"}),
        "analysis": analysis,
    }
    insert_run(run)
    return run


@app.get("/api/runs")
def runs(limit: int = Query(default=50, ge=1, le=500)) -> list[dict[str, Any]]:
    return list_runs(limit)


@app.get("/api/runs/{run_id}")
def run_by_id(run_id: str) -> dict[str, Any]:
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="QoE run not found")
    return run


@app.get("/api/summary")
def qoe_summary() -> dict[str, Any]:
    return summary()


@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB / "index.html")
