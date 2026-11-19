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
  };
}
