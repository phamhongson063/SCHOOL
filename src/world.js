const PASSABLE = new Set(['water']);

export class VoxelWorld {
  constructor() {
    this.cells = new Map();
    this.layers = new Map();
  }

  set(x, y, z, type, layer = 'main') {
    const key = `${x},${y},${z}`;
    if (!type) {
      this.cells.delete(key);
      this.layers.delete(key);
      return;
    }
    this.cells.set(key, type);
    if (layer === 'main') this.layers.delete(key);
    else this.layers.set(key, layer);
  }

  get(x, y, z) {
    return this.cells.get(`${x},${y},${z}`);
  }

  fill(x0, y0, z0, x1, y1, z1, type, layer) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, type, layer);
      }
    }
  }

  isSolid(x, y, z) {
    const type = this.get(x, y, z);
    if (type === undefined) return y < 0;
    return !PASSABLE.has(type);
  }

  blocksView(x, y, z, hiddenLayers) {
    const key = `${x},${y},${z}`;
    const type = this.cells.get(key);
    if (type === undefined) return y < 0;
    if (PASSABLE.has(type)) return false;
    return !hiddenLayers.has(this.layers.get(key) ?? 'main');
  }
}
