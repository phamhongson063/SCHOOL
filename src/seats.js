export class Seats {
  constructor(list) {
    this.list = list;
  }

  at(point) {
    return (
      this.list.find((s) => {
        const facing = s.facing ?? Math.PI;
        const fx = Math.sin(facing);
        const fz = Math.cos(facing);
        const dx = point.x - s.x;
        const dz = point.z - s.z;
        const ahead = dx * fx + dz * fz;
        const across = dx * fz - dz * fx;
        return Math.abs(across) <= 0.55 && ahead >= -0.6 && ahead <= 0.85;
      }) ?? null
    );
  }

  canTake(seat, who) {
    return !seat.occupant || seat.occupant === who;
  }

  isFreeFor(seat, who) {
    return this.canTake(seat, who) && (!seat.reservedBy || seat.reservedBy === who);
  }

  nearestFree(position, who, accept = () => true) {
    let best = null;
    let bestD = Infinity;
    for (const seat of this.list) {
      if (!this.isFreeFor(seat, who) || !accept(seat)) continue;
      const d = Math.hypot(seat.x - position.x, seat.z - position.z);
      if (d < bestD) {
        bestD = d;
        best = seat;
      }
    }
    return best;
  }

  reserve(seat, who) {
    seat.reservedBy = who;
  }

  unreserve(seat, who) {
    if (seat && seat.reservedBy === who) seat.reservedBy = null;
  }

  occupy(seat, who) {
    const displaced = seat.reservedBy && seat.reservedBy !== who ? seat.reservedBy : null;
    seat.occupant = who;
    seat.reservedBy = null;
    return displaced;
  }

  vacate(seat, who) {
    if (seat && seat.occupant === who) seat.occupant = null;
  }
}
