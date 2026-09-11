"""Normalization of a fighter's OKTAGON history, against real payloads
captured from /v1/fights?fighterId=... (see docs/shape-fighter-history.md)."""

import json
import pathlib

from oktagon import normalize_history_fight, parse_end_time

FIXTURES = pathlib.Path(__file__).parent / "fixtures"
HOLZER_ID = 678
KINCL_ID = 385


def _fixture(name: str) -> list[dict]:
    return json.loads((FIXTURES / name).read_text())


def _history(name: str, fighter_id: int) -> list[dict]:
    rows = [normalize_history_fight(f, fighter_id) for f in _fixture(name)]
    return [row for row in rows if row]


def test_skips_the_fight_that_has_not_happened_yet():
    raw = _fixture("fights_by_fighter_max_holzer.json")
    upcoming = next(f for f in raw if f["id"] == 1476)
    # An undecided fight has no `result` key at all - not a null one.
    assert "result" not in upcoming
    assert normalize_history_fight(upcoming, HOLZER_ID) is None

    assert 1476 not in {row["oktagon_fight_id"] for row in _history(
        "fights_by_fighter_max_holzer.json", HOLZER_ID
    )}


def test_result_is_read_from_the_fighters_own_side():
    history = {
        row["oktagon_fight_id"]: row
        for row in _history("fights_by_fighter_max_holzer.json", HOLZER_ID)
    }

    # Holzer is fighter1 and fighter1 won.
    assert history[1417]["outcome"] == "win"
    assert history[1417]["opponent_name"] == "Khalid Taha"

    # Holzer is fighter2 and fighter2 won - same outcome, other slot.
    assert history[832]["outcome"] == "win"
    assert history[832]["opponent_name"] == "Corey Fry"


def test_carries_the_result_detail_and_the_gala():
    history = {
        row["oktagon_fight_id"]: row
        for row in _history("fights_by_fighter_max_holzer.json", HOLZER_ID)
    }

    taha = history[1417]
    assert taha["result_type"] == "TKO"
    assert taha["end_round"] == 1
    assert taha["end_time"] == "3:14"
    assert taha["event_label"] == "OKTAGON 88"
    assert taha["event_number"] == 88
    assert taha["event_date"].startswith("2026-05-16")
    assert taha["title_fight"] is False


def test_end_round_is_the_round_the_fight_ended_in():
    history = {
        row["oktagon_fight_id"]: row
        for row in _history("fights_by_fighter_max_holzer.json", HOLZER_ID)
    }

    # Holzer vs Ilbay: a submission at 4:14 of round four - and not a title
    # fight, which is exactly the case OKTAGON's API cannot express.
    ilbay = history[1104]
    assert (ilbay["result_type"], ilbay["end_round"], ilbay["end_time"]) == ("SUB", 4, "4:14")
    assert ilbay["title_fight"] is False

    # A decision reports the last round fought, not a finish.
    black_dell = history[1084]
    assert (black_dell["result_type"], black_dell["end_round"]) == ("DEC", 3)


def test_ignores_a_fight_of_somebody_else():
    taha_side = next(
        f for f in _fixture("fights_by_fighter_max_holzer.json") if f["id"] == 1417
    )
    assert normalize_history_fight(taha_side, 999999) is None


def test_kincl_history_from_the_websites_own_query():
    history = _history("fights_by_fighter_patrik_kincl.json", KINCL_ID)
    by_id = {row["oktagon_fight_id"]: row for row in history}

    # Three items in, one of them the announced OKTAGON 95 bout.
    assert set(by_id) == {1452, 1277}
    assert by_id[1452]["outcome"] == "win"
    assert by_id[1452]["result_type"] == "SUB"
    assert by_id[1452]["end_round"] == 2
    assert by_id[1452]["opponent_name"] == "Hojat Khajevand"
    assert by_id[1452]["event_label"] == "OKTAGON 91"


def test_old_cards_report_the_finish_time_in_seconds():
    # OKTAGON 1 (2016) stores "227" where a recent card stores "3:14".
    assert parse_end_time("227") == "3:47"
    assert parse_end_time("60") == "1:00"
    assert parse_end_time("3:14") == "3:14"
    assert parse_end_time(None) is None
    assert parse_end_time("") is None
