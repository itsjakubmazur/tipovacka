"""Regression test for the missing "karta je online" push: an event
whose card was already imported by an admin while it was still a draft
(see triggerSherdogImport in the admin event detail page) must still
get notified the moment it publishes, even though import_new_cards
finds fights already sitting there."""

from contextlib import contextmanager
from datetime import datetime, timezone

import cron


@contextmanager
def _fake_log_run(mode, event_id=None):
    yield


class FakeDB:
    def __init__(self, events, fights):
        self._events = events
        self._fights = fights
        self.updates = []

    def select(self, table, params):
        if table == "events":
            return self._events
        if table == "fights":
            return self._fights
        raise AssertionError(f"unexpected table: {table}")

    def update(self, table, values, filters):
        self.updates.append((table, values, filters))


def test_notifies_when_card_was_preimported_during_draft(monkeypatch):
    event = {"id": "evt-1", "number": 91, "name": "OKTAGON 91"}
    db = FakeDB(events=[event], fights=[{"id": "fight-1"}])

    monkeypatch.setattr(cron, "import_card", lambda event_id: (_ for _ in ()).throw(
        AssertionError("import_card should not be called when fights already exist")
    ))
    sent = []
    monkeypatch.setattr(
        cron,
        "send_to_all",
        lambda db, title, body, url, **kw: sent.append((title, body, url)),
    )

    cron.import_new_cards(db, datetime(2026, 7, 8, 8, 0, tzinfo=timezone.utc))

    assert sent == [("OKTAGON 91: karta je online", "Zápasy byly zveřejněny, můžeš tipovat!", "/events/evt-1")]
    notified_updates = [u for u in db.updates if "card_notified_at" in u[1]]
    assert len(notified_updates) == 1


def test_imports_card_when_no_fights_yet(monkeypatch):
    event = {"id": "evt-2", "number": 92, "name": "OKTAGON 92"}
    db = FakeDB(events=[event], fights=[])

    monkeypatch.setattr(cron, "import_card", lambda event_id: (0, 0))
    monkeypatch.setattr(cron, "log_run", _fake_log_run)
    sent = []
    monkeypatch.setattr(
        cron,
        "send_to_all",
        lambda db, title, body, url, **kw: sent.append((title, body, url)),
    )

    cron.import_new_cards(db, datetime(2026, 7, 8, 8, 0, tzinfo=timezone.utc))

    assert sent == []
    notified_updates = [u for u in db.updates if "card_notified_at" in u[1]]
    assert notified_updates == []
