const MAX_STEP = 0.55;
const BODY_RADIUS = 0.3;
const GOAL_RADIUS = 12;
const FAR_GOAL_RADIUS = 40;
const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

class MinHeap {
  constructor() {
    this.nodes = [];
    this.keys = [];
  }

  get size() {
    return this.nodes.length;
  }

  clear() {
    this.nodes.length = 0;
    this.keys.length = 0;
  }

  push(node, key) {
    const { nodes, keys } = this;
    let i = nodes.length;
    nodes.push(node);
    keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      nodes[i] = nodes[parent];
      keys[i] = keys[parent];
      i = parent;
    }
    nodes[i] = node;
    keys[i] = key;
  }

  pop() {
    const { nodes, keys } = this;
    const top = nodes[0];
    const node = nodes.pop();
    const key = keys.pop();
    const n = nodes.length;
    if (n === 0) return top;
    let i = 0;
    while (true) {
      const left = i * 2 + 1;
      if (left >= n) break;
      const child = left + 1 < n && keys[left + 1] < keys[left] ? left + 1 : left;
      if (keys[child] >= key) break;
      nodes[i] = nodes[child];
      keys[i] = keys[child];
      i = child;
    }
    nodes[i] = node;
    keys[i] = key;
    return top;
  }
}

function surface(world, bx, bz) {
  for (let y = -2; y <= 3; y++) {
    if (!world.isSolid(bx, y - 1, bz) || world.isSolid(bx, y, bz) || world.isSolid(bx, y + 1, bz)) continue;
    return world.get(bx, y, bz) === 'water' ? null : y;
  }
  return null;
}

export class NavGrid {
  constructor(world, collides, bounds, { cell = 0.5, surfaceAt = null, blocked = null } = {}) {
    this.world = world;
    this.collides = collides;
    this.blocked = blocked;
    this.surfaceAt = surfaceAt;
    this.cell = cell;
    this.x0 = bounds.x0;
    this.z0 = bounds.z0;
    this.w = Math.round((bounds.x1 - bounds.x0) / cell);
    this.d = Math.round((bounds.z1 - bounds.z0) / cell);
    this.heights = new Float32Array(this.w * this.d).fill(NaN);
    const total = this.w * this.d;
    this.gScore = new Float32Array(total);
    this.cameFrom = new Int32Array(total);
    this.seen = new Uint32Array(total);
    this.closed = new Uint32Array(total);
    this.searchId = 0;
    this.marks = new Uint32Array(total);
    this.markId = 0;
    this.marking = 0;
    this.heap = new MinHeap();
    this.bake(bounds);
  }

  bake({ x0, z0, x1, z1 }) {
    const { cell } = this;
    const i0 = Math.max(0, Math.floor((x0 - this.x0) / cell));
    const j0 = Math.max(0, Math.floor((z0 - this.z0) / cell));
    const i1 = Math.min(this.w, Math.ceil((x1 - this.x0) / cell));
    const j1 = Math.min(this.d, Math.ceil((z1 - this.z0) / cell));
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        const x = this.x0 + (i + 0.5) * cell;
        const z = this.z0 + (j + 0.5) * cell;
        const n = j * this.w + i;
        this.heights[n] = NaN;
        const y = this.surfaceAt?.(x, z) ?? surface(this.world, Math.floor(x), Math.floor(z));
        if (y === null || Number.isNaN(y)) continue;
        if (!this.collides({ x, y, z }) || (!this.collides({ x, y: y + 1, z }) && !this.blocked?.({ x, y, z }))) this.heights[n] = y;
      }
    }
    this.components = this.label();
  }

  walkable(n) {
    return n >= 0 && !Number.isNaN(this.heights[n]) && (this.marking === 0 || this.marks[n] !== this.marking);
  }

  markBlockers(boxes) {
    if (++this.markId >= 0xfffffff0) {
      this.marks.fill(0);
      this.markId = 1;
    }
    const { cell } = this;
    for (const box of boxes) {
      const i0 = Math.max(0, Math.floor((box.minX - this.x0) / cell));
      const j0 = Math.max(0, Math.floor((box.minZ - this.z0) / cell));
      const i1 = Math.min(this.w - 1, Math.floor((box.maxX - this.x0) / cell));
      const j1 = Math.min(this.d - 1, Math.floor((box.maxZ - this.z0) / cell));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) this.marks[j * this.w + i] = this.markId;
      }
    }
    this.marking = this.markId;
  }

  canStep(a, b) {
    return this.walkable(a) && this.walkable(b) && Math.abs(this.heights[a] - this.heights[b]) <= MAX_STEP;
  }

  cellIndex(x, z) {
    const i = Math.floor((x - this.x0) / this.cell);
    const j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.w || j >= this.d) return -1;
    return j * this.w + i;
  }

  heightAt(x, z) {
    const n = this.cellIndex(x, z);
    return this.walkable(n) ? this.heights[n] : null;
  }

  center(n) {
    const i = n % this.w;
    const j = (n - i) / this.w;
    return { x: this.x0 + (i + 0.5) * this.cell, y: this.heights[n], z: this.z0 + (j + 0.5) * this.cell };
  }

  forEachNeighbor(cur, fn) {
    const i = cur % this.w;
    const j = (cur - i) / this.w;
    for (const [di, dj, cost] of DIRS) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= this.w || nj >= this.d) continue;
      const n = nj * this.w + ni;
      if (!this.canStep(cur, n)) continue;
      if (di && dj && (!this.canStep(cur, j * this.w + ni) || !this.canStep(cur, nj * this.w + i))) continue;
      fn(n, cost);
    }
  }

  label() {
    const comp = new Int32Array(this.heights.length).fill(-1);
    const queue = new Int32Array(this.heights.length);
    let id = 0;
    for (let s = 0; s < comp.length; s++) {
      if (comp[s] !== -1 || !this.walkable(s)) continue;
      let head = 0;
      let tail = 0;
      queue[tail++] = s;
      comp[s] = id;
      while (head < tail) {
        this.forEachNeighbor(queue[head++], (n) => {
          if (comp[n] !== -1) return;
          comp[n] = id;
          queue[tail++] = n;
        });
      }
      id++;
    }
    return comp;
  }

  nearest(x, z, radius, comp = -1) {
    const ci = Math.floor((x - this.x0) / this.cell);
    const cj = Math.floor((z - this.z0) / this.cell);
    let best = -1;
    let bestD = Infinity;
    for (let dj = -radius; dj <= radius; dj++) {
      for (let di = -radius; di <= radius; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= this.w || j >= this.d) continue;
        const n = j * this.w + i;
        if (!this.walkable(n)) continue;
        if (comp >= 0 && this.components[n] !== comp) continue;
        const d = di * di + dj * dj;
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
    }
    return best;
  }

  search(start, goal) {
    if (this.searchId >= 0xfffffff0) {
      this.seen.fill(0);
      this.closed.fill(0);
      this.searchId = 0;
    }
    const id = ++this.searchId;
    const g = this.gScore;
    const came = this.cameFrom;
    const seen = this.seen;
    const closed = this.closed;
    const heap = this.heap;
    heap.clear();
    const gi = goal % this.w;
    const gj = (goal - gi) / this.w;
    const estimate = (c) => {
      const i = c % this.w;
      const dx = Math.abs(i - gi);
      const dz = Math.abs((c - i) / this.w - gj);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };

    seen[start] = id;
    g[start] = 0;
    came[start] = -1;
    heap.push(start, estimate(start));
    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) break;
      if (closed[cur] === id) continue;
      closed[cur] = id;
      this.forEachNeighbor(cur, (n, cost) => {
        if (closed[n] === id) return;
        const next = g[cur] + cost;
        if (seen[n] !== id || next < g[n]) {
          seen[n] = id;
          g[n] = next;
          came[n] = cur;
          heap.push(n, next + estimate(n));
        }
      });
    }

    if (start !== goal && seen[goal] !== id) return null;
    const cells = [goal];
    while (cells[cells.length - 1] !== start) cells.push(came[cells[cells.length - 1]]);
    return cells.reverse();
  }

  bodyClear(x, z) {
    const i0 = Math.floor((x - BODY_RADIUS - this.x0) / this.cell);
    const i1 = Math.floor((x + BODY_RADIUS - this.x0) / this.cell);
    const j0 = Math.floor((z - BODY_RADIUS - this.z0) / this.cell);
    const j1 = Math.floor((z + BODY_RADIUS - this.z0) / this.cell);
    if (i0 < 0 || j0 < 0 || i1 >= this.w || j1 >= this.d) return false;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) if (!this.walkable(j * this.w + i)) return false;
    }
    return true;
  }

  clear(a, b) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return true;
    const steps = Math.ceil(len / 0.2);
    let prev = this.cellIndex(a.x, a.z);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = a.x + dx * t;
      const z = a.z + dz * t;
      const n = this.cellIndex(x, z);
      if (!this.walkable(n) || !this.bodyClear(x, z)) return false;
      if (n !== prev && this.walkable(prev) && !this.canStep(prev, n)) return false;
      prev = n;
    }
    return true;
  }

  smooth(points) {
    const out = [];
    let anchor = 0;
    while (anchor < points.length - 1) {
      let next = anchor + 1;
      for (let k = anchor + 2; k < points.length; k++) {
        if (!this.clear(points[anchor], points[k])) break;
        next = k;
      }
      out.push(points[next]);
      anchor = next;
    }
    return out;
  }

  findPath(from, to, blockers = null) {
    if (blockers?.length) {
      this.markBlockers(blockers);
      const path = this.route(from, to);
      this.marking = 0;
      if (path) return path;
    }
    return this.route(from, to);
  }

  route(from, to) {
    const start = this.nearest(from.x, from.z, 4);
    if (start < 0) return null;
    const comp = this.components[start];
    let goal = this.nearest(to.x, to.z, GOAL_RADIUS, comp);
    if (goal < 0) goal = this.nearest(to.x, to.z, FAR_GOAL_RADIUS, comp);
    if (goal < 0) return null;
    const cells = this.search(start, goal);
    if (!cells) return null;

    const exact = this.cellIndex(to.x, to.z) === goal && this.bodyClear(to.x, to.z);
    const end = exact ? { x: to.x, y: this.heights[goal], z: to.z } : this.center(goal);
    const points = [{ x: from.x, y: from.y, z: from.z }, ...cells.slice(1, -1).map((n) => this.center(n)), end];
    return this.smooth(points);
  }
}
