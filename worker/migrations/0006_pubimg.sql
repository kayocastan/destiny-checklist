-- imagem de prévia (Discord/WhatsApp) de cada build pública, gerada no navegador de quem compartilhou
CREATE TABLE IF NOT EXISTS pubimg (c TEXT PRIMARY KEY, img BLOB NOT NULL, t INTEGER NOT NULL);
