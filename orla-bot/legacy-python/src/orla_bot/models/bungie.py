"""Persistence models for linked Bungie profiles and activity experience."""

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from orla_bot.activities.models import Base
from orla_bot.persistence.types import UTCDateTime

class User(Base):
    """A Discord member linked to a Bungie Destiny membership."""

    __tablename__ = "users"

    discord_user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    discord_member_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bungie_membership_id: Mapped[str] = mapped_column(String(32), nullable=False)
    bungie_membership_type: Mapped[int] = mapped_column(Integer, nullable=False)
    bungie_name: Mapped[str] = mapped_column(String(80), nullable=False)


class BungieActivity(Base):
    """A Raid or Dungeon definition imported from the Bungie manifest."""

    __tablename__ = "bungie_activities"
    __table_args__ = (
        Index("ix_bungie_activities_eligibility_group", "eligibility_group"),
    )

    bungie_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    bungie_name: Mapped[str] = mapped_column(String(200), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    eligibility_group: Mapped[str] = mapped_column(String(100), nullable=False)


class CuratedBungieActivity(Base):
    """A curated activity choice shown to users when creating a grade."""

    __tablename__ = "curated_bungie_activities"
    __table_args__ = (
        Index("ix_curated_bungie_activities_eligibility_group", "eligibility_group"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    eligibility_group: Mapped[str] = mapped_column(String(100), nullable=False)


class PlayerActivity(Base):
    """Cached clear count and derived skill for one user and one activity."""

    __tablename__ = "player_activities"
    __table_args__ = (
        UniqueConstraint("user_discord_id", "activity_bungie_id", name="uq_player_activity_user_activity"),
        CheckConstraint("clear_count >= 0", name="ck_player_activity_clear_count"),
        CheckConstraint("skill IN ('rookie', 'veteran', 'master')", name="ck_player_activity_skill"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_discord_id: Mapped[int] = mapped_column(
        ForeignKey("users.discord_user_id", ondelete="CASCADE"), nullable=False
    )
    activity_bungie_id: Mapped[int] = mapped_column(
        ForeignKey("bungie_activities.bungie_id", ondelete="CASCADE"), nullable=False
    )
    clear_count: Mapped[int] = mapped_column(Integer, nullable=False)
    skill: Mapped[str] = mapped_column(String(10), nullable=False)
    checked_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
