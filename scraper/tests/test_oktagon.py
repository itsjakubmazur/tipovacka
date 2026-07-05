"""Tests for the OKTAGON API response normalization - the code most
likely to break silently when OKTAGON changes their payload shape.
Fixtures mirror the real /v1 response structure documented in
oktagon.py's module docstring."""

from oktagon import (
    _birth_date,
    _card_segment,
    _event_number,
    _localized,
    _rank_label,
    _record_label,
    _strip_html,
    normalize_fight,
    normalize_fighter,
)


def make_fighter(**overrides) -> dict:
    fighter = {
        "id": 123,
        "firstName": "Karlos",
        "lastName": "Vémola",
        "nickName": "Terminátor",
        "nationality": "CZ",
        "heightCm": 180,
        "yearOfBirth": 1985,
        "monthOfBirth": 7,
        "dayOfBirth": 1,
        "weightClass": {"weightKg": 84},
        "slugs": ["karlos-vemola"],
        "imageProfile": {"url": {"cs": "https://img.example/profile.jpg"}},
        "imageFightCard": {"url": {"cs": "https://img.example/card.jpg"}},
        "description": {"cs": "<p>Bio &amp; text</p>"},
        "scores": {"MMA_PROFI": {"wins": 35, "losses": 7, "draws": 0, "noContests": 1}},
        "rankings": [{"type": "OFFICIAL", "position": 1, "positionChange": 2}],
        "otherRankings": [],
        "champion": False,
        "interimChampion": False,
    }
    fighter.update(overrides)
    return fighter


class TestNormalizeFighter:
    def test_full_fighter(self):
        result = normalize_fighter(make_fighter())
        assert result["oktagon_fighter_id"] == 123
        assert result["name"] == "Karlos Vémola"
        assert result["nickname"] == "Terminátor"
        assert result["photo_url"] == "https://img.example/profile.jpg"
        assert result["fight_card_photo_url"] == "https://img.example/card.jpg"
        assert result["bio"] == "Bio & text"
        assert result["record"] == "35-7-0 (1 NC)"
        assert result["nationality"] == "Česko"
        assert result["flag_code"] == "cz"
        assert result["height_cm"] == 180
        assert result["weight_kg"] == 84
        assert result["birth_date"] == "1985-07-01"
        assert result["oktagon_rank"] == "#1"
        assert result["oktagon_rank_change"] == 2
        assert result["oktagon_slug"] == "karlos-vemola"
        assert result["is_tba"] is False

    def test_missing_fighter_is_tba(self):
        # OKTAGON omits fighter1/fighter2 entirely for unannounced sides
        result = normalize_fighter(None)
        assert result["is_tba"] is True
        assert result["name"] == "TBA"
        assert result["oktagon_fighter_id"] is None

    def test_unknown_country_code_passes_through(self):
        result = normalize_fighter(make_fighter(nationality="XX"))
        assert result["nationality"] == "XX"
        assert result["flag_code"] == "xx"

    def test_champion_flag_beats_ranking(self):
        result = normalize_fighter(make_fighter(champion=True))
        assert result["oktagon_rank"] == "Šampion"


class TestNormalizeFight:
    def make_fight(self, **overrides) -> dict:
        fight = {
            "id": 555,
            "result": None,
            "resultType": None,
            "numRounds": None,
            "time": None,
            "titleFight": False,
            "weightClass": {"title": "Lightweight"},
            "fighter1": make_fighter(),
            "fighter2": make_fighter(id=124, firstName="Attila", lastName="Végh"),
        }
        fight.update(overrides)
        return fight

    def test_scheduled_fight(self):
        result = normalize_fight(self.make_fight(), index=0, total=10, card_segment="main_card")
        assert result["status"] == "scheduled"
        assert result["winner_side"] is None
        assert result["is_main_event"] is True
        assert result["card_order"] == 10
        assert result["card_segment"] == "main_card"

    def test_fighter1_win_by_ko(self):
        result = normalize_fight(
            self.make_fight(result="FIGHTER_1_WIN", resultType="KO", numRounds=2, time="2:26"),
            index=3,
            total=10,
            card_segment="prelims",
        )
        assert result["status"] == "completed"
        assert result["winner_side"] == "a"
        assert result["method"] == "KO/TKO"
        assert result["result_round"] == 2
        assert result["result_time"] == "2:26"
        assert result["is_main_event"] is False
        assert result["card_order"] == 7

    def test_fighter2_win_by_decision_has_no_round(self):
        result = normalize_fight(
            self.make_fight(result="FIGHTER_2_WIN", resultType="DEC", numRounds=3),
            index=1,
            total=5,
            card_segment="main_card",
        )
        assert result["winner_side"] == "b"
        assert result["method"] == "DECISION"
        assert result["result_round"] is None

    def test_draw_and_no_contest_are_no_contest(self):
        for outcome in ("DRAW", "NO_CONTEST"):
            result = normalize_fight(
                self.make_fight(result=outcome), index=0, total=1, card_segment="main_card"
            )
            assert result["status"] == "no_contest"
            assert result["winner_side"] is None


class TestHelpers:
    def test_card_segment_mapping(self):
        assert _card_segment("MAIN CARD") == "main_card"
        assert _card_segment("PRELIMS") == "prelims"
        assert _card_segment("FREE PRELIMS") == "free_prelims"
        assert _card_segment("HEAVYWEIGHT TITLE FIGHT") == "main_card"
        assert _card_segment(None) == "main_card"

    def test_event_number_from_slugs(self):
        assert _event_number({"slugs": ["oktagon-90-berlin"]}) == 90
        assert _event_number({"slugs": ["oktagon-72"]}) == 72
        assert _event_number({"slugs": ["tipsport-cage-game"]}) is None
        assert _event_number({"slugs": []}) is None

    def test_localized_prefers_czech(self):
        assert _localized({"cs": "Ahoj", "en": "Hello"}) == "Ahoj"
        assert _localized({"en": "Hello"}) == "Hello"
        assert _localized({}) is None
        assert _localized(None) is None

    def test_strip_html(self):
        assert _strip_html("<p>Text <strong>tučně</strong>&nbsp;dál</p>") == "Text tučně dál"
        assert _strip_html(None) is None
        assert _strip_html("") is None

    def test_record_label(self):
        assert _record_label({"scores": {"MMA_PROFI": {"wins": 10, "losses": 2, "draws": 1}}}) == "10-2-1"
        assert _record_label({"scores": {}}) is None

    def test_birth_date_requires_all_parts(self):
        assert _birth_date({"yearOfBirth": 1990, "monthOfBirth": 1, "dayOfBirth": 5}) == "1990-01-05"
        assert _birth_date({"yearOfBirth": 1990}) is None

    def test_rank_label_p4p_fallback(self):
        fighter = {
            "rankings": [],
            "otherRankings": [{"type": "P4P", "position": 3}],
        }
        assert _rank_label(fighter) == "P4P #3"
