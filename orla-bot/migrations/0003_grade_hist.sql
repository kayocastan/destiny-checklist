-- Histórico resumido das grades (o cron apaga a grade 1 h depois do início; antes disso guarda isto).
-- Usado só pelo painel "Discord do clã" do DPI. Sem descrição e sem mensagem.
CREATE TABLE IF NOT EXISTS grade_hist (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  curated_id INTEGER,
  capacity INTEGER NOT NULL,
  rookie_limit INTEGER,
  starts_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  archived_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_grade_hist_starts ON grade_hist (starts_at);
CREATE TABLE IF NOT EXISTS grade_hist_p (
  activity_id INTEGER NOT NULL,
  discord_user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  is_rookie INTEGER,
  PRIMARY KEY (activity_id, discord_user_id)
);
