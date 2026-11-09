export const CHUNK_SIZE = 32;

const chunkKey = (cx, cz) => `${cx},${cz}`;
const chunkAt = (x, z) => [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];

export function inside(bounds, x, z) {
  return x >= bounds.x0 && x <= bounds.x1 && z >= bounds.z0 && z <= bounds.z1;
}

function chunksCovering({ x0, z0, x1, z1 }) {
  const [cx0, cz0] = chunkAt(x0, z0);
  const [cx1, cz1] = chunkAt(x1, z1);
  const keys = [];
  for (let cz = cz0; cz <= cz1; cz++) {
    for (let cx = cx0; cx <= cx1; cx++) keys.push(chunkKey(cx, cz));
  }
  return keys;
}

const EMPTY_HANDLE = { group: null, clickables: [], obstacles: [], update: null, dispose: null };

export class RegionManager {
  constructor({ scene, obstacles, radius = 3, generate = null }) {
    this.scene = scene;
    this.obstacles = obstacles;
    this.radius = radius;
    this.generate = generate;
    this.regions = [];
    this.chunks = new Map();
    this.centerKey = null;
    this.active = null;
    this.onChange = null;
    this.onLoad = null;
    this.onUnload = null;
  }

  add(region) {
    region.handle = null;
    this.regions.push(region);
    if (region.obstacles?.length) this.addObstacles(region.obstacles);
    for (const key of chunksCovering(region.bounds)) {
      const list = this.chunks.get(key);
      if (list) list.push(region);
      else this.chunks.set(key, [region]);
    }
    if (region.pinned) this.load(region);
    return region;
  }

  load(region) {
    if (region.handle) return;
    region.handle = { ...EMPTY_HANDLE, ...(region.load?.() ?? {}) };
    if (region.handle.group) this.scene.add(region.handle.group);
    if (region.handle.obstacles.length) this.addObstacles(region.handle.obstacles);
    this.onLoad?.(region);
  }

  unload(region) {
    const handle = region.handle;
    if (!handle || region.pinned) return;
    if (handle.group) this.scene.remove(handle.group);
    if (handle.obstacles.length) this.removeObstacles(handle.obstacles);
    handle.dispose?.();
    region.handle = null;
    this.onUnload?.(region);
  }

  addObstacles(boxes) {
    this.obstacles.push(...boxes);
    this.obstacles.version = (this.obstacles.version ?? 0) + 1;
  }

  removeObstacles(boxes) {
    for (const box of boxes) {
      const i = this.obstacles.indexOf(box);
      if (i >= 0) this.obstacles.splice(i, 1);
    }
    this.obstacles.version = (this.obstacles.version ?? 0) + 1;
  }

  async warmUp(compile) {
    const cold = this.regions.filter((region) => !region.handle);
    for (const region of cold) this.load(region);
    try {
      await compile();
    } finally {
      for (const region of cold) this.unload(region);
    }
  }

  regionsAround(cx, cz, radius) {
    const found = new Set();
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const key = chunkKey(cx + dx, cz + dz);
        if (!this.chunks.has(key) && this.generate) {
          const region = this.generate(cx + dx, cz + dz, CHUNK_SIZE);
          if (region) this.add(region);
          else this.chunks.set(key, null);
        }
        for (const region of this.chunks.get(key) ?? []) found.add(region);
      }
    }
    return found;
  }

  stream(x, z) {
    const [cx, cz] = chunkAt(x, z);
    const key = chunkKey(cx, cz);
    if (key === this.centerKey) return;
    this.centerKey = key;
    for (const region of this.regionsAround(cx, cz, this.radius)) this.load(region);
    const keep = this.regionsAround(cx, cz, this.radius + 1);
    for (const region of this.regions) {
      if (region.handle && !keep.has(region)) this.unload(region);
    }
  }

  regionAt(x, z) {
    for (const region of this.regions) {
      if (region.handle && inside(region.bounds, x, z)) return region;
    }
    return null;
  }

  regionOf(object) {
    for (const region of this.regions) {
      const group = region.handle?.group;
      if (!group) continue;
      for (let node = object; node; node = node.parent) {
        if (node === group) return region;
      }
    }
    return null;
  }

  get clickables() {
    return this.regions.flatMap((region) => region.handle?.clickables ?? []);
  }

  update(t, dt, position) {
    this.stream(position.x, position.z);
    for (const region of this.regions) region.handle?.update?.(t, dt);
    const active = this.regionAt(position.x, position.z);
    if (active === this.active) return;
    this.active = active;
    this.onChange?.(active);
  }
}
