-- builds compartilhadas por link curto (/b/<código>): uma foto da build no momento em que foi compartilhada
CREATE TABLE IF NOT EXISTS pub (c TEXT PRIMARY KEY, v TEXT NOT NULL, uid TEXT NOT NULL, sig TEXT NOT NULL, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS pub_uid ON pub (uid, sig);
