from import_card import derive_subtitle


def _fight(a, b, main=False, order=0):
    return {
        "fighter_a": {"name": a},
        "fighter_b": {"name": b},
        "is_main_event": main,
        "card_order": order,
    }


def test_uses_flagged_main_event():
    fights = [
        _fight("Karlos Vémola", "Attila Végh", order=5),
        _fight("Samuel Krištofič", "David Kozma", main=True, order=1),
    ]
    assert derive_subtitle(fights) == "Krištofič vs. Kozma"


def test_falls_back_to_top_of_card_when_no_main_flag():
    fights = [
        _fight("Someone Junior", "Other Guy", order=2),
        _fight("Losers Bracket", "Nobody Special", order=9),
    ]
    assert derive_subtitle(fights) == "Bracket vs. Special"


def test_skips_while_a_corner_is_tba():
    fights = [_fight("Real Fighter", "TBA", main=True)]
    assert derive_subtitle(fights) is None


def test_empty_card():
    assert derive_subtitle([]) is None
