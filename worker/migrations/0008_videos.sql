-- Vídeos de guia cadastrados pelo dono do site (página /videos): somam aos que já vêm no data/defs.json.
-- k = "raid:<chave>", "dg:<chave>" ou "xm:<chave>" (as mesmas chaves do defs.json)
CREATE TABLE IF NOT EXISTS vid (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  k TEXT NOT NULL,
  url TEXT NOT NULL,
  pt TEXT NOT NULL DEFAULT '',
  en TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_vid_k ON vid (k);
