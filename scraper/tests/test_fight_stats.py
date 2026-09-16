"""Aggregation of the external tracking system's per-fight payload, against
two real fights (a submission and a decision) - plus which of the system's two
endpoints a fight is looked up on."""

import json
import pathlib

import oktagon
from oktagon import summarize_match_stats

FIXTURES = pathlib.Path(__file__).parent / "fixtures"

KINCL = {"name": "Patrik Kincl", "oktagon_legacy_id": 56682}
PUKAC = {"name": "Robert Pukač", "oktagon_legacy_id": 2274}
KHAJEVAND = {"name": "Hojat Khajevand", "oktagon_legacy_id": 59766}


def _fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_counts_hits_per_side():
    # Fixture keeps the first 8 of 163 logged hits, so these are the counts
    # of that slice - the point is the split, not the real fight totals.
    stats = summarize_match_stats(
        _fixture("esports_match_stats_decision_981.json"), KINCL, PUKAC
    )

    assert stats["esports_match_id"] == 981
    assert stats["fighter_a_hits"] == 4
    assert stats["fighter_a_significant_hits"] == 4
    assert stats["fighter_b_hits"] == 4
    assert stats["fighter_b_significant_hits"] == 2


def test_counts_takedowns_and_submission_attempts():
    stats = summarize_match_stats(
        _fixture("esports_match_stats_submission_1093.json"), KINCL, KHAJEVAND
    )

    # Two takedown attempts, one of them completed - both Kincl's.
    assert stats["fighter_a_takedown_attempts"] == 2
    assert stats["fighter_a_takedowns"] == 1
    assert stats["fighter_b_takedown_attempts"] == 0
    # The submission that ended the fight.
    assert stats["fighter_a_submission_attempts"] == 1
    assert stats["fighter_b_submission_attempts"] == 0


def test_breaks_the_totals_down_by_round():
    stats = summarize_match_stats(
        _fixture("esports_match_stats_submission_1093.json"), KINCL, KHAJEVAND
    )

    rounds = {entry["round"]: entry for entry in stats["rounds"]}
    assert sorted(rounds) == [1, 2]
    # Every logged hit of the fixture slice is in round one...
    assert rounds[1]["a"]["hits"] == 3
    assert rounds[1]["b"]["hits"] == 5
    # ...and all the grappling in round two.
    assert rounds[2]["a"]["takedowns"] == 1
    assert rounds[2]["a"]["submission_attempts"] == 1
    assert rounds[2]["b"]["hits"] == 0


def test_sides_can_be_matched_by_name_when_there_is_no_legacy_id():
    # Anyone signed in the last couple of years has no legacyId at all.
    stats = summarize_match_stats(
        _fixture("esports_match_stats_submission_1093.json"),
        {"name": "Patrik Kincl", "oktagon_legacy_id": None},
        {"name": "Hojat Khajevand", "oktagon_legacy_id": None},
    )

    assert stats["fighter_a_takedowns"] == 1


def test_one_recognisable_side_places_the_other_by_elimination():
    stats = summarize_match_stats(
        _fixture("esports_match_stats_submission_1093.json"),
        {"name": "Někdo Jiný", "oktagon_legacy_id": None},
        {"name": "Hojat Khajevand", "oktagon_legacy_id": None},
    )

    # Only Khajevand's name lined up - but a fight has two men in it, so the
    # other entry cannot be anybody else. Mirroring is impossible here, which
    # is the thing that would have been worse than no stats at all.
    assert stats is not None
    assert stats["fighter_a_takedowns"] == 1
    assert stats["fighter_b_takedowns"] == 0


def test_sides_follow_our_own_fighter_order():
    """The tracking system has its own fighter1/fighter2 - if we passed our
    sides the other way round, the numbers have to swap with them."""
    payload = _fixture("esports_match_stats_submission_1093.json")
    straight = summarize_match_stats(payload, KINCL, KHAJEVAND)
    flipped = summarize_match_stats(payload, KHAJEVAND, KINCL)

    assert flipped["fighter_b_takedowns"] == straight["fighter_a_takedowns"] == 1
    assert flipped["fighter_a_hits"] == straight["fighter_b_hits"]


class TestSideMatching:
    """The two systems don't always agree on a fighter's name."""

    def test_one_side_is_enough_to_place_both(self):
        # OKTAGON 93 for real: the tracking system had "Dávid Komár" where we
        # have "Dávid Dániel Komár", so only Kincl's side matched by name -
        # and a fight has exactly two men in it.
        stats = summarize_match_stats(
            _fixture("esports_match_stats_submission_1093.json"),
            {"name": "Patrik Kincl", "oktagon_legacy_id": None},
            {"name": "Hojat Sayed Khajevand", "oktagon_legacy_id": None},
        )

        assert stats is not None
        assert stats["fighter_a_takedowns"] == 1
        assert stats["fighter_b_takedowns"] == 0

    def test_a_middle_name_on_the_other_side_works_the_same(self):
        stats = summarize_match_stats(
            _fixture("esports_match_stats_submission_1093.json"),
            {"name": "Patrik Josef Kincl", "oktagon_legacy_id": None},
            KHAJEVAND,
        )

        assert stats is not None
        assert stats["fighter_a_takedowns"] == 1

    def test_still_gives_up_when_neither_side_is_recognisable(self):
        stats = summarize_match_stats(
            _fixture("esports_match_stats_submission_1093.json"),
            {"name": "Někdo Jiný", "oktagon_legacy_id": None},
            {"name": "Ještě Někdo Jiný", "oktagon_legacy_id": None},
        )

        assert stats is None

    def test_gives_up_when_both_entries_point_at_the_same_side(self):
        # One side matching both entries - here by name on one and by legacy
        # id on the other - makes the elimination meaningless. Better nothing
        # than a coin flip.
        stats = summarize_match_stats(
            _fixture("esports_match_stats_submission_1093.json"),
            {"name": "Patrik Kincl", "oktagon_legacy_id": 59766},
            {"name": "Nikdo Odsud", "oktagon_legacy_id": None},
        )

        assert stats is None


class TestStrikeTargets:
    """Kam údery dopadaly - to, z čeho OKTAGON kreslí "údery podle oblasti
    zasažení". Dřív se ta část payloadu zahazovala."""

    def test_counts_each_area_per_side(self):
        stats = summarize_match_stats(
            _fixture("esports_match_stats_decision_981.json"), KINCL, PUKAC
        )
        assert stats["fighter_a_targets"] == {"legs": 3, "head": 1}
        assert stats["fighter_b_targets"] == {"head": 4}

    def test_areas_add_up_to_the_hit_count(self):
        # Kdyby se oblast počítala jinde než zásah, rozešly by se - a graf by
        # pak tvrdil něco jiného než číslo nad ním.
        for name, a, b in (
            ("esports_match_stats_decision_981.json", KINCL, PUKAC),
            ("esports_match_stats_submission_1093.json", KINCL, KHAJEVAND),
        ):
            stats = summarize_match_stats(_fixture(name), a, b)
            for side in ("a", "b"):
                assert sum(stats[f"fighter_{side}_targets"].values()) == stats[f"fighter_{side}_hits"]


class TestWhichEndpointAFightIsAskedFor:
    """Trackovací systém zná zápas pod jedním ze dvou nezávislých čísel a
    která cesta se použije, záleží na stáří zápasu. Splést je znamená buď
    404, nebo - hůř - statistiky cizího zápasu."""

    def _spy(self, monkeypatch, responses):
        calls = []

        class FakeResponse:
            def __init__(self, payload):
                self.status_code = 200 if payload is not None else 404
                self._payload = payload

            def json(self):
                return self._payload

        def fake_get(url, **_kwargs):
            calls.append(url)
            for suffix, payload in responses.items():
                if url.endswith(suffix):
                    return FakeResponse(payload)
            return FakeResponse(None)

        monkeypatch.setattr(oktagon.requests, "get", fake_get)
        return calls

    def test_new_fight_goes_to_the_plain_endpoint(self, monkeypatch):
        calls = self._spy(monkeypatch, {"/matches/1117": {"id": 1117}})
        assert oktagon.fetch_match_stats_by_key(1117, None) == {"id": 1117}
        assert calls == [f"{oktagon.ESPORTS_EXPORT_URL}/matches/1117"]

    def test_old_fight_goes_to_the_external_endpoint(self, monkeypatch):
        calls = self._spy(monkeypatch, {"/matches/external/55670": {"id": 170}})
        assert oktagon.fetch_match_stats_by_key(None, 55670) == {"id": 170}
        assert calls == [f"{oktagon.ESPORTS_EXPORT_URL}/matches/external/55670"]

    def test_a_legacy_id_is_never_asked_for_on_the_plain_endpoint(self, monkeypatch):
        # /matches/55670 by nevrátilo nic, nebo něčí cizí zápas - a ten by
        # se pak uložil pod náš.
        calls = self._spy(monkeypatch, {"/matches/external/55670": {"id": 170}})
        oktagon.fetch_match_stats_by_key(None, 55670)
        assert f"{oktagon.ESPORTS_EXPORT_URL}/matches/55670" not in calls

    def test_falls_back_to_legacy_when_the_new_key_finds_nothing(self, monkeypatch):
        calls = self._spy(monkeypatch, {"/matches/external/55670": {"id": 170}})
        assert oktagon.fetch_match_stats_by_key(999, 55670) == {"id": 170}
        assert calls == [
            f"{oktagon.ESPORTS_EXPORT_URL}/matches/999",
            f"{oktagon.ESPORTS_EXPORT_URL}/matches/external/55670",
        ]

    def test_a_fight_with_neither_key_is_not_asked_about_at_all(self, monkeypatch):
        calls = self._spy(monkeypatch, {})
        assert oktagon.fetch_match_stats_by_key(None, None) is None
        assert calls == []
