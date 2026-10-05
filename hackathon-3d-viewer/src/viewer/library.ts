import type { LibraryMaterial, MaterialsLibrary, PartsList, Product, SlotDefinition, SlotState } from './types';

export function materialsForSlot(library: MaterialsLibrary, slot: SlotDefinition): LibraryMaterial[] {
  return library.materials.filter((m) => slot.allowedCategories.includes(m.category));
}

export function findMaterial(library: MaterialsLibrary, id: string): LibraryMaterial | undefined {
  return library.materials.find((m) => m.id === id);
}

/** Validate catalog ↔ library consistency. Returns human-readable problems (empty = OK). */
export function validateProduct(product: Product, library: MaterialsLibrary): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const slot of product.slots) {
    if (seen.has(slot.id)) problems.push(`${product.id}: duplicate slot "${slot.id}"`);
    seen.add(slot.id);
    const def = findMaterial(library, slot.default);
    if (!def) problems.push(`${product.id}/${slot.id}: default material "${slot.default}" not in library`);
    else if (!slot.allowedCategories.includes(def.category))
      problems.push(`${product.id}/${slot.id}: default "${slot.default}" (${def.category}) not in allowed ${slot.allowedCategories.join(',')}`);
    if (materialsForSlot(library, slot).length === 0) problems.push(`${product.id}/${slot.id}: no library materials match`);
  }
  return problems;
}

export function buildPartsList(product: Product, library: MaterialsLibrary, slots: SlotState[], now = new Date()): PartsList {
  return {
    stub: true,
    productId: product.id,
    productSku: product.sku,
    parts: slots.map((s) => {
      const mat = findMaterial(library, s.materialId);
      return {
        slotId: s.def.id,
        slotLabel: s.def.label,
        materialId: s.materialId,
        materialName: mat?.name ?? 'Unknown',
        materialSku: mat?.sku ?? 'Unknown',
        meshCount: s.meshCount,
      };
    }),
    generatedAt: now.toISOString(),
  };
}
