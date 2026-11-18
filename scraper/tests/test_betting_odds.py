"""Betting odds from /events/{id}/fightcard/betting. OKTAGON reshaped this
payload in November 2026 and the old parser quietly produced nothing for
two events while every run logged "success" - these tests pin the current
shape and make sure an unknown one is loud."""

import pytest

import import_card as import_card_module
from oktagon import BettingFormatError, parse_betting_odds


def _option(key, odds):
    return {"key": key, "label": key, "odds": odds, "link": "https://www.tipsport.cz/..."}


def _payload(fights):
    return {
        "provider": {"id": "tipsport-cz", "name": "Tipsport"},
        "fights": fights,
    }


# Trimmed from the real OKTAGON 98 (event 148) response.
REAL_SHAPE = _payload(
    {
        "1496": {
            "link": "https://www.tipsport.cz/...",
            "bets": [
                {
                    "type": "winner",
                    "label": "Winner",
                    "options": [_option("fighter1", 1.4), _option("fighter2", 2.74)],
                }
            ],
        },
        "1533": {
            "link": "https://www.tipsport.cz/...",
            "bets": [
                {
                    "type": "winner",
                    "label": "Winner",
                    "options": [_option("fighter1", 2.41), _option("fighter2", 1.5)],
                }
            ],
        },
    }
)


def test_parses_winner_odds_keyed_by_fight_id():
    assert parse_betting_odds(REAL_SHAPE) == {
        1496: {"odds_fighter_a": 1.4, "odds_fighter_b": 2.74},
        1533: {"odds_fighter_a": 2.41, "odds_fighter_b": 1.5},
    }


def test_option_order_does_not_matter():
    data = _payload(
        {"7": {"bets": [{"type": "winner", "options": [_option("fighter2", 3.0), _option("fighter1", 1.3)]}]}}
    )
    assert parse_betting_odds(data) == {7: {"odds_fighter_a": 1.3, "odds_fighter_b": 3.0}}


def test_ignores_other_bet_types_and_fights_without_prices():
    data = _payload(
        {
            "1": {"bets": [{"type": "method", "options": [_option("ko", 2.0)]}]},
            "2": {"bets": [{"type": "winner", "options": []}]},
            "3": {
                "bets": [
                    {"type": "method", "options": [_option("ko", 2.0)]},
                    {"type": "winner", "options": [_option("fighter1", 1.8)]},
                ]
            },
        }
    )
    assert parse_betting_odds(data) == {3: {"odds_fighter_a": 1.8, "odds_fighter_b": None}}


def test_no_fights_posted_yet_is_empty_not_an_error():
    assert parse_betting_odds(_payload({})) == {}


@pytest.mark.parametrize(
    "data",
    [
        # the pre-November 2026 flat shape
        {"1496": {"oddsFighter1": 1.4, "oddsFighter2": 2.74}},
        {"provider": {}},
        [],
        _payload({"1496": {"link": "x"}}),
    ],
)
def test_unknown_shape_raises(data):
    with pytest.raises(BettingFormatError):
        parse_betting_odds(data)


class FakeDB:
    def __init__(self):
        self.updates = []

    def select(self, table, params):
        assert table == "fights"
        return [{"id": "f-1", "oktagon_fight_id": 1496}, {"id": "f-2", "oktagon_fight_id": 1545}]

    def update(self, table, values, filters):
        self.updates.append((table, values, filters))


def test_update_odds_writes_only_fights_with_odds(monkeypatch):
    monkeypatch.setattr(import_card_module, "fetch_betting_odds", lambda _id: parse_betting_odds(REAL_SHAPE))
    db = FakeDB()
    import_card_module.update_odds(db, "evt", 148)
    assert db.updates == [
        ("fights", {"odds_fighter_a": 1.4, "odds_fighter_b": 2.74}, {"id": "eq.f-1"}),
    ]


def _raise_format(_id):
    raise BettingFormatError("nope")


def test_update_odds_format_error_is_quiet_by_default(monkeypatch):
    monkeypatch.setattr(import_card_module, "fetch_betting_odds", _raise_format)
    db = FakeDB()
    import_card_module.update_odds(db, "evt", 148)
    assert db.updates == []


def test_update_odds_format_error_raises_when_strict(monkeypatch):
    monkeypatch.setattr(import_card_module, "fetch_betting_odds", _raise_format)
    with pytest.raises(BettingFormatError):
        import_card_module.update_odds(FakeDB(), "evt", 148, strict=True)


def test_update_odds_network_error_stays_quiet_even_when_strict(monkeypatch):
    def boom(_id):
        raise ConnectionError("timeout")

    monkeypatch.setattr(import_card_module, "fetch_betting_odds", boom)
    import_card_module.update_odds(FakeDB(), "evt", 148, strict=True)
