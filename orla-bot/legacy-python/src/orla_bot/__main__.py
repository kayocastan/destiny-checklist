"""Discord bot entry point."""

import asyncio
import logging
import os

from orla_bot.bot import create_bot
from orla_bot.config import load_settings
from orla_bot.persistence.database import create_session_factory


async def run_bot() -> None:
    """Load configuration and run the async bot lifecycle."""
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    settings = load_settings()
    session_factory = create_session_factory(settings.database_url)
    bot = create_bot(
        session_factory, settings.discord_guild_id, settings.timezone, settings.bungie_api_key
    )
    try:
        await bot.start(settings.discord_token)
    finally:
        await bot.close()
        await session_factory.kw["bind"].dispose()


def main() -> None:
    """Run the async bot lifecycle."""
    asyncio.run(run_bot())


if __name__ == "__main__":
    main()
