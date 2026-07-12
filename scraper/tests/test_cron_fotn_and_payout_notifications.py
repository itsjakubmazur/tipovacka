"""send_fotn_reminders nudges admins once a started event's real fights
are all graded but nobody's entered Fight of the Night;
send_payout_settled_notifications tells the startovné winner once
every other tipper has checked themselves off as paid."""

from datetime import datetime, timezone

import cron


class FakeDB:
    def __init__(self, tables):
        self._tables = tables
        self.updates = []

    def select(self, table, params):
        return self._tables.get(table, [])

    def update(self, table, values, filters):
        self.updates.append((table, values, filters))


def test_fotn_reminder_fires_once_all_real_fights_are_graded(monkeypatch):
    now = datetime(2026, 7, 12, 20, 0, tzinfo=timezone.utc)
    db = FakeDB(
        {
            "events": [
                {
                    "id": "evt-1",
                    "number": 91,
                    "name": "OKTAGON 91",
                }
            ],
            "fights": [
                {"status": "completed"},
                {"status": "completed"},
            ],
            "profiles": [{"id": "admin-1"}, {"id": "admin-2"}],
        }
    )
    sent = []
    monkeypatch.setattr(cron, "send_to_user", lambda db, uid, title, body, url: sent.append(uid))

    cron.send_fotn_reminders(db, now)

    assert set(sent) == {"admin-1", "admin-2"}
    notified = [u for u in db.updates if u[0] == "events"]
    assert notified == [("events", {"fotn_reminder_sent_at": now.isoformat()}, {"id": "eq.evt-1"})]


def test_fotn_reminder_skipped_when_a_real_fight_is_still_scheduled(monkeypatch):
    now = datetime(2026, 7, 12, 20, 0, tzinfo=timezone.utc)
    db = FakeDB(
        {
            "events": [{"id": "evt-1", "number": 91, "name": "OKTAGON 91"}],
            "fights": [{"status": "completed"}, {"status": "scheduled"}],
            "profiles": [{"id": "admin-1"}],
        }
    )
    sent = []
    monkeypatch.setattr(cron, "send_to_user", lambda db, uid, title, body, url: sent.append(uid))

    cron.send_fotn_reminders(db, now)

    assert sent == []
    assert db.updates == []


def test_payout_settled_notifies_winner_once_everyone_else_paid(monkeypatch):
    now = datetime(2026, 7, 12, 20, 0, tzinfo=timezone.utc)
    db = FakeDB(
        {
            "events": [{"id": "evt-1", "number": 91, "name": "OKTAGON 91"}],
            "event_leaderboard": [
                {
                    "user_id": "alice",
                    "points": 10,
                    "fights_correct_winner": 5,
                    "perfect_card": False,
                    "earliest_prediction_at": "t1",
                },
                {
                    "user_id": "bob",
                    "points": 5,
                    "fights_correct_winner": 3,
                    "perfect_card": False,
                    "earliest_prediction_at": "t2",
                },
            ],
            "event_payouts": [{"user_id": "bob", "paid": True}],
        }
    )
    sent = []
    monkeypatch.setattr(
        cron, "send_to_user", lambda db, uid, title, body, url: sent.append((uid, title))
    )

    cron.send_payout_settled_notifications(db, now)

    assert sent == [("alice", "OKTAGON 91: startovné vyplaceno")]
    notified = [u for u in db.updates if u[0] == "events"]
    assert notified == [
        ("events", {"payout_all_paid_notified_at": now.isoformat()}, {"id": "eq.evt-1"})
    ]


def test_payout_settled_waits_for_everyone(monkeypatch):
    now = datetime(2026, 7, 12, 20, 0, tzinfo=timezone.utc)
    db = FakeDB(
        {
            "events": [{"id": "evt-1", "number": 91, "name": "OKTAGON 91"}],
            "event_leaderboard": [
                {
                    "user_id": "alice",
                    "points": 10,
                    "fights_correct_winner": 5,
                    "perfect_card": False,
                    "earliest_prediction_at": "t1",
                },
                {
                    "user_id": "bob",
                    "points": 5,
                    "fights_correct_winner": 3,
                    "perfect_card": False,
                    "earliest_prediction_at": "t2",
                },
            ],
            "event_payouts": [{"user_id": "bob", "paid": False}],
        }
    )
    sent = []
    monkeypatch.setattr(cron, "send_to_user", lambda db, uid, title, body, url: sent.append(uid))

    cron.send_payout_settled_notifications(db, now)

    assert sent == []
    assert db.updates == []
