"""Download and import the current Destiny activity catalog from Bungie's manifest."""

from __future__ import annotations

import json
import re
import sqlite3
import tempfile
import unicodedata
import zipfile
from pathlib import Path
from typing import Any

import aiohttp
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from orla_bot.bungie import BungieApiError, BungieClient
from orla_bot.models.bungie import BungieActivity


async def import_activity_catalog(
    session_factory: async_sessionmaker[AsyncSession], api_key: str
) -> int:
    """Upsert all Raid and Dungeon definitions from the current Manifest."""
    async with BungieClient(api_key) as client:
        manifest = await client._request("GET", "/Destiny2/Manifest/")
    body = manifest["Response"]
    paths = body.get("mobileWorldContentPaths", {}) if isinstance(body, dict) else {}
    database_url = paths.get("en") if isinstance(paths, dict) else None
    if not isinstance(database_url, str) or not database_url.startswith("/"):
        raise BungieApiError("O manifesto da Bungie não informou o catálogo em inglês.")

    timeout = aiohttp.ClientTimeout(total=120, connect=10, sock_read=120)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(f"https://www.bungie.net{database_url}") as response:
            if response.status >= 400:
                raise BungieApiError("Não foi possível baixar o manifesto de atividades da Bungie.")
            archive_bytes = await response.read()

    with tempfile.TemporaryDirectory(prefix="orla-manifest-") as temp_dir:
        archive_path = Path(temp_dir) / "manifest.zip"
        archive_path.write_bytes(archive_bytes)
        with zipfile.ZipFile(archive_path) as archive:
            sqlite_name = next((name for name in archive.namelist() if name.endswith(".content")), None)
            if sqlite_name is None:
                raise BungieApiError("O arquivo do manifesto não contém o banco esperado.")
            database_path = Path(temp_dir) / "manifest.content"
            database_path.write_bytes(archive.read(sqlite_name))
        activities = _read_activity_definitions(database_path)

    if not activities:
        raise BungieApiError(
            "O manifesto não trouxe definições de Raids ou Dungeons; o catálogo existente foi preservado."
        )
    async with session_factory() as session:
        async with session.begin():
            dialect_name = session.bind.dialect.name if session.bind is not None else ""
            if dialect_name != "sqlite":
                raise BungieApiError("O catálogo de atividades requer o banco SQLite configurado.")
            for activity in activities:
                statement = sqlite_insert(BungieActivity).values(**activity)
                statement = statement.on_conflict_do_update(
                    index_elements=[BungieActivity.bungie_id],
                    set_={
                        "bungie_name": statement.excluded.bungie_name,
                        "name": statement.excluded.name,
                        "type": statement.excluded.type,
                        "eligibility_group": statement.excluded.eligibility_group,
                    },
                )
                await session.execute(statement)
    return len(activities)


def _read_activity_definitions(database_path: Path) -> list[dict[str, Any]]:
    connection = sqlite3.connect(database_path)
    try:
        type_names: dict[int, str] = {}
        try:
            rows = connection.execute('SELECT id, json FROM DestinyActivityTypeDefinition')
            for raw_hash, raw_json in rows:
                value = json.loads(raw_json)
                display = value.get("displayProperties", {})
                label = display.get("name") if isinstance(display, dict) else None
                if label:
                    type_names[int(raw_hash) & 0xFFFFFFFF] = str(label)
        except sqlite3.OperationalError:
            pass

        results: list[dict[str, Any]] = []
        for raw_hash, raw_json in connection.execute('SELECT id, json FROM DestinyActivityDefinition'):
            try:
                value = json.loads(raw_json)
            except (TypeError, json.JSONDecodeError):
                continue
            properties = value.get("displayProperties", {})
            activity_name = properties.get("name") if isinstance(properties, dict) else None
            if not isinstance(activity_name, str) or not activity_name.strip():
                continue
            activity_type_hash = value.get("activityTypeHash")
            try:
                category = type_names.get(int(activity_type_hash), "Other")
            except (TypeError, ValueError):
                category = "Other"
            if category.casefold() not in {"raid", "dungeon"}:
                continue
            original = value.get("originalDisplayProperties", {})
            original_name = original.get("name") if isinstance(original, dict) else None
            selection = value.get("selectionScreenDisplayProperties", {})
            selection_name = selection.get("name") if isinstance(selection, dict) else None
            activity_group = _activity_group(
                category,
                activity_name,
                original_name if isinstance(original_name, str) else None,
                selection_name if isinstance(selection_name, str) else None,
            )
            eligibility_group = _eligibility_group(activity_group)
            results.append({
                "bungie_id": int(raw_hash) & 0xFFFFFFFF,
                "bungie_name": activity_name.strip(),
                "name": activity_name.strip(),
                "type": category[:100],
                "eligibility_group": eligibility_group,
            })
        return results
    finally:
        connection.close()


_DIFFICULTY_SUFFIX = re.compile(
    r":\s*(standard|normal|master|legend|prestige)\s*$",
    re.IGNORECASE,
)
_EPIC_MARKER = re.compile(r"\s*\(epic\)", re.IGNORECASE)

# Deliberate exceptions for skill classification. The report uses each
# definition's name, so this shared key does not merge its displayed variants.
_ELIGIBILITY_GROUP_ALIASES = {
    "raid:last-wish:level-55": "raid:last-wish:normal",
    "raid:last-wish:level-58": "raid:last-wish:normal",
}


def _eligibility_group(group_key: str) -> str:
    """Map a raw activity group to its classification group."""
    return _ELIGIBILITY_GROUP_ALIASES.get(group_key, group_key)


def _activity_group(
    activity_type: str,
    display_name: str,
    original_name: str | None,
    selection_name: str | None,
) -> str:
    """Build a stable key from the activity name and its Manifest variant."""
    base_name = (original_name or display_name).strip()
    base_name = _EPIC_MARKER.sub("", base_name).strip()
    base_name = _DIFFICULTY_SUFFIX.sub("", base_name).strip()

    difficulty_label = (selection_name or "").strip()
    if not difficulty_label or difficulty_label.casefold() not in {
        "standard", "normal", "master", "legend", "prestige"
    }:
        suffix = _DIFFICULTY_SUFFIX.search(display_name)
        difficulty_label = suffix.group(1) if suffix else difficulty_label
    normalized_difficulty = difficulty_label.casefold()
    if normalized_difficulty in {"", "standard", "normal"}:
        difficulty = "normal"
    elif normalized_difficulty in {"master", "legend", "prestige"}:
        difficulty = "master"
    else:
        difficulty = _slug(difficulty_label)

    return f"{activity_type.casefold()}:{_slug(base_name)}:{difficulty}"


def _slug(value: str) -> str:
    """Normalize a Manifest label into an ASCII key component."""
    value = value.replace("'", "").replace("’", "")
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.casefold()).strip("-")
