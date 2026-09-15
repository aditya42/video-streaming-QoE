from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any


DEFAULT_THRESHOLDS: dict[str, float] = {
    "startupTimeMs": 5000.0,
    "timeToFirstFrameMs": 5500.0,
    "rebufferingRatio": 0.10,
    "droppedFrameRatio": 0.05,
    "playbackFailures": 0.0,
    "networkErrorCount": 2.0,
}


@dataclass
class Violation:
    metric: str
    actual: float
    threshold: float
    operator: str = "<="


@dataclass
class Analysis:
    verdict: str
    score: int
    violations: list[dict[str, Any]]


def _number(metrics: dict[str, Any], name: str) -> float | None:
    value = metrics.get(name)
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def analyze_qoe(
    metrics: dict[str, Any],
    threshold_overrides: dict[str, float] | None = None,
) -> dict[str, Any]:
    thresholds = {**DEFAULT_THRESHOLDS, **(threshold_overrides or {})}
    violations: list[Violation] = []

    for metric, threshold in thresholds.items():
        actual = _number(metrics, metric)
        if actual is None:
            continue
        if actual > float(threshold):
            violations.append(Violation(metric=metric, actual=actual, threshold=float(threshold)))

    # Fatal playback is weighted more heavily than a soft QoE miss.
    score = 100
    for violation in violations:
        score -= 35 if violation.metric == "playbackFailures" else 12
    score = max(score, 0)

    verdict = "PASS" if not violations else "FAIL"
    return asdict(Analysis(
        verdict=verdict,
        score=score,
        violations=[asdict(v) for v in violations],
    ))
