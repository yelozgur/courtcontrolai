"""CourtControl AI — Standalone OR-Tools scheduler service.

JSON-in / JSON-out FastAPI service. Decoupled from Bracket's Postgres DB;
reads tournament context via JSON request body (Genkit flow or admin UI
calls this).

Endpoints:
  GET  /health      liveness
  GET  /version     service version + solver config
  POST /schedule    solve a tournament context, return optimal assignments

Run locally:
  cd services/scheduler && uv sync && uv run uvicorn app.main:app --port 8500

Run in Docker:
  docker build -t cca-scheduler services/scheduler/
  docker run -p 8500:8500 cca-scheduler
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from app.solver import (
    CourtInput,
    MatchInput,
    PlayerInput,
    ScheduleRequest,
    ScheduleResult,
    VenueInput,
    result_to_dict,
    solve,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [cca-scheduler] %(levelname)s %(message)s",
)
logger = logging.getLogger("cca.scheduler")

SERVICE_VERSION = "0.1.0"


# ---- Pydantic request/response models ----


class PlayerPayload(BaseModel):
    """A player with stated unavailability.

    Absolute ISO datetimes. A player who cannot play Tuesday evening cannot be
    scheduled into Tuesday evening — this is a feasibility constraint, not a
    preference the optimiser may trade away.
    """

    player_id: str
    unavailable: list[dict[str, str]] = Field(default_factory=list)


class MatchPayload(BaseModel):
    match_id: str
    duration_minutes: int = Field(gt=0, le=240)
    player_ids: list[str] = Field(default_factory=list)

    # Referee's manual grid edit — must survive every later re-solve.
    locked_court_id: str | None = None
    locked_start_time_iso: str | None = None
    locked_by: str | None = None

    # Tournament-day attendance outcome.
    skipped: bool = False
    skip_reason: str | None = None

    @field_validator("player_ids")
    @classmethod
    def dedup_players(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(v))  # preserve order, remove dups


class CourtPayload(BaseModel):
    court_id: str
    name: str = ""
    venue_id: str | None = None


class VenuePayload(BaseModel):
    """A venue owning courts, with opening hours.

    An empty range list means closed that weekday; a missing weekday key means
    no information. Those are different states.
    """

    venue_id: str
    courts: list[str] = Field(default_factory=list)
    open_hours: dict[str, list[list[str]]] = Field(default_factory=dict)


class SchedulePayload(BaseModel):
    tournament_id: str
    start_time_iso: str
    matches: list[MatchPayload]
    courts: list[CourtPayload]
    margin_minutes: int = Field(default=30, ge=0, le=240)
    players: list[PlayerPayload] = Field(default_factory=list)
    venues: list[VenuePayload] = Field(default_factory=list)
    end_time_iso: str | None = None
    revision: int = Field(default=1, ge=1)
    objectives: dict[str, bool] = Field(default_factory=dict)


# ---- FastAPI app ----

app = FastAPI(
    title="CourtControl AI — Scheduler",
    version=SERVICE_VERSION,
    description="Standalone OR-Tools CP-SAT scheduler (JSON-in/JSON-out).",
)

# Permissive CORS for dev (Next.js :9002 + scheduler :8500 cross-origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "service": "cca-scheduler", "version": SERVICE_VERSION}


@app.get("/version")
async def version() -> dict[str, Any]:
    from app.solver import (
        SLOT_DURATION_MINUTES,
        SOLVER_TIME_LIMIT_SECONDS,
        NUM_SEARCH_WORKERS,
    )
    return {
        "version": SERVICE_VERSION,
        "slot_duration_minutes": SLOT_DURATION_MINUTES,
        "solver_time_limit_seconds": SOLVER_TIME_LIMIT_SECONDS,
        "num_search_workers": NUM_SEARCH_WORKERS,
    }


@app.post("/schedule")
async def schedule(payload: SchedulePayload) -> dict[str, Any]:
    if not payload.matches:
        raise HTTPException(status_code=400, detail="matches must be non-empty")
    if not payload.courts:
        raise HTTPException(status_code=400, detail="courts must be non-empty")

    try:
        req = ScheduleRequest(
            tournament_id=payload.tournament_id,
            start_time_iso=payload.start_time_iso,
            matches=[MatchInput(**m.model_dump()) for m in payload.matches],
            courts=[CourtInput(**c.model_dump()) for c in payload.courts],
            margin_minutes=payload.margin_minutes,
            players=[PlayerInput(**p.model_dump()) for p in payload.players],
            venues=[VenueInput(**v.model_dump()) for v in payload.venues],
            end_time_iso=payload.end_time_iso,
            revision=payload.revision,
            objectives=payload.objectives,
        )
        result: ScheduleResult = solve(req)
        return result_to_dict(result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("solver_failed", extra={"tournament": payload.tournament_id})
        raise HTTPException(status_code=500, detail=f"solver error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8500, reload=False)
