-- "Popular no clã": perks das armas equipadas pelos membros (lidas 1x por dia; vale o que cada um usou nos últimos 14 dias)
CREATE TABLE IF NOT EXISTS croll (
  g TEXT NOT NULL,      -- id do clã
  mid TEXT NOT NULL,    -- membro
  h INTEGER NOT NULL,   -- arma (item hash)
  p TEXT NOT NULL,      -- perks encaixados, separados por vírgula
  t INTEGER NOT NULL,   -- quando foi visto
  PRIMARY KEY (g, mid, h)
);
CREATE INDEX IF NOT EXISTS ix_croll_g ON croll (g, h);
