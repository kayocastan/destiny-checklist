"""Initial production schema, version 1.0.

Revision ID: 1.0
Revises:
Create Date: 2026-10-24
"""

from alembic import op
import sqlalchemy as sa

revision = "1.0"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("discord_user_id", sa.BigInteger(), primary_key=True),
        sa.Column("discord_member_name", sa.String(100), nullable=True),
        sa.Column("bungie_membership_id", sa.String(32), nullable=False),
        sa.Column("bungie_membership_type", sa.Integer(), nullable=False),
        sa.Column("bungie_name", sa.String(80), nullable=False),
    )
    op.create_table(
        "bungie_activities",
        sa.Column("bungie_id", sa.BigInteger(), primary_key=True),
        sa.Column("bungie_name", sa.String(200), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("type", sa.String(100), nullable=False),
        sa.Column("eligibility_group", sa.String(100), nullable=False),
    )
    op.create_index("ix_bungie_activities_eligibility_group", "bungie_activities", ["eligibility_group"])
    op.create_table(
        "curated_bungie_activities",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("type", sa.String(100), nullable=False),
        sa.Column("eligibility_group", sa.String(100), nullable=False),
    )
    op.create_index("ix_curated_bungie_activities_eligibility_group", "curated_bungie_activities", ["eligibility_group"])
    op.create_table(
        "activities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("curated_bungie_activity_id", sa.BigInteger(), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("rookie_limit", sa.Integer(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("created_by_discord_id", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("discord_channel_id", sa.BigInteger(), nullable=True),
        sa.Column("discord_message_id", sa.BigInteger(), nullable=True),
        sa.CheckConstraint("length(name) BETWEEN 1 AND 80", name="ck_activities_name_length"),
        sa.CheckConstraint("capacity BETWEEN 1 AND 99", name="ck_activities_capacity_range"),
        sa.CheckConstraint("rookie_limit IS NULL OR rookie_limit BETWEEN 0 AND capacity", name="ck_activities_rookie_limit"),
        sa.CheckConstraint("length(description) <= 250", name="ck_activities_description_length"),
        sa.ForeignKeyConstraint(["curated_bungie_activity_id"], ["curated_bungie_activities.id"], name="fk_activities_curated_bungie_id_curated_activities", ondelete="SET NULL"),
    )
    op.create_table(
        "activity_participants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("activity_id", sa.Integer(), nullable=False),
        sa.Column("discord_user_id", sa.BigInteger(), nullable=False),
        sa.Column("category", sa.String(10), nullable=False),
        sa.Column("is_rookie", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("category IN ('titular', 'substituto', 'reserva')", name="ck_activity_participants_category"),
        sa.UniqueConstraint("activity_id", "discord_user_id", name="uq_activity_participants_user"),
        sa.ForeignKeyConstraint(["activity_id"], ["activities.id"], ondelete="CASCADE"),
    )
    op.create_table(
        "player_activities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_discord_id", sa.BigInteger(), nullable=False),
        sa.Column("activity_bungie_id", sa.BigInteger(), nullable=False),
        sa.Column("clear_count", sa.Integer(), nullable=False),
        sa.Column("skill", sa.String(10), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("clear_count >= 0", name="ck_player_activity_clear_count"),
        sa.CheckConstraint("skill IN ('rookie', 'veteran', 'master')", name="ck_player_activity_skill"),
        sa.UniqueConstraint("user_discord_id", "activity_bungie_id", name="uq_player_activity_user_activity"),
        sa.ForeignKeyConstraint(["user_discord_id"], ["users.discord_user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["activity_bungie_id"], ["bungie_activities.bungie_id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("player_activities")
    op.drop_table("activity_participants")
    op.drop_table("activities")
    op.drop_index("ix_curated_bungie_activities_eligibility_group", table_name="curated_bungie_activities")
    op.drop_table("curated_bungie_activities")
    op.drop_index("ix_bungie_activities_eligibility_group", table_name="bungie_activities")
    op.drop_table("bungie_activities")
    op.drop_table("users")
