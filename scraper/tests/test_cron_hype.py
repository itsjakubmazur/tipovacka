"""The ~6-days-before YouTube heads-up: timing, the Czech weekday it
names for the card opening, and the "already open -> skip but mark"
guard so a late run doesn't send a wrong 'opens on <day>' message."""

from contextlib import contextmanager
from datetime import datetime, timezone

import cron


@contextmanager
def _fake_log_run(mode, event_id=None):
    yield


class FakeDB:
    def __init__(self, events):
        self._events = events
        self.updates = []

    def select(self, table, params):
        return self._events

    def update(self, table, values, filters):
        self.updates.append((table, values, filters))


def test_hype_at_is_14_prague_six_days_before():
    # Gala Saturday 2026-08-01 18:30 CEST (16:30 UTC); hype 6 days
    # earlier at 14:00 Prague CEST = 12:00 UTC on Sunday 2026-07-26.
    event_date = datetime(2026, 8, 1, 16, 30, tzinfo=timezone.utc)
    assert cron._hype_at(event_date).astimezone(timezone.utc) == datetime(
        2026, 7, 26, 12, 0, tzinfo=timezone.utc
    )


def test_publish_day_name_is_wednesday_for_a_saturday_gala():
    # Card opens 3 days before Saturday = Wednesday.
    event_date = datetime(2026, 8, 1, 16, 30, tzinfo=timezone.utc)
    assert cron._publish_day_name(event_date) == "ve středu"


def test_sends_once_before_card_opens(monkeypatch):
    event = {"id": "e1", "number": 92, "name": "OKTAGON 92", "event_date": "2026-08-01T16:30:00Z"}
    db = FakeDB([event])
    monkeypatch.setattr(cron, "log_run", _fake_log_run)
    sent = []
    monkeypatch.setattr(cron, "send_to_all", lambda db, title, body, url, **kw: sent.append((title, body, url)))

    # after hype (Jul 26 12:00 UTC), before publish (Jul 29 07:00 UTC)
    cron.send_hype_notifications(db, datetime(2026, 7, 27, 10, 0, tzinfo=timezone.utc))

    assert len(sent) == 1
    title, body, url = sent[0]
    assert title == "OKTAGON 92 už příští víkend"
    assert "ve středu" in body
    assert url == "https://youtube.com/@oktagon_czsk"
    assert any("hype_notified_at" in u[1] for u in db.updates)


def test_too_early_does_nothing(monkeypatch):
    event = {"id": "e1", "number": 92, "name": "OKTAGON 92", "event_date": "2026-08-01T16:30:00Z"}
    db = FakeDB([event])
    sent = []
    monkeypatch.setattr(cron, "send_to_all", lambda *a, **kw: sent.append(a))

    # a week before the hype moment
    cron.send_hype_notifications(db, datetime(2026, 7, 20, 10, 0, tzinfo=timezone.utc))

    assert sent == []
    assert db.updates == []


def test_late_run_marks_but_does_not_send(monkeypatch):
    event = {"id": "e1", "number": 92, "name": "OKTAGON 92", "event_date": "2026-08-01T16:30:00Z"}
    db = FakeDB([event])
    monkeypatch.setattr(cron, "log_run", _fake_log_run)
    sent = []
    monkeypatch.setattr(cron, "send_to_all", lambda *a, **kw: sent.append(a))

    # after the card already opened (publish Jul 29 07:00 UTC) - skip send, still mark
    cron.send_hype_notifications(db, datetime(2026, 7, 30, 10, 0, tzinfo=timezone.utc))

    assert sent == []
    assert any("hype_notified_at" in u[1] for u in db.updates)
