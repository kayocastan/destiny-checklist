"""One-shot command to refresh Bungie activity definitions in SQLite."""

import asyncio

from orla_bot.bungie.catalog import import_activity_catalog
from orla_bot.config import load_settings
from orla_bot.persistence.database import create_session_factory


async def main() -> None:
    settings = load_settings()
    if not settings.bungie_api_key:
        raise SystemExit("Missing required configuration: BUNGIE_API_KEY")
    session_factory = create_session_factory(settings.database_url)
    try:
        count = await import_activity_catalog(session_factory, settings.bungie_api_key)
        print(f"Catálogo atualizado: {count} definições inseridas/atualizadas.")
    finally:
        await session_factory.kw["bind"].dispose()


if __name__ == "__main__":
    asyncio.run(main())
