"""_notify_fight_result mentions the doubled tally for a user whose
bold pick ("jistotka") landed on this fight - and stays quiet about it
for everyone else."""

import import_results


class FakeDB:
    def __init__(self, predictions, profiles, bold_picks):
        self._tables = {
            "predictions": predictions,
            "profiles": profiles,
            "bold_picks": bold_picks,
        }

    def select(self, table, params):
        return self._tables[table]


def test_bold_hit_mentions_doubled_points(monkeypatch):
    db = FakeDB(
        predictions=[
            {"user_id": "alice", "predicted_winner_id": "f-a", "points": 3},
            {"user_id": "bob", "predicted_winner_id": "f-a", "points": 2},
        ],
        profiles=[],
        bold_picks=[{"user_id": "alice"}],
    )
    sent = {}
    monkeypatch.setattr(
        import_results, "send_to_user", lambda db, uid, title, body, url: sent.setdefault(uid, body)
    )

    import_results._notify_fight_result(
        db,
        "evt-1",
        {"id": "fight-1", "fighter_a_id": "f-a", "fighter_b_id": "f-b"},
        "Vemola",
        "Marpo",
        "Vemola",
        "KO/TKO ve 2. kole",
    )

    assert "(jistotka ×2 = 6 b.)" in sent["alice"]
    assert "jistotka" not in sent["bob"]


def test_bold_miss_stays_quiet(monkeypatch):
    db = FakeDB(
        predictions=[{"user_id": "alice", "predicted_winner_id": "f-b", "points": 0}],
        profiles=[],
        bold_picks=[{"user_id": "alice"}],
    )
    sent = {}
    monkeypatch.setattr(
        import_results, "send_to_user", lambda db, uid, title, body, url: sent.setdefault(uid, body)
    )

    import_results._notify_fight_result(
        db,
        "evt-1",
        {"id": "fight-1", "fighter_a_id": "f-a", "fighter_b_id": "f-b"},
        "Vemola",
        "Marpo",
        "Vemola",
        "KO/TKO ve 2. kole",
    )

    assert "jistotka" not in sent["alice"]
    assert "0 b." in sent["alice"]
