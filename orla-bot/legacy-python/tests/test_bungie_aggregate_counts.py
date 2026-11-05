"""Tests for aggregate per-activity clear counts from Bungie."""

import os
import tempfile
import zipfile
from pathlib import Path

import aiohttp
import pytest

from orla_bot.bungie import BungieApiError, BungieClient, BungieMembership
from orla_bot.bungie.catalog import _activity_group, _eligibility_group, _read_activity_definitions


def test_last_wish_variants_share_eligibility_but_keep_distinct_names() -> None:
    level_55 = _activity_group("Raid", "Last Wish: Level 55", "Last Wish", "Level 55")
    level_58 = _activity_group("Raid", "Last Wish: Level 58", "Last Wish", "Level 58")
    normal = _activity_group("Raid", "Last Wish: Normal", "Last Wish", "Normal")
    master = _activity_group("Raid", "Last Wish: Master", "Last Wish", "Master")
    contest = _activity_group("Raid", "Example Raid: Contest", "Example Raid", "Contest")

    assert len({level_55, level_58, normal}) == 3
    assert {_eligibility_group(group) for group in (level_55, level_58, normal)} == {
        "raid:last-wish:normal"
    }
    assert _eligibility_group(master) == "raid:last-wish:master"
    assert _eligibility_group(contest) == contest


@pytest.mark.asyncio
async def test_aggregate_clear_counts_sum_all_characters_per_activity_hash(monkeypatch) -> None:
    client = BungieClient("test-key")
    membership = BungieMembership("12345", 3, "Guardian#1234")
    requests: list[tuple[str, str, dict[str, object]]] = []
    responses = [
        {"Response": {"profiles": [
            {"membershipId": "12345", "membershipType": 3},
            {"membershipId": "67890", "membershipType": 1},
        ]}},
        {"Response": {"profile": {"data": {"characterIds": ["1001"]}}}},
        {"Response": {"profile": {"data": {"characterIds": ["2001"]}}}},
        {"Response": {"activities": [
            {"activityHash": 101, "values": {"activityCompletions": {"basic": {"value": 4}}}},
            {"activityHash": 202, "values": {"activityCompletions": {"basic": {"value": 1}}}},
        ]}},
        {"Response": {"activities": [
            {"activityHash": 101, "values": {"activityCompletions": {"basic": {"value": 2}}}},
            {"activityHash": 303, "values": {"activityCompletions": {"basic": {"value": 9}}}},
        ]}},
    ]

    async def fake_request(method: str, path: str, **kwargs: object) -> dict[str, object]:
        requests.append((method, path, kwargs))
        return responses.pop(0)

    monkeypatch.setattr(client, "_request", fake_request)

    counts = await client.get_clear_counts(membership, {101, 202}, mode=4)

    assert counts == {101: 6, 202: 1}
    assert len(requests) == 5
    assert requests[0][1] == "/Destiny2/3/Profile/12345/LinkedProfiles/"
    assert requests[1][1] == "/Destiny2/3/Profile/12345/"
    assert requests[2][1] == "/Destiny2/1/Profile/67890/"
    assert requests[3][1].endswith("/Character/1001/Stats/AggregateActivityStats/")
    assert requests[4][1].endswith("/Character/2001/Stats/AggregateActivityStats/")
    assert requests[1][2] == {"params": {"components": "Profiles"}}
    assert requests[2][2] == {"params": {"components": "Profiles"}}
    assert not requests[0][2] and not requests[3][2] and not requests[4][2]


@pytest.mark.asyncio
async def test_aggregate_clear_counts_reject_missing_completion_metric(monkeypatch) -> None:
    client = BungieClient("test-key")
    membership = BungieMembership("12345", 3, "Guardian#1234")
    responses = [
        {"Response": {"profiles": [{"membershipId": "12345", "membershipType": 3}]}},
        {"Response": {"profile": {"data": {"characterIds": ["1001"]}}}},
        {"Response": {"activities": [{"activityHash": 101, "values": {}}]}},
    ]

    async def fake_request(method: str, path: str, **kwargs: object) -> dict[str, object]:
        return responses.pop(0)

    monkeypatch.setattr(client, "_request", fake_request)

    with pytest.raises(BungieApiError, match="contagem válida"):
        await client.get_clear_counts(membership, {101}, mode=82)


@pytest.mark.asyncio
async def test_aggregate_clear_counts_requires_nonempty_activity_hashes() -> None:
    client = BungieClient("test-key")
    membership = BungieMembership("12345", 3, "Guardian#1234")

    with pytest.raises(BungieApiError, match="Não há atividades"):
        await client.get_clear_counts(membership, set(), mode=4)


@pytest.mark.asyncio
async def test_aggregate_clear_counts_does_not_treat_unreported_hash_as_verified_zero(
    monkeypatch,
) -> None:
    client = BungieClient("test-key")
    membership = BungieMembership("12345", 3, "Guardian#1234")
    responses = [
        {"Response": {"profiles": [{"membershipId": "12345", "membershipType": 3}]}},
        {"Response": {"profile": {"data": {"characterIds": ["1001"]}}}},
        {"Response": {"activities": [
            {"activityHash": 303, "values": {"activityCompletions": {"basic": {"value": 9}}}}
        ]}},
    ]

    async def fake_request(method: str, path: str, **kwargs: object) -> dict[str, object]:
        return responses.pop(0)

    monkeypatch.setattr(client, "_request", fake_request)

    counts = await client.get_clear_counts(membership, {101, 202}, mode=4)

    assert counts == {}


@pytest.mark.asyncio
@pytest.mark.skipif(
    os.getenv("ORLA_RUN_BUNGIE_LIVE_REPORT") != "1",
    reason="Set ORLA_RUN_BUNGIE_LIVE_REPORT=1 to query Bungie and print the live report.",
)
async def test_print_nipanga_activity_clear_report() -> None:
    """Print a human-checkable per-activity table from live Bungie aggregate stats.

    Run with ORLA_RUN_BUNGIE_LIVE_REPORT=1 and BUNGIE_API_KEY set, using pytest
    with -s so the Markdown table is shown in the terminal.
    """
    api_key = os.getenv("BUNGIE_API_KEY", "").strip()
    if not api_key:
        pytest.fail("BUNGIE_API_KEY must be configured for the live Bungie report.")

    async with BungieClient(api_key) as client:
        membership = await client.find_membership("nipanga#5471")
        manifest = await client._request("GET", "/Destiny2/Manifest/")
        paths = manifest["Response"].get("mobileWorldContentPaths", {})
        database_url = paths.get("en") if isinstance(paths, dict) else None
        if not isinstance(database_url, str) or not database_url.startswith("/"):
            pytest.fail("Bungie did not return the English Manifest database path.")

        timeout = aiohttp.ClientTimeout(total=120, connect=10, sock_read=120)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"https://www.bungie.net{database_url}") as response:
                response.raise_for_status()
                archive_bytes = await response.read()

        with tempfile.TemporaryDirectory(prefix="orla-bungie-report-") as temp_dir:
            archive_path = Path(temp_dir) / "manifest.zip"
            archive_path.write_bytes(archive_bytes)
            with zipfile.ZipFile(archive_path) as archive:
                content_name = next(
                    (name for name in archive.namelist() if name.endswith(".content")),
                    None,
                )
                if content_name is None:
                    pytest.fail("Bungie's Manifest archive did not contain its content database.")
                database_path = Path(temp_dir) / "manifest.content"
                database_path.write_bytes(archive.read(content_name))
            definitions = _read_activity_definitions(database_path)

        groups: dict[tuple[str, str], list[dict[str, object]]] = {}
        for definition in definitions:
            group_key = (str(definition["type"]), str(definition["name"]))
            groups.setdefault(group_key, []).append(definition)

        counts_by_hash: dict[int, int] = {}
        for activity_type, mode in (("Raid", 4), ("Dungeon", 82)):
            hashes = {
                int(definition["bungie_id"])
                for definition in definitions
                if definition["type"] == activity_type
            }
            counts_by_hash.update(await client.get_clear_counts(membership, hashes, mode))

        print(f"Player: {membership.bungie_name}")
        print("| Tipo | Atividade | Completadas |")
        print("|---|---|---:|")
        sorted_groups = sorted(
            groups.items(),
            key=lambda item: (item[0][0], str(item[1][0]["name"]).casefold()),
        )
        for (activity_type, _), activity_definitions in sorted_groups:
            completed = sum(
                counts_by_hash.get(int(definition["bungie_id"]), 0)
                for definition in activity_definitions
            )
            name = str(activity_definitions[0]["name"]).replace("|", "\\|")
            print(f"| {activity_type} | {name} | {completed} |")
