"""Transactional enrollment operations for activity messages."""

from datetime import UTC, datetime
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from orla_bot.activities.models import Activity, ActivityParticipant
from orla_bot.models.bungie import BungieActivity, CuratedBungieActivity, PlayerActivity, User


class SignupError(ValueError):
    """An enrollment action cannot be applied."""


@dataclass(frozen=True)
class SignupRemoval:
    """Outcome of leaving an activity, including whether its message must be deleted."""

    message: str
    activity_deleted: bool = False
    discord_message_id: int | None = None


async def enroll(
    session: AsyncSession,
    activity_id: int,
    user_id: int,
    category: str,
    *,
    is_rookie: bool | None = None,
    rookie_limit_applicable: bool = True,
) -> str:
    """Add a user to an activity, enforcing capacity under an activity row lock."""
    if category not in {"titular", "reserva"}:
        raise ValueError("Invalid participant category")
    activity = await session.scalar(
        select(Activity).where(Activity.id == activity_id).with_for_update()
    )
    if activity is None:
        raise SignupError("Essa atividade não está mais disponível.")
    participant = await session.scalar(
        select(ActivityParticipant).where(
            ActivityParticipant.activity_id == activity_id,
            ActivityParticipant.discord_user_id == user_id,
        )
    )
    actual_category = category
    classification_unavailable = False
    if category == "titular":
        if participant is not None and participant.category == "titular":
            if is_rookie is not None:
                participant.is_rookie = is_rookie
            return "Você já está como integrante titular."
        titular_count = await session.scalar(
            select(func.count()).select_from(ActivityParticipant).where(
                ActivityParticipant.activity_id == activity_id,
                ActivityParticipant.category == "titular",
            )
        )
        rookie_limit_full = False
        if activity.rookie_limit is not None and rookie_limit_applicable and is_rookie is None:
            classification_unavailable = True
            actual_category = "substituto"
        elif is_rookie is True and activity.rookie_limit is not None and rookie_limit_applicable:
            rookie_count = await session.scalar(
                select(func.count()).select_from(ActivityParticipant).where(
                    ActivityParticipant.activity_id == activity_id,
                    ActivityParticipant.category == "titular",
                    ActivityParticipant.is_rookie.is_(True),
                )
            )
            rookie_limit_full = int(rookie_count or 0) >= activity.rookie_limit
            if rookie_limit_full:
                actual_category = "substituto"
        if int(titular_count or 0) >= activity.capacity:
            actual_category = "substituto"
            if participant is not None and participant.category == "substituto":
                return "Você já está na fila de substitutos e mantém sua posição."
        elif rookie_limit_full and participant is not None and participant.category == "substituto":
            return "Você já está na fila de substitutos e mantém sua posição."
    if participant is None:
        session.add(ActivityParticipant(
            activity_id=activity_id,
            discord_user_id=user_id,
            category=actual_category,
            is_rookie=is_rookie,
            created_at=datetime.now(UTC),
        ))
    else:
        was_titular = participant.category == "titular"
        participant.category = actual_category
        participant.is_rookie = is_rookie
        participant.created_at = datetime.now(UTC)
        if was_titular and actual_category != "titular":
            promoted = await _promote_oldest_substitute(session, activity_id)
            if promoted is not None:
                return f"Inscrição atualizada; <@{promoted.discord_user_id}> foi promovido a titular."
    if actual_category == "substituto":
        if classification_unavailable:
            return "Não foi possível verificar se você é novato; você entrou na fila de substitutos e será promovido quando abrir uma vaga."
        if rookie_limit_full and int(titular_count or 0) < activity.capacity:
            return "O limite de novatos da grade foi preenchido. Você entrou na fila de substitutos e será promovido quando abrir uma vaga."
        return "Você entrou na fila de substitutos. Ao abrir uma vaga, será promovido automaticamente."
    if actual_category == "reserva":
        return "Você entrou na lista de reservas. Essa lista não preenche vagas automaticamente."
    return "Inscrição atualizada como titular."


async def remove_signup(session: AsyncSession, activity_id: int, user_id: int) -> SignupRemoval:
    """Remove a user, delete an empty creator-owned activity, or promote a substitute."""
    activity = await session.scalar(
        select(Activity).where(Activity.id == activity_id).with_for_update()
    )
    if activity is None:
        raise SignupError("Essa atividade não está mais disponível.")

    participant = await session.scalar(
        select(ActivityParticipant).where(
            ActivityParticipant.activity_id == activity_id,
            ActivityParticipant.discord_user_id == user_id,
        )
    )
    if participant is None:
        return SignupRemoval("Você não está inscrito nessa atividade.")

    was_titular = participant.category == "titular"
    await session.delete(participant)
    if activity.created_by_discord_id == user_id:
        remaining_count = await session.scalar(
            select(func.count()).select_from(ActivityParticipant).where(
                ActivityParticipant.activity_id == activity_id,
            )
        )
        if int(remaining_count or 0) == 0:
            message_id = activity.discord_message_id
            await session.delete(activity)
            return SignupRemoval(
                "Você saiu e, como não havia outros participantes, a grade foi excluída.",
                activity_deleted=True,
                discord_message_id=message_id,
            )
    if not was_titular:
        return SignupRemoval("Inscrição removida.")

    next_substitute = await _promote_oldest_substitute(session, activity_id)
    if next_substitute is None:
        return SignupRemoval("Inscrição removida. Não havia substituto para promover.")
    return SignupRemoval(
        f"Inscrição removida; <@{next_substitute.discord_user_id}> foi promovido da fila de substitutos."
    )


async def _promote_oldest_substitute(
    session: AsyncSession, activity_id: int
) -> ActivityParticipant | None:
    """Promote the earliest substitute without touching manual reserves."""
    next_substitute = await session.scalar(
        select(ActivityParticipant)
        .where(
            ActivityParticipant.activity_id == activity_id,
            ActivityParticipant.category == "substituto",
        )
        .order_by(ActivityParticipant.created_at, ActivityParticipant.id)
        .with_for_update()
        .limit(1)
    )
    if next_substitute is not None:
        next_substitute.category = "titular"
    return next_substitute


async def get_roster(
    session: AsyncSession, activity_id: int
) -> tuple[Activity, list[ActivityParticipant], dict[int, str], dict[int, str]]:
    """Return activity, ordered participants, linked Bungie names, and skill levels."""
    activity = await session.get(Activity, activity_id)
    if activity is None:
        raise SignupError("Essa atividade não está mais disponível.")
    participants = list((await session.scalars(
        select(ActivityParticipant)
        .where(ActivityParticipant.activity_id == activity_id)
        .order_by(ActivityParticipant.category, ActivityParticipant.created_at, ActivityParticipant.id)
    )).all())
    participant_ids = [participant.discord_user_id for participant in participants]
    bungie_names = dict((await session.execute(
        select(User.discord_user_id, User.bungie_name).where(User.discord_user_id.in_(participant_ids))
    )).all()) if participant_ids else {}
    skills: dict[int, str] = {}
    if participant_ids and activity.curated_bungie_activity_id is not None:
        eligibility_group = await session.scalar(
            select(CuratedBungieActivity.eligibility_group).where(
                CuratedBungieActivity.id == activity.curated_bungie_activity_id
            )
        )
        if eligibility_group is not None:
            skills = dict((await session.execute(
                select(PlayerActivity.user_discord_id, PlayerActivity.skill)
                .join(BungieActivity, BungieActivity.bungie_id == PlayerActivity.activity_bungie_id)
                .where(
                    PlayerActivity.user_discord_id.in_(participant_ids),
                    BungieActivity.eligibility_group == eligibility_group,
                )
            )).all())
            for participant_id in participant_ids:
                skills.setdefault(participant_id, "unknown")
    return activity, participants, bungie_names, skills
