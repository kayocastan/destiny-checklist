-- nomes de definições da Bungie, compartilhados (chave: tipo:idioma:hash)
CREATE TABLE IF NOT EXISTS defs (k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL);
-- dados sincronizados de cada pessoa (uid = id da conta Bungie)
CREATE TABLE IF NOT EXISTS kv (uid TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (uid, k));
-- resumo (SHA-256) do token de login -> conta, por 50 minutos
CREATE TABLE IF NOT EXISTS tok (h TEXT PRIMARY KEY, uid TEXT NOT NULL, exp INTEGER NOT NULL);
