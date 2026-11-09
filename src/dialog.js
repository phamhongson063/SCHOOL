function outside(dialog, event) {
  const box = dialog.getBoundingClientRect();
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
}

export function closable(dialog) {
  for (const button of dialog.querySelectorAll('.sched-x')) button.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && outside(dialog, event)) dialog.close();
  });
}
