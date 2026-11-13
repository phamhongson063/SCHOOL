export class SeatWaitlist {
  constructor(seats, halls) {
    this.seats = seats;
    this.lines = new Map(halls.map((hall) => [hall.deck, { spots: hall.waitSpots, look: hall.look, area: hall.area, entry: hall.entry, entries: [] }]));
  }

  inside(deck, position) {
    const area = this.lines.get(deck)?.area;
    if (!area) return true;
    return position.x >= area.x0 && position.x <= area.x1 && position.z >= area.z0 && position.z <= area.z1;
  }

  entry(deck) {
    return this.lines.get(deck)?.entry ?? null;
  }

  lineOf(who) {
    for (const [deck, line] of this.lines) {
      const entry = line.entries.find((e) => e.who === who);
      if (entry) return { deck, line, entry };
    }
    return null;
  }

  has(who) {
    return !!this.lineOf(who);
  }

  turnOf(who) {
    const found = this.lineOf(who);
    return found ? found.line.entries.indexOf(found.entry) + 1 : 0;
  }

  join(deck, who, { ready, take }) {
    const line = this.lines.get(deck);
    if (!line) return null;
    const current = this.lineOf(who);
    if (current?.deck === deck) return current.entry.spot;
    this.leave(who);
    if (line.entries.length >= line.spots.length) return null;
    const used = new Set(line.entries.map((e) => e.spot));
    const spot = line.spots.find((s) => !used.has(s));
    line.entries.push({ who, ready, take, spot });
    return spot;
  }

  hasRoom(deck) {
    const line = this.lines.get(deck);
    return !!line && line.entries.length < line.spots.length;
  }

  leave(who) {
    const found = this.lineOf(who);
    if (found) found.line.entries.splice(found.line.entries.indexOf(found.entry), 1);
  }

  look(deck) {
    return this.lines.get(deck)?.look ?? null;
  }

  canSit(seat, who, now) {
    return this.seats.restLeft(seat, who, now) <= 0;
  }

  openTo(seat, who, now) {
    if (seat.reservedBy && seat.reservedBy !== who) return false;
    const line = this.lines.get(seat.deck);
    if (!line) return true;
    for (const entry of line.entries) {
      if (entry.who === who) return true;
      if (entry.ready() && this.canSit(seat, entry.who, now)) return false;
    }
    return true;
  }

  update(now) {
    for (const [deck, line] of this.lines) {
      for (const entry of [...line.entries]) {
        if (!entry.ready()) {
          line.entries.splice(line.entries.indexOf(entry), 1);
          continue;
        }
        const seat = this.seats.nearestFree(entry.spot, entry.who, (s) => s.deck === deck && this.canSit(s, entry.who, now));
        if (!seat) continue;
        line.entries.splice(line.entries.indexOf(entry), 1);
        this.seats.reserve(seat, entry.who);
        entry.take(seat);
      }
    }
  }
}
