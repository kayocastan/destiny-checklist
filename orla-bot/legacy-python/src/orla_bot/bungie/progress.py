"""Synchronize cached per-player activity clear counts and skill levels."""

import logging
from datetime import UTC, datetime
from time import monotonic

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from orla_bot.bungie import BungieApiError, BungieClient, BungieMembership
from orla_bot.models.bungie import (
    BungieActivity,
    CuratedBungieActivity,
    PlayerActivity,
    User,
)

logger = logging.getLogger(__name__)


def skill_for_clears(clear_count: int) -> str:
    """Map a clear count to the configured rookie/veteran/master bands."""
    if clear_count < 5:
        return "rookie"
    if clear_count <= 10:
        return "veteran"
    return "master"


async def upsert_bungie_user(
    session: AsyncSession,
    discord_user_id: int,
    discord_member_name: str,
    membership: BungieMembership,
) -> None:
    """Create or refresh a Discord-to-Bungie identity link."""
    user = await session.get(User, discord_user_id)
    if user is None:
        session.add(User(
            discord_user_id=discord_user_id,
            discord_member_name=discord_member_name,
            bungie_membership_id=membership.membership_id,
            bungie_membership_type=membership.membership_type,
            bungie_name=membership.bungie_name,
        ))
    else:
        user.discord_member_name = discord_member_name
        user.bungie_membership_id = membership.membership_id
        user.bungie_membership_type = membership.membership_type
        user.bungie_name = membership.bungie_name
    await session.flush()


async def sync_player_activities(
    session: AsyncSession,
    client: BungieClient,
    discord_user_id: int,
    curated_activity_id: int,
) -> dict[int, int]:
    """Refresh one activity group's variant clears and derive its skill band."""
    started_at = monotonic()
    logger.info("Bungie progress sync started curated_activity_id=%d", curated_activity_id)
    user = await session.get(User, discord_user_id)
    if user is None:
        logger.warning(
            "Bungie progress sync skipped: no linked identity curated_activity_id=%d",
            curated_activity_id,
        )
        raise BungieApiError("Vincule seu Bungie Name antes de continuar.")
    existing = list((await session.scalars(
        select(PlayerActivity).where(PlayerActivity.user_discord_id == discord_user_id)
    )).all())
    tracked_by_hash = {row.activity_bungie_id: row for row in existing}
    selected_activity = await session.get(CuratedBungieActivity, curated_activity_id)
    if selected_activity is None:
        logger.warning(
            "Bungie progress sync failed: curated activity missing curated_activity_id=%d",
            curated_activity_id,
        )
        raise BungieApiError("Essa atividade não está mais no catálogo curado.")
    activities = list((await session.scalars(
        select(BungieActivity).where(
            BungieActivity.eligibility_group == selected_activity.eligibility_group
        )
    )).all())
    activity_hashes = {activity.bungie_id for activity in activities}
    if not activity_hashes:
        logger.warning(
            "Bungie progress sync failed: no raw activity definitions curated_activity_id=%d group=%s",
            curated_activity_id,
            selected_activity.eligibility_group,
        )
        raise BungieApiError("O catálogo de atividades está vazio. Atualize-o antes de se inscrever.")

    activity_type = selected_activity.type.casefold()
    if "raid" in activity_type:
        mode = 4
    elif "dungeon" in activity_type:
        mode = 82
    else:
        raise BungieApiError(
            "O histórico só pode ser consultado para atividades classificadas como Raid ou Dungeon."
        )

    membership = BungieMembership(
        membership_id=user.bungie_membership_id,
        membership_type=user.bungie_membership_type,
        bungie_name=user.bungie_name,
    )
    logger.info(
        "Requesting Bungie progress curated_activity_id=%d group=%s mode=%d variants=%d",
        curated_activity_id,
        selected_activity.eligibility_group,
        mode,
        len(activity_hashes),
    )
    counts = await client.get_clear_counts(membership, activity_hashes, mode)
    observed_groups = {
        activity.eligibility_group
        for activity in activities
        if activity.bungie_id in counts
    }
    if selected_activity.eligibility_group not in observed_groups:
        logger.warning(
            "Bungie returned no matching activity data curated_activity_id=%d group=%s variants=%d",
            curated_activity_id,
            selected_activity.eligibility_group,
            len(activity_hashes),
        )
        raise BungieApiError(
            "A Bungie não retornou dados suficientes para classificar essa atividade."
        )
    counts_by_group: dict[str, int] = {}
    for activity in activities:
        if activity.eligibility_group not in observed_groups:
            continue
        counts_by_group[activity.eligibility_group] = (
            counts_by_group.get(activity.eligibility_group, 0)
            + counts.get(activity.bungie_id, 0)
        )
    skills_by_group = {
        group: skill_for_clears(count)
        for group, count in counts_by_group.items()
    }
    total_clears = counts_by_group[selected_activity.eligibility_group]
    hashes_to_store = {
        activity_hash
        for activity_hash in activity_hashes
        if counts.get(activity_hash, 0) > 0
    }
    if not hashes_to_store:
        # Keep one row to represent a verified zero-clear result for this group.
        hashes_to_store.add(min(activity_hashes))

    checked_at = datetime.now(UTC)
    results: dict[int, int] = {}
    inserted_count = 0
    updated_count = 0
    deleted_zero_count = 0
    for activity in activities:
        if activity.eligibility_group not in observed_groups:
            continue
        activity_hash = activity.bungie_id
        count = counts.get(activity_hash, 0)
        row = tracked_by_hash.get(activity_hash)
        if activity_hash not in hashes_to_store:
            if row is not None:
                await session.delete(row)
                deleted_zero_count += 1
            continue
        skill = skills_by_group[activity.eligibility_group]
        if row is None:
            row = PlayerActivity(
                user_discord_id=discord_user_id,
                activity_bungie_id=activity_hash,
                clear_count=count,
                skill=skill,
                checked_at=checked_at,
            )
            session.add(row)
            inserted_count += 1
        else:
            row.clear_count = count
            row.skill = skill
            row.checked_at = checked_at
            updated_count += 1
        results[activity_hash] = count
    await session.flush()
    logger.info(
        "Bungie progress rows flushed curated_activity_id=%d group=%s variants=%d "
        "nonzero_variants=%d total_clears=%d inserted=%d updated=%d deleted_zero=%d elapsed_ms=%d",
        curated_activity_id,
        selected_activity.eligibility_group,
        len(hashes_to_store),
        sum(counts.get(activity_hash, 0) > 0 for activity_hash in hashes_to_store),
        total_clears,
        inserted_count,
        updated_count,
        deleted_zero_count,
        int((monotonic() - started_at) * 1000),
    )
    return results
