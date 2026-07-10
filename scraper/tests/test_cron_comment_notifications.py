"""send_comment_notifications batches unread kecárna messages into one
push per event per tick, skips the messages' own authors, and never
touches system rows (those get their own push from import_results.py)."""

from contextlib import contextmanager
from datetime import datetime, timezone

import cron


@contextmanager
def _fake_log_run(mode, event_id=None):
    yield


class FakeDB:
    def __init__(self, event_comments, events, push_subscriptions, profiles):
        self._tables = {
            "event_comments": event_comments,
            "events": events,
            "push_subscriptions": push_subscriptions,
            "profiles": profiles,
        }
        self.updates = []

    def select(self, table, params):
        rows = self._tables[table]
        if table == "profiles" and "notify_comments" in params:
            return [r for r in rows if r.get("notify_comments", True)]
        return rows

    def update(self, table, values, filters):
        self.updates.append((table, values, filters))


def _base_db(comments, extra_subs=None):
    events = [{"id": "evt-1", "number": 91, "name": "OKTAGON 91"}]
    subs = [
        {"id": "sub-1", "endpoint": "https://push/1", "p256dh": "a", "auth": "b", "user_id": "alice"},
        {"id": "sub-2", "endpoint": "https://push/2", "p256dh": "a", "auth": "b", "user_id": "bob"},
    ] + (extra_subs or [])
    profiles = [{"id": "alice"}, {"id": "bob"}]
    return FakeDB(comments, events, subs, profiles)


def test_batches_single_message_and_excludes_author(monkeypatch):
    comments = [
        {"id": "c1", "event_id": "evt-1", "user_id": "alice", "body": "gg", "created_at": "2026-07-10T10:00:00Z"}
    ]
    db = _base_db(comments)
    monkeypatch.setattr(cron, "log_run", _fake_log_run)
    sent = []
    monkeypatch.setattr(
        cron, "send_to_all", lambda *a, exclude_user_ids=None, **kw: sent.append(exclude_user_ids)
    )

    cron.send_comment_notifications(db, datetime(2026, 7, 10, 10, 5, tzinfo=timezone.utc))

    assert sent == [{"alice"}]
    notified = [u for u in db.updates if u[0] == "event_comments"]
    assert len(notified) == 1
    assert notified[0][2] == {"id": "in.(c1)"}


def test_multiple_messages_in_one_tick_become_a_single_push(monkeypatch):
    comments = [
        {"id": "c1", "event_id": "evt-1", "user_id": "alice", "body": "one", "created_at": "t1"},
        {"id": "c2", "event_id": "evt-1", "user_id": "bob", "body": "two", "created_at": "t2"},
    ]
    db = _base_db(comments)
    monkeypatch.setattr(cron, "log_run", _fake_log_run)
    calls = []
    monkeypatch.setattr(cron, "send_to_all", lambda *a, **kw: calls.append((a, kw)))

    cron.send_comment_notifications(db, datetime(2026, 7, 10, 10, 5, tzinfo=timezone.utc))

    assert len(calls) == 1
    args, kwargs = calls[0]
    assert kwargs["pref"] == "notify_comments"
    assert kwargs["exclude_user_ids"] == {"alice", "bob"}


def test_no_unread_comments_is_a_noop(monkeypatch):
    db = _base_db([])
    called = []
    monkeypatch.setattr(cron, "send_to_all", lambda *a, **kw: called.append(1))

    cron.send_comment_notifications(db, datetime(2026, 7, 10, 10, 5, tzinfo=timezone.utc))

    assert called == []
    assert db.updates == []
