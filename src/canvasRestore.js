const kept = new Set();

function redraw(entry) {
  const canvas = entry.texture.image;
  const ctx = canvas.getContext('2d');
  if (!ctx || ctx.isContextLost?.()) return;
  if (ctx.reset) ctx.reset();
  else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  entry.paint(ctx);
  entry.texture.needsUpdate = true;
}

export function keepCanvas(texture, paint) {
  const entry = { texture, paint };
  kept.add(entry);
  texture.image.addEventListener?.('contextrestored', () => redraw(entry));
  texture.addEventListener('dispose', () => kept.delete(entry));
  return texture;
}

export function redrawCanvases() {
  for (const entry of kept) redraw(entry);
}
