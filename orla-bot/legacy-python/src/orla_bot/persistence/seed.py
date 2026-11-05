"""Load the curated and raw Bungie catalog from the portable seed SQL file."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def seed_database() -> None:
    """Execute essential catalog data using the configured database URL."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("Missing required configuration: DATABASE_URL")

    seed_path = Path(__file__).resolve().parents[3] / "scripts" / "essential-data.sql"
    statements = [
        statement.strip()
        for statement in seed_path.read_text(encoding="utf-8").split(";")
        if statement.strip()
    ]
    engine = create_async_engine(database_url)
    try:
        async with engine.begin() as connection:
            for statement in statements:
                await connection.execute(text(statement))
    finally:
        await engine.dispose()


def main() -> None:
    """Run the essential-data seed command."""
    asyncio.run(seed_database())


if __name__ == "__main__":
    main()
