/**
 * Undo/redo stack for RoomGraph ops (deep-clone snapshots).
 * Session-only — not persisted across reload.
 */

import { normalizeRoomGraph, type RoomGraph } from './roomGraph';

const MAX = 50;

export class RoomHistory {
  private past: RoomGraph[] = [];
  private future: RoomGraph[] = [];
  private current: RoomGraph | null = null;

  /** Replace tip without pushing (initial load / import that resets history). */
  reset(graph: RoomGraph | null): void {
    this.past = [];
    this.future = [];
    this.current = graph ? clone(graph) : null;
  }

  getCurrent(): RoomGraph | null {
    return this.current ? clone(this.current) : null;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Commit a new graph tip. Pushes previous tip onto undo stack when it differs.
   * Clears redo stack.
   */
  commit(next: RoomGraph | null): RoomGraph | null {
    const nextClone = next ? clone(next) : null;
    if (same(this.current, nextClone)) {
      return this.getCurrent();
    }
    if (this.current) {
      this.past.push(clone(this.current));
      if (this.past.length > MAX) this.past.shift();
    }
    this.future = [];
    this.current = nextClone;
    return this.getCurrent();
  }

  undo(): RoomGraph | null {
    if (!this.past.length) return this.getCurrent();
    if (this.current) this.future.push(clone(this.current));
    this.current = this.past.pop() ?? null;
    return this.getCurrent();
  }

  redo(): RoomGraph | null {
    if (!this.future.length) return this.getCurrent();
    if (this.current) this.past.push(clone(this.current));
    this.current = this.future.pop() ?? null;
    return this.getCurrent();
  }
}

function clone(graph: RoomGraph): RoomGraph {
  const n = normalizeRoomGraph(JSON.parse(JSON.stringify(graph)));
  if (!n) throw new Error('RoomHistory: failed to clone graph');
  return n;
}

function same(a: RoomGraph | null, b: RoomGraph | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
