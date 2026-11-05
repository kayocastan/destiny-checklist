"""Modal that links a Discord member to a Bungie Name."""

import logging
from collections.abc import Awaitable, Callable

import discord
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from orla_bot.bungie import BungieApiError, BungieClient
from orla_bot.bungie.progress import upsert_bungie_user

Continuation = Callable[[discord.Interaction], Awaitable[None]]
logger = logging.getLogger(__name__)


class BungieNameModal(discord.ui.Modal, title="Vincular Bungie Name"):
    """Resolve and save a member's Bungie Name before continuing their action."""

    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession],
        api_key: str,
        continuation: Continuation,
    ) -> None:
        super().__init__()
        self._session_factory = session_factory
        self._api_key = api_key
        self._continuation = continuation
        self.bungie_name = discord.ui.TextInput(
            label="Bungie Name",
            placeholder="Guardian#6666",
            min_length=6,
            max_length=30,
        )
        self.add_item(self.bungie_name)

    async def on_submit(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True, thinking=True)
        try:
            async with BungieClient(self._api_key) as client:
                membership = await client.find_membership(str(self.bungie_name.value))
            async with self._session_factory() as session:
                async with session.begin():
                    await upsert_bungie_user(
                        session,
                        interaction.user.id,
                        interaction.user.name,
                        membership,
                    )
        except BungieApiError as exc:
            logger.warning("Bungie Name lookup failed during account linking: %s", exc, exc_info=True)
            await interaction.followup.send(str(exc), ephemeral=True)
            return
        except SQLAlchemyError:
            logger.exception("Database failure while saving a Bungie identity")
            await interaction.followup.send(
                "Não consegui salvar o vínculo Bungie agora. Tente novamente.", ephemeral=True
            )
            return
        try:
            await self._continuation(interaction)
        except Exception:
            logger.exception("Failed to continue the Discord action after Bungie account linking")
            await interaction.followup.send(
                "Sua conta Bungie foi vinculada, mas não consegui continuar a criação da grade. "
                "Tente enviar o formulário novamente.",
                ephemeral=True,
            )
