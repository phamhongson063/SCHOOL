export class Seats {
  constructor(list) {
    this.list = list;
  }

  at(point) {
    return this.list.find((s) => Math.abs(point.x - s.x) <= 0.55 && point.z >= s.z - 0.85 && point.z <= s.z + 0.6) ?? null;
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
