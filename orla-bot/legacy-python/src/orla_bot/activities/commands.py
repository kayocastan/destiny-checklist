"""Discord command adapter for activity creation."""

import logging

import discord
from discord import app_commands
from discord.ext import commands
from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from orla_bot.activities.models import Activity
from orla_bot.activities.service import (
    ActivityInputError,
    create_activity,
    parse_activity_start,
    validate_activity_start,
)
from orla_bot.activities.signups import get_roster
from orla_bot.activities.view import ActivityView, activity_image_file, render_activity
from orla_bot.bungie import BungieApiError, BungieClient
from orla_bot.bungie.progress import skill_for_clears, sync_player_activities, upsert_bungie_user
from orla_bot.models.activity_modal import ActivityModal
from orla_bot.models.bungie import CuratedBungieActivity, User
from orla_bot.models.bungie_name_modal import BungieNameModal

logger = logging.getLogger(__name__)
_CATALOG_ACTIVITY_PREFIX = "curated:"


class ActivityCommand:
    """Register activity slash commands and coordinate their application flow."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        timezone_name: str = "America/Sao_Paulo",
        bungie_api_key: str = "",
    ) -> None:
        self._session_factory = session_factory
        self._timezone_name = timezone_name
        self._bungie_api_key = bungie_api_key

    def register(self, bot: commands.Bot, guild: discord.Object) -> None:
        """Register the ``/orla`` command group for one guild."""
        orla_group = app_commands.Group(name="orla", description="Comandos do bot Orla")
        grade_command = orla_group.command(
            name="grade", description="Configura uma atividade do clã"
        )(self.grade)
        grade_command.autocomplete("atividade")(self.activity_autocomplete)
        orla_group.command(
            name="registrar", description="Vincula seu Bungie Name à sua conta Discord"
        )(self.register_bungie)
        bot.tree.add_command(orla_group, guild=guild)

    @app_commands.describe(player_bungie_id="Seu Bungie Name completo, no formato Nome#1234")
    async def register_bungie(
        self,
        interaction: discord.Interaction,
        player_bungie_id: app_commands.Range[str, 6, 30],
    ) -> None:
        """Link the invoking Discord member to the supplied Bungie Name."""
        await interaction.response.defer(ephemeral=True, thinking=True)
        try:
            async with BungieClient(self._bungie_api_key) as client:
                membership = await client.find_membership(player_bungie_id)
            async with self._session_factory() as session:
                async with session.begin():
                    await upsert_bungie_user(
                        session,
                        interaction.user.id,
                        interaction.user.name,
                        membership,
                    )
        except BungieApiError as exc:
            logger.warning("Bungie Name lookup failed during /orla register: %s", exc)
            await interaction.followup.send(str(exc), ephemeral=True)
            return
        except SQLAlchemyError:
            logger.exception("Database failure while saving a Bungie identity")
            await interaction.followup.send(
                "Não consegui salvar o vínculo Bungie agora. Tente novamente.", ephemeral=True
            )
            return
        await interaction.followup.send(
            f"Bungie Name **{discord.utils.escape_markdown(membership.bungie_name)}** vinculado à sua conta Discord.",
            ephemeral=True,
        )

    async def activity_autocomplete(
        self, interaction: discord.Interaction, current: str
    ) -> list[app_commands.Choice[str]]:
        """Suggest catalog display names while leaving custom titles available."""
        try:
            async with self._session_factory() as session:
                activities = list((await session.scalars(
                    select(CuratedBungieActivity)
                    .where(
                        (
                            CuratedBungieActivity.name.ilike(f"%{current}%")
                        ),
                        func.length(CuratedBungieActivity.name) <= 80,
                    )
                    .order_by(CuratedBungieActivity.name, CuratedBungieActivity.id)
                    .limit(25)
                )).all())
        except SQLAlchemyError:
            logger.exception("Could not load Bungie activity autocomplete choices")
            return []
        return [
            app_commands.Choice(
                name=activity.name[:100],
                value=f"{_CATALOG_ACTIVITY_PREFIX}{activity.id}",
            )
            for activity in activities
        ]

    @app_commands.describe(
        atividade="Escolha uma sugestão ou digite um título livre (até 80 caracteres)",
        integrantes="Escolha 3, 4, 6 ou 12 integrantes",
        inicio="USe o formato DD/mm/YY HH:MM",
        descricao="Informações adicionais (até 250 caracteres)",
        novatos="Quantidade máxima de novatos titulares (opcional)",
    )
    @app_commands.choices(
        integrantes=[
            app_commands.Choice(name=str(capacity), value=capacity)
            for capacity in (3, 4, 6, 12)
        ]
    )
    async def grade(
        self,
        interaction: discord.Interaction,
        atividade: app_commands.Range[str, 1, 80],
        integrantes: int | None = None,
        inicio: app_commands.Range[str, 1, 40] | None = None,
        descricao: app_commands.Range[str, 0, 250] | None = None,
        novatos: app_commands.Range[int, 0, 99] | None = None,
    ) -> None:
        """Open the activity wizard or save values supplied directly."""
        curated_bungie_activity_id: int | None = None
        selected_from_catalog = bool(
            atividade is not None and atividade.startswith(_CATALOG_ACTIVITY_PREFIX)
        )
        logger.info(
            "Grade command received activity_source=%s has_capacity=%s has_start=%s",
            "catalog" if selected_from_catalog else "free_text",
            integrantes is not None,
            inicio is not None,
        )
        if atividade is not None and atividade.startswith(_CATALOG_ACTIVITY_PREFIX):
            try:
                curated_bungie_activity_id = int(atividade.removeprefix(_CATALOG_ACTIVITY_PREFIX))
            except ValueError:
                await interaction.response.send_message(
                    "A opção do catálogo é inválida. Escolha outra atividade.", ephemeral=True
                )
                return
            try:
                async with self._session_factory() as session:
                    catalog_activity = await session.get(
                        CuratedBungieActivity, curated_bungie_activity_id
                    )
                    linked = await session.get(User, interaction.user.id)
            except SQLAlchemyError:
                logger.exception("Could not load selected Bungie activity or identity")
                await interaction.response.send_message(
                    "Não consegui verificar a atividade selecionada agora. Tente novamente.", ephemeral=True
                )
                return
            if catalog_activity is None:
                await interaction.response.send_message(
                    "Essa opção não está mais no catálogo. Pesquise novamente e escolha outra.",
                    ephemeral=True,
                )
                return
            atividade = catalog_activity.name

        # A complete slash-command submission can continue after the identity
        # modal. If the wizard is needed, collect all remaining values there
        # rather than opening a second modal (Discord only permits one modal
        # response to an interaction).
        try:
            async with self._session_factory() as session:
                linked_user = await session.get(User, interaction.user.id)
        except SQLAlchemyError:
            logger.exception("Could not check creator Bungie identity")
            await interaction.response.send_message(
                "Não consegui verificar seu vínculo Bungie agora. Tente novamente.", ephemeral=True
            )
            return

        if linked_user is None:
            async def continue_grade(linked_interaction: discord.Interaction) -> None:
                if integrantes is None or inicio is None:
                    await self._ask_to_retry_grade(linked_interaction)
                    return
                await self.save(
                    linked_interaction, atividade, integrantes, inicio, descricao or "",
                    curated_bungie_activity_id, novatos,
                )

            await interaction.response.send_modal(BungieNameModal(
                session_factory=self._session_factory,
                api_key=self._bungie_api_key,
                continuation=continue_grade,
            ))
            return

        if integrantes is None or inicio is None:
            await interaction.response.send_modal(
                ActivityModal(
                    self.save,
                    atividade=atividade,
                    integrantes=integrantes,
                    inicio=inicio,
                    descricao=descricao,
                    rookie_limit=novatos,
                    curated_bungie_activity_id=curated_bungie_activity_id,
                )
            )
            return

        await self.save(
            interaction,
            atividade,
            integrantes,
            inicio,
            descricao or "",
            curated_bungie_activity_id,
            novatos,
        )

    @staticmethod
    async def _ask_to_retry_grade(interaction: discord.Interaction) -> None:
        """Tell the user to reopen the command after linking their Bungie account."""
        await interaction.followup.send(
            "Bungie Name vinculado. Execute `/orla grade` novamente para abrir o formulário da grade.",
            ephemeral=True,
        )

    async def save(
        self,
        interaction: discord.Interaction,
        atividade: str,
        integrantes: int,
        inicio: str,
        descricao: str,
        curated_bungie_activity_id: int | None = None,
        rookie_limit: int | None = None,
    ) -> None:
        """Validate input, persist the activity, and respond to the interaction."""
        requires_bungie = curated_bungie_activity_id is not None
        logger.info(
            "Grade save started curated_activity_id=%s activity_source=%s",
            curated_bungie_activity_id,
            "catalog" if curated_bungie_activity_id is not None else "free_text",
        )
        if curated_bungie_activity_id is not None:
            try:
                async with self._session_factory() as session:
                    linked = await session.get(User, interaction.user.id)
                    catalog_activity = await session.get(
                        CuratedBungieActivity, curated_bungie_activity_id
                    )
            except SQLAlchemyError:
                logger.exception("Could not verify Bungie identity before activity creation")
                message = "Não consegui verificar seu vínculo Bungie agora. Tente novamente."
                if interaction.response.is_done():
                    await interaction.followup.send(message, ephemeral=True)
                else:
                    await interaction.response.send_message(message, ephemeral=True)
                return
            if catalog_activity is not None:
                requires_bungie = catalog_activity.eligibility_group != "orla:0"
                logger.info(
                    "Grade progress decision curated_activity_id=%d group=%s requires_bungie=%s linked=%s",
                    curated_bungie_activity_id,
                    catalog_activity.eligibility_group,
                    requires_bungie,
                    linked is not None,
                )
            else:
                logger.warning(
                    "Grade save references missing curated activity curated_activity_id=%d",
                    curated_bungie_activity_id,
                )

        if not interaction.response.is_done():
            await interaction.response.defer(ephemeral=True, thinking=True)
        try:
            starts_at = parse_activity_start(inicio, self._timezone_name)
            validate_activity_start(starts_at)
        except ActivityInputError as exc:
            await interaction.followup.send(str(exc), ephemeral=True)
            return

        progress_warning: str | None = None
        creator_is_rookie: bool | None = None
        if curated_bungie_activity_id is not None and requires_bungie:
            try:
                async with self._session_factory() as session:
                    async with BungieClient(self._bungie_api_key) as client:
                        counts = await sync_player_activities(
                            session,
                            client,
                            interaction.user.id,
                            curated_bungie_activity_id,
                        )
                    await session.commit()
                    creator_is_rookie = skill_for_clears(sum(counts.values())) == "rookie"
                    logger.info(
                        "Bungie progress committed for grade creation curated_activity_id=%d "
                        "variants=%d total_clears=%d",
                        curated_bungie_activity_id,
                        len(counts),
                        sum(counts.values()),
                    )
            except BungieApiError as exc:
                logger.warning(
                    "Bungie progress refresh failed before activity creation curated_activity_id=%d: %s",
                    curated_bungie_activity_id,
                    exc,
                )
                progress_warning = (
                    " Não consegui verificar seu histórico Bungie; você entrou como substituto."
                    if rookie_limit is not None
                    else " Não consegui verificar seu histórico Bungie; nenhum dado novo de progressão foi salvo."
                )
            except SQLAlchemyError:
                logger.exception("Database failure while refreshing Bungie progress before activity creation")
                progress_warning = (
                    " Não consegui verificar seu histórico Bungie; você entrou como substituto."
                    if rookie_limit is not None
                    else " Não consegui atualizar seus dados de progressão Bungie; a grade foi criada sem essa atualização."
                )
        elif curated_bungie_activity_id is None:
            logger.info("Grade Bungie progress sync skipped reason=free_text_activity")
            creator_is_rookie = None
        else:
            logger.info(
                "Grade Bungie progress sync skipped curated_activity_id=%d reason=activity_not_tracked",
                curated_bungie_activity_id,
            )
            creator_is_rookie = None

        try:
            async with self._session_factory() as session:
                async with session.begin():
                    activity = await create_activity(
                        session,
                        name=atividade,
                        capacity=integrantes,
                        starts_at=starts_at,
                        description=descricao,
                        creator_id=interaction.user.id,
                        channel_id=interaction.channel_id,
                        curated_bungie_activity_id=curated_bungie_activity_id,
                        rookie_limit=rookie_limit,
                        creator_is_rookie=creator_is_rookie,
                        rookie_limit_applicable=(curated_bungie_activity_id is not None and requires_bungie),
                    )
                    activity_id = activity.id
            logger.info(
                "Grade saved activity_id=%d curated_activity_id=%s",
                activity_id,
                curated_bungie_activity_id,
            )
        except ActivityInputError as exc:
            await interaction.followup.send(str(exc), ephemeral=True)
            return
        except SQLAlchemyError:
            logger.exception("Database failure while saving a Discord activity")
            await interaction.followup.send(
                "Não foi possível salvar a atividade agora. Tente novamente mais tarde.",
                ephemeral=True,
            )
            return

        try:
            async with self._session_factory() as session:
                activity, participants, bungie_names, skills = await get_roster(session, activity_id)
                channel = interaction.channel
                if channel is None:
                    await interaction.followup.send(
                        f"A atividade foi salva (#{activity_id}), mas não encontrei o canal para publicá-la.",
                        ephemeral=True,
                    )
                    return
                view = ActivityView(activity_id, self._session_factory, self._timezone_name, self._bungie_api_key)
                message = await channel.send(
                    embed=render_activity(activity, participants, self._timezone_name, bungie_names, skills),
                    view=view,
                    file=activity_image_file(),
                )
            async with self._session_factory() as session:
                async with session.begin():
                    await session.execute(
                        update(Activity)
                        .where(Activity.id == activity_id)
                        .values(discord_message_id=message.id)
                    )
            await interaction.followup.send(
                f"Atividade **{atividade.strip()}** publicada (#{activity_id}).{progress_warning or ''}",
                ephemeral=True,
            )
        except (discord.HTTPException, SQLAlchemyError):
            logger.exception("Could not publish the Discord activity message")
            await interaction.followup.send(
                f"A atividade foi salva (#{activity_id}), mas não consegui publicar a mensagem com os botões. Peça a um administrador para verificar.",
                ephemeral=True,
            )

