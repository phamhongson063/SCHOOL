const CELL = 4;
const OFFSET = 4096;
const SPAN = 8192;
const MAX_CELLS = 96;

const keyOf = (ix, iz) => (ix + OFFSET) * SPAN + (iz + OFFSET);

export class ObstacleGrid {
  constructor(list) {
    this.list = list;
    this.count = -1;
    this.version = -1;
    this.cells = new Map();
    this.wide = [];
  }

  sync() {
    const list = this.list;
    const version = list.version ?? 0;
    if (list.length === this.count && version === this.version) return;
    this.count = list.length;
    this.version = version;
    this.cells.clear();
    this.wide.length = 0;
    for (const box of list) {
      const x0 = Math.floor(box.minX / CELL);
      const x1 = Math.floor(box.maxX / CELL);
      const z0 = Math.floor(box.minZ / CELL);
      const z1 = Math.floor(box.maxZ / CELL);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > MAX_CELLS) {
        this.wide.push(box);
        continue;
      }
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const key = keyOf(ix, iz);
          const bucket = this.cells.get(key);
          if (bucket) bucket.push(box);
          else this.cells.set(key, [box]);
        }
      }
    }
  }

  some(minX, minZ, maxX, maxZ, test) {
    this.sync();
    for (const box of this.wide) if (test(box)) return true;
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const bucket = this.cells.get(keyOf(ix, iz));
        if (!bucket) continue;
        for (const box of bucket) if (test(box)) return true;
      }
    }
    return false;
  }
}
