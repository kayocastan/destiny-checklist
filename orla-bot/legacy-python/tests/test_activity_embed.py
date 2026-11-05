"""Activity embed presentation tests."""

from datetime import UTC, datetime

import orla_bot.activities.view as activity_view
from orla_bot.activities.models import Activity, ActivityParticipant
from orla_bot.activities.view import render_activity


def test_activity_embed_displays_bungie_name_for_participants(monkeypatch) -> None:
    monkeypatch.setattr(activity_view, "ZoneInfo", lambda _timezone_name: UTC)
    activity = Activity(
        id=1,
        name="Raid",
        capacity=6,
        starts_at=datetime(2026, 10, 10, 23, 30, tzinfo=UTC),
        description="",
        created_by_discord_id=10,
        created_at=datetime(2026, 10, 1, tzinfo=UTC),
    )
    participant = ActivityParticipant(
        id=1,
        activity_id=1,
        discord_user_id=10,
        category="titular",
        created_at=datetime(2026, 10, 1, tzinfo=UTC),
    )

    embed = render_activity(
        activity, [participant], bungie_names={10: "Guardian#1234"}, player_skills={10: "rookie"}
    )

    titular_field = next(field for field in embed.fields if field.name.startswith("Titulares "))
    assert titular_field.value == "[ 👶 ] Guardian#1234 ( **<@10>** )"


def test_activity_embed_falls_back_to_discord_mention_without_bungie_name(monkeypatch) -> None:
    monkeypatch.setattr(activity_view, "ZoneInfo", lambda _timezone_name: UTC)
    activity = Activity(
        id=1,
        name="Raid",
        capacity=6,
        starts_at=datetime(2026, 10, 10, 23, 30, tzinfo=UTC),
        description="",
        created_by_discord_id=10,
        created_at=datetime(2026, 10, 1, tzinfo=UTC),
    )
    participant = ActivityParticipant(
        id=1,
        activity_id=1,
        discord_user_id=10,
        category="titular",
        created_at=datetime(2026, 10, 1, tzinfo=UTC),
    )

    embed = render_activity(activity, [participant])

    titular_field = next(field for field in embed.fields if field.name.startswith("Titulares "))
    assert titular_field.value == "[ ❔ ] Bungie ID não vinculado ( **<@10>** )"


def test_activity_embed_displays_each_skill_emoji(monkeypatch) -> None:
    monkeypatch.setattr(activity_view, "ZoneInfo", lambda _timezone_name: UTC)
    activity = Activity(
        id=1,
        name="Raid",
        capacity=6,
        starts_at=datetime(2026, 10, 10, 23, 30, tzinfo=UTC),
        description="",
        created_by_discord_id=10,
        created_at=datetime(2026, 10, 1, tzinfo=UTC),
    )
    participants = [
        ActivityParticipant(id=user_id, activity_id=1, discord_user_id=user_id, category="titular", created_at=datetime(2026, 10, 1, tzinfo=UTC))
        for user_id in (10, 11, 12)
    ]

    embed = render_activity(
        activity,
        participants,
        bungie_names={10: "Rookie#0001", 11: "Veteran#0002", 12: "Master#0003"},
        player_skills={10: "rookie", 11: "veteran", 12: "master"},
    )

    titular_field = next(field for field in embed.fields if field.name.startswith("Titulares "))
    assert titular_field.value.splitlines() == [
        "[ 👶 ] Rookie#0001 ( **<@10>** )",
        "[ 🎖️ ] Veteran#0002 ( **<@11>** )",
        "[ 🧙‍♂️ ] Master#0003 ( **<@12>** )",
    ]


def test_activity_embed_warns_when_player_has_no_saved_history(monkeypatch) -> None:
    monkeypatch.setattr(activity_view, "ZoneInfo", lambda _timezone_name: UTC)
    activity = Activity(
        id=1,
        name="Raid",
        capacity=6,
        starts_at=datetime(2026, 10, 10, 23, 30, tzinfo=UTC),
        description="",
        created_by_discord_id=10,
        created_at=datetime(2026, 10, 1, tzinfo=UTC),
    )
    participant = ActivityParticipant(
        id=1,
        activity_id=1,
        discord_user_id=10,
        category="titular",
        created_at=datetime(2026, 10, 1, tzinfo=UTC),
    )

    embed = render_activity(
        activity,
        [participant],
        bungie_names={10: "Guardian#1234"},
        player_skills={10: "unknown"},
    )

    titular_field = next(field for field in embed.fields if field.name.startswith("Titulares "))
    assert titular_field.value == "[ ⚠ ] Guardian#1234 ( **<@10>** )"


def test_activity_embed_formats_substitutes_and_reserves_with_emoji(monkeypatch) -> None:
    monkeypatch.setattr(activity_view, "ZoneInfo", lambda _timezone_name: UTC)
    activity = Activity(
        id=1,
        name="Raid",
        capacity=6,
        starts_at=datetime(2026, 10, 10, 23, 30, tzinfo=UTC),
        description="",
        created_by_discord_id=10,
        created_at=datetime(2026, 10, 1, tzinfo=UTC),
    )
    participants = [
        ActivityParticipant(
            id=user_id,
            activity_id=1,
            discord_user_id=user_id,
            category=category,
            created_at=datetime(2026, 10, 1, tzinfo=UTC),
        )
        for user_id, category in ((10, "titular"), (11, "substituto"), (12, "reserva"))
    ]

    embed = render_activity(
        activity,
        participants,
        bungie_names={10: "Peter#6639", 11: "Nipanga#5471", 12: "Reserva#1234"},
        player_skills={10: "rookie", 11: "master", 12: "veteran"},
    )

    assert next(field for field in embed.fields if field.name.startswith("Titulares")).value == (
        "[ 👶 ] Peter#6639 ( **<@10>** )"
    )
    assert next(field for field in embed.fields if field.name == "Substitutos").value == (
        "[ 🧙‍♂️ ] Nipanga#5471 ( **<@11>** )"
    )
    assert next(field for field in embed.fields if field.name == "Reservas").value == (
        "[ 🎖️ ] Reserva#1234 ( **<@12>** )"
    )
