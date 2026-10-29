/* Formato resumido das definições da Bungie, igual ao que o site guarda no navegador.
   Usado pelo servidor (buscas sob demanda) e pela rotina que pré-carrega o manifesto. */
export function compact(type, d) {
  const v = { n: d.displayProperties?.name || d.name || '', d: d.displayProperties?.description || '', ql: d.setData?.questLineName || '', il: (d.setData?.itemList || []).map(x => x.itemHash), b: d.inventory?.bucketTypeHash || 0, it: d.itemType || 0, tl: d.itemTypeDisplayName || '', su: d.inventory?.stackUniqueLabel || '', ob: d.objectives?.objectiveHashes || [], lh: d.locationHash || 0, lr: (d.locationReleases || []).map(r => [r.destinationHash || 0, r.activityHash || 0]).slice(-1)[0] || null, ic: d.displayProperties?.icon || '', tt: d.inventory?.tierType || 0, dt: d.talentGrid?.hudDamageType || 0 };
  if (type === 'DestinyInventoryItemDefinition') Object.assign(v, { pc: d.plug?.plugCategoryIdentifier || '', st: d.itemSubType || 0, tr: (d.traitIds || []).includes('item.plug.aspect') ? 'a' : (d.traitIds || []).includes('item.plug.fragment') ? 'f' : '', x: { a: d.equippingBlock?.ammoType || 0, s: d.equippingBlock?.equipableItemSetHash || 0, c: d.collectibleHash || 0 } });
  return v;
}

// conjunto de armadura já com os bônus resolvidos; perk(hash) devolve a definição do bônus (DestinySandboxPerkDefinition)
export function compactSet(d, perk) {
  return { n: d.displayProperties?.name || '', perks: (d.setPerks || []).map(p => { const sp = perk(p.sandboxPerkHash); return sp ? { c: p.requiredSetCount, n: sp.displayProperties?.name || '', d: sp.displayProperties?.description || '', ic: sp.displayProperties?.icon || '' } : null; }).filter(Boolean).sort((a, b) => a.c - b.c) };
}
