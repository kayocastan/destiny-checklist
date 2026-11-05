"""Discord client creation and command registration."""

import logging
from datetime import UTC, datetime, timedelta

import discord
from discord.ext import commands, tasks
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from orla_bot.activities.commands import ActivityCommand
from orla_bot.activities.models import Activity
from orla_bot.activities.view import ActivityView

logger = logging.getLogger(__name__)
ACTIVITY_RETENTION = timedelta(hours=1)
ACTIVITY_CLEANUP_INTERVAL = 60


def create_bot(
    session_factory: async_sessionmaker[AsyncSession],
    guild_id: int,
    timezone_name: str = "America/Sao_Paulo",
    bungie_api_key: str = "",
) -> commands.Bot:
    """Create the Discord client and register guild-scoped commands."""
    bot = commands.Bot(command_prefix="!", intents=discord.Intents.none())
    guild = discord.Object(id=guild_id)
    ActivityCommand(session_factory, timezone_name, bungie_api_key).register(bot, guild)

    @bot.event
    async def setup_hook() -> None:
        await cleanup_expired_activities(bot, session_factory)
        async with session_factory() as session:
            activities = (await session.scalars(
                select(Activity).where(
                    Activity.discord_message_id.is_not(None),
                    Activity.starts_at > datetime.now(UTC) - ACTIVITY_RETENTION,
                )
            )).all()
        for activity in activities:
            bot.add_view(
                ActivityView(activity.id, session_factory, timezone_name, bungie_api_key),
                message_id=activity.discord_message_id,
            )
        await bot.tree.sync(guild=guild)

    @tasks.loop(seconds=ACTIVITY_CLEANUP_INTERVAL)
    async def cleanup_loop() -> None:
        await cleanup_expired_activities(bot, session_factory)

    @cleanup_loop.before_loop
    async def before_cleanup_loop() -> None:
        await bot.wait_until_ready()

    @bot.event
    async def on_ready() -> None:
        if not cleanup_loop.is_running():
            cleanup_loop.start()

    return bot


async def cleanup_expired_activities(
    bot: commands.Bot,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Delete activity messages one hour after their scheduled start."""
    expiration = datetime.now(UTC) - ACTIVITY_RETENTION
    async with session_factory() as session:
        expired = list((await session.scalars(
            select(Activity).where(
                Activity.starts_at <= expiration,
                Activity.discord_message_id.is_not(None),
            )
        )).all())

    for activity in expired:
        try:
            channel = bot.get_channel(activity.discord_channel_id) if activity.discord_channel_id else None
            if channel is None and activity.discord_channel_id is not None:
                channel = await bot.fetch_channel(activity.discord_channel_id)
            if channel is None or not hasattr(channel, "fetch_message"):
                logger.warning("Cannot locate channel for expired activity_id=%d", activity.id)
                continue
            try:
                message = await channel.fetch_message(activity.discord_message_id)
            except discord.NotFound:
                message = None
            if message is not None:
                await message.delete()
        except discord.HTTPException as exc:
            logger.warning("Could not delete expired activity message activity_id=%d: %s", activity.id, exc)
            continue

        async with session_factory() as session:
            async with session.begin():
                await session.execute(delete(Activity).where(Activity.id == activity.id))
        logger.info("Expired activity removed activity_id=%d", activity.id)
