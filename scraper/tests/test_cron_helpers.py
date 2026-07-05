"""Tests for cron.py's pure date/label helpers - the Prague-timezone
publish/followup scheduling is easy to break across DST."""

from datetime import datetime, timezone

from cron import _followup_at, _format_date_cs, _parse_dt, _publish_at, event_label


class TestEventLabel:
    def test_numbered_event(self):
        assert event_label({"number": 90, "name": "OKTAGON 90: Berlin"}) == "OKTAGON 90"

    def test_unnumbered_event_falls_back_to_name(self):
        assert event_label({"number": None, "name": "Speciál"}) == "Speciál"


class TestParseDt:
    def test_z_suffix(self):
        dt = _parse_dt("2026-07-04T18:00:00Z")
        assert dt == datetime(2026, 7, 4, 18, 0, tzinfo=timezone.utc)

    def test_offset_suffix(self):
        dt = _parse_dt("2026-07-04T20:00:00+02:00")
        assert dt.astimezone(timezone.utc).hour == 18


class TestPublishAt:
    def test_summer_event_publishes_9am_prague_cest(self):
        # Gala on Saturday 2026-07-04 20:00 CEST (18:00 UTC); publish 3
        # days earlier at 9:00 Prague = 7:00 UTC.
        event_date = datetime(2026, 7, 4, 18, 0, tzinfo=timezone.utc)
        publish = _publish_at(event_date)
        assert publish.astimezone(timezone.utc) == datetime(2026, 7, 1, 7, 0, tzinfo=timezone.utc)

    def test_winter_event_publishes_9am_prague_cet(self):
        # Winter: 9:00 Prague = 8:00 UTC (CET).
        event_date = datetime(2026, 12, 12, 19, 0, tzinfo=timezone.utc)
        publish = _publish_at(event_date)
        assert publish.astimezone(timezone.utc) == datetime(2026, 12, 9, 8, 0, tzinfo=timezone.utc)


class TestFollowupAt:
    def test_day_after_at_2pm_prague(self):
        event_date = datetime(2026, 7, 4, 18, 0, tzinfo=timezone.utc)
        followup = _followup_at(event_date)
        # 14:00 Prague CEST = 12:00 UTC, the day after
        assert followup.astimezone(timezone.utc) == datetime(2026, 7, 5, 12, 0, tzinfo=timezone.utc)


class TestFormatDateCs:
    def test_genitive_month(self):
        dt = datetime(2026, 7, 4, 18, 0, tzinfo=timezone.utc)
        assert _format_date_cs(dt) == "4. července 2026"

    def test_utc_date_shifts_to_prague_day(self):
        # 23:30 UTC on the 4th is already the 5th in Prague (CEST)
        dt = datetime(2026, 7, 4, 23, 30, tzinfo=timezone.utc)
        assert _format_date_cs(dt) == "5. července 2026"
