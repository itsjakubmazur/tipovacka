"""import_results re-reads an already graded card and corrects it.

The bug this covers: a fight was graded exactly once and never looked at
again, so a winner OKTAGON changed after the fact never reached us - points
stayed wrong and the (wrong) result push had already gone out.
"""

import import_results


class FakeDB:
    """Just enough of SupabaseClient to drive import_results."""

    def __init__(self, event, fights, leaderboard=None):
        self.event = event
        self.fights = fights
        self.leaderboard = leaderboard or []
        self.updates: list[tuple[str, dict, dict]] = []
        self.rpcs: list[tuple[str, dict]] = []
        self.inserts: list[tuple[str, list]] = []

    def select(self, table, params):
        if table == "events":
            return [self.event]
        if table == "fights":
            if params.get("status") == "eq.scheduled":
                return [f for f in self.fights if f["status"] == "scheduled"]
            return self.fights
        if table == "event_leaderboard":
            return self.leaderboard
        return []

    def update(self, table, values, match):
        self.updates.append((table, values, match))
        if table == "fights":
            target = match["id"].removeprefix("eq.")
            for fight in self.fights:
                if fight["id"] == target:
                    fight.update(values)

    def rpc(self, name, params):
        self.rpcs.append((name, params))

    def insert(self, table, rows):
        self.inserts.append((table, rows))


def _db_fight(**overrides):
    base = {
        "id": "fight-1",
        "oktagon_fight_id": "ok-1",
        "fighter_a_id": "f-a",
        "fighter_b_id": "f-b",
        "status": "completed",
        "result_locked": False,
        "winner_fighter_id": "f-a",
        "method": "DECISION",
        "result_round": None,
        "result_time": None,
    }
    base.update(overrides)
    return base


def _api_fight(winner_side="b", **overrides):
    base = {
        "oktagon_fight_id": "ok-1",
        "status": "completed",
        "winner_side": winner_side,
        "method": "DECISION",
        "result_round": None,
        "result_time": None,
        "fighter_a": {"name": "Vemola"},
        "fighter_b": {"name": "Marpo"},
    }
    base.update(overrides)
    return base


def _wire(monkeypatch, db, api_fights):
    monkeypatch.setattr(import_results, "SupabaseClient", lambda: db)
    monkeypatch.setattr(import_results, "resolve_event_id", lambda db, event: "ok-evt")
    monkeypatch.setattr(import_results, "fetch_fightcard", lambda _id: api_fights)


def _event(**overrides):
    base = {
        "id": "evt-1",
        "number": 92,
        "name": "OKTAGON 92",
        "status": "completed",
        "oktagon_event_id": "ok-evt",
        "actual_fotn_fight_id": "fight-1",
        "payouts_enabled": True,
    }
    base.update(overrides)
    return base


def test_changed_winner_is_corrected_and_announced(monkeypatch):
    db = FakeDB(_event(), [_db_fight()])
    _wire(monkeypatch, db, [_api_fight(winner_side="b")])
    corrections = []
    monkeypatch.setattr(
        import_results,
        "_notify_result_correction_safely",
        lambda *a, **k: corrections.append(a[4]),
    )

    import_results.import_results("evt-1")

    fight_updates = [u for u in db.updates if u[0] == "fights"]
    assert fight_updates, "the corrected result should have been written"
    assert fight_updates[0][1]["winner_fighter_id"] == "f-b"
    assert ("recalculate_fight_points", {"p_fight_id": "fight-1"}) in db.rpcs
    assert corrections == ["Marpo"]  # the push names the fighter it was corrected *to*
    # a system message explains the moving points
    assert any(table == "event_comments" for table, _ in db.inserts)


def test_unchanged_result_is_left_alone(monkeypatch):
    db = FakeDB(_event(), [_db_fight()])
    _wire(monkeypatch, db, [_api_fight(winner_side="a")])
    monkeypatch.setattr(import_results, "_notify_result_correction_safely", lambda *a, **k: None)

    import_results.import_results("evt-1")

    assert [u for u in db.updates if u[0] == "fights"] == []
    assert db.rpcs == []
    assert db.inserts == []


def test_admin_locked_result_survives_the_feed(monkeypatch):
    """The case this whole change exists for: an admin fixed a result OKTAGON
    got wrong, and the re-check must not put the wrong one back."""
    db = FakeDB(_event(), [_db_fight(result_locked=True)])
    _wire(monkeypatch, db, [_api_fight(winner_side="b")])

    import_results.import_results("evt-1")

    assert [u for u in db.updates if u[0] == "fights"] == []
    assert db.rpcs == []


def test_first_grading_still_sends_the_normal_push(monkeypatch):
    db = FakeDB(
        _event(status="upcoming"),
        [_db_fight(status="scheduled", winner_fighter_id=None, method=None)],
    )
    _wire(monkeypatch, db, [_api_fight(winner_side="a")])
    normal, corrections = [], []
    monkeypatch.setattr(
        import_results, "_notify_fight_result_safely", lambda *a, **k: normal.append(a[4])
    )
    monkeypatch.setattr(
        import_results, "_notify_result_correction_safely", lambda *a, **k: corrections.append(a[4])
    )
    monkeypatch.setattr(import_results, "_announce_payout_pool", lambda *a, **k: None)

    import_results.import_results("evt-1")

    assert normal and not corrections
    assert not any(table == "event_comments" for table, _ in db.inserts)


def test_recheck_does_not_reannounce_the_payout(monkeypatch):
    """A completed gala being re-read must not post the startovné message a
    second time - it already went out when the event closed."""
    db = FakeDB(_event(), [_db_fight()])
    _wire(monkeypatch, db, [_api_fight(winner_side="a")])
    announced = []
    monkeypatch.setattr(
        import_results, "_announce_payout_pool", lambda *a, **k: announced.append(True)
    )

    import_results.import_results("evt-1")

    assert announced == []
    assert not any(
        table == "events" and values.get("status") == "completed"
        for table, values, _ in db.updates
    )


class TestStatsLink:
    """The link into the external tracking system can only be picked up here.

    A fight has no `esportsId` until it has actually been tracked, so the card
    import - which only ever runs before the gala - never sees one, and by the
    time it exists the card is locked and never re-imported.
    """

    def test_links_a_finished_fight_to_its_tracking_id(self, monkeypatch):
        db = FakeDB(_event(), [_db_fight(oktagon_esports_id=None)])
        _wire(monkeypatch, db, [_api_fight(winner_side="a", oktagon_esports_id=1093)])

        import_results.import_results("evt-1")

        assert ("fights", {"oktagon_esports_id": 1093}, {"id": "eq.fight-1"}) in db.updates

    def test_does_not_rewrite_a_link_it_already_has(self, monkeypatch):
        db = FakeDB(_event(), [_db_fight(oktagon_esports_id=1093)])
        _wire(monkeypatch, db, [_api_fight(winner_side="a", oktagon_esports_id=1093)])

        import_results.import_results("evt-1")

        assert not [u for u in db.updates if "oktagon_esports_id" in u[1]]

    def test_a_card_without_tracking_ids_writes_nothing(self, monkeypatch):
        # Anything before roughly mid-2024 has no ids at all.
        db = FakeDB(_event(), [_db_fight(oktagon_esports_id=None)])
        _wire(monkeypatch, db, [_api_fight(winner_side="a", oktagon_esports_id=None)])

        import_results.import_results("evt-1")

        assert not [u for u in db.updates if "oktagon_esports_id" in u[1]]

    def test_links_even_a_fight_whose_result_an_admin_locked(self, monkeypatch):
        # The link is not a result - a hand-corrected fight still deserves
        # its stats, and the result_locked guard below must not swallow it.
        db = FakeDB(_event(), [_db_fight(oktagon_esports_id=None, result_locked=True)])
        _wire(monkeypatch, db, [_api_fight(winner_side="b", oktagon_esports_id=1093)])

        import_results.import_results("evt-1")

        assert ("fights", {"oktagon_esports_id": 1093}, {"id": "eq.fight-1"}) in db.updates
        # ...while the locked result itself stays untouched
        assert not [u for u in db.updates if "winner_fighter_id" in u[1]]
