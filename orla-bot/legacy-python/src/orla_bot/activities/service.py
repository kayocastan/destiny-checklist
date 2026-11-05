"""Activity input validation and persistence."""

import re
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from orla_bot.activities.models import Activity, ActivityParticipant


class ActivityInputError(ValueError):
    """User-provided activity data is invalid."""


_LOCAL_START_PATTERNS = (
    (re.compile(r"^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$"), (0, 1, 2, 3, 4)),
    (re.compile(r"^(\d{2})/(\d{2})/(\d{4}) (\d{2}):(\d{2})$"), (2, 1, 0, 3, 4)),
    (re.compile(r"^(\d{2})/(\d{2})/(\d{2}) (\d{2}):(\d{2})$"), (2, 1, 0, 3, 4)),
)


def parse_activity_start(value: str, timezone_name: str = "America/Sao_Paulo") -> datetime:
    """Parse supported local formats or ISO-8601 with offset, returning UTC."""
    normalized_value = value.strip()
    for pattern, indexes in _LOCAL_START_PATTERNS:
        match = pattern.fullmatch(normalized_value)
        if match is None:
            continue
        values = [int(part) for part in match.groups()]
        year = values[indexes[0]]
        if len(match.group(indexes[0] + 1)) == 2:
            year += 2000 if year <= 68 else 1900
        try:
            local_time = datetime(
                year,
                values[indexes[1]],
                values[indexes[2]],
                values[indexes[3]],
                values[indexes[4]],
            )
        except ValueError as exc:
            raise ActivityInputError("A data ou hora informada não é válida.") from exc
        timezone = ZoneInfo(timezone_name)
        first = local_time.replace(tzinfo=timezone, fold=0)
        second = local_time.replace(tzinfo=timezone, fold=1)
        first_round_trip = first.astimezone(UTC).astimezone(timezone).replace(tzinfo=None)
        second_round_trip = second.astimezone(UTC).astimezone(timezone).replace(tzinfo=None)
        if first_round_trip != local_time and second_round_trip != local_time:
            raise ActivityInputError("Esse horário local não existe por causa da mudança de fuso horário.")
        if first.utcoffset() != second.utcoffset() and first_round_trip == local_time and second_round_trip == local_time:
            raise ActivityInputError("Esse horário é ambíguo no fuso local; informe a data em ISO 8601 com deslocamento UTC.")
        return first.astimezone(UTC)

    try:
        parsed = datetime.fromisoformat(normalized_value)
    except ValueError as exc:
        raise ActivityInputError(
            "Use o formato DD/mm/YY HH:MM."
        ) from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ActivityInputError(
            "Formato de início inválido. Use um dos formatos informados ou ISO 8601 com fuso explícito."
        )
    return parsed.astimezone(UTC)


def validate_activity_input(name: str, capacity: int, starts_at: datetime, description: str, rookie_limit: int | None = None) -> str:
    """Validate user-supplied values and return the trimmed activity name."""
    normalized_name = name.strip()
    if not normalized_name or len(normalized_name) > 80:
        raise ActivityInputError("Atividade deve conter de 1 a 80 caracteres.")
    if not 1 <= capacity <= 99:
        raise ActivityInputError("Integrantes deve ser um número entre 1 e 99.")
    if rookie_limit is not None and not 0 <= rookie_limit <= capacity:
        raise ActivityInputError("A quantidade de novatos deve ser 0 ou um número entre 1 e a quantidade de integrantes.")
    if len(description) > 250:
        raise ActivityInputError("Descrição deve ter no máximo 250 caracteres.")
    if starts_at.tzinfo is None or starts_at.utcoffset() is None:
        raise ActivityInputError("Início precisa incluir um fuso horário.")
    return normalized_name


def validate_activity_start(starts_at: datetime) -> None:
    """Reject activity start times that are not in the future."""
    if starts_at.tzinfo is None or starts_at.utcoffset() is None:
        raise ActivityInputError("Início precisa incluir um fuso horário.")
    if starts_at.astimezone(UTC) <= datetime.now(UTC):
        raise ActivityInputError(
            "A data e hora de início precisam ser futuras; não é possível criar uma atividade no passado."
        )


async def create_activity(
    session: AsyncSession,
    *,
    name: str,
    capacity: int,
    starts_at: datetime,
    description: str,
    creator_id: int,
    channel_id: int | None = None,
    curated_bungie_activity_id: int | None = None,
    rookie_limit: int | None = None,
    creator_is_rookie: bool | None = None,
    rookie_limit_applicable: bool = True,
) -> Activity:
    """Validate and persist an activity in the caller's transaction."""
    normalized_name = validate_activity_input(name, capacity, starts_at, description, rookie_limit)
    validate_activity_start(starts_at)

    activity = Activity(
        name=normalized_name,
        curated_bungie_activity_id=curated_bungie_activity_id,
        capacity=capacity,
        rookie_limit=rookie_limit,
        starts_at=starts_at.astimezone(UTC),
        description=description,
        created_by_discord_id=creator_id,
        created_at=datetime.now(UTC),
        discord_channel_id=channel_id,
    )
    session.add(activity)
    await session.flush()
    session.add(ActivityParticipant(
        activity_id=activity.id,
        discord_user_id=creator_id,
        category=(
            "substituto"
            if rookie_limit_applicable and rookie_limit is not None and creator_is_rookie is None
            or rookie_limit_applicable and creator_is_rookie is True and rookie_limit == 0
            else "titular"
        ),
        is_rookie=creator_is_rookie,
        created_at=activity.created_at,
    ))
    await session.flush()
    return activity
