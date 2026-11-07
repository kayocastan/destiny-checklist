-- Presença nas grades: depois que a atividade acontece, o bot confere no histórico da Bungie se cada titular jogou.
ALTER TABLE grade_hist ADD COLUMN checked_at TEXT;
ALTER TABLE grade_hist_p ADD COLUMN played INTEGER; -- 1 jogou, 0 não jogou, NULL não deu para saber / não conferido
