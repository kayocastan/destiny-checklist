"""Input validation tests for activity creation."""

from datetime import UTC, datetime, timedelta, timezone

import pytest

import orla_bot.activities.service as activity_service
from orla_bot.activities.service import (
    ActivityInputError,
    parse_activity_start,
    validate_activity_input,
)


def test_parse_start_converts_offset_to_utc() -> None:
    assert parse_activity_start("2026-10-10T20:30-03:00") == datetime(2026, 10, 10, 23, 30, tzinfo=UTC)


@pytest.mark.parametrize(
    "value",
    ["2026-10-10 20:30", "10/10/2026 20:30", "10/10/26 20:30"],
)
def test_parse_start_accepts_local_formats(value: str, monkeypatch: pytest.MonkeyPatch) -> None:
    fixed_timezone = timezone(timedelta(hours=-3))
    monkeypatch.setattr(activity_service, "ZoneInfo", lambda _timezone_name: fixed_timezone)
    assert parse_activity_start(value, "Test/Fixed-UTC-3") == datetime(2026, 10, 10, 23, 30, tzinfo=UTC)


@pytest.mark.parametrize("value", ["31/12/2026 23:59", "31/12/26 23:59"])
def test_parse_start_accepts_december_2026(value: str) -> None:
    assert parse_activity_start(value) == datetime(2027, 1, 1, 2, 59, tzinfo=UTC)


@pytest.mark.parametrize("value", ["2026-10-10T20:30", "not-a-date"])
def test_parse_start_requires_valid_datetime_with_timezone(value: str) -> None:
    with pytest.raises(ActivityInputError):
        parse_activity_start(value)


def test_activity_input_accepts_limits_and_trims_name() -> None:
    assert validate_activity_input("  " + "A" * 80, 99, datetime.now(UTC), "D" * 250) == "A" * 80


@pytest.mark.parametrize(
    ("name", "capacity", "description"),
    [("", 1, ""), ("x" * 81, 1, ""), ("Raid", 0, ""), ("Raid", 100, ""), ("Raid", 1, "x" * 251)],
)
def test_activity_input_rejects_values_outside_limits(name: str, capacity: int, description: str) -> None:
    with pytest.raises(ActivityInputError):
        validate_activity_input(name, capacity, datetime.now(UTC), description)


def test_activity_input_requires_timezone() -> None:
    with pytest.raises(ActivityInputError, match="fuso"):
        validate_activity_input("Raid", 1, datetime(2026, 10, 10, 20, 30), "")
