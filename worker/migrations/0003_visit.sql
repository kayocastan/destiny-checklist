-- acessos únicos por dia: um registro por visitante por dia (sem IP; id aleatório do navegador ou conta, ambos resumidos)
CREATE TABLE IF NOT EXISTS visit (d TEXT NOT NULL, v TEXT NOT NULL, u INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (d, v));
