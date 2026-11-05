-- Missões exóticas no catálogo (sem histórico de conclusões: a Bungie só é consultada para incursão/masmorra).
-- O grupo "xm:<chave>" é a mesma chave das missões exóticas do DPI (data/defs.json), para imagem e guias na agenda.
INSERT OR IGNORE INTO curated_bungie_activities (id, name, "type", eligibility_group)
VALUES
    (1000, 'Missão exótica: //nodo.AVALON//', 'Exotic Mission', 'xm:avalon'),
    (1001, 'Missão exótica: Bis', 'Exotic Mission', 'xm:encore'),
    (1002, 'Missão exótica: Hora Zero', 'Exotic Mission', 'xm:zero'),
    (1003, 'Missão exótica: O Sussurro', 'Exotic Mission', 'xm:whisper'),
    (1004, 'Missão exótica: Presságio', 'Exotic Mission', 'xm:presage'),
    (1005, 'Missão exótica: Vox Obscura', 'Exotic Mission', 'xm:vox'),
    (1006, 'Missão exótica: Operação: Escudo de Serafim', 'Exotic Mission', 'xm:seraph'),
    (1007, 'Missão exótica: Entre Estrelas', 'Exotic Mission', 'xm:star'),
    (1008, 'Missão exótica: Destino Duplo', 'Exotic Mission', 'xm:dual'),
    (1009, 'Missão exótica: A Queda de Kell', 'Exotic Mission', 'xm:kell'),
    (1010, 'Missão exótica: Fogo e Gelo', 'Exotic Mission', 'xm:fire'),
    (1011, 'Missão exótica: Heliostato', 'Exotic Mission', 'xm:helio'),
    (1012, 'Missão exótica: Desrealização', 'Exotic Mission', 'xm:dereal'),
    (1013, 'Missão exótica: Oblation: Bloodline', 'Exotic Mission', 'xm:oblation');
