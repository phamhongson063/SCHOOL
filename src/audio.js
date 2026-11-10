let ctx = null;
const waiting = [];

function wake() {
  if (!ctx) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    ctx = new Context();
    for (const fn of waiting.splice(0)) fn(ctx);
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
}

window.addEventListener('pointerdown', wake);
window.addEventListener('keydown', wake);
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else ctx.resume();
});

export function onAudio(fn) {
  if (ctx) fn(ctx);
  else waiting.push(fn);
}

export async function loadClip(ctx, urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {}
  }
  return null;
}
