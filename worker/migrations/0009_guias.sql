-- Página /guias (só o dono): ajustes por atividade que substituem o padrão do site.
-- k = "lnk:<tipo>:<chave>" (vídeos), "img:<tipo>:<chave>" (imagens) ou "enc:<tipo>:<chave>" (guia por encontro); v = JSON
CREATE TABLE IF NOT EXISTS gde (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL,
  at INTEGER NOT NULL
);
