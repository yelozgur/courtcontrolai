"""Contract tests for the CP-SAT scheduler.

These exist because the solver had never been proven end to end. The /health
probe only proves the service is up; it says nothing about whether the schedule
it produces is correct.

The first test asserts optimality against a hand-computed lower bound rather
than just "it returned something".
"""

import datetime as dt

from app.solver import CourtInput, MatchInput, ScheduleRequest, solve

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
