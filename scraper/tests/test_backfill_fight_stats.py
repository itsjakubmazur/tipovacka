"""The backfill has to be able to run over a finished gala without touching
anything but the column that links a fight to the tracking system."""

import json
import pathlib

import backfill_fight_stats as backfill

FIXTURES = pathlib.Path(__file__).parent / "fixtures"

EVENT = {"id": "evt-88", "number": 88, "name": "OKTAGON 88", "oktagon_event_id": 133}


class FakeDB:
    def __init__(self, fights):
        self._fights = fights
        self.updates = []

    def select(self, table, params):
        if table == "fights":
            return self._fights
        raise AssertionError(f"unexpected table: {table}")

    def update(self, table, values, filters):
        self.updates.append((table, values, filters))
        return []


def _card():
    from oktagon import normalize_fight

    raw = [
        fight
        for card in json.loads((FIXTURES / "fightcard_oktagon_88.json").read_text())
        for fight in card.get("fights", [])
    ]
    return [normalize_fight(f, i, len(raw), "main_card") for i, f in enumerate(raw)]


def _run(monkeypatch, db, stats_calls):
    monkeypatch.setattr(backfill, "resolve_event_id", lambda _db, _e: 133)
    monkeypatch.setattr(backfill, "fetch_fightcard", lambda _id: _card())
    monkeypatch.setattr(
        backfill, "import_fight_stats", lambda event_id: stats_calls.append(event_id) or 0
    )
    return backfill.backfill_event(db, EVENT)


def test_links_finished_fights_to_the_tracking_system(monkeypatch):
    db = FakeDB([{"id": "f1", "oktagon_fight_id": 1417, "oktagon_esports_id": None}])
    calls = []
    linked, _ = _run(monkeypatch, db, calls)

    assert linked == 1
    assert db.updates == [
        ("fights", {"oktagon_esports_id": 1059}, {"id": "eq.f1"})
    ]
    # Only ever that one column - a graded card must not be touched otherwise.
    assert calls == ["evt-88"]


def test_leaves_a_fight_that_is_already_linked_alone(monkeypatch):
    db = FakeDB([{"id": "f1", "oktagon_fight_id": 1417, "oktagon_esports_id": 1059}])
    linked, _ = _run(monkeypatch, db, [])

    assert linked == 0
    assert db.updates == []


def test_skips_a_fight_the_tracking_system_never_had(monkeypatch):
    # OKTAGON 1 (2016) predates it: every fight there has an empty metadata.
    db = FakeDB([{"id": "f1", "oktagon_fight_id": 1, "oktagon_esports_id": None}])
    monkeypatch.setattr(backfill, "resolve_event_id", lambda _db, _e: 11)

    raw = [
        fight
        for card in json.loads((FIXTURES / "fightcard_oktagon_1.json").read_text())
        for fight in card.get("fights", [])
    ]
    from oktagon import normalize_fight

    monkeypatch.setattr(
        backfill,
        "fetch_fightcard",
        lambda _id: [normalize_fight(f, i, len(raw), "main_card") for i, f in enumerate(raw)],
    )
    monkeypatch.setattr(backfill, "import_fight_stats", lambda _e: 0)

    linked, _ = backfill.backfill_event(db, EVENT)
    assert linked == 0
    assert db.updates == []


def test_survives_a_card_that_cannot_be_fetched(monkeypatch):
    db = FakeDB([{"id": "f1", "oktagon_fight_id": 1417, "oktagon_esports_id": None}])
    monkeypatch.setattr(backfill, "resolve_event_id", lambda _db, _e: 133)

    def boom(_id):
        raise RuntimeError("OKTAGON API je dole")

    monkeypatch.setattr(backfill, "fetch_fightcard", boom)
    monkeypatch.setattr(backfill, "import_fight_stats", lambda _e: 0)

    # One unreachable gala must not stop the rest of the backfill.
    assert backfill.backfill_event(db, EVENT) == (0, 0)
    assert db.updates == []
