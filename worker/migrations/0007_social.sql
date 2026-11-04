-- Clã › Administração › Quem joga com quem: leituras de 15 em 15 min (por dia, horário de Brasília)
-- soc_on: quantas leituras o membro estava online (n) e quantas estava com alguém do clã no esquadrão (wc)
CREATE TABLE IF NOT EXISTS soc_on (g TEXT NOT NULL, mid TEXT NOT NULL, d TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, wc INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (g, mid, d));
-- soc_pair: quantas leituras a dupla (a < b) estava no mesmo esquadrão
CREATE TABLE IF NOT EXISTS soc_pair (g TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, d TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (g, a, b, d));
