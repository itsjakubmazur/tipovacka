"""Regression test for a fully-tipped user getting told to "nezapomeň
dotipovat" (don't forget to finish tipping) even though they already
tipped every fight - the reminder text must match reality."""

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import cron


@contextmanager
def _fake_log_run(mode, event_id=None):
    yield


class FakeDB:
    def __init__(
        self, events, fights, push_subscriptions, profiles, predictions, bonus_predictions=None
    ):
        self._tables = {
            "events": events,
            "fights": fights,
            "push_subscriptions": push_subscriptions,
            "profiles": profiles,
            "predictions": predictions,
            # the reminder also checks the Fight of the Night pick
            "bonus_predictions": bonus_predictions or [],
        }
        self.updates = []

    def select(self, table, params):
        rows = self._tables[table]
        if table == "profiles" and "notify_reminders" in params:
            return [r for r in rows if not r.get("notify_reminders", True)]
        return rows

    def update(self, table, values, filters):
        self.updates.append((table, values, filters))


def test_fully_tipped_user_is_not_told_to_keep_tipping(monkeypatch):
    now = datetime(2026, 7, 11, 18, 0, tzinfo=timezone.utc)
    event = {
        "id": "evt-1",
        "number": 91,
        "name": "OKTAGON 91",
        "lock_at": (now + timedelta(minutes=30)).isoformat(),
    }
    fights = [{"id": "f1"}, {"id": "f2"}]
    db = FakeDB(
        events=[event],
        fights=fights,
        push_subscriptions=[{"user_id": "alice"}, {"user_id": "bob"}],
        profiles=[{"id": "alice", "notify_reminders": True}, {"id": "bob", "notify_reminders": True}],
        predictions=[
            {"user_id": "alice", "fight_id": "f1"},
            {"user_id": "alice", "fight_id": "f2"},
            {"user_id": "bob", "fight_id": "f1"},
        ],
        # both have the bonus pick, so this stays purely about fight counts
        bonus_predictions=[{"user_id": "alice"}, {"user_id": "bob"}],
    )
    monkeypatch.setattr(cron, "log_run", _fake_log_run)
    sent = {}
    monkeypatch.setattr(
        cron, "send_to_user", lambda db, user_id, title, body, url: sent.setdefault(user_id, body)
    )

    cron.send_lock_reminders(db, now)

    assert sent["alice"] == "Máš tipnuto všech 2 zápasů, nic dalšího tě nečeká!"
    assert sent["bob"] == "Máš tipnuto 1 z 2 zápasů, nezapomeň dotipovat!"


def test_missing_fotn_pick_is_called_out(monkeypatch):
    """Tipping every fight isn't the whole job - the Fight of the Night pick
    scores too, so someone who's only missing that must still hear about it."""
    now = datetime(2026, 7, 11, 18, 0, tzinfo=timezone.utc)
    event = {
        "id": "evt-1",
        "number": 90,
        "name": "OKTAGON 90",
        "subtitle": None,
        "lock_at": (now + timedelta(minutes=30)).isoformat(),
    }
    db = FakeDB(
        events=[event],
        fights=[{"id": "f1"}, {"id": "f2"}],
        push_subscriptions=[{"user_id": "alice"}],
        profiles=[],
        predictions=[
            {"user_id": "alice", "fight_id": "f1"},
            {"user_id": "alice", "fight_id": "f2"},
        ],
        bonus_predictions=[],
    )
    monkeypatch.setattr(cron, "log_run", _fake_log_run)
    sent = {}
    monkeypatch.setattr(
        cron, "send_to_user", lambda db, user_id, title, body, url: sent.setdefault(user_id, body)
    )

    cron.send_lock_reminders(db, now)

    assert "zápas večera" in sent["alice"]
    assert "nezapomeň dotipovat" not in sent["alice"]
