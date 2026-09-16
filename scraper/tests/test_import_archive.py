"""The archive import writes into the same tables the tipping game lives in,
so the tests here are mostly about what it must NOT do."""

import json
import pathlib

import import_archive
from oktagon import normalize_fight

FIXTURES = pathlib.Path(__file__).parent / "fixtures"

OURS = {"id": "evt-ours", "is_archive": False, "number": 93}
ARCHIVE = {"id": "evt-22", "is_archive": True, "number": 22}


def _card(name: str) -> list[dict]:
    raw = [
        fight
        for card in json.loads((FIXTURES / name).read_text())
        for fight in card.get("fights", [])
    ]
    return [normalize_fight(f, i, len(raw), "main_card") for i, f in enumerate(raw)]


class FakeDB:
    def __init__(self, events=None, fights=None):
        self._events = events or []
        self._fights = fights or []
        self.inserts = []
        self.updates = []

    def select(self, table, params):
        if table == "events":
            if "oktagon_event_id" in params:
                wanted = params["oktagon_event_id"].removeprefix("eq.")
                return [e for e in self._events if str(e.get("oktagon_event_id")) == wanted]
            if "number" in params:
                wanted = int(params["number"].removeprefix("eq."))
                return [e for e in self._events if e.get("number") == wanted]
            return self._events
        if table == "fights":
            return self._fights
        return []

    def insert(self, table, rows):
        self.inserts.append((table, rows))
        return [{"id": f"new-{table}-{len(self.inserts)}"}]

    def update(self, table, values, filters):
        self.updates.append((table, values, filters))
        return []


def _tournament(number=22, date="2020-06-13T18:00:00.000Z"):
    return {
        "oktagon_event_id": 40,
        "number": number,
        "name": f"OKTAGON {number}: NĚKDO VS. NĚKDO",
        "subtitle": "Podtitul",
        "event_date": date,
        "location": "Praha",
        "image_url": "https://assets.oktagonmma.com/plakat.jpg",
    }


def _wire(monkeypatch, db, tournaments, card=None):
    monkeypatch.setattr(import_archive, "SupabaseClient", lambda: db)
    monkeypatch.setattr(import_archive, "fetch_all_tournaments", lambda *a, **k: tournaments)
    monkeypatch.setattr(import_archive, "fetch_fightcard", lambda _id: card or [])
    monkeypatch.setattr(import_archive, "import_fight_stats", lambda _e: 0)
    monkeypatch.setattr(
        import_archive, "resolve_fighter", lambda _db, fighter, _existing: fighter["name"]
    )


def test_never_touches_one_of_our_own_galas(monkeypatch):
    # The whole point of the flag: OKTAGON 93 is ours, tipped and scored.
    db = FakeDB(events=[{**OURS, "oktagon_event_id": 40}])
    _wire(monkeypatch, db, [_tournament(number=93)])

    import_archive.import_archive(None, None)

    assert db.inserts == []
    assert db.updates == []


def test_creates_an_archive_gala_nothing_can_notify_about(monkeypatch):
    db = FakeDB()
    _wire(monkeypatch, db, [_tournament()])

    import_archive.import_archive(None, None)

    table, rows = db.inserts[0]
    assert table == "events"
    row = rows[0]
    assert row["is_archive"] is True
    assert row["status"] == "completed"
    assert row["payouts_enabled"] is False
    assert row["image_url"].endswith("plakat.jpg")
    # Every push marker stamped, so even a query that forgets the flag finds
    # nothing left to send.
    for marker in import_archive.NOTIFICATION_MARKERS:
        assert row[marker], marker


def test_writes_the_card_with_its_results_already_in(monkeypatch):
    db = FakeDB()
    _wire(monkeypatch, db, [_tournament()], card=_card("fightcard_oktagon_1.json"))

    import_archive.import_archive(None, None)

    fights = [rows[0] for table, rows in db.inserts if table == "fights"]
    assert len(fights) == 6
    # An archive gala is over - writing it as "scheduled" and grading it
    # afterwards would be a detour through the live results path.
    assert all(f["status"] in ("completed", "no_contest") for f in fights)

    main_event = next(f for f in fights if f["is_main_event"])
    assert main_event["method"] == "SUBMISSION"
    assert main_event["result_round"] == 1
    assert main_event["result_time"] == "3:47"  # "227" seconds on a 2016 card
    assert main_event["winner_fighter_id"] == "Gábor Boráros"


def test_rerunning_updates_instead_of_duplicating(monkeypatch):
    db = FakeDB(
        events=[{**ARCHIVE, "oktagon_event_id": 40}],
        fights=[{"id": "fight-1", "oktagon_fight_id": 1}],
    )
    _wire(monkeypatch, db, [_tournament()], card=_card("fightcard_oktagon_1.json"))

    import_archive.import_archive(None, None)

    assert not [t for t, _ in db.inserts if t == "events"]
    assert ("fights", "eq.fight-1") in [
        (t, f["id"]) for t, _, f in db.updates if t == "fights"
    ]


def test_skips_galas_that_have_not_happened_yet(monkeypatch):
    db = FakeDB()
    _wire(monkeypatch, db, [_tournament(number=100, date="2099-01-01T00:00:00.000Z")])

    import_archive.import_archive(None, None)

    assert db.inserts == []


def test_range_limits_what_gets_imported(monkeypatch):
    db = FakeDB()
    _wire(
        monkeypatch,
        db,
        [_tournament(number=n) for n in (5, 22, 40)],
    )

    import_archive.import_archive(20, 30)

    events = [rows[0] for table, rows in db.inserts if table == "events"]
    assert [e["number"] for e in events] == [22]


def test_a_finish_in_a_later_round_widens_the_scheduled_length(monkeypatch):
    # OKTAGON 69 for real: a submission in round four of a non-title fight.
    # Leaving rounds at three would contradict the result on the same row.
    db = FakeDB()
    card = _card("fightcard_oktagon_1.json")
    card[0].update({"is_title_fight": False, "result_round": 4, "method": "SUBMISSION"})
    _wire(monkeypatch, db, [_tournament()], card=card)

    import_archive.import_archive(None, None)

    fights = [rows[0] for table, rows in db.inserts if table == "fights"]
    assert fights[0]["rounds"] == 4
    assert all(f["rounds"] in (3, 4, 5) for f in fights)
