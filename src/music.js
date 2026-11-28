import { musicBus, musicEnabled, onAudio, onMusicToggle, streamTrack } from './audio.js';

const VOLUME = 0.25;
const FADE = 2.5;
const RELEASE_AFTER = (FADE + 0.2) * 1000;

export class Music {
  constructor(path) {
    this.path = path;
    this.ctx = null;
    this.gain = null;
    this.track = null;
    this.wanted = false;
    this.releaseTimer = null;
    onAudio((ctx) => {
      this.ctx = ctx;
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(musicBus(ctx));
      this.apply();
    });
    onMusicToggle(() => this.apply());
  }

  set(on) {
    if (on === this.wanted) return;
    this.wanted = on;
    this.apply();
  }

  apply() {
    const ctx = this.ctx;
    if (!ctx) return;
    clearTimeout(this.releaseTimer);
    const on = this.wanted && musicEnabled();
    if (on && !this.track) {
      this.track = streamTrack(ctx, this.path);
      this.track.node.connect(this.gain);
      this.track.play();
    }
    const now = ctx.currentTime;
    const level = this.gain.gain;
    level.cancelScheduledValues(now);
    level.setValueAtTime(level.value, now);
    level.linearRampToValueAtTime(on ? VOLUME : 0, now + FADE);
    if (!on && this.track) this.releaseTimer = setTimeout(() => this.release(), RELEASE_AFTER);
  }

  release() {
    this.track?.release();
    this.track = null;
  }
}
