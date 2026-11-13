import { loadClip, onAudio } from './audio.js';

const VOLUME = 0.5;
const CLOSE_BUTTONS = '.sched-x, .lesson-close';
const BUTTONS = 'button, [role="button"]';

export function createUiSounds() {
  let ctx = null;
  let out = null;
  let close = null;
  let click = null;
  let correct = null;
  let wrong = null;
  let pop = null;

  onAudio(async (context) => {
    ctx = context;
    out = ctx.createGain();
    out.gain.value = VOLUME;
    out.connect(ctx.destination);
    [close, click, correct, wrong, pop] = await Promise.all([
      loadClip(ctx, ['assets/sfx/close.ogg', 'assets/sfx/close.m4a']),
      loadClip(ctx, ['assets/sfx/click.ogg', 'assets/sfx/click.m4a']),
      loadClip(ctx, ['assets/sfx/correct.ogg', 'assets/sfx/correct.m4a']),
      loadClip(ctx, ['assets/sfx/wrong.ogg', 'assets/sfx/wrong.m4a']),
      loadClip(ctx, ['assets/sfx/pop.ogg', 'assets/sfx/pop.m4a']),
    ]);
  });

  function play(clip) {
    if (!ctx || !clip || ctx.state !== 'running') return;
    const source = ctx.createBufferSource();
    source.buffer = clip;
    source.connect(out);
    source.start();
  }

  function gong() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const body = ctx.createGain();
    body.gain.setValueAtTime(0.0001, now);
    body.gain.exponentialRampToValueAtTime(0.9, now + 0.02);
    body.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    body.connect(out);
    for (const [ratio, level] of [
      [1, 0.6],
      [1.47, 0.35],
      [2.09, 0.25],
      [2.76, 0.15],
      [3.9, 0.08],
    ]) {
      const tone = ctx.createOscillator();
      const gain = ctx.createGain();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(98 * ratio, now);
      tone.frequency.exponentialRampToValueAtTime(92 * ratio, now + 3);
      gain.gain.value = level;
      tone.connect(gain).connect(body);
      tone.start(now);
      tone.stop(now + 3.3);
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.(BUTTONS);
    if (!button) return;
    play(button.matches(CLOSE_BUTTONS) ? close : click);
  });

  return {
    click: () => play(click),
    correct: () => play(correct),
    wrong: () => play(wrong),
    pop: () => play(pop),
    gong,
  };
}
