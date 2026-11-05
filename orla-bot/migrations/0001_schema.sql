-- Orla Bot · esquema inicial no D1 `orla` (portado do Alembic 1.0 do bot em Python).
-- Datas ficam em texto ISO-8601 UTC (ex.: 2026-11-05T18:00:00.000Z).

CREATE TABLE IF NOT EXISTS users (
  discord_user_id TEXT PRIMARY KEY,
  discord_member_name TEXT,
  bungie_membership_id TEXT NOT NULL,
  bungie_membership_type INTEGER NOT NULL,
  bungie_name TEXT NOT NULL,
  linked_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_users_bungie ON users (bungie_membership_id);

CREATE TABLE IF NOT EXISTS bungie_activities (
  bungie_id INTEGER PRIMARY KEY,
  bungie_name TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  eligibility_group TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_bungie_activities_eligibility_group ON bungie_activities (eligibility_group);

CREATE TABLE IF NOT EXISTS curated_bungie_activities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  eligibility_group TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_curated_bungie_activities_eligibility_group ON curated_bungie_activities (eligibility_group);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  curated_bungie_activity_id INTEGER REFERENCES curated_bungie_activities (id) ON DELETE SET NULL,
  capacity INTEGER NOT NULL,
  rookie_limit INTEGER,
  starts_at TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by_discord_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  discord_channel_id TEXT,
  discord_message_id TEXT,
  CHECK (length(name) BETWEEN 1 AND 80),
  CHECK (capacity BETWEEN 1 AND 99),
  CHECK (rookie_limit IS NULL OR rookie_limit BETWEEN 0 AND capacity),
  CHECK (length(description) <= 250)
);
CREATE INDEX IF NOT EXISTS ix_activities_message ON activities (discord_message_id);
CREATE INDEX IF NOT EXISTS ix_activities_starts ON activities (starts_at);

CREATE TABLE IF NOT EXISTS activity_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('titular', 'substituto', 'reserva')),
  is_rookie INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE (activity_id, discord_user_id)
);

CREATE TABLE IF NOT EXISTS player_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_discord_id TEXT NOT NULL REFERENCES users (discord_user_id) ON DELETE CASCADE,
  activity_bungie_id INTEGER NOT NULL REFERENCES bungie_activities (bungie_id) ON DELETE CASCADE,
  clear_count INTEGER NOT NULL CHECK (clear_count >= 0),
  skill TEXT NOT NULL CHECK (skill IN ('rookie', 'veteran', 'master')),
  checked_at TEXT NOT NULL,
  UNIQUE (user_discord_id, activity_bungie_id)
);

-- Dados da grade que esperam o vínculo Bungie (modal) terminar; limpos pelo cron.
CREATE TABLE IF NOT EXISTS pending_grades (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
