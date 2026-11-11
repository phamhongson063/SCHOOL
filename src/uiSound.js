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

  onAudio(async (context) => {
    ctx = context;
    out = ctx.createGain();
    out.gain.value = VOLUME;
    out.connect(ctx.destination);
    [close, click, correct, wrong] = await Promise.all([
      loadClip(ctx, ['assets/sfx/close.ogg', 'assets/sfx/close.m4a']),
      loadClip(ctx, ['assets/sfx/click.ogg', 'assets/sfx/click.m4a']),
      loadClip(ctx, ['assets/sfx/correct.ogg', 'assets/sfx/correct.m4a']),
      loadClip(ctx, ['assets/sfx/wrong.ogg', 'assets/sfx/wrong.m4a']),
    ]);
  });

  function play(clip) {
    if (!ctx || !clip || ctx.state !== 'running') return;
    const source = ctx.createBufferSource();
    source.buffer = clip;
    source.connect(out);
    source.start();
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
  };
}
