"""Aggregation of the external tracking system's per-fight payload, against
two real fights (a submission and a decision)."""

import json
import pathlib

from oktagon import summarize_match_stats

FIXTURES = pathlib.Path(__file__).parent / "fixtures"

KINCL = {"name": "Patrik Kincl", "oktagon_legacy_id": 56682}
PUKAC = {"name": "Robert Pukač", "oktagon_legacy_id": 2274}
KHAJEVAND = {"name": "Hojat Khajevand", "oktagon_legacy_id": 59766}


def _fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_counts_hits_per_side():
    # Fixture keeps the first 8 of 163 logged hits, so these are the counts
    # of that slice - the point is the split, not the real fight totals.
    stats = summarize_match_stats(
        _fixture("esports_match_stats_decision_981.json"), KINCL, PUKAC
    )

    assert stats["esports_match_id"] == 981
    assert stats["fighter_a_hits"] == 4
    assert stats["fighter_a_significant_hits"] == 4
    assert stats["fighter_b_hits"] == 4
    assert stats["fighter_b_significant_hits"] == 2


def test_counts_takedowns_and_submission_attempts():
    stats = summarize_match_stats(
        _fixture("esports_match_stats_submission_1093.json"), KINCL, KHAJEVAND
    )

    # Two takedown attempts, one of them completed - both Kincl's.
    assert stats["fighter_a_takedown_attempts"] == 2
    assert stats["fighter_a_takedowns"] == 1
    assert stats["fighter_b_takedown_attempts"] == 0
    # The submission that ended the fight.
    assert stats["fighter_a_submission_attempts"] == 1
    assert stats["fighter_b_submission_attempts"] == 0


def test_breaks_the_totals_down_by_round():
    stats = summarize_match_stats(
        _fixture("esports_match_stats_submission_1093.json"), KINCL, KHAJEVAND
    )

    rounds = {entry["round"]: entry for entry in stats["rounds"]}
    assert sorted(rounds) == [1, 2]
    # Every logged hit of the fixture slice is in round one...
    assert rounds[1]["a"]["hits"] == 3
    assert rounds[1]["b"]["hits"] == 5
    # ...and all the grappling in round two.
    assert rounds[2]["a"]["takedowns"] == 1
    assert rounds[2]["a"]["submission_attempts"] == 1
    assert rounds[2]["b"]["hits"] == 0


def test_sides_can_be_matched_by_name_when_there_is_no_legacy_id():
    # Anyone signed in the last couple of years has no legacyId at all.
    stats = summarize_match_stats(
        _fixture("esports_match_stats_submission_1093.json"),
        {"name": "Patrik Kincl", "oktagon_legacy_id": None},
        {"name": "Hojat Khajevand", "oktagon_legacy_id": None},
    )

    assert stats["fighter_a_takedowns"] == 1


def test_gives_up_rather_than_guessing_which_side_is_which():
    stats = summarize_match_stats(
        _fixture("esports_match_stats_submission_1093.json"),
        {"name": "Někdo Jiný", "oktagon_legacy_id": None},
        {"name": "Hojat Khajevand", "oktagon_legacy_id": None},
    )

    # Mirrored stats would be worse than none.
    assert stats is None


def test_sides_follow_our_own_fighter_order():
    """The tracking system has its own fighter1/fighter2 - if we passed our
    sides the other way round, the numbers have to swap with them."""
    payload = _fixture("esports_match_stats_submission_1093.json")
    straight = summarize_match_stats(payload, KINCL, KHAJEVAND)
    flipped = summarize_match_stats(payload, KHAJEVAND, KINCL)

    assert flipped["fighter_b_takedowns"] == straight["fighter_a_takedowns"] == 1
    assert flipped["fighter_a_hits"] == straight["fighter_b_hits"]
