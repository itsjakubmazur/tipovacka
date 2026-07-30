"""Every broadcast has to leave a trace in push_log - that table is the
admin's only record of the sends that have no *_notified_at column of
their own (card changed, manual broadcast, the winner's payout push)."""

import push


class FakeDB:
    def __init__(self, subscriptions=None, profiles=None):
        self._subscriptions = subscriptions or []
        self._profiles = profiles or []
        self.inserted = []

    def select(self, table, params):
        if table == "push_subscriptions":
            return self._subscriptions
        if table == "profiles":
            return self._profiles
        return []

    def insert(self, table, rows):
        self.inserted.append((table, rows))
        return rows

    def delete(self, table, filters):
        pass


def _subs(*user_ids):
    return [
        {"id": f"s{i}", "endpoint": f"https://push/{i}", "p256dh": "k", "auth": "a", "user_id": uid}
        for i, uid in enumerate(user_ids)
    ]


def test_send_to_all_logs_one_row_per_campaign():
    db = FakeDB(subscriptions=_subs("u1", "u2"))

    recipients = push.send_to_all(db, "Titulek", "Text", "/events/e1", kind="lock", event_id="e1")

    assert recipients == 2
    assert db.inserted == [
        (
            "push_log",
            [
                {
                    "kind": "lock",
                    "event_id": "e1",
                    "title": "Titulek",
                    "body": "Text",
                    "recipients": 2,
                }
            ],
        )
    ]


def test_recipients_counts_people_not_devices():
    # one person, phone + laptop
    db = FakeDB(subscriptions=_subs("u1", "u1"))

    assert push.send_to_all(db, "T", "B", "/", kind="manual") == 1
    assert db.inserted[0][1][0]["recipients"] == 1


def test_opted_out_users_are_not_counted():
    db = FakeDB(subscriptions=_subs("u1", "u2"), profiles=[{"id": "u1"}])

    recipients = push.send_to_all(db, "T", "B", "/", pref="notify_card_updates", kind="card_changed")

    assert recipients == 1


def test_logging_failure_never_breaks_a_send():
    class ExplodingDB(FakeDB):
        def insert(self, table, rows):
            raise RuntimeError("db is down")

    db = ExplodingDB(subscriptions=_subs("u1"))

    # the push already went out by the time we log - a broken log must not
    # surface as a failed notification
    assert push.send_to_all(db, "T", "B", "/", kind="lock") == 1
