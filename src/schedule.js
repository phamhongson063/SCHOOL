const STORAGE_KEY = 'truong-lang-xua.schedule';
const MIN = 0.5;
const MAX = 180;

const valid = (value) => Number.isFinite(value) && value >= MIN && value <= MAX;

export class Schedule {
  constructor() {
    this.classMinutes = 10;
    this.breakMinutes = 5;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved && valid(saved.classMinutes) && valid(saved.breakMinutes)) {
        this.classMinutes = saved.classMinutes;
        this.breakMinutes = saved.breakMinutes;
      }
    } catch {}
    this.phase = 'class';
    this.elapsed = 0;
    this.listeners = [];
  }

  get duration() {
    return (this.phase === 'class' ? this.classMinutes : this.breakMinutes) * 60;
  }

  get remaining() {
    return Math.max(0, this.duration - this.elapsed);
  }

  onChange(listener) {
    this.listeners.push(listener);
  }

  update(dt) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.advance();
  }

  advance() {
    this.phase = this.phase === 'class' ? 'break' : 'class';
    this.elapsed = 0;
    for (const listener of this.listeners) listener(this.phase);
  }

  setMinutes(classMinutes, breakMinutes) {
    if (!valid(classMinutes) || !valid(breakMinutes)) return false;
    this.classMinutes = classMinutes;
    this.breakMinutes = breakMinutes;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ classMinutes, breakMinutes }));
    } catch {}
    if (this.elapsed >= this.duration) this.advance();
    return true;
  }
}
