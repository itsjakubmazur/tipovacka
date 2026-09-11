"""A five-round fight that isn't for a belt has no marker in the OKTAGON
API - the round count can only come from a human in the admin. Re-importing
the card must never quietly put it back to three."""

import import_card as import_card_module


class FakeDB:
    def __init__(self, fights_by_query):
        self._fights_by_query = fights_by_query
        self.updates = []
        self.inserts = []

    def select(self, table, params):
        if table == "events":
            return [{"id": "evt-1", "number": 93, "oktagon_event_id": 93}]
        if table == "fights":
            # The legacy lookup ("no oktagon_fight_id yet") is the only one
            # this test cares about; every other fights query comes back empty.
            if params.get("oktagon_fight_id") == "is.null":
                return self._fights_by_query
            return []
        if table == "predictions":
            return []
        raise AssertionError(f"unexpected table: {table}")

    def update(self, table, values, filters):
        self.updates.append((table, values, filters))

    def insert(self, table, rows):
        self.inserts.append((table, rows))


def _run(monkeypatch, db, fight):
    monkeypatch.setattr(import_card_module, "SupabaseClient", lambda: db)
    monkeypatch.setattr(import_card_module, "resolve_event_id", lambda _db, _event: 93)
    monkeypatch.setattr(import_card_module, "fetch_fightcard", lambda _id: [fight])
    monkeypatch.setattr(
        import_card_module,
        "resolve_fighter",
        lambda _db, fighter, _existing: fighter["name"],
    )
    monkeypatch.setattr(import_card_module, "import_image", lambda _id: None)
    monkeypatch.setattr(import_card_module, "update_odds", lambda *_args: None)
    import_card_module.import_card("evt-1")


def _fight(is_title_fight):
    return {
        "oktagon_fight_id": 4242,
        "fighter_a": {"name": "Rousal"},
        "fighter_b": {"name": "Magaard"},
        "weight_class": "Welterweight",
        "is_title_fight": is_title_fight,
        "is_main_event": True,
        "card_order": 1,
        "card_segment": "main_card",
        "oktagon_esports_id": 4242,
    }


def _legacy_row():
    return [{"id": "fight-1", "fighter_a_id": "Rousal", "fighter_b_id": "Magaard"}]


def test_legacy_link_keeps_manual_round_count(monkeypatch):
    db = FakeDB(_legacy_row())
    _run(monkeypatch, db, _fight(is_title_fight=False))

    patches = [values for table, values, _ in db.updates if table == "fights"]
    assert len(patches) == 1 and patches[0]["oktagon_fight_id"] == 4242
    assert "rounds" not in patches[0]


def test_legacy_link_still_raises_a_title_fight_to_five(monkeypatch):
    db = FakeDB(_legacy_row())
    _run(monkeypatch, db, _fight(is_title_fight=True))

    patches = [values for table, values, _ in db.updates if table == "fights"]
    assert len(patches) == 1 and patches[0]["rounds"] == 5
