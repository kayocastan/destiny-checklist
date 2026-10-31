-- sugestões enviadas pela página de novidades (sem IP: só um resumo do dia para limitar envios)
CREATE TABLE IF NOT EXISTS sug (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, txt TEXT NOT NULL, name TEXT, uid TEXT, ipd TEXT, rd INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS sug_ipd ON sug (ipd);
