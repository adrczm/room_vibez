// Pure helpers for products placed in the room (UX-09 host part, UX-16 step 2).
// No DOM and no three.js, so they are unit-tested on their own: tests/unit/placedProducts.test.ts.
// main.ts owns the state and the wiring; nothing here reads or writes it.
import { copy, fmt } from './copy';
import { resolveBindings } from './viewer/slots';
import type { MaterialsLibrary, Product } from './viewer/types';

// ---------------------------------------------------------------------------------------------
// Rows of the Products list (UX-09 item 2)
// ---------------------------------------------------------------------------------------------

/** The parts of a room-graph placement the list needs. */
export interface PlacementLike {
  id: string;
  product_id: string;
  sku_id: string;
}

/** One row of the Products list. */
export interface PlacementRow {
  id: string;
  /** The product's name, or the placement's SKU when the product is not in the catalog. */
  name: string;
  /** 1 for the first placement with this name in the list, 2 for the second, and so on. */
  n: number;
  /** What the row shows and what messages call it: "Lounge chair 2". */
  label: string;
  /** False when the placement's product is not in the catalog (an uploaded model after a refresh). */
  inCatalog: boolean;
}

/**
 * Name every placement, in list order: the product's name and a number, counted per name
 * ("Lounge chair 1", "Lounge chair 2", "Side table 1"). Counting per name, not per product id,
 * keeps two rows from ever reading the same when two products share a name.
 * The numbers are positions in the list: after a row is deleted, the rows behind it move up.
 */
export function placementRows(
  placements: readonly PlacementLike[],
  products: readonly Pick<Product, 'id' | 'name'>[],
): PlacementRow[] {
  const seen = new Map<string, number>();
  return placements.map((pl) => {
    const product = products.find((p) => p.id === pl.product_id);
    const name = product?.name ?? pl.sku_id;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return { id: pl.id, name, n, label: fmt(copy.notInDeck.placedProducts.row, { name, n }), inCatalog: !!product };
  });
}

// ---------------------------------------------------------------------------------------------
// Moving and turning a selected product (UX-09 item 3)
// ---------------------------------------------------------------------------------------------

/** One arrow-key step, in metres (UX-09 item 3: 5 cm). */
export const NUDGE_STEP_M = 0.05;
/** One arrow-key step with Shift held, in metres (UX-09 item 3: 25 cm). */
export const NUDGE_BIG_STEP_M = 0.25;

/**
 * The room axis each arrow key moves along. The axes are the room's own, the ones the 2D plan in
 * the panel is drawn on (x to the right, z down), not the screen's: the host cannot ask the engine
 * where the camera is. In the view a room opens in (camera at +x, +z), Right moves a product to
 * the right and nearer, Down nearer and to the left, Left and Up the opposite ways. Once the user
 * has orbited to the far side of the room, the keys run against what the screen shows.
 */
const NUDGE_AXES: Record<string, { x: number; z: number }> = {
  ArrowLeft: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
  ArrowUp: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: 1 },
};

/** Positions are stepped many times; trim the float noise each step leaves (0.1 + 0.05). */
const trim = (v: number) => Number(v.toFixed(6));

/** True for the four keys that move a selected product. */
export function isNudgeKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(NUDGE_AXES, key);
}

/**
 * Where a product at `position` stands after one press of an arrow key, or null for any other key.
 * `big` is Shift. Only the floor point changes; whether the new point is allowed (inside the
 * room) is the caller's check.
 */
export function nudgedPosition(
  position: { x: number; z: number },
  key: string,
  big = false,
): { x: number; z: number } | null {
  if (!isNudgeKey(key)) return null;
  const axis = NUDGE_AXES[key]!;
  const step = big ? NUDGE_BIG_STEP_M : NUDGE_STEP_M;
  return { x: trim(position.x + axis.x * step), z: trim(position.z + axis.z * step) };
}

/**
 * A quarter turn about the vertical axis. 'left' is counter-clockwise seen from above (the
 * direction three.js counts `rotation.y` in), 'right' is clockwise. The result is wrapped into
 * (-π, π], so the stored angle does not grow with every turn.
 */
export function quarterTurn(rotationY: number, direction: 'left' | 'right'): number {
  const turned = rotationY + (direction === 'left' ? Math.PI / 2 : -Math.PI / 2);
  const wrapped = turned - 2 * Math.PI * Math.ceil((turned - Math.PI) / (2 * Math.PI));
  // A full circle back to "unturned" should read 0, not 2e-16.
  return Math.abs(wrapped) < 1e-12 ? 0 : wrapped;
}

// ---------------------------------------------------------------------------------------------
// The finish a product is placed with (UX-16 step 2)
// ---------------------------------------------------------------------------------------------

/** What the Materials card currently holds: the product on the turntable and its slot choices. */
export interface ShownFinish {
  /** Id of the product the choices belong to (the turntable's), if one is loaded. */
  productId: string | undefined;
  slots: readonly { def: { id: string }; materialId: string }[];
}

/**
 * The `slot_bindings` a product is placed with: one entry per slot the catalog defines for it.
 * The choices on the Materials card are used when they belong to this product. They do not while
 * another product is still loading onto the turntable; the product then gets its default finish,
 * which is also what the card will show for it once it has loaded.
 * A choice the library no longer has, or one the slot does not allow, falls back to the default.
 */
export function finishForPlacing(
  product: Pick<Product, 'id' | 'slots'>,
  shown: ShownFinish | null | undefined,
  library?: MaterialsLibrary,
): Record<string, string> {
  const chosen: Record<string, string> = {};
  if (shown && shown.productId === product.id) {
    for (const slot of shown.slots) chosen[slot.def.id] = slot.materialId;
  }
  return resolveBindings(product, chosen, library).bindings;
}
