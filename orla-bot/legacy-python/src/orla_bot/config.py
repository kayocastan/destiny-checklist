"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env", override=False)


@dataclass(frozen=True, slots=True)
class Settings:
    discord_token: str
    discord_guild_id: int
    database_url: str
    timezone: str
    bungie_api_key: str


def load_settings() -> Settings:
    """Load required settings without exposing secret values in errors."""
    token = os.getenv("DISCORD_TOKEN", "").strip()
    if not token:
        raise SystemExit("Missing required configuration: DISCORD_TOKEN")

    guild_id_value = os.getenv("DISCORD_GUILD_ID", "").strip()
    if not guild_id_value.isdecimal():
        raise SystemExit("Missing or invalid required configuration: DISCORD_GUILD_ID")

    timezone = os.getenv("TIMEZONE", "America/Sao_Paulo").strip()
    try:
        ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise SystemExit("Invalid required configuration: TIMEZONE") from exc

    database_url = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./data/orla.sqlite3",
    ).strip()
    if not database_url:
        database_url = "sqlite+aiosqlite:///./data/orla.sqlite3"

    return Settings(token, int(guild_id_value), database_url, timezone, os.getenv("BUNGIE_API_KEY", "").strip())
