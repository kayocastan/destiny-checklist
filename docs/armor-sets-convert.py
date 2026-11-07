import csv, io, json, re, sys
src = open(sys.argv[1], encoding='utf-8').read()
def sheet(name):
    m = re.search(r'## Sheet name: ' + re.escape(name) + r'\n(.*?)(?=\n## Sheet name: |\Z)', src, re.S)
    return list(csv.reader(io.StringIO(m.group(1))))
sets = []
for r in sheet('Armour Sets')[3:]:
    if len(r) < 11 or not r[0].strip() or r[0].startswith(('Important', 'Spreadsheet')): continue
    sets.append({'set': r[0].strip(), 'b2': {'name': r[1], 'desc': r[2], 'num': r[3], 'rating': r[4]}, 'b4': {'name': r[5], 'desc': r[6], 'num': r[7], 'rating': r[8]}, 'source': r[9], 'sourceType': r[10]})
arch = {}
bc = sheet('Backend Calculation'); hdr = None
for r in bc:
    if len(r) > 7 and r[2] == 'Health' and r[3] == 'Melee': hdr = r[2:8]; continue
    if hdr and len(r) > 7 and r[1] and r[2].isdigit(): arch[r[1]] = {k: int(v) for k, v in zip(hdr, r[2:8]) if int(v)}
    elif hdr and arch and not r[1:2] == ['']: pass
    if hdr and len(arch) >= 12: break
ex = []
for r in sheet('Exotics')[2:]:
    if len(r) >= 3 and r[0] in ('Hunter', 'Titan', 'Warlock'): ex.append({'class': r[0], 'slot': r[1], 'name': r[2], 'perk': r[3] if len(r) > 3 else '', 'desc': r[4] if len(r) > 4 else ''})
seen = set(); ex = [e for e in ex if not ((e['class'], e['name']) in seen or seen.add((e['class'], e['name'])))]
out = {'_source': 'Planilha Armor Set Bonuses (We Chosen Few; créditos LowCo + Azra; números do Destiny Data Compendium). Notas são subjetivas.', 'archetypes': arch, 'sets': sets, 'exotics': ex}
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print(len(sets), 'sets', len(arch), 'archetypes', len(ex), 'exotics')
