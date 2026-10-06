"""OR-Tools CP-SAT scheduler — standalone, JSON-in/JSON-out.

CourtControl AI: Bracket scheduler'ın DB bağımlılığını soyup, Firestore'dan
gelen tournament context'i JSON olarak alıp optimal schedule üretir. Genkit
optimize-schedule-flow bu servisi HTTP üzerinden çağırır.

Constraints (same as bracket/scheduler/app/scheduler.py):
  HARD:
    1. court conflict: at most one match per court per slot
    2. player conflict: a player cannot be in two overlapping matches
    3. player rest: same player's matches separated by margin_minutes buffer
    4. match duration: every match occupies a contiguous run of slots
    5. start time not before tournament start_time
  SOFT:
    - minimize makespan (total tournament wall clock)
"""
from __future__ import annotations

import time
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Any

from ortools.sat.python import cp_model


SLOT_DURATION_MINUTES = 5
SOLVER_TIME_LIMIT_SECONDS = 30
NUM_SEARCH_WORKERS = 8


@dataclass
class MatchInput:
    """One match to schedule."""
    match_id: str  # string for Firestore doc id compat
    duration_minutes: int
    player_ids: list[str]  # all players (team A + team B)


@dataclass
class CourtInput:
    """One court available."""
    court_id: str
    name: str = ""


@dataclass
class ScheduleRequest:
    """Top-level request payload."""
    tournament_id: str
    start_time_iso: str  # e.g. "2026-09-15T09:00:00+03:00"
    matches: list[MatchInput]
    courts: list[CourtInput]
    margin_minutes: int = 30  # player rest buffer between matches


@dataclass
class ScheduleAssignment:
    match_id: str
    court_id: str
    start_time_iso: str
    position: int


@dataclass
class ScheduleResult:
    tournament_id: str
    assignments: list[ScheduleAssignment]
    makespan_minutes: int
    status: str  # OPTIMAL | FEASIBLE | INFEASIBLE | MODEL_INVALID | UNKNOWN
    solve_time_seconds: float


def _match_slots(duration_minutes: int) -> int:
    return max(1, (duration_minutes + SLOT_DURATION_MINUTES - 1) // SLOT_DURATION_MINUTES)


def _rest_slots(margin_minutes: int) -> int:
    return max(1, (margin_minutes + SLOT_DURATION_MINUTES - 1) // SLOT_DURATION_MINUTES)


def _parse_start(iso: str) -> datetime:
    # Python's fromisoformat doesn't support all suffixes in <3.11; use datetime
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def solve(req: ScheduleRequest) -> ScheduleResult:
    n_matches = len(req.matches)
    n_courts = len(req.courts)
    start_time = _parse_start(req.start_time_iso)

    if n_matches == 0:
        return ScheduleResult(
            tournament_id=req.tournament_id,
            assignments=[],
            makespan_minutes=0,
            status="OPTIMAL",
            solve_time_seconds=0.0,
        )
    if n_courts == 0:
        raise ValueError("At least one court is required")

    # Horizon: sequential worst-case * 2 (so solver has room)
    total_minutes_estimate = sum(
        m.duration_minutes + req.margin_minutes for m in req.matches
    )
    worst_case_minutes = max(60 * 24, total_minutes_estimate * 2)
    horizon_slots = worst_case_minutes // SLOT_DURATION_MINUTES

    model = cp_model.CpModel()

    # Per-match variables
    start_vars: dict[str, cp_model.IntVar] = {}
    end_vars: dict[str, cp_model.IntVar] = {}
    duration_slots: dict[str, int] = {}
    court_idx_vars: dict[str, cp_model.IntVar] = {}

    for m in req.matches:
        dur = _match_slots(m.duration_minutes)
        duration_slots[m.match_id] = dur
        sv = model.new_int_var(0, horizon_slots - dur, f"start_{m.match_id}")
        ev = model.new_int_var(0, horizon_slots, f"end_{m.match_id}")
        cv = model.new_int_var(0, n_courts - 1, f"court_{m.match_id}")
        model.add(ev == sv + dur)
        start_vars[m.match_id] = sv
        end_vars[m.match_id] = ev
        court_idx_vars[m.match_id] = cv

    # Constraint 1: NoOverlap per court
    for ci in range(n_courts):
        opt_intervals: list[cp_model.IntervalVar] = []
        for m in req.matches:
            is_on = model.new_bool_var(f"m{m.match_id}_on_c{ci}")
            model.add(court_idx_vars[m.match_id] == ci).only_enforce_if(is_on)
            model.add(court_idx_vars[m.match_id] != ci).only_enforce_if(is_on.negated())
            opt = model.new_optional_interval_var(
                start_vars[m.match_id],
                duration_slots[m.match_id],
                end_vars[m.match_id],
                is_on,
                f"opt_{m.match_id}_{ci}",
            )
            opt_intervals.append(opt)
        model.add_no_overlap(opt_intervals)

    # Constraint 2 + 3: player conflict + rest buffer
    player_to_matches: dict[str, list[str]] = {}
    for m in req.matches:
        for pid in m.player_ids:
            player_to_matches.setdefault(pid, []).append(m.match_id)

    rest = _rest_slots(req.margin_minutes)
    for pid, match_ids in player_to_matches.items():
        if len(match_ids) < 2:
            continue
        for i_idx in range(len(match_ids)):
            for j_idx in range(i_idx + 1, len(match_ids)):
                mi_id = match_ids[i_idx]
                mj_id = match_ids[j_idx]
                b = model.new_bool_var(f"order_{mi_id}_{mj_id}")
                model.add(end_vars[mi_id] + rest <= start_vars[mj_id]).only_enforce_if(b)
                model.add(end_vars[mj_id] + rest <= start_vars[mi_id]).only_enforce_if(b.negated())

    # Objective: minimize makespan
    makespan = model.new_int_var(0, horizon_slots, "makespan")
    model.add_max_equality(makespan, [end_vars[m.match_id] for m in req.matches])
    model.minimize(makespan)

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = SOLVER_TIME_LIMIT_SECONDS
    solver.parameters.num_search_workers = NUM_SEARCH_WORKERS

    t0 = time.monotonic()
    status_code = solver.solve(model)
    solve_time = time.monotonic() - t0

    status_name = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN: "UNKNOWN",
    }.get(status_code, "UNKNOWN")

    if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return ScheduleResult(
            tournament_id=req.tournament_id,
            assignments=[],
            makespan_minutes=0,
            status=status_name,
            solve_time_seconds=solve_time,
        )

    # Extract assignments
    assignments: list[ScheduleAssignment] = []
    for m in req.matches:
        court_idx_val = solver.value(court_idx_vars[m.match_id])
        start_slot = solver.value(start_vars[m.match_id])
        court = req.courts[court_idx_val]
        start_dt = start_time + timedelta(minutes=start_slot * SLOT_DURATION_MINUTES)
        assignments.append(
            ScheduleAssignment(
                match_id=m.match_id,
                court_id=court.court_id,
                start_time_iso=start_dt.isoformat(),
                position=0,
            )
        )

    # Compute position per court
    by_court: dict[str, list[ScheduleAssignment]] = {}
    for a in assignments:
        by_court.setdefault(a.court_id, []).append(a)
    for court_assignments in by_court.values():
        court_assignments.sort(key=lambda x: x.start_time_iso)
        for i, a in enumerate(court_assignments):
            a.position = i

    assignments.sort(key=lambda a: a.start_time_iso)

    return ScheduleResult(
        tournament_id=req.tournament_id,
        assignments=assignments,
        makespan_minutes=int(solver.value(makespan) * SLOT_DURATION_MINUTES),
        status=status_name,
        solve_time_seconds=solve_time,
    )


def result_to_dict(r: ScheduleResult) -> dict[str, Any]:
    return {
        "tournament_id": r.tournament_id,
        "assignments": [asdict(a) for a in r.assignments],
        "makespan_minutes": r.makespan_minutes,
        "status": r.status,
        "solve_time_seconds": round(r.solve_time_seconds, 3),
    }
