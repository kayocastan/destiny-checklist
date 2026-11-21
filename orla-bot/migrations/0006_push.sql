-- Avisos no celular (Web Push) do DPI: inscrições, caixa de mensagens (o aviso chega sem conteúdo e o aparelho busca aqui) e o que já foi enviado.
CREATE TABLE IF NOT EXISTS push_keys (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  uid TEXT NOT NULL,                 -- conta Bungie.net
  dmi TEXT, dmt INTEGER,             -- conta de Destiny principal (para ver exóticos que faltam)
  discord_user_id TEXT,              -- quando registrou o Discord: avisos das grades
  prefs TEXT NOT NULL DEFAULT '{"grade":1,"xur":1}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_push_subs_discord ON push_subs (discord_user_id);
CREATE TABLE IF NOT EXISTS push_inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL, tag TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_push_inbox_ep ON push_inbox (endpoint);
CREATE TABLE IF NOT EXISTS push_sent (k TEXT PRIMARY KEY, at TEXT NOT NULL);
