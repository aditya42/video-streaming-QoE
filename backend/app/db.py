from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


def db_path() -> Path:
    path = Path(os.getenv("QOE_DB_PATH", "./data/qoe.db"))
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS qoe_runs (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                asset_url TEXT NOT NULL,
                protocol TEXT NOT NULL,
                browser TEXT,
                network_profile TEXT,
                status TEXT NOT NULL,
                score INTEGER NOT NULL,
                metrics_json TEXT NOT NULL,
                telemetry_json TEXT NOT NULL,
                analysis_json TEXT NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_qoe_runs_created_at ON qoe_runs(created_at DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_qoe_runs_protocol ON qoe_runs(protocol)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_qoe_runs_status ON qoe_runs(status)")


def insert_run(run: dict[str, Any]) -> None:
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO qoe_runs (
              id, created_at, asset_url, protocol, browser, network_profile,
              status, score, metrics_json, telemetry_json, analysis_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run["id"], run["createdAt"], run["assetUrl"], run["protocol"],
                run.get("browser"), run.get("networkProfile"), run["analysis"]["verdict"],
                run["analysis"]["score"], json.dumps(run["metrics"]),
                json.dumps(run.get("telemetry", {})), json.dumps(run["analysis"]),
            ),
        )


def _row_to_run(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "createdAt": row["created_at"],
        "assetUrl": row["asset_url"],
        "protocol": row["protocol"],
        "browser": row["browser"],
        "networkProfile": row["network_profile"],
        "status": row["status"],
        "score": row["score"],
        "metrics": json.loads(row["metrics_json"]),
        "telemetry": json.loads(row["telemetry_json"]),
        "analysis": json.loads(row["analysis_json"]),
    }


def list_runs(limit: int = 50) -> list[dict[str, Any]]:
    with connection() as conn:
        rows = conn.execute(
            "SELECT * FROM qoe_runs ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [_row_to_run(r) for r in rows]


def get_run(run_id: str) -> dict[str, Any] | None:
    with connection() as conn:
        row = conn.execute("SELECT * FROM qoe_runs WHERE id = ?", (run_id,)).fetchone()
    return _row_to_run(row) if row else None


def summary() -> dict[str, Any]:
    with connection() as conn:
        aggregate = conn.execute(
            """
            SELECT
              COUNT(*) total,
              SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END) passed,
              AVG(score) avg_score
            FROM qoe_runs
            """
        ).fetchone()
        recent = conn.execute(
            "SELECT metrics_json FROM qoe_runs ORDER BY created_at DESC LIMIT 100"
        ).fetchall()

    metrics = [json.loads(r["metrics_json"]) for r in recent]
    def avg(name: str) -> float | None:
        vals = [float(m[name]) for m in metrics if m.get(name) is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    return {
        "totalRuns": int(aggregate["total"] or 0),
        "passedRuns": int(aggregate["passed"] or 0),
        "passRate": round((aggregate["passed"] or 0) * 100 / aggregate["total"], 2) if aggregate["total"] else 0,
        "averageScore": round(float(aggregate["avg_score"] or 0), 2),
        "averageStartupTimeMs": avg("startupTimeMs"),
        "averageTtffMs": avg("timeToFirstFrameMs"),
        "averageRebufferingRatio": avg("rebufferingRatio"),
    }
