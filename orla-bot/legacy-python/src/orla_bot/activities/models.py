"""Database model for Discord activities."""

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from orla_bot.persistence.types import UTCDateTime


class Base(DeclarativeBase):
    """SQLAlchemy metadata root."""


class Activity(Base):
    """A scheduled clan activity created through Discord."""

    __tablename__ = "activities"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 80", name="ck_activities_name_length"),
        CheckConstraint("capacity BETWEEN 1 AND 99", name="ck_activities_capacity_range"),
        CheckConstraint("rookie_limit IS NULL OR rookie_limit BETWEEN 0 AND capacity", name="ck_activities_rookie_limit"),
        CheckConstraint("length(description) <= 250", name="ck_activities_description_length"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    curated_bungie_activity_id: Mapped[int | None] = mapped_column(
        ForeignKey("curated_bungie_activities.id", ondelete="SET NULL"), nullable=True
    )
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    rookie_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by_discord_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
    discord_channel_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    discord_message_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


class ActivityParticipant(Base):
    """A Discord user enrolled as titular or reserve in an activity."""

    __tablename__ = "activity_participants"
    __table_args__ = (
        UniqueConstraint("activity_id", "discord_user_id", name="uq_activity_participants_user"),
        CheckConstraint("category IN ('titular', 'substituto', 'reserva')", name="ck_activity_participants_category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), nullable=False)
    discord_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    category: Mapped[str] = mapped_column(String(10), nullable=False)
    is_rookie: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
