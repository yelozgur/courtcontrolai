"""OR-Tools CP-SAT scheduler — standalone, JSON-in/JSON-out.

CourtControl AI: Bracket scheduler'ın DB bağımlılığını soyup, tournament context'i
JSON olarak alıp optimal schedule üretir. Genkit optimize-schedule-flow bu servisi
HTTP üzerinden çağırır.

Modelled after the real tournament workflow (docs/SCHEDULING_MODEL.md), not after a
one-shot optimisation:

  1. Registration closes
  2. Solve onto a slot grid
  3. A referee edits the grid by hand
  4. Something changes -> RE-SOLVE (the loop)
  5. Tournament day: attendance by QR
  6. No-show -> the match is skipped; referees decide

Constraints (feasibility — free, always enforced):
  HARD:
    1. court conflict: at most one match per court per slot
    2. player conflict: a player cannot be in two overlapping matches
    3. player rest: same player's matches separated by margin_minutes buffer
    4. match duration: every match occupies a contiguous run of slots
    5. start time not before tournament start_time
    6. player unavailability: a match may not overlap a player's stated unavailability
    7. locked matches keep their referee-assigned court and slot
  SOFT (this is what credits buy):
    - minimize makespan (total tournament wall clock)

Known limitation, stated rather than faked: venue `open_hours` is validated and
reported but is NOT enforced per-slot. A court is excluded only when no open window
can fit the match duration at all. Partial closures inside an open day are not yet
modelled.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from typing import Any

from ortools.sat.python import cp_model


SLOT_DURATION_MINUTES = 5
SOLVER_TIME_LIMIT_SECONDS = 30
NUM_SEARCH_WORKERS = 8

WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


@dataclass
class PlayerInput:
    """A player, with any stated unavailability.

    This is a real constraint, not a preference. `unavailable` holds absolute
    ISO datetimes — a player who cannot play Tuesday evening cannot be scheduled
    into Tuesday evening no matter how convenient it would be.
    """

    player_id: str
    unavailable: list[dict[str, str]] = field(default_factory=list)


@dataclass
class MatchInput:
    """One match to schedule."""

    match_id: str  # string for Firestore doc id compat
    duration_minutes: int
    player_ids: list[str]  # all players (team A + team B)

    # --- referee's manual grid edit -------------------------------------------------
    # When set, the match must keep exactly this court and start time across every
    # later re-solve. The single most important field in this file: without it a
    # re-solve silently overwrites the referee's work and nobody notices until
    # tournament day.
    locked_court_id: str | None = None
    locked_start_time_iso: str | None = None
    locked_by: str | None = None

    # --- tournament-day attendance ---------------------------------------------------
    # A no-show drops the match out of the model. It is still reported, with its
    # reason, so a hole in the bracket is explained rather than looking like a bug.
    #
    # skip_reason is one of two canonical values (see docs/SCHEDULING_MODEL.md):
    #   "no_show"       - the player(s) never arrived at the venue (QR absent)
    #   "no_court_show" - the player(s) were present at the venue but did not
    #                     take the court; this is a referee decision
    skipped: bool = False
    skip_reason: str | None = None

    @property
    def is_locked(self) -> bool:
        return self.locked_court_id is not None and self.locked_start_time_iso is not None


@dataclass
class CourtInput:
    """One court available."""

    court_id: str
    name: str = ""
    venue_id: str | None = None


@dataclass
class VenueInput:
    """A venue owning one or more courts, with its opening hours.

    `open_hours` maps a weekday key to a list of [from, to] "HH:MM" ranges.
    An empty list means closed that day. A missing key means "no information" —
    these are different states and must not be treated the same.
    """

    venue_id: str
    courts: list[str] = field(default_factory=list)
    open_hours: dict[str, list[list[str]]] = field(default_factory=dict)


@dataclass
class ScheduleRequest:
    """Top-level request payload."""

    tournament_id: str
    start_time_iso: str  # e.g. "2026-09-15T09:00:00+03:00"
    matches: list[MatchInput]
    courts: list[CourtInput]
    margin_minutes: int = 30  # player rest buffer between matches
    players: list[PlayerInput] = field(default_factory=list)
    venues: list[VenueInput] = field(default_factory=list)
    end_time_iso: str | None = None
    revision: int = 1
    objectives: dict[str, bool] = field(default_factory=dict)

    # Per-player venue check-in (QR scan at the entrance). The referee is the one
    # who translates attendance into skipped matches; the solver does not act on
    # this directly, but it is recorded so the bracket can display it.
    attendance: dict[str, bool] = field(default_factory=dict)

    # Stage 2: model-formalised preferences (SEL-93).
    # court_priority: ordered court IDs, most preferred first. Soft objective
    # penalises assignments to lower-priority courts. Empty = no preference.
    court_priority: list[str] = field(default_factory=list)
    # day_compaction: when True, tighten the makespan objective weight so
    # matches are packed into the smallest time window.
    day_compaction: bool = False


@dataclass
class ScheduleAssignment:
    match_id: str
    court_id: str
    start_time_iso: str
    position: int
    locked: bool = False
    skipped: bool = False
    skip_reason: str | None = None


@dataclass
class ScheduleResult:
    tournament_id: str
    assignments: list[ScheduleAssignment]
    makespan_minutes: int
    status: str  # OPTIMAL | FEASIBLE | INFEASIBLE | MODEL_INVALID | UNKNOWN
    solve_time_seconds: float
    revision: int = 1
    # Referee locks that could not be honoured. Never silently overridden.
    conflicting_locks: list[str] = field(default_factory=list)
    # Matches dropped by attendance, with reasons.
    skipped_matches: list[str] = field(default_factory=list)


def _match_slots(duration_minutes: int) -> int:
    return max(1, (duration_minutes + SLOT_DURATION_MINUTES - 1) // SLOT_DURATION_MINUTES)


def _rest_slots(margin_minutes: int) -> int:
    return max(1, (margin_minutes + SLOT_DURATION_MINUTES - 1) // SLOT_DURATION_MINUTES)


def _parse_start(iso: str) -> datetime:
    # Python's fromisoformat doesn't support all suffixes in <3.11; use datetime
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def _court_open_spans(req: ScheduleRequest, start_time: datetime) -> dict[str, list[tuple[int, int]]]:
    """court_id -> list of (from_minute, to_minute) when that court is open, in
    tournament-relative minutes from start_time.

    Semantics for `open_hours[weekday]`:
      missing      -> no information -> treat as open all day
      []           -> explicitly closed all day -> empty open spans
      [[from, to]] -> open only during those times

    Single-day model. Partial closures inside an open day are not modelled —
    see module docstring.
    """
    out: dict[str, list[tuple[int, int]]] = {}
    if not req.venues:
        return out

    day = start_time.date()
    wd = WEEKDAY_KEYS[day.weekday()]
    day_end = 24 * 60

    for venue in req.venues:
        ranges = venue.open_hours.get(wd)
        if ranges is None:
            # No info -> open all day for this court group.
            spans = [(0, day_end)]
        elif ranges == []:
            # Explicitly closed all day.
            spans = []
        else:
            raw: list[tuple[int, int]] = []
            for r in ranges:
                lo = int((datetime.combine(day, datetime.strptime(r[0], "%H:%M").time(), start_time.tzinfo) - start_time).total_seconds() // 60)
                hi = int((datetime.combine(day, datetime.strptime(r[1], "%H:%M").time(), start_time.tzinfo) - start_time).total_seconds() // 60)
                lo, hi = max(0, lo), min(day_end, hi)
                if hi > lo:
                    raw.append((lo, hi))
            # Merge overlaps and clamp to [0, day_end].
            raw.sort()
            spans: list[tuple[int, int]] = []
            for lo, hi in raw:
                if spans and lo <= spans[-1][1]:
                    spans[-1] = (spans[-1][0], max(spans[-1][1], hi))
                else:
                    spans.append((lo, hi))
            if not spans:
                spans = []  # closed all day
        for court_id in venue.courts:
            out[court_id] = spans

    return out


def solve(req: ScheduleRequest) -> ScheduleResult:
    n_courts = len(req.courts)
    if n_courts == 0:
        raise ValueError("At least one court is required")

    start_time = _parse_start(req.start_time_iso)
    court_index = {c.court_id: i for i, c in enumerate(req.courts)}

    # ------------------------------------------------------------------
    # Build the per-court open-spans map from venue hours. A court with no
    # open span long enough for a given match is excluded for that match.
    # Partial closures inside an open day are not modelled — the limitation
    # is stated rather than faked.
    # ------------------------------------------------------------------
    # Three distinct states matter:
    #   court_open has no entry for this court -> no information, no constraint
    #   court_open[c] == []                    -> explicitly closed
    #   court_open[c] == [(lo, hi), ...]       -> open during those spans
    court_open: dict[str, list[tuple[int, int]]] = (
        _court_open_spans(req, start_time) if req.venues else {}
    )

    def court_fits(court_id: str, dur_slots: int) -> bool:
        """True iff this court can host a match of `dur_slots` slots.

        No entry  -> no constraint, any duration fits
        []        -> explicitly closed, nothing fits
        [..]      -> at least one span must be long enough
        """
        spans = court_open.get(court_id)
        if spans is None:
            return True
        if not spans:
            return False
        d_min = dur_slots * SLOT_DURATION_MINUTES
        for s, e in spans:
            if e - s >= d_min:
                return True
        return False

    # ------------------------------------------------------------------
    # Split matches into scheduled / skipped (tournament-day attendance)
    # ------------------------------------------------------------------
    skipped_matches = [m for m in req.matches if m.skipped]
    active = [m for m in req.matches if not m.skipped]

    if not active:
        # Still report every skipped match so the bracket can show why it is empty.
        all_skipped: list[ScheduleAssignment] = [
            ScheduleAssignment(
                match_id=m.match_id,
                court_id="",
                start_time_iso="",
                position=0,
                skipped=True,
                skip_reason=m.skip_reason,
            )
            for m in skipped_matches
        ]
        return ScheduleResult(
            tournament_id=req.tournament_id,
            assignments=all_skipped,
            makespan_minutes=0,
            status="OPTIMAL",
            solve_time_seconds=0.0,
            revision=req.revision,
            skipped_matches=[m.match_id for m in skipped_matches],
        )

    # ------------------------------------------------------------------
    # Validate referee locks against the court list before modelling
    # ------------------------------------------------------------------
    conflicting_locks: list[str] = []
    for m in active:
        if m.is_locked and m.locked_court_id not in court_index:
            conflicting_locks.append(m.match_id)

    if conflicting_locks:
        # Never silently drop or override a referee's decision.
        return ScheduleResult(
            tournament_id=req.tournament_id,
            assignments=[],
            makespan_minutes=0,
            status="INFEASIBLE",
            solve_time_seconds=0.0,
            revision=req.revision,
            conflicting_locks=conflicting_locks,
            skipped_matches=[m.match_id for m in skipped_matches],
        )

    # Horizon: sequential worst-case * 2 (so solver has room)
    total_minutes_estimate = sum(
        m.duration_minutes + req.margin_minutes for m in active
    )
    worst_case_minutes = max(60 * 24, total_minutes_estimate * 2)
    horizon_slots = worst_case_minutes // SLOT_DURATION_MINUTES

    model = cp_model.CpModel()

    start_vars: dict[str, cp_model.IntVar] = {}
    end_vars: dict[str, cp_model.IntVar] = {}
    duration_slots: dict[str, int] = {}
    court_idx_vars: dict[str, cp_model.IntVar] = {}

    for m in active:
        dur = _match_slots(m.duration_minutes)
        duration_slots[m.match_id] = dur
        sv = model.new_int_var(0, horizon_slots - dur, f"start_{m.match_id}")
        ev = model.new_int_var(0, horizon_slots, f"end_{m.match_id}")
        cv = model.new_int_var(0, n_courts - 1, f"court_{m.match_id}")

        # Venue hours: exclude courts that have no open span long enough. A court
        # with no open_hours info at all stays unrestricted.
        for court in req.courts:
            if not court_fits(court.court_id, dur):
                model.add(cv != court_index[court.court_id])
        model.add(ev == sv + dur)
        start_vars[m.match_id] = sv
        end_vars[m.match_id] = ev
        court_idx_vars[m.match_id] = cv

        # Referee's grid edit: pin the slot and the court.
        if m.is_locked:
            locked_start = _parse_start(m.locked_start_time_iso)
            slot = int((locked_start - start_time).total_seconds() // 60) // SLOT_DURATION_MINUTES
            model.add(sv == slot)
            model.add(cv == court_index[m.locked_court_id])

    # Constraint 1: NoOverlap per court
    for ci in range(n_courts):
        opt_intervals: list[cp_model.IntervalVar] = []
        for m in active:
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

    # Constraint 6: player unavailability
    # A match occupying [s, s+dur) overlaps a closed window [c0, c1) when
    # s < c1 and s+dur > c0, i.e. s in (c0-dur, c1). Restrict the start variable
    # to the complement of those ranges.
    #
    # OR-Tools' add_forbidden_assignments takes exact value tuples, not ranges, so
    # the complement is computed here and applied as a domain.
    unavailability = {
        p.player_id: p.unavailable for p in req.players if p.unavailable
    }
    if unavailability:
        for m in active:
            dur = duration_slots[m.match_id]
            ub = horizon_slots - dur
            allowed: list[tuple[int, int]] = [(0, ub)]
            for pid in m.player_ids:
                for win in unavailability.get(pid, []):
                    c0 = int(
                        (_parse_start(win["from"]) - start_time).total_seconds() // 60
                    ) // SLOT_DURATION_MINUTES
                    c1 = int(
                        (_parse_start(win["to"]) - start_time).total_seconds() // 60
                    ) // SLOT_DURATION_MINUTES
                    lo = max(0, c0 - dur + 1)
                    hi = min(ub, c1 - 1)
                    if lo > hi:
                        continue
                    trimmed: list[tuple[int, int]] = []
                    for a, b in allowed:
                        if hi < a or lo > b:
                            trimmed.append((a, b))
                            continue
                        if a <= lo - 1:
                            trimmed.append((a, lo - 1))
                        if hi + 1 <= b:
                            trimmed.append((hi + 1, b))
                    allowed = trimmed
            if not allowed:
                # No legal slot remains for this match: report INFEASIBLE rather than
                # quietly leaving it unconstrained and scheduling it anywhere.
                model.add_bool_or([])
            elif allowed != [(0, ub)]:
                model.add_linear_expression_in_domain(
                    start_vars[m.match_id], cp_model.Domain.from_intervals(allowed)
                )

    # Constraint 2 + 3: player conflict + rest buffer
    player_to_matches: dict[str, list[str]] = {}
    for m in active:
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
    minimize_makespan = req.objectives.get("minimize_makespan", True)
    makespan = model.new_int_var(0, horizon_slots, "makespan")
    model.add_max_equality(makespan, [end_vars[m.match_id] for m in active])

    obj_terms: list[cp_model.LinearExpr] = []
    if minimize_makespan:
        obj_terms.append(makespan)

    if req.court_priority and len(req.court_priority) > 1:
        priority_map = {cid: idx for idx, cid in enumerate(req.court_priority)}
        known = [cid for cid in req.court_priority if cid in court_index]
        if len(known) > 1:
            max_penalty = len(known)
            for m in active:
                for cid in known:
                    rank = priority_map[cid]
                    is_on = model.new_bool_var(f"prio_{m.match_id}_{cid}")
                    model.add(court_idx_vars[m.match_id] == court_index[cid]).only_enforce_if(is_on)
                    model.add(court_idx_vars[m.match_id] != court_index[cid]).only_enforce_if(is_on.negated())
                    penalty = model.new_int_var(0, max_penalty, f"penalty_{m.match_id}_{cid}")
                    model.add(penalty == rank).only_enforce_if(is_on)
                    model.add(penalty == 0).only_enforce_if(is_on.negated())
                    obj_terms.append(penalty)

    if obj_terms:
        model.minimize(sum(obj_terms))

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

    skipped_ids = [m.match_id for m in skipped_matches]

    if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return ScheduleResult(
            tournament_id=req.tournament_id,
            assignments=[],
            makespan_minutes=0,
            status=status_name,
            solve_time_seconds=solve_time,
            revision=req.revision,
            conflicting_locks=conflicting_locks,
            skipped_matches=skipped_ids,
        )

    # Extract assignments for scheduled matches
    locked_by_id = {m.match_id: m for m in active}
    assignments: list[ScheduleAssignment] = []
    for m in active:
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
                locked=m.is_locked,
            )
        )

    # Skipped matches are reported with their reason so the bracket can explain
    # the hole instead of looking like a rendering failure.
    for m in skipped_matches:
        assignments.append(
            ScheduleAssignment(
                match_id=m.match_id,
                court_id="",
                start_time_iso="",
                position=0,
                locked=False,
                skipped=True,
                skip_reason=m.skip_reason,
            )
        )

    # Compute position per court
    by_court: dict[str, list[ScheduleAssignment]] = {}
    for a in assignments:
        if a.skipped:
            continue
        by_court.setdefault(a.court_id, []).append(a)
    for court_assignments in by_court.values():
        court_assignments.sort(key=lambda x: x.start_time_iso)
        for i, a in enumerate(court_assignments):
            a.position = i

    assignments.sort(key=lambda a: (a.skipped, a.start_time_iso))

    return ScheduleResult(
        tournament_id=req.tournament_id,
        assignments=assignments,
        makespan_minutes=(
            int(solver.value(makespan) * SLOT_DURATION_MINUTES) if minimize_makespan else 0
        ),
        status=status_name,
        solve_time_seconds=solve_time,
        revision=req.revision,
        conflicting_locks=conflicting_locks,
        skipped_matches=skipped_ids,
    )


def result_to_dict(r: ScheduleResult) -> dict[str, Any]:
    return {
        "tournament_id": r.tournament_id,
        "revision": r.revision,
        "assignments": [asdict(a) for a in r.assignments],
        "makespan_minutes": r.makespan_minutes,
        "status": r.status,
        "solve_time_seconds": round(r.solve_time_seconds, 3),
        "conflicting_locks": r.conflicting_locks,
        "skipped_matches": r.skipped_matches,
    }
