-- Erros de JavaScript vistos pelos visitantes (para achar telas em branco); guarda só os últimos 300
CREATE TABLE IF NOT EXISTS errs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  t INTEGER NOT NULL,
  m TEXT NOT NULL,   -- mensagem + começo da pilha
  v TEXT,            -- página / aba
  ua TEXT            -- navegador (resumido)
);
