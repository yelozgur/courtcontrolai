"""Contract tests for the CP-SAT scheduler.

These exist because the solver had never been proven end to end. The /health
probe only proves the service is up; it says nothing about whether the schedule
it produces is correct.

The first test asserts optimality against a hand-computed lower bound rather
than just "it returned something".
"""

import dataclasses
import datetime as dt

replace = dataclasses.replace

from app.solver import CourtInput, MatchInput, PlayerInput, ScheduleRequest, solve

SLOT = 5
MARGIN = 30
START = "2026-10-12T09:00:00+03:00"


def _parse(iso: str) -> dt.datetime:
    return dt.datetime.fromisoformat(iso)


def _request(matches, courts, tournament_id="contract", margin=MARGIN):
    return ScheduleRequest(
        tournament_id=tournament_id,
        start_time_iso=START,
        matches=[MatchInput(**m) for m in matches],
        courts=[CourtInput(**c) for c in courts],
        margin_minutes=margin,
    )


def _windows(result, req):
    """court_id and player_id -> [(start, end, match_id)]"""
    asg = {a.match_id: a for a in result.assignments}
    dur = {m.match_id: m.duration_minutes for m in req.matches}
    pls = {m.match_id: m.player_ids for m in req.matches}
    by_court, by_player = {}, {}
    for mid, a in asg.items():
        s = _parse(a.start_time_iso)
        e = s + dt.timedelta(minutes=dur[mid])
        by_court.setdefault(a.court_id, []).append((s, e, mid))
        for p in pls[mid]:
            by_player.setdefault(p, []).append((s, e, mid))
    return asg, by_court, by_player


def test_optimality_matches_hand_computed_lower_bound():
    """p1 plays three 60-minute matches with a 30-minute rest between each.

    Lower bound = 2 * (60 + 30) + 60 = 240 minutes.
    Returning exactly 240 proves the solver found the optimum, not merely a
    feasible schedule.
    """
    req = _request(
        matches=[
            {"match_id": "m1", "duration_minutes": 60, "player_ids": ["p1", "p2"]},
            {"match_id": "m2", "duration_minutes": 60, "player_ids": ["p3", "p4"]},
            {"match_id": "m3", "duration_minutes": 60, "player_ids": ["p1", "p5"]},
            {"match_id": "m4", "duration_minutes": 60, "player_ids": ["p6", "p7"]},
            {"match_id": "m5", "duration_minutes": 60, "player_ids": ["p1", "p8"]},
            {"match_id": "m6", "duration_minutes": 60, "player_ids": ["p2", "p4"]},
        ],
        courts=[{"court_id": "c1"}, {"court_id": "c2"}],
    )
    result = solve(req)
    assert result.status == "OPTIMAL"
    assert result.makespan_minutes == 240, "solver missed the provable optimum"


def test_no_court_or_player_conflict_and_rest_is_respected():
    req = _request(
        matches=[
            {"match_id": "m1", "duration_minutes": 60, "player_ids": ["p1", "p2"]},
            {"match_id": "m2", "duration_minutes": 60, "player_ids": ["p1", "p3"]},
            {"match_id": "m3", "duration_minutes": 60, "player_ids": ["p4", "p5"]},
        ],
        courts=[{"court_id": "c1"}, {"court_id": "c2"}],
    )
    result = solve(req)
    _, by_court, by_player = _windows(result, req)
    start = _parse(START)

    for court, w in by_court.items():
        w.sort()
        for i in range(len(w) - 1):
            assert w[i][1] <= w[i + 1][0], f"court {court}: {w[i][2]} overlaps {w[i + 1][2]}"

    for player, w in by_player.items():
        w.sort()
        for i in range(len(w) - 1):
            gap = (w[i + 1][0] - w[i][1]).total_seconds() / 60
            assert gap >= MARGIN, f"{player} rest {gap}min < {MARGIN}min ({w[i][2]} -> {w[i + 1][2]})"
        offset = (w[0][0] - start).total_seconds() / 60
        assert offset % SLOT == 0, f"{player} starts off the {SLOT}min grid"


def test_single_court_serialises_the_same_player():
    """One court forces serialisation but the problem stays feasible.

    Guards against a regression that reports INFEASIBLE for a solvable problem
    instead of finding the only possible ordering.
    """
    req = _request(
        matches=[
            {"match_id": "m1", "duration_minutes": 60, "player_ids": ["p1", "p2"]},
            {"match_id": "m2", "duration_minutes": 60, "player_ids": ["p1", "p3"]},
            {"match_id": "m3", "duration_minutes": 60, "player_ids": ["p1", "p4"]},
        ],
        courts=[{"court_id": "c1"}],
    )
    result = solve(req)
    assert result.status == "OPTIMAL"
    assert result.makespan_minutes == 240


def test_every_match_is_assigned_exactly_once():
    req = _request(
        matches=[
            {"match_id": f"m{i}", "duration_minutes": 45, "player_ids": [f"p{i}a", f"p{i}b"]}
            for i in range(1, 13)
        ],
        courts=[{"court_id": "c1"}, {"court_id": "c2"}, {"court_id": "c3"}],
    )
    result = solve(req)
    assert {a.match_id for a in result.assignments} == {m.match_id for m in req.matches}
    assert len(result.assignments) == len(req.matches)


# ---------------------------------------------------------------------------
# Repeat solves — the referee workflow
#
# From docs/SCHEDULING_MODEL.md: after registration closes we solve, a referee
# edits the grid by hand, and then we re-solve when something changes. A re-solve
# that silently moves a locked match destroys the referee's work, and nobody
# notices until tournament day.
# ---------------------------------------------------------------------------


def test_locked_match_keeps_its_court_and_slot_across_a_resolve():
    req = _request(
        matches=[
            {"match_id": "m1", "duration_minutes": 60, "player_ids": ["p1", "p2"]},
            {"match_id": "m2", "duration_minutes": 60, "player_ids": ["p3", "p4"]},
            {"match_id": "m3", "duration_minutes": 60, "player_ids": ["p5", "p6"]},
        ],
        courts=[{"court_id": "c1"}, {"court_id": "c2"}],
    )
    # First solve: referee pins m2 to court 2 at 09:00.
    req.matches[1].locked_court_id = "c2"
    req.matches[1].locked_start_time_iso = START
    req.matches[1].locked_by = "referee:ahmet"
    req.revision = 1

    first = solve(req)
    assert first.status == "OPTIMAL"
    locked = {a.match_id: a for a in first.assignments}["m2"]
    assert locked.court_id == "c2"
    assert locked.start_time_iso == START
    assert locked.locked is True

    # Re-solve with different input: m4 joins, m3 is gone. The lock must hold.
    req.revision = 2
    req.matches = [
        replace(req.matches[0]),
        replace(req.matches[1]),              # still locked
        MatchInput(match_id="m4", duration_minutes=60, player_ids=["p5", "p6", "p7"]),
    ]

    second = solve(req)
    assert second.status == "OPTIMAL"
    assert second.revision == 2
    again = {a.match_id: a for a in second.assignments}["m2"]
    assert again.court_id == "c2", "re-solve moved a referee-locked match"
    assert again.start_time_iso == START, "re-solve moved a referee-locked match"


def test_lock_to_an_unknown_court_is_reported_not_silently_dropped():
    req = _request(
        matches=[{"match_id": "m1", "duration_minutes": 60, "player_ids": ["p1", "p2"]}],
        courts=[{"court_id": "c1"}],
    )
    req.matches[0].locked_court_id = "c99"   # court the venue no longer has
    req.matches[0].locked_start_time_iso = START

    result = solve(req)
    assert result.status == "INFEASIBLE"
    assert result.conflicting_locks == ["m1"], "the referee must be told which lock broke"


def test_skipped_match_is_dropped_from_the_model_but_still_reported():
    req = _request(
        matches=[
            {"match_id": "m1", "duration_minutes": 60, "player_ids": ["p1", "p2"]},
            {"match_id": "m2", "duration_minutes": 60, "player_ids": ["p1", "p3"],
             "skipped": True, "skip_reason": "no_show"},
            {"match_id": "m3", "duration_minutes": 60, "player_ids": ["p4", "p5"]},
        ],
        courts=[{"court_id": "c1"}, {"court_id": "c2"}],
    )
    result = solve(req)

    assert result.status == "OPTIMAL"
    assert result.skipped_matches == ["m2"]
    reported = {a.match_id: a for a in result.assignments}
    assert reported["m2"].skipped is True
    assert reported["m2"].skip_reason == "no_show"
    assert reported["m2"].court_id == ""
    # It must not consume a court slot.
    assert reported["m1"].court_id and reported["m3"].court_id


def test_skipping_relaxes_rest_for_the_remaining_matches():
    """m2 is skipped, so p1's only other match no longer needs rest spacing."""
    req = _request(
        matches=[
            {"match_id": "m1", "duration_minutes": 60, "player_ids": ["p1", "p2"]},
            {"match_id": "m2", "duration_minutes": 60, "player_ids": ["p1", "p3"],
             "skipped": True, "skip_reason": "withdrawn"},
        ],
        courts=[{"court_id": "c1"}],
    )
    result = solve(req)
    assert result.status == "OPTIMAL"
    assert result.makespan_minutes == 60, "a skipped match still forced rest spacing"


def test_player_unavailability_blocks_that_window():
    req = _request(
        matches=[
            {"match_id": "m1", "duration_minutes": 60, "player_ids": ["p1", "p2"]},
            {"match_id": "m2", "duration_minutes": 60, "player_ids": ["p3", "p4"]},
        ],
        courts=[{"court_id": "c1"}],
    )
    # p1 cannot play for the whole window -> m1 has nowhere legal to go.
    req.players = [
        PlayerInput(
            player_id="p1",
            unavailable=[{"from": START, "to": "2026-10-13T09:00:00+03:00"}],
        )
    ]
    result = solve(req)
    assert result.status == "INFEASIBLE", "an unavailable player was scheduled anyway"

    # A partial window still leaves room after it.
    req.players = [
        PlayerInput(
            player_id="p1",
            unavailable=[{"from": START, "to": "2026-10-12T10:00:00+03:00"}],
        )
    ]
    partial = solve(req)
    assert partial.status == "OPTIMAL"
    m1 = {a.match_id: a for a in partial.assignments}["m1"]
    assert m1.start_time_iso >= "2026-10-12T10:00:00+03:00"


# ---------------------------------------------------------------------------
# Attendance is a per-player existence proof; skip decisions remain the
# referee's. Both skip reasons stay distinct so the bracket can show the real
# reason, not a generic "absent".
# ---------------------------------------------------------------------------


def test_both_skip_reasons_are_preserved_distinctly():
    no_show = _request(
        matches=[
            {"match_id": "m1", "duration_minutes": 60, "player_ids": ["p1", "p2"],
             "skipped": True, "skip_reason": "no_show"},
        ],
        courts=[{"court_id": "c1"}],
    )
    no_court_show = _request(
        matches=[
            {"match_id": "m1", "duration_minutes": 60, "player_ids": ["p3", "p4"],
             "skipped": True, "skip_reason": "no_court_show"},
        ],
        courts=[{"court_id": "c1"}],
    )
    a = solve(no_show).assignments[0]
    b = solve(no_court_show).assignments[0]
    assert a.skip_reason == "no_show"
    assert b.skip_reason == "no_court_show"
    assert a.skip_reason != b.skip_reason


def test_attendance_field_passes_through_for_display():
    """Attendance is recorded for the bracket UI but the solver does not auto-skip
    from it — the referee decides. The solver's result is unaffected by it.
    """
    req = _request(
        matches=[{"match_id": "m1", "duration_minutes": 60, "player_ids": ["p1", "p2"]}],
        courts=[{"court_id": "c1"}],
    )
    req.attendance = {"p1": True, "p2": False}   # p2 absent but match still scheduled

    result = solve(req)
    assert result.status == "OPTIMAL"
    assert len([a for a in result.assignments if not a.skipped]) == 1
    assert result.skipped_matches == []  # referee did not skip
