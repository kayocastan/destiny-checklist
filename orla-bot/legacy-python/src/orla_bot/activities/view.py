"""Persistent buttons and embed rendering for activity enrollment."""

import logging
from pathlib import Path
from zoneinfo import ZoneInfo

import discord
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from orla_bot.activities.models import Activity, ActivityParticipant
from orla_bot.activities.signups import SignupError, enroll, get_roster, remove_signup
from orla_bot.bungie import BungieApiError, BungieClient
from orla_bot.bungie.progress import skill_for_clears, sync_player_activities
from orla_bot.models.bungie import CuratedBungieActivity, User
from orla_bot.models.bungie_name_modal import BungieNameModal

logger = logging.getLogger(__name__)
ACTIVITY_IMAGE_PATH = Path(__file__).resolve().parents[3] / "assets" / "orla-bot-hero.png"
ACTIVITY_IMAGE_NAME = "orla-bot-hero.png"


def activity_image_file() -> discord.File:
    """Return the image attached to activity embeds."""
    return discord.File(ACTIVITY_IMAGE_PATH, filename=ACTIVITY_IMAGE_NAME)


class ActivityView(discord.ui.View):
    """Persistent enrollment controls for one activity."""

    def __init__(
        self,
        activity_id: int,
        session_factory: async_sessionmaker[AsyncSession],
        timezone_name: str = "America/Sao_Paulo",
        bungie_api_key: str = "",
    ) -> None:
        super().__init__(timeout=None)
        self.activity_id = activity_id
        self.session_factory = session_factory
        self.timezone_name = timezone_name
        self.bungie_api_key = bungie_api_key

    @discord.ui.button(
        label="",
        emoji=discord.PartialEmoji(name="plus", id=965116109164511333),
        style=discord.ButtonStyle.secondary,
        custom_id="orla:activity:join",
    )
    async def join(self, interaction: discord.Interaction, _button: discord.ui.Button) -> None:
        await self._apply(interaction, "titular")

    @discord.ui.button(
        label="",
        emoji=discord.PartialEmoji(name="minus", id=965116109416181760),
        style=discord.ButtonStyle.secondary,
        custom_id="orla:activity:leave",
    )
    async def leave(self, interaction: discord.Interaction, _button: discord.ui.Button) -> None:
        await self._apply(interaction, None)

    @discord.ui.button(
        label="",
        emoji=discord.PartialEmoji(name="question", id=965116109114183732),
        style=discord.ButtonStyle.secondary,
        custom_id="orla:activity:reserve",
    )
    async def reserve(self, interaction: discord.Interaction, _button: discord.ui.Button) -> None:
        await self._apply(interaction, "reserva")

    async def _apply(self, interaction: discord.Interaction, category: str | None) -> None:
        logger.info(
            "Activity button requested activity_id=%d category=%s",
            self.activity_id,
            category or "leave",
        )
        catalog_activity_id: int | None = None
        requires_bungie = False
        linked = None
        rookie_limit: int | None = None
        is_rookie: bool | None = None
        progress_warning: str | None = None
        if category is not None:
            try:
                async with self.session_factory() as session:
                    linked = await session.get(User, interaction.user.id)
                    activity_record = await session.get(Activity, self.activity_id)
                    if activity_record is not None:
                        catalog_activity_id = activity_record.curated_bungie_activity_id
                        rookie_limit = activity_record.rookie_limit
                    catalog_activity = (
                        await session.get(CuratedBungieActivity, catalog_activity_id)
                        if catalog_activity_id is not None
                        else None
                    )
                    requires_bungie = (
                        catalog_activity_id is not None
                        and (
                            catalog_activity is None
                            or catalog_activity.eligibility_group != "orla:0"
                        )
                    )
                logger.info(
                    "Activity Bungie sync decision activity_id=%d curated_activity_id=%s "
                    "requires_bungie=%s linked=%s api_key_configured=%s",
                    self.activity_id,
                    catalog_activity_id,
                    requires_bungie,
                    linked is not None,
                    bool(self.bungie_api_key),
                )
            except SQLAlchemyError:
                logger.exception("Could not check Bungie linkage before activity enrollment")
                await interaction.response.send_message(
                    "Não consegui verificar seu vínculo Bungie agora. Tente novamente.", ephemeral=True
                )
                return
            if linked is None:
                async def continue_enrollment(linked_interaction: discord.Interaction) -> None:
                    await self._apply(linked_interaction, category)

                await interaction.response.send_modal(BungieNameModal(
                    session_factory=self.session_factory,
                    api_key=self.bungie_api_key,
                    continuation=continue_enrollment,
                ))
                return
            if rookie_limit is None and requires_bungie and linked is None:
                progress_warning = (
                    "Seu Bungie Name não está vinculado; sua inscrição seguirá sem atualizar o histórico."
                )
            elif rookie_limit is None and requires_bungie and not self.bungie_api_key:
                progress_warning = (
                    "A integração Bungie não está configurada; sua inscrição seguirá sem atualizar o histórico."
                )
        if not interaction.response.is_done():
            await interaction.response.defer()
        try:
            if (
                category is not None
                and catalog_activity_id is not None
                and requires_bungie
                and linked is not None
                and self.bungie_api_key
            ):
                try:
                    async with self.session_factory() as session:
                        async with BungieClient(self.bungie_api_key) as client:
                            counts = await sync_player_activities(
                                session,
                                client,
                                interaction.user.id,
                                catalog_activity_id,
                            )
                        is_rookie = skill_for_clears(sum(counts.values())) == "rookie"
                        await session.commit()
                    logger.info(
                        "Bungie progress committed before enrollment activity_id=%d "
                        "curated_activity_id=%d variants=%d total_clears=%d",
                        self.activity_id,
                        catalog_activity_id,
                        len(counts),
                        sum(counts.values()),
                    )
                except BungieApiError as exc:
                    logger.warning("Bungie progress refresh failed before activity enrollment: %s", exc)
                    if rookie_limit is None:
                        progress_warning = "A consulta Bungie falhou; sua inscrição foi mantida sem atualizar o histórico."
                except SQLAlchemyError:
                    logger.exception("Database failure while refreshing Bungie progress before enrollment")
                    if rookie_limit is None:
                        progress_warning = "Não consegui atualizar seu histórico Bungie; sua inscrição foi mantida."
            async with self.session_factory() as session:
                async with session.begin():
                    if category is None:
                        result = await remove_signup(session, self.activity_id, interaction.user.id)
                    else:
                        result = await enroll(
                            session,
                            self.activity_id,
                            interaction.user.id,
                            category,
                            is_rookie=is_rookie,
                            rookie_limit_applicable=(catalog_activity_id is not None and requires_bungie),
                        )
                    if not (category is None and result.activity_deleted):
                        activity, participants, bungie_names, skills = await get_roster(session, self.activity_id)
            if category is not None:
                logger.info(
                    "Activity enrollment saved activity_id=%d category=%s",
                    self.activity_id,
                    category,
                )
            if category is None and result.activity_deleted:
                try:
                    if interaction.message is not None:
                        await interaction.message.delete()
                except discord.HTTPException:
                    await interaction.followup.send(
                        "A grade foi excluída do banco, mas não consegui apagar a mensagem do Discord.",
                        ephemeral=True,
                    )
                    return
                await interaction.followup.send(result.message, ephemeral=True)
                return
            await interaction.edit_original_response(
                embed=render_activity(activity, participants, self.timezone_name, bungie_names, skills),
                view=self,
                attachments=[activity_image_file()],
            )
            if category is None or result != "Inscrição atualizada como titular.":
                confirmation = result.message if category is None else result
                await interaction.followup.send(
                    f"{confirmation}\n{progress_warning}" if progress_warning else confirmation,
                    ephemeral=True,
                )
            elif progress_warning:
                await interaction.followup.send(progress_warning, ephemeral=True)
        except SignupError as exc:
            await interaction.followup.send(str(exc), ephemeral=True)
        except discord.HTTPException:
            logger.exception("Could not update the Discord activity message after enrollment")
            await interaction.followup.send(
                "Sua inscrição foi processada, mas não consegui atualizar a mensagem da grade. "
                "Grades publicadas no layout anterior precisam ser recriadas para usar o embed.",
                ephemeral=True,
            )
        except SQLAlchemyError:
            await interaction.followup.send("Não foi possível atualizar a inscrição agora. Tente novamente.", ephemeral=True)


def render_activity(
    activity: Activity,
    participants: list[ActivityParticipant],
    timezone_name: str = "America/Sao_Paulo",
    bungie_names: dict[int, str] | None = None,
    player_skills: dict[int, str] | None = None,
) -> discord.Embed:
    """Render the activity details and current roster."""
    description = f"_{activity.description}_" if activity.description else "\u200b"
    local_start = activity.starts_at.astimezone(ZoneInfo(timezone_name))
    start_timestamp = int(local_start.timestamp())
    names = bungie_names or {}
    skills = player_skills or {}
    skill_emojis = {"rookie": "👶", "veteran": "🎖️", "master": "🧙‍♂️", "unknown": "⚠"}

    def display_name(participant: ActivityParticipant) -> str:
        bungie_name = names.get(participant.discord_user_id)
        skill_emoji = skill_emojis.get(skills.get(participant.discord_user_id, ""), "❔")
        if bungie_name:
            safe_bungie_name = discord.utils.escape_mentions(discord.utils.escape_markdown(bungie_name))
            name = safe_bungie_name
        else:
            name = ""
        mention = f"<@{participant.discord_user_id}>"
        bungie_id = name or "Bungie ID não vinculado"
        return f"[ {skill_emoji} ] {bungie_id} ( **{mention}** )"

    titular = [display_name(p) for p in participants if p.category == "titular"]
    reserve = [display_name(p) for p in participants if p.category == "reserva"]
    substitutes = [display_name(p) for p in participants if p.category == "substituto"]
    spacer = "\u200b"

    embed = discord.Embed(
        description=(
            f"# {activity.name}\n"
            f"### <t:{start_timestamp}:F> (<t:{start_timestamp}:R>)"
        ),
        color=discord.Color.blurple(),
    )
    embed.set_image(url=f"attachment://{ACTIVITY_IMAGE_NAME}")
    embed.add_field(name=spacer, value="------ ------ ------", inline=False)
    embed.add_field(name=spacer, value=description, inline=False)
    embed.add_field(name=spacer, value="------ ------ ------", inline=False)
    rookie_limit = f" [{activity.rookie_limit}]" if activity.rookie_limit is not None else ""
    embed.add_field(
        name=f"Titulares {sum(p.category == 'titular' for p in participants)}/{activity.capacity}{rookie_limit}",
        value="\n".join(titular) or "-",
        inline=True,
    )
    embed.add_field(
        name=f"Substitutos {len(substitutes)}",
        value="\n".join(substitutes) or "-",
        inline=True,
    )
    embed.add_field(name=spacer, value=spacer, inline=False)
    embed.add_field(name="Reservas", value="\n".join(reserve) or "-", inline=False)
    return embed
