# CourtControl AI — Standalone Scheduler (OR-Tools CP-SAT)

JSON-in/JSON-out FastAPI service. Sits between the Next.js dashboard and the
Google OR-Tools solver. Decoupled from Bracket's Postgres so it can run
standalone on any M-series Mac (M5 here, M2 later).

## Endpoints

- `GET /health` — liveness
- `GET /version` — service version + solver config
- `POST /schedule` — solve a tournament context, return optimal assignments

## Request example

```bash
curl -X POST http://localhost:8500/schedule \
  -H 'Content-Type: application/json' \
  -d '{
    "tournament_id": "t-001",
    "start_time_iso": "2026-09-15T09:00:00+03:00",
    "matches": [
      {"match_id": "m1", "duration_minutes": 60, "player_ids": ["p1", "p2"]},
      {"match_id": "m2", "duration_minutes": 60, "player_ids": ["p3", "p4"]},
      {"match_id": "m3", "duration_minutes": 60, "player_ids": ["p1", "p4"]}
    ],
    "courts": [
      {"court_id": "c1", "name": "Center Court"},
      {"court_id": "c2", "name": "Court 2"}
    ],
    "margin_minutes": 30
  }'
```

## Response

```json
{
  "tournament_id": "t-001",
  "assignments": [
    {"match_id": "m1", "court_id": "c1", "start_time_iso": "2026-09-15T09:00:00+03:00", "position": 0},
    {"match_id": "m2", "court_id": "c2", "start_time_iso": "2026-09-15T09:00:00+03:00", "position": 0},
    {"match_id": "m3", "court_id": "c1", "start_time_iso": "2026-09-15T10:00:00+03:00", "position": 1}
  ],
  "makespan_minutes": 60,
  "status": "OPTIMAL",
  "solve_time_seconds": 0.012
}
```

## Run locally (uv)

```bash
cd services/scheduler
uv sync
uv run uvicorn app.main:app --port 8500 --reload
```

## Run in Docker

```bash
docker build -t cca-scheduler services/scheduler/
docker run -p 8500:8500 cca-scheduler
```

## Constraints modelled

**HARD:**
1. Court conflict — at most one match per court per slot
2. Player conflict — a player cannot be in two overlapping matches
3. Player rest — same player's matches separated by `margin_minutes` buffer
4. Match duration — every match occupies a contiguous run of slots
5. Start time — not before `start_time_iso`

**SOFT:**
- Minimize makespan (total tournament wall clock)

## Capacity (measured on M5 Air)

- Up to ~80 matches + 8 courts: <1s solve
- Up to 200 matches + 16 courts: ~5s solve
- Hard limit at 30s (configurable in solver.py)

## Integration with Next.js

The Genkit `optimize-schedule-flow` should call this service via
`SCHEDULER_URL` env var. `/api/health` probes it on every watchdog tick.
