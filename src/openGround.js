const CELL = 2;

export function createOpenGround({ bounds, heightAt, allowed = () => true }) {
  const cells = [];
  for (let x = bounds.x0; x < bounds.x1; x += CELL) {
    for (let z = bounds.z0; z < bounds.z1; z += CELL) {
      const cx = x + CELL / 2;
      const cz = z + CELL / 2;
      const ground = heightAt(cx, cz);
      if (ground != null && allowed(cx, ground, cz)) cells.push({ x, z });
    }
  }

  function pickFrom(list, rand, accept) {
    for (let tries = 0; tries < 24 && list.length; tries++) {
      const cell = list[Math.floor(rand() * list.length)];
      const x = cell.x + rand() * CELL;
      const z = cell.z + rand() * CELL;
      const ground = heightAt(x, z);
      if (ground == null || !allowed(x, ground, z) || !accept(x, z)) continue;
      return { x, y: ground, z };
    }
    return null;
  }

  return {
    area: cells.length * CELL * CELL,
    heightAt,
    pick(rand = Math.random, accept = () => true) {
      return pickFrom(cells, rand, accept);
    },
    zoned(center, radius, sectors) {
      const turn = Math.PI * 2;
      const of = (x, z) => {
        const dx = x - center.x;
        const dz = z - center.z;
        if (Math.hypot(dx, dz) < radius) return 0;
        return 1 + (Math.floor(((Math.atan2(dz, dx) + turn + Math.PI / sectors) % turn) / (turn / sectors)) % sectors);
      };
      const groups = Array.from({ length: sectors + 1 }, () => []);
      for (const cell of cells) groups[of(cell.x + CELL / 2, cell.z + CELL / 2)].push(cell);
      return {
        ids: groups.flatMap((group, id) => (group.length ? [id] : [])),
        of,
        pick: (id, rand = Math.random, accept = () => true) => pickFrom(groups[id] ?? [], rand, accept),
      };
    },
  };
}
