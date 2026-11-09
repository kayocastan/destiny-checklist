-- Histórico da página /guias: cada gravação guarda a versão anterior (para voltar atrás)
CREATE TABLE IF NOT EXISTS gde_h (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  k TEXT NOT NULL,
  v TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_gde_h_k ON gde_h (k, at);
